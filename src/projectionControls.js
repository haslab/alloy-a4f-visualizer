/**
 * Projection-frame controls for the currently assigned projected type.
 * The controller owns focused atoms; this view only reports and changes them.
 */
export function createProjectionControls(container, { controller, atomsForType } = {}) {
    if (!container || !controller || typeof atomsForType !== 'function') {
        throw new TypeError('A container, projection controller, and atom lookup are required')
    }

    const previous = document.createElement('button')
    previous.type = 'button'
    previous.id = 'previousFrame'
    previous.className = 'cbutton'
    previous.setAttribute('aria-label', 'Previous projection atom')
    previous.innerHTML = '<i class="cbutton__icon fa fa-fw fa-step-backward" aria-hidden="true"></i>'

    const target = document.createElement('select')
    target.className = 'framePickerTarget'
    target.setAttribute('aria-label', 'Projected type')

    const current = document.createElement('p')
    current.className = 'current-frame'
    current.setAttribute('aria-live', 'polite')

    const next = document.createElement('button')
    next.type = 'button'
    next.id = 'nextFrame'
    next.className = 'cbutton'
    next.setAttribute('aria-label', 'Next projection atom')
    next.innerHTML = '<i class="cbutton__icon fa fa-fw fa-step-forward" aria-hidden="true"></i>'

    container.classList.add('frame-navigation', 'row')
    container.replaceChildren(previous, target, current, next)

    function render() {
        const assignments = controller.snapshot().assignments
        const types = Object.keys(assignments)
        const selectedType = types.includes(target.value) ? target.value : types[0]
        target.replaceChildren(...types.map(type => {
            const option = document.createElement('option')
            option.value = type
            option.textContent = type
            option.selected = type === selectedType
            return option
        }))
        const visible = types.length > 0
        container.hidden = !visible
        if (!visible) {
            current.textContent = ''
            previous.disabled = true
            next.disabled = true
            return
        }

        const atoms = atomsForType(selectedType)
        const index = atoms.indexOf(assignments[selectedType])
        current.textContent = types.map(type => `${type}${atomsForType(type).indexOf(assignments[type])}`).join(',')
        previous.disabled = index <= 0
        next.disabled = index < 0 || index >= atoms.length - 1
    }

    target.addEventListener('change', render)
    previous.addEventListener('click', () => {
        controller.selectPrevious(target.value, atomsForType(target.value))
    })
    next.addEventListener('click', () => {
        controller.selectNext(target.value, atomsForType(target.value))
    })

    const unsubscribe = controller.subscribe(render)
    render()

    return {
        element: container,
        update: render,
        destroy() {
            unsubscribe()
            container.replaceChildren()
            container.hidden = true
        }
    }
}
