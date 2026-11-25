/**
 * Owns projection assignments without calculating projected instances.
 *
 * An assignment maps a projected type name to the selected atom. The
 * projected instance is derived locally by projectInstance(). The optional
 * project callback is retained as a host notification hook, not as a source
 * of projection semantics.
 */
export function createProjectionController({ onChange, project } = {}) {
    let assignments = {}
    const listeners = new Set()
    if (onChange) listeners.add(onChange)

    function snapshot() {
        return { assignments: { ...assignments } }
    }

    function notify() {
        const state = snapshot()
        for (const listener of listeners) listener(state)
        return state
    }

    function validateAtom(atom) {
        if (typeof atom !== 'string' || atom.length === 0) {
            throw new TypeError('A projection assignment must select an atom name')
        }
    }

    function setProjection(nextAssignments = {}) {
        if (nextAssignments === null || typeof nextAssignments !== 'object' || Array.isArray(nextAssignments)) {
            throw new TypeError('Projection assignments must be an object')
        }
        assignments = {}
        for (const [type, atom] of Object.entries(nextAssignments)) {
            validateAtom(atom)
            assignments[type] = atom
        }
        return notify()
    }

    function addType(type, atom) {
        if (Object.prototype.hasOwnProperty.call(assignments, type)) {
            throw new Error(`${type} already being projected.`)
        }
        validateAtom(atom)
        assignments[type] = atom
        return notify()
    }

    function removeType(type) {
        if (!Object.prototype.hasOwnProperty.call(assignments, type)) {
            throw new Error(`${type} not found in types being projected.`)
        }
        delete assignments[type]
        return notify()
    }

    function setAtom(type, atom) {
        if (!Object.prototype.hasOwnProperty.call(assignments, type)) {
            throw new Error(`${type} not found in types being projected.`)
        }
        validateAtom(atom)
        assignments[type] = atom
        return notify()
    }

    function selectNext(type, atoms) {
        return selectRelative(type, atoms, 1)
    }

    function selectPrevious(type, atoms) {
        return selectRelative(type, atoms, -1)
    }

    function selectRelative(type, atoms, offset) {
        if (!Object.prototype.hasOwnProperty.call(assignments, type)) return snapshot()
        if (!Array.isArray(atoms) || atoms.length === 0) return snapshot()
        const current = atoms.indexOf(assignments[type])
        const next = current + offset
        if (current < 0 || next < 0 || next >= atoms.length) return snapshot()
        return setAtom(type, atoms[next])
    }

    function clear() {
        assignments = {}
        return notify()
    }

    function request() {
        return project ? project(snapshot()) : undefined
    }

    return {
        snapshot,
        setProjection,
        addType,
        removeType,
        setAtom,
        selectNext,
        selectPrevious,
        clear,
        request,
        subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        }
    }
}
