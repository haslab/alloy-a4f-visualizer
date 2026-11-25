import cytoscape from 'cytoscape'
import { bindGraphInteractions } from './graphInteractions.js'
import { addGraph, replaceGraph } from './graphRenderer.js'
import { createContextMenu } from './contextMenu.js'
import { createCytoscapeStyle } from './cytoscapeStyle.js'
import { createPositionStore, applyLayout, layouts } from './layout.js'
import { createThemeState } from './themeState.js'
import { createTraceController } from './traceController.js'
import { createTraceControls } from './traceControls.js'
import { createProjectionController } from './projectionController.js'
import { createProjectionControls } from './projectionControls.js'
import { isProjectableType } from './projectionEligibility.js'
import { projectInstance } from './instanceProjection.js'
import { instanceToGraph } from './graphModel.js'
import { createVisualizerState } from './visualizerState.js'
import { createInitialStateResolver, serializePreferences } from './preferences.js'

/**
 * Mounts the complete reusable visualizer canvas.
 *
 * Hosts provide documents and persistence/projection callbacks. The component
 * owns rendering, themes, context-menu behavior, trace navigation, layouts,
 * and atom positions.
 */
export function createVisualizer(container, {
    document: initialDocument,
    preferences,
    theme,
    positions,
    projection,
    onChange,
    onStateChange,
    onThemeChange,
    onProjectionChange,
    onPreferencesChange,
    onRender,
    onResetTheme,
    appearance = 'light'
} = {}) {
    if (!container) throw new TypeError('A visualizer container is required')

    container.classList.add('visualizer-graph')
    if (container.parentElement) container.parentElement.classList.add('visualizer-canvas')

    const themeState = createThemeState({ onChange: refreshGraph })
    const unsubscribeTheme = onThemeChange || onPreferencesChange
        ? themeState.subscribe(value => {
            if (onThemeChange) onThemeChange(value)
            if (onPreferencesChange) onPreferencesChange(getPreferences())
        })
        : undefined
    const positionStore = createPositionStore()
    if (positions || (preferences && preferences.nodePositions)) {
        positionStore.set(positions || preferences.nodePositions)
    }
    const visualizerState = createVisualizerState({ onChange })
    let settingDocument = false
    let hasDocument = false
    const resolveInitialState = createInitialStateResolver(preferences)
    let projectionControls
    const traceController = createTraceController({ onChange: (state, index) => {
        visualizerState.setCurrentState(index)
        // The full trace is laid out when its document is installed. State
        // navigation reuses those positions and the current viewport.
        if (!settingDocument) render(visualizerState.projectedInstance(), { layout: false })
        if (onStateChange) onStateChange(state, index)
    } })
    const projectionController = createProjectionController({ onChange: value => {
        visualizerState.setProjection(value)
        if (!settingDocument) {
            // Position restoration can move projected atoms after Cytoscape's
            // layout fit. Fit again after the layout completes so the reduced
            // graph and its restored coordinates are visible in the canvas.
            fitAfterLayout = true
            render(visualizerState.projectedInstance(), { layout: true })
        }
        if (projectionControls) projectionControls.update()
        if (onProjectionChange) onProjectionChange(value)
    } })
    const graph = cytoscape({ container, elements: [] })
    let currentLayout = 'breadthfirst'
    let currentAppearance = appearance === 'dark' ? 'dark' : 'light'
    let fitAfterLayout = false
    let documentGeneration = 0
    let layoutGeneration = 0
    let destroyed = false

    const contextMenu = createContextMenu({
        container: container.parentElement || globalThis.document.body,
        theme: themeState,
        onProject: addProjection,
        onResetProjection: resetProjection,
        onResetTheme: () => {
            themeState.reset()
            currentLayout = themeState.getLayout()
            projectionController.clear()
            if (onResetTheme) onResetTheme()
        },
        onLayout: layout => {
            currentLayout = layout
            applyCurrentLayout({ restorePositions: false })
        },
        onRefresh: refreshGraph,
        canProject: type => isProjectableType(visualizerState.currentInstance(), type)
            && atomsForType(type).length > 0
    })

    bindGraphInteractions(graph, {
        onBackgroundContext: event => {
            contextMenu.open({ kind: 'background', label: 'general' }, menuPosition(event))
            return false
        },
        onNodeContext: event => {
            const data = event.cyTarget.data()
            contextMenu.open({ kind: 'node', labels: [data.type].concat(data.subsetSigs || []) }, menuPosition(event))
            return false
        },
        onEdgeContext: event => {
            const data = event.cyTarget.data()
            contextMenu.open({ kind: 'edge', labels: [themeState.relationId(data)] }, menuPosition(event))
            return false
        },
        onEdgeTap: event => event.cyTarget.select(),
        onTap: () => contextMenu.hide(),
        onRender
    })

    function menuPosition(event) {
        const original = event.originalEvent || {}
        const parent = container.parentElement || globalThis.document.body
        const bounds = parent.getBoundingClientRect()
        const localX = (Number.isFinite(original.clientX) ? original.clientX : bounds.left) - bounds.left
        const localY = (Number.isFinite(original.clientY) ? original.clientY : bounds.top) - bounds.top
        return {
            left: localX + 1,
            top: localY + 1
        }
    }

    function refreshGraph() {
        const selected = graph.$(':selected')
        graph.elements().select().unselect()
        selected.select()
    }

    function hierarchyFor(graphData) {
        return {
            metaPrimSigs: graphData.signatures.filter(sig => !sig.subset).map(sig => ({ type: sig.name, parent: sig.parent })),
            metaSubsetSigs: graphData.signatures.filter(sig => sig.subset).map(sig => ({ type: sig.name, parent: sig.parent }))
        }
    }

    function atomsForType(type, instance = visualizerState.currentInstance()) {
        if (!instance) return []
        const entry = [...(instance.types || []), ...(instance.sets || [])]
            .find(candidate => candidate.name === type)
        return entry ? entry.atoms : []
    }

    function addProjection(type) {
        const atoms = atomsForType(type)
        if (isProjectableType(visualizerState.currentInstance(), type) && atoms.length > 0) {
            projectionController.addType(type, atoms[0])
        }
    }

    function resetProjection() {
        projectionController.clear()
    }

    function fitVisibleGraph(generation, layoutRun) {
        // Cytoscape can emit layoutstop before the host has finished applying
        // the canvas's new dimensions. Defer one frame, refresh renderer size,
        // then fit so the transform uses the actual viewport dimensions.
        requestAnimationFrame(() => {
            if (destroyed || generation !== documentGeneration || layoutRun !== layoutGeneration) return
            graph.resize()
            const visibleElements = graph.elements(':visible')
            if (visibleElements.length > 0) graph.fit(visibleElements, 20)
        })
    }

    function applyCurrentLayout({ restorePositions = true } = {}) {
        const document = visualizerState.currentDocument()
        const isTrace = document && document.loop >= 0
        const assignments = projectionController.snapshot().assignments
        const states = isTrace
            ? document.states.map(state => projectInstance(state, assignments))
            : [visualizerState.projectedInstance()]
        const stateGraphs = states.filter(Boolean).map(instanceToGraph)

        // Alloy4Fun computes trace layouts using the union of every state's
        // graph, so atoms first appearing later in the trace already have a
        // stable position when they become visible.
        if (document && document.loop >= 0) {
            const signatures = new Map()
            stateGraphs.forEach(stateGraph => stateGraph.signatures.forEach(signature => {
                signatures.set(`${signature.name}\u0000${signature.parent || ''}`, signature)
            }))
            const allSignatures = Array.from(signatures.values())
            themeState.setHierarchy({
                metaPrimSigs: allSignatures.filter(sig => !sig.subset).map(sig => ({ type: sig.name, parent: sig.parent })),
                metaSubsetSigs: allSignatures.filter(sig => sig.subset).map(sig => ({ type: sig.name, parent: sig.parent }))
            })
            graph.style(createCytoscapeStyle(themeState, themeState, currentAppearance))
            stateGraphs.forEach(stateGraph => addGraph(graph, stateGraph))
        }

        const layoutElements = graph.elements().filter((index, element) => element.visible())
        const shouldFit = fitAfterLayout
        fitAfterLayout = false
        const generation = documentGeneration
        const layoutRun = ++layoutGeneration

        if (isTrace) {
            if (layoutElements.length === 0) {
                const currentGraph = instanceToGraph(visualizerState.projectedInstance())
                themeState.setHierarchy(hierarchyFor(currentGraph))
                graph.style(createCytoscapeStyle(themeState, themeState, currentAppearance))
                replaceGraph(graph, currentGraph)
                return
            }
            // Keep the union of trace atoms in the renderer until layoutstop.
            // Fitting after removing future-state atoms would fit only the
            // current state's graph and can leave later atoms off-canvas.
            graph.one('layoutstop', () => {
                requestAnimationFrame(() => {
                    if (destroyed || generation !== documentGeneration || layoutRun !== layoutGeneration) return
                    graph.resize()
                    positionStore.capture(layoutElements)
                    if (shouldFit && layoutElements.length > 0) graph.fit(layoutElements, 20)

                    const currentGraph = instanceToGraph(visualizerState.projectedInstance())
                    themeState.setHierarchy(hierarchyFor(currentGraph))
                    graph.style(createCytoscapeStyle(themeState, themeState, currentAppearance))
                    replaceGraph(graph, currentGraph)
                    positionStore.apply(graph)
                })
            })
        } else if (shouldFit) {
            graph.one('layoutstop', () => fitVisibleGraph(generation, layoutRun))
        }
        applyLayout(layoutElements, layouts[currentLayout] || layouts.breadthfirst,
            restorePositions ? positionStore : undefined)
        if (!isTrace) positionStore.capture(layoutElements)
    }

    function render(instance = visualizerState.projectedInstance(), { layout = true, capturePositions = true } = {}) {
        if (!instance) return
        if (capturePositions && graph.nodes().length > 0) positionStore.capture(graph)
        const graphData = instanceToGraph(instance)
        themeState.setHierarchy(hierarchyFor(graphData))
        graph.style(createCytoscapeStyle(themeState, themeState, currentAppearance))
        replaceGraph(graph, graphData)
        if (layout) applyCurrentLayout()
        else positionStore.apply(graph)
    }

    function setDocument(nextDocument, initialIndex) {
        const replacingDocument = hasDocument
        hasDocument = true
        const selectedIndex = resolveInitialState(nextDocument, initialIndex)
        // A new instance/trace gets its own viewport transform after layout.
        // State changes inside the same trace use render() directly and keep
        // the current zoom and pan.
        documentGeneration += 1
        fitAfterLayout = true
        settingDocument = true
        try {
            if (replacingDocument) positionStore.clear()
            visualizerState.setDocument(nextDocument)
            traceController.setTrace(nextDocument, selectedIndex)
            const assignments = {}
            Object.keys(projectionController.snapshot().assignments).forEach(type => {
                const atoms = atomsForType(type)
                if (isProjectableType(visualizerState.currentInstance(), type) && atoms.length > 0) {
                    assignments[type] = atoms[0]
                }
            })
            projectionController.setProjection(assignments)
        } finally {
            settingDocument = false
        }
        render(visualizerState.projectedInstance(), { layout: true, capturePositions: false })
        return snapshot()
    }

    function setTheme(value) {
        themeState.init(value)
        currentLayout = themeState.getLayout()
        return themeState.snapshot()
    }

    function setAppearance(value) {
        if (value !== 'dark' && value !== 'light') throw new RangeError(`Unknown appearance: ${value}`)
        currentAppearance = value
        graph.style(createCytoscapeStyle(themeState, themeState, currentAppearance))
        return currentAppearance
    }

    function shareInstanceDocument() {
        const instance = visualizerState.currentInstance()
        return instance ? { states: [instance], loop: -1 } : undefined
    }

    function isEmpty() {
        return graph.nodes(':visible').length === 0
    }

    function capturePositions() {
        return positionStore.capture(graph)
    }

    function applyPositions() {
        return positionStore.apply(graph)
    }

    function clearPositions() {
        return positionStore.clear()
    }

    function refresh() {
        refreshGraph()
    }

    function snapshot() {
        return {
            document: visualizerState.currentDocument(),
            currentState: visualizerState.currentState(),
            theme: themeState.snapshot(),
            positions: positionStore.snapshot(),
            projection: visualizerState.projection()
        }
    }

    function getPreferences() {
        return serializePreferences(themeState.snapshot(), positionStore.snapshot())
    }

    // Controls are part of the standalone visualizer UI. Create their mount
    // points beside the graph rather than requiring host applications to
    // provide A4F-specific trace/projection slots.
    const controlsContainer = document.createElement('div')
    controlsContainer.className = 'alloy-visualizer-controls'
    const traceContainer = document.createElement('div')
    traceContainer.id = 'traceControls'
    const projectionContainer = document.createElement('div')
    projectionContainer.id = 'projectionControls'
    controlsContainer.append(traceContainer, projectionContainer)
    container.parentElement.insertBefore(controlsContainer, container)

    const traceControls = createTraceControls(traceContainer, { controller: traceController })
    projectionControls = createProjectionControls(projectionContainer, { controller: projectionController, atomsForType })

    function destroy() {
        destroyed = true
        contextMenu.hide()
        contextMenu.destroy()
        graph.destroy()
        if (unsubscribeTheme) unsubscribeTheme()
        if (traceControls) traceControls.destroy()
        if (projectionControls) projectionControls.destroy()
        controlsContainer.remove()
    }

    const initialTheme = theme || (preferences && preferences.sigSettings ? preferences : undefined)
    if (initialTheme) {
        themeState.init(initialTheme)
        currentLayout = themeState.getLayout()
    }
    const initialProjection = projection
    if (initialProjection) projectionController.setProjection(initialProjection.assignments || initialProjection)
    if (initialDocument) setDocument(initialDocument)

    return {
        theme: themeState,
        trace: traceController,
        projection: projectionController,
        setDocument,
        setTheme,
        setAppearance,
        snapshot,
        preferences: getPreferences,
        render,
        refresh,
        isEmpty,
        shareInstanceDocument,
        capturePositions,
        applyPositions,
        clearPositions,
        destroy
    }
}
