export function bindGraphInteractions(renderer, handlers) {
    renderer.on('cxttap', (event) => {
        const target = event.cyTarget
        if (target === renderer) return handlers.onBackgroundContext && handlers.onBackgroundContext(event)
        if (target.isNode && target.isNode()) return handlers.onNodeContext && handlers.onNodeContext(event)
        if (target.isEdge && target.isEdge()) return handlers.onEdgeContext && handlers.onEdgeContext(event)
        return undefined
    })
    renderer.on('tap', event => {
        const target = event.cyTarget
        if (target !== renderer && target.isEdge && target.isEdge()) {
            if (handlers.onEdgeTap) handlers.onEdgeTap(event)
        }
        if (handlers.onTap) handlers.onTap(event)
    })
    renderer.on('render', event => handlers.onRender && handlers.onRender(event))
}
