import { iconMarkup } from './icons.js'

/**
 * Renders navigation controls for the states of one Alloy trace.
 *
 * The host remains responsible for rendering the selected state. The controls
 * only navigate the supplied trace controller and report the new state.
 */
export function createTraceControls(container, {
    controller,
    onChange,
    previousLabel = 'Previous trace state',
    nextLabel = 'Next trace state'
} = {}) {
    if (!container || !controller) throw new TypeError('A container and trace controller are required')

    const previous = document.createElement('button')
    previous.type = 'button'
    previous.className = 'cbutton alloy-trace-previous'
    previous.setAttribute('aria-label', previousLabel)
    previous.innerHTML = iconMarkup('arrow-left')

    const next = document.createElement('button')
    next.type = 'button'
    next.className = 'cbutton alloy-trace-next'
    next.setAttribute('aria-label', nextLabel)

    const current = document.createElement('div')
    current.className = 'alloy-trace-current'
    current.setAttribute('aria-live', 'polite')

    container.replaceChildren(previous, next, current)

    function render(state, index = controller.index()) {
        const hasState = controller.isTrace() && controller.length() > 0 && index >= 0
        container.hidden = !hasState
        previous.disabled = !controller.hasPrevious()
        next.disabled = !controller.hasNext()
        previous.hidden = !hasState
        next.hidden = !hasState
        current.hidden = !hasState
        current.textContent = hasState ? index : ''
        next.innerHTML = iconMarkup(controller.hasNext() && index === controller.length() - 1 ? 'undo' : 'arrow-right')
    }

    function navigate(action) {
        const state = action()
        if (onChange) onChange(state, controller.index())
    }

    previous.addEventListener('click', () => navigate(() => controller.previous()))
    next.addEventListener('click', () => navigate(() => controller.next()))
    const unsubscribe = controller.subscribe(render)
    render(controller.current(), controller.index())

    return {
        element: container,
        update: render,
        destroy() {
            unsubscribe()
            container.replaceChildren()
        }
    }
}
