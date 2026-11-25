export function relationLabel(relation) {
    if (!relation || !relation.relation) return ''
    if (!relation.atoms || relation.atoms.length <= 2) return relation.relation
    return `${relation.relation} [${relation.atoms.slice(1, -1).join(',')}]`
}

export function nodeLabel(node, attributeLabel = '') {
    if (!node || !node.id) return attributeLabel
    const subsetLabel = node.subsetSigs && node.subsetSigs.length > 0
        ? `\n(${node.subsetSigs.map(sig => sig.split(':')[0]).join(',')})`
        : ''
    return `${node.id}${subsetLabel}\n${attributeLabel}`
}
