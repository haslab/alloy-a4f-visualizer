// Observe the real renderer in tests without extending the public component API.
export default function createRenderer(options) {
    const renderer = globalThis.cytoscape(options)
    globalThis.testGraph = renderer
    return renderer
}
