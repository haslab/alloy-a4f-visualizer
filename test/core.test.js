import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { serializePreferences } from '../src/preferences.js'
import {
    instanceToGraph,
    relationLabel,
    nodeLabel,
    replaceGraph,
    addGraph,
    createCytoscapeStyle,
    bindGraphInteractions,
    createTraceController,
    createTraceControls,
    createProjectionController,
    normalizeInstance,
    normalizeDocument,
    createVisualizerState,
    createThemeState,
    createPositionStore,
    applyLayout,
    projectInstance
} from '../src/index.js'

describe('Alloy visualizer core', function() {
    it('converts Alloy instances into graph data', function() {
        const graph = instanceToGraph({
            types: [{ name: 'Person', parent: 'univ', atoms: ['Person$0', 'Person$1'] }],
            sets: [{ name: 'Student', atoms: ['Person$0'] }],
            rels: [{ name: 'knows', atoms: [['Person$0', 'Person$1']] }]
        })
        assert.equal(graph.nodes.length, 2)
        assert.deepEqual(graph.nodes[0].data.subsetSigs, ['Student:Person'])
        assert.equal(graph.edges[0].data.parent_sig, 'Person')
    })

    it('derives labels without application state', function() {
        assert.equal(relationLabel({ relation: 'visits', atoms: ['A', 'Room', 'Day', 'B'] }), 'visits [Room,Day]')
        assert.equal(nodeLabel({ id: 'A', subsetSigs: ['S:A'] }, 'r: B'), 'A\n(S)\nr: B')
    })

    it('manages graph replacement and additions', function() {
        const calls = []
        const renderer = {
            elements: () => ['old'],
            remove: value => calls.push(['remove', value]),
            add: value => calls.push(['add', value]),
            resize: () => calls.push(['resize'])
        }
        replaceGraph(renderer, { nodes: ['n'], edges: ['e'] })
        addGraph(renderer, { nodes: ['n2'], edges: ['e2'] })
        assert.deepEqual(calls, [
            ['remove', ['old']], ['add', ['n']], ['add', ['e']], ['resize'],
            ['add', ['n2']], ['add', ['e2']]
        ])
    })

    it('creates an injectable Cytoscape stylesheet', function() {
        const style = createCytoscapeStyle({
            getInheritedAtomColor: () => 'red', getInheritedAtomBorder: () => 'solid',
            getInheritedAtomShape: () => 'ellipse', getInheritedAtomVisibility: () => false
        }, {
            getAttributeLabel: () => '', getEdgeColor: () => 'blue', getEdgeLabel: () => 'r',
            getEdgeStyle: () => 'solid', isShowAsArcsOn: () => true
        })
        assert.equal(style.length, 6)
        assert.equal(style[0].selector, 'node')
        assert.equal(style[1].selector, 'edge')
    })

    it('uses legible foregrounds and borders in the dark appearance', function() {
        const dark = createCytoscapeStyle({
            getInheritedAtomColor: () => 'green', getInheritedAtomBorder: () => 'solid',
            getInheritedAtomShape: () => 'ellipse', getInheritedAtomVisibility: () => false
        }, {
            getAttributeLabel: () => '', getEdgeColor: () => 'blue', getEdgeLabel: () => 'r',
            getEdgeStyle: () => 'solid', isShowAsArcsOn: () => true
        }, 'dark')
        assert.equal(dark[0].style.color, '#f3f4f6')
        assert.equal(dark[0].style['border-color'], '#e5e7eb')
        assert.equal(dark[1].style.color, '#f3f4f6')
    })

    it('binds generic renderer interactions', function() {
        const bindings = []
        bindGraphInteractions({ on: (...args) => bindings.push(args) }, {})
        assert.deepEqual(bindings.map(binding => binding[0]), ['cxttap', 'tap', 'render'])
    })

    it('navigates trace states and follows the loop', function() {
        const changes = []
        const controller = createTraceController({ onChange: (state, index) => changes.push([state, index]) })
        controller.setTrace({ states: ['s0', 's1', 's2'], loop: 1 })
        assert.equal(controller.current(), 's0')
        assert.equal(controller.next(), 's1')
        assert.equal(controller.next(), 's2')
        assert.equal(controller.next(), 's1')
        assert.equal(controller.previous(), 's0')
        assert.deepEqual(changes, [['s0', 0], ['s1', 1], ['s2', 2], ['s1', 1], ['s0', 0]])
    })

    it('does not wrap backwards and rejects invalid state indices', function() {
        const controller = createTraceController()
        controller.setTrace({ states: ['s0', 's1'], loop: -1 })
        controller.previous()
        assert.equal(controller.index(), 0)
        assert.throws(() => controller.setIndex(2), RangeError)
    })

    it('notifies subscribers when trace state changes', function() {
        const changes = []
        const controller = createTraceController()
        const unsubscribe = controller.subscribe((state, index) => changes.push([state, index]))
        controller.setTrace({ states: ['s0', 's1'], loop: -1 })
        controller.next()
        unsubscribe()
        controller.previous()
        assert.deepEqual(changes, [['s0', 0], ['s1', 1]])
    })

    it('requires a DOM container for trace controls', function() {
        assert.throws(() => createTraceControls(), TypeError)
    })

    it('manages projection assignments without an API dependency', function() {
        const changes = []
        const requests = []
        const controller = createProjectionController({
            project: state => requests.push(state),
            onChange: state => changes.push(state)
        })
        controller.addType('A', 'A$0')
        controller.addType('B', 'B$2')
        controller.selectNext('A', ['A$0', 'A$1'])
        controller.selectPrevious('B', ['B$0', 'B$1', 'B$2'])
        controller.removeType('A')
        controller.request()
        assert.deepEqual(controller.snapshot(), { assignments: { B: 'B$1' } })
        assert.deepEqual(requests, [{ assignments: { B: 'B$1' } }])
        assert.equal(changes.length, 5)
    })

    it('normalizes parents and preserves relation metadata', function() {
        const instance = normalizeInstance({
            types: [{ name: 'A', parents: [], atoms: [] }],
            sets: [{ name: 'S', parents: ['A', 'B'], atoms: ['A$0'] }],
            rels: [{ name: 'r', arity: 2, types: ['A', 'B'], atoms: [] }]
        })
        assert.deepEqual(instance.types[0].parents, [])
        assert.deepEqual(instance.sets[0].parents, ['A', 'B'])
        assert.deepEqual(instance.rels[0].types, ['A', 'B'])
        assert.equal(instance.rels[0].arity, 2)
    })

    it('accepts both canonical traces and Alloy4Fun execution responses', function() {
        const trace = normalizeDocument({ states: [{ types: [], sets: [], rels: [] }], loop: 0 })
        assert.equal(trace.states.length, 1)
        assert.equal(trace.loop, 0)

        const instance = normalizeDocument({ states: [{ types: [], sets: [], rels: [] }], loop: -1 })
        assert.equal(instance.states.length, 1)
        assert.equal(instance.loop, -1)
        assert.throws(() => normalizeDocument({ states: [], loop: -1 }), RangeError)
    })

    it('owns document, theme, position, and projection state independently of the host', function() {
        const visualizerState = createVisualizerState()
        visualizerState.setDocument({ states: [{ types: [], sets: [], rels: [] }], loop: -1 })
        visualizerState.setTheme({ sigSettings: { nodeColors: [] } })
        visualizerState.setPositions({ nodes: { 'A$0': { x: 10, y: 20 } } })
        visualizerState.setProjection({ assignments: { Person: 'Person$0' } })
        assert.equal(visualizerState.currentState(), 0)
        assert.equal(visualizerState.currentInstance().types.length, 0)
        assert.deepEqual(visualizerState.projection().assignments, { Person: 'Person$0' })
        assert.deepEqual(visualizerState.projectedInstance().types, [])
    })

    it('owns persistent theme settings without application globals', function() {
        const theme = createThemeState()
        theme.setHierarchy({
            metaPrimSigs: [{ type: 'univ', parent: null }, { type: 'Person', parent: 'univ' }],
            metaSubsetSigs: []
        })
        theme.updateAtomColor('Person', '#ff0000')
        theme.updateAtomShape('Person', 'ellipse')
        theme.getEdgeColor('Person<:visits')
        theme.updateEdgeColor('Person<:visits', '#00ff00')
        assert.equal(theme.getInheritedAtomColor('Person'), '#ff0000')
        assert.equal(theme.getEdgeColor('Person<:visits'), '#00ff00')
        assert.equal(theme.getLayout(), 'breadthfirst')
        assert.equal(theme.snapshot().sigSettings.nodeColors.find(setting => setting.type === 'Person').color, '#ff0000')
        theme.isShowAsAttributesOn('Person<:visits')
        theme.updateShowAsAttributes('Person<:visits', true)
        assert.equal(theme.getAttributeLabel({ id: 'Person$0' }, [{ source: 'Person$0', parent_sig: 'Person', relation: 'visits', atoms: ['Person$0', 'Room$0'] }]), 'visits: Room$0\n')
    })

    it('serializes preferences in the existing model-theme format without projection state', function() {
        const settings = {
            sigSettings: { nodeColors: [{ type: 'Person', color: '#ff0000' }] },
            relationSettings: { edgeColors: [] },
            generalSettings: { currentLayout: 'circle' }
        }
        const positions = { Person0: { x: 12, y: 34 } }
        assert.deepEqual(serializePreferences(settings, positions), {
            ...settings,
            nodePositions: positions
        })
    })

    it('loads and updates legacy relation settings keyed by bare field names', function() {
        const theme = createThemeState()
        theme.init({
            relationSettings: {
                edgeColors: [{ relation: 'visits', color: '#ff0000' }],
                edgeStyles: [{ relation: 'visits', edgeStyle: 'dashed' }],
                showAsAttributes: [{ relation: 'visits', showAsAttributes: true }],
                showAsArcs: [{ relation: 'visits', showAsArcs: false }]
            }
        })
        const relation = { parent_sig: 'Person', relation: 'visits' }

        assert.equal(theme.getEdgeColor(relation), '#ff0000')
        assert.equal(theme.getEdgeStyle(relation), 'dashed')
        assert.equal(theme.isShowAsAttributesOn(relation), true)
        assert.equal(theme.isShowAsArcsOn(relation), false)

        theme.updateEdgeColor(relation, '#00ff00')
        assert.deepEqual(theme.snapshot().relationSettings.edgeColors, [
            { relation: 'visits', color: '#00ff00' }
        ])
    })

    it('preserves Alloy4Fun theme defaults, hierarchy, and hidden-element behavior', function() {
        const theme = createThemeState()
        theme.setHierarchy({
            metaPrimSigs: [{ type: 'univ', parent: null }, { type: 'Person', parent: 'univ' }],
            metaSubsetSigs: [{ type: 'Student', parent: 'Person' }]
        })
        assert.equal(theme.getAtomColor('Student'), 'inherit')
        assert.equal(theme.getInheritedAtomColor('Student'), '#2ECC40')
        assert.equal(theme.getSigParent('Student'), 'Person')
        assert.equal(theme.hasSubsetSig('Student'), true)
        theme.addPrimSig('Room', 'univ')
        theme.addSubSig('Guest', 'Person')
        assert.equal(theme.getSigParent('Guest'), 'Person')
        assert.equal(theme.hasSubsetSig('Guest'), true)

        theme.updateAtomVisibility('Person', true)
        assert.deepEqual(theme.getAllHiddenAtoms(), ['Person'])
        theme.isShowAsArcsOn('visits')
        theme.updateShowAsArcs('visits', false)
        assert.deepEqual(theme.getAllHiddenRels(), ['visits'])
        theme.resetHierarchy()
        assert.equal(theme.hasSubsetSig('Student'), false)
        assert.deepEqual(theme.getAllHiddenAtoms(), [])
    })

    it('captures and restores atom positions independently of the renderer', function() {
        const values = { A: { x: 10, y: 20 }, B: { x: 30, y: 40 } }
        const nodes = Object.entries(values).map(([id, position]) => ({
            data: () => ({ id }),
            position: next => next ? Object.assign(position, next) : position
        }))
        const renderer = {
            nodes: () => nodes,
            layout: () => undefined
        }
        const positions = createPositionStore()
        positions.capture(renderer)
        values.A.x = 0
        positions.apply(renderer)
        assert.equal(values.A.x, 10)
        applyLayout(renderer, { name: 'grid' }, positions)
        assert.deepEqual(positions.snapshot().B, { x: 30, y: 40 })
    })

    it('projects a state without mutating the source', function() {
        const source = {
            types: [
                { name: 'Person', parents: ['univ'], atoms: ['Person$0', 'Person$1'] },
                { name: 'Room', parents: ['univ'], atoms: ['Room$0'] }
            ],
            sets: [],
            rels: [
                { name: 'visits', arity: 2, types: ['Person', 'Room'], atoms: [['Person$0', 'Room$0']]},
                { name: 'knows', arity: 2, types: ['Person', 'Person'], atoms: [['Person$0', 'Person$1'], ['Person$1', 'Person$0']]}
            ]
        }
        const projected = projectInstance(source, { Person: 'Person$0' })
        assert.deepEqual(projected.types.map(type => type.name), ['Room'])
        assert.deepEqual(projected.rels, [])
        assert.deepEqual(projected.sets, [
            { name: 'visits', parents: ['Room'], atoms: ['Room$0'] },
            { name: 'knows', parents: ['Person'], atoms: ['Person$1'] }
        ])

        const otherProjection = projectInstance(source, { Person: 'Person$1' })
        assert.deepEqual(otherProjection.sets, [
            { name: 'visits', parents: ['Room'], atoms: [] },
            { name: 'knows', parents: ['Person'], atoms: ['Person$0'] }
        ])
        assert.equal(source.rels[0].atoms.length, 1)
    })
})
