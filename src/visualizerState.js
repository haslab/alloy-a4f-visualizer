import { normalizeDocument } from './schema.js'
import { projectInstance } from './instanceProjection.js'

function copy(value) {
    if (value === undefined) return undefined
    return JSON.parse(JSON.stringify(value))
}

/**
 * Owns state that belongs to a visualizer instance rather than its host app.
 * It contains no DOM, Cytoscape, backend, or Alloy-specific dependencies.
 */
export function createVisualizerState({ onChange } = {}) {
    let document
    let currentState = 0
    let theme = {}
    let positions = {}
    let projection = {}
    const listeners = new Set()
    if (onChange) listeners.add(onChange)

    function snapshot() {
        return {
            document: copy(document),
            currentState,
            theme: copy(theme),
            positions: copy(positions),
            projection: copy(projection)
        }
    }

    function notify() {
        const value = snapshot()
        for (const listener of listeners) listener(value)
        return value
    }

    function setDocument(value) {
        document = normalizeDocument(value)
        currentState = Math.min(currentState, document.states.length - 1)
        if (currentState < 0) currentState = 0
        return notify()
    }

    function setCurrentState(index) {
        if (!document) throw new Error('A document must be set before selecting a state')
        if (!Number.isInteger(index) || index < 0 || index >= document.states.length) {
            throw new RangeError(`Invalid state index: ${index}`)
        }
        currentState = index
        return notify()
    }

    return {
        snapshot,
        setDocument,
        setCurrentState,
        currentDocument: () => copy(document),
        currentInstance: () => document && copy(document.states[currentState]),
        projectedInstance: () => document && projectInstance(document.states[currentState], projection.assignments || projection),
        currentState: () => currentState,
        setTheme(value) { theme = copy(value) || {}; return notify() },
        theme: () => copy(theme),
        setPositions(value) { positions = copy(value) || {}; return notify() },
        positions: () => copy(positions),
        setProjection(value) { projection = copy(value) || {}; return notify() },
        projection: () => copy(projection),
        subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        }
    }
}
