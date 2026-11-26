function clonePosition(position) {
    return { x: position.x, y: position.y }
}

// These are the layouts used by Alloy4Fun's visualizer.  Keep them as data
// here so hosts select the same Cytoscape layout, rather than getting a
// simplified replacement from the standalone wrapper.
export const layouts = {
    // Cytoscape 3 scales final positions by spacingFactor, after overlap
    // avoidance. The old 0.1 value compressed even correctly spaced nodes.
    // Do not enable the deprecated maximal/DAG adjustment: Alloy relations can
    // contain cycles and self-loops. Cytoscape 3 leaves null depth entries during
    // that adjustment and can throw while sorting them before cleanup.
    breadthfirst: { name: 'breadthfirst', avoidOverlap: true, padding: 10, directed: true, spacingFactor: 1 },
    cocentric: {
        name: 'concentric', fit: true, padding: 10, startAngle: 3 / 2 * Math.PI,
        clockwise: true, equidistant: false, minNodeSpacing: 10, avoidOverlap: true,
        concentric(node) { return node.degree() },
        levelWidth(nodes) { return nodes.maxDegree() / 4 }, animate: false
    },
    random: { name: 'random', fit: true, padding: 10, animate: false },
    circle: { name: 'circle', fit: true, padding: 30, avoidOverlap: true, startAngle: 3 / 2 * Math.PI, clockwise: true, animate: false },
    grid: {
        name: 'grid', fit: true, padding: 10, avoidOverlap: true, avoidOverlapPadding: 10,
        sort(a, b) { return a.data('label') < b.data('label') }, animate: false
    },
    cose: {
        name: 'cose', animate: true, animationThreshold: 250, refresh: 20, fit: true,
        padding: 30, componentSpacing: 100,
        nodeRepulsion() { return 400000 }, nodeOverlap: 10,
        idealEdgeLength() { return 10 }, edgeElasticity() { return 100 }, nestingFactor: 5,
        gravity: 80, numIter: 1000, initialTemp: 200, coolingFactor: 0.95,
        minTemp: 1, useMultitasking: true
    }
}

/** Stores atom coordinates independently of Cytoscape or an application. */
export function createPositionStore({ onChange } = {}) {
    let positions = {}
    const listeners = new Set()
    if (onChange) listeners.add(onChange)

    function snapshot() {
        return JSON.parse(JSON.stringify(positions))
    }

    function notify() {
        const value = snapshot()
        for (const listener of listeners) listener(value)
        return value
    }

    function set(nextPositions = {}) {
        positions = {}
        Object.entries(nextPositions).forEach(([id, position]) => {
            if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
                positions[id] = clonePosition(position)
            }
        })
        return notify()
    }

    function capture(renderer) {
        if (!renderer || typeof renderer.nodes !== 'function') throw new TypeError('A node renderer is required')
        renderer.nodes().forEach(node => {
            const data = typeof node.data === 'function' ? node.data() : {}
            const position = typeof node.position === 'function' ? node.position() : undefined
            if (data.id && position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
                // Keep coordinates for atoms absent from this state. They may
                // reappear in a later trace state and should return where they
                // were last seen, as in Alloy4Fun's accumulated position map.
                positions[data.id] = clonePosition(position)
            }
        })
        return notify()
    }

    function apply(renderer) {
        if (!renderer || typeof renderer.nodes !== 'function') throw new TypeError('A node renderer is required')
        renderer.nodes().forEach(node => {
            const data = typeof node.data === 'function' ? node.data() : {}
            if (data.id && positions[data.id] && typeof node.position === 'function') {
                node.position(clonePosition(positions[data.id]))
            }
        })
        return snapshot()
    }

    return {
        set,
        capture,
        apply,
        clear() { positions = {}; return notify() },
        snapshot,
        subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        }
    }
}

/**
 * Applies a renderer layout and restores known atom positions afterwards.
 * Cytoscape 2.x executes layout() immediately; newer adapters may return a
 * layout object requiring run(), so both renderer conventions are supported.
 */
export function applyLayout(renderer, options = {}, positionStore) {
    if (!renderer || typeof renderer.layout !== 'function') throw new TypeError('A layout-capable renderer is required')
    const layout = renderer.layout(options)
    // Cytoscape 2 runs layouts from layout(); newer Cytoscape versions return
    // a layout object. Supporting both is part of the portability boundary.
    if (layout && typeof layout.run === 'function') layout.run()
    if (positionStore) positionStore.apply(renderer)
    return layout
}
