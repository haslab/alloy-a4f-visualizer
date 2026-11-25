export function replaceGraph(renderer, graph) {
    renderer.remove(renderer.elements())
    renderer.add(graph.nodes)
    renderer.add(graph.edges)
    renderer.resize()
}

export function addGraph(renderer, graph) {
    renderer.add(graph.nodes)
    renderer.add(graph.edges)
}
