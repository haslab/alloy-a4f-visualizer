import { normalizeInstance } from './schema.js'

export function instanceToGraph(inst) {
    inst = normalizeInstance(inst)
    const nodes = []
    const edges = []
    const signatures = []
    const atomTypes = new Map()

    ;(inst.types || []).forEach((sig) => {
        const parents = sig.parents
        signatures.push({ name: sig.name, parent: parents[0] || null, parents })
        ;(sig.atoms || []).forEach((atom) => {
            atomTypes.set(atom, sig.name)
            nodes.push({
                group: 'nodes',
                classes: 'multiline-manual',
                data: { id: atom, type: sig.name, subsetSigs: [] }
            })
        })
    })

    ;(inst.sets || []).forEach((set) => {
        ;(set.atoms || []).forEach((atom) => {
            const node = nodes.find(candidate => candidate.data.id === atom)
            if (!node) return
            const parents = set.parents.length > 0 ? set.parents : [node.data.type]
            parents.forEach(parent => {
                const subsetSig = `${set.name}:${parent}`
                if (!node.data.subsetSigs.includes(subsetSig)) node.data.subsetSigs.push(subsetSig)
                if (!signatures.some(sig => sig.name === subsetSig)) {
                    signatures.push({ name: subsetSig, parent, parents: [parent], subset: true })
                }
            })
        })
    })

    ;(inst.rels || []).forEach((field) => {
        ;(field.atoms || []).forEach((relation) => {
            edges.push({
                group: 'edges',
                selectable: true,
                data: {
                    relation: field.name,
                    source: relation[0],
                    target: relation[relation.length - 1],
                    atoms: relation,
                    parent_sig: atomTypes.get(relation[0])
                }
            })
        })
    })

    return { nodes, edges, signatures }
}
