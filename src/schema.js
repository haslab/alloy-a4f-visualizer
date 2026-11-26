/** Normalize one visualizer state from the canonical visualizer shape. */
export function normalizeInstance(instance = {}) {
    requireObject(instance, 'state')
    for (const key of ['types', 'sets', 'rels']) {
        if (instance[key] !== undefined && !Array.isArray(instance[key])) {
            throw new TypeError(`state.${key} must be an array`)
        }
    }
    return {
        types: (instance.types || []).map(type => {
            const normalized = normalizeNode(type)
            if (normalized.parents.length > 1) throw new RangeError('A type can have at most one parent; use a subset for multiple parents')
            return normalized
        }),
        sets: (instance.sets || []).map(normalizeNode),
        rels: (instance.rels || []).map(relation => {
            requireObject(relation, 'relation')
            requireName(relation.name)
            if (relation.atoms !== undefined && (!Array.isArray(relation.atoms)
                || !relation.atoms.every(tuple => Array.isArray(tuple) && tuple.every(atom => typeof atom === 'string')))) {
                throw new TypeError('Relation atoms must be arrays of string tuples')
            }
            if (relation.types !== undefined) requireStrings(relation.types, 'relation.types')
            if (relation.arity !== undefined && (!Number.isInteger(relation.arity) || relation.arity < 0)) {
                throw new TypeError('Relation arity must be a non-negative integer')
            }
            const atoms = (relation.atoms || []).map(tuple => Array.isArray(tuple) ? tuple.slice() : tuple)
            const arity = relation.arity ?? atoms[0]?.length
            if (atoms.some(tuple => tuple.length !== arity)) throw new RangeError('Relation tuple lengths must match arity')
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
    requireObject(node, 'signature')
    requireName(node.name)
    if (node.atoms !== undefined) requireStrings(node.atoms, 'signature.atoms')
    if (node.parents !== undefined) requireStrings(node.parents, 'signature.parents')
    if (node.parent !== undefined && node.parent !== null && typeof node.parent !== 'string') {
        throw new TypeError('signature.parent must be a string or null')
    }
    const parents = Array.isArray(node.parents)
        ? node.parents
        : (node.parent && node.parent !== 'null' ? [node.parent] : [])
    return { ...node, parents: parents.slice(), atoms: (node.atoms || []).slice() }
}

/** Normalize the canonical instance/trace document. */
export function normalizeDocument(document = {}) {
    requireObject(document, 'document')
    if (!Array.isArray(document.states)) throw new TypeError('document.states must be an array')
    if (document.loop !== undefined && !Number.isInteger(document.loop)) {
        throw new TypeError('document.loop must be an integer')
    }
    const states = (document.states || []).map(normalizeInstance)
    const loop = Number.isInteger(document.loop) ? document.loop : -1
    if (loop < -1 || loop >= states.length) throw new RangeError(`Invalid loop index: ${loop}`)
    if (loop === -1 && states.length !== 1) {
        throw new RangeError('A non-trace document must contain exactly one state')
    }
    return { ...document, states, loop }
}

function requireObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
}

function requireName(value) {
    if (typeof value !== 'string' || value.length === 0) throw new TypeError('Signature and relation names must be non-empty strings')
}

function requireStrings(value, label) {
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        throw new TypeError(`${label} must be an array of strings`)
    }
}
