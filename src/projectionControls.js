/**
 * Per-type projection navigation. Each projected type owns an independent
 * focused-atom control; the controller remains the source of assignments.
 */
export function createProjectionControls(container, { controller, atomsForType } = {}) {
    if (!container || !controller || typeof atomsForType !== 'function') {
        throw new TypeError('A container, projection controller, and atom lookup are required')
    }

    container.classList.add('frame-navigation', 'row')

    function render() {
        const assignments = controller.snapshot().assignments
        const types = Object.keys(assignments)
        container.hidden = types.length === 0
        container.replaceChildren(...types.map(type => {
            const group = document.createElement('div')
            group.className = 'projection-type-control'
            group.setAttribute('role', 'group')
            group.setAttribute('aria-label', `Projection for ${type}`)

            const label = document.createElement('span')
            label.className = 'projection-type-label'
            label.textContent = type

            const atoms = atomsForType(type)
            const index = atoms.indexOf(assignments[type])
            const previous = document.createElement('button')
            previous.type = 'button'
            previous.className = 'cbutton projection-atom-button'
            previous.setAttribute('aria-label', `Previous ${type} atom`)
            previous.innerHTML = '<i class="cbutton__icon fa fa-fw fa-step-backward" aria-hidden="true"></i>'
            previous.disabled = index <= 0
            previous.addEventListener('click', () => controller.selectPrevious(type, atomsForType(type)))

            const atom = document.createElement('span')
            atom.className = 'projection-focused-atom'
            atom.setAttribute('aria-live', 'polite')
            atom.textContent = assignments[type]

            const next = document.createElement('button')
            next.type = 'button'
            next.className = 'cbutton projection-atom-button'
            next.setAttribute('aria-label', `Next ${type} atom`)
            next.innerHTML = '<i class="cbutton__icon fa fa-fw fa-step-forward" aria-hidden="true"></i>'
            next.disabled = index < 0 || index >= atoms.length - 1
            next.addEventListener('click', () => controller.selectNext(type, atomsForType(type)))

            group.append(label, previous, atom, next)
            return group
        }))
    }

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
