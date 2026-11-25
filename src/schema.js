/** Normalize one visualizer state from the canonical visualizer shape. */
export function normalizeInstance(instance = {}) {
    return {
        types: (instance.types || []).map(normalizeNode),
        sets: (instance.sets || []).map(normalizeNode),
        rels: (instance.rels || []).map(relation => {
            const atoms = (relation.atoms || []).map(tuple => Array.isArray(tuple) ? tuple.slice() : tuple)
            return {
                ...relation,
                arity: Number.isInteger(relation.arity) ? relation.arity : (atoms[0] ? atoms[0].length : undefined),
                types: relation.types ? relation.types.slice() : undefined,
                atoms
            }
        })
    }
}

function normalizeNode(node) {
    return { ...node, parents: (node.parents || []).slice(), atoms: (node.atoms || []).slice() }
}

/** Normalize the canonical instance/trace document. */
export function normalizeDocument(document = {}) {
    const states = (document.states || []).map(normalizeInstance)
    const loop = Number.isInteger(document.loop) ? document.loop : -1
    if (loop < -1 || loop >= states.length) throw new RangeError(`Invalid loop index: ${loop}`)
    if (loop === -1 && states.length !== 1) {
        throw new RangeError('A non-trace document must contain exactly one state')
    }
    return { ...document, states, loop }
}
