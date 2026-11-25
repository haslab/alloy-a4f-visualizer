import { normalizeInstance } from './schema.js'

/**
 * Apply Alloy-style static projection to one instance state.
 *
 * Assignments map projected type names to their focused atom. Relation type
 * metadata is used to remove projected columns, just as Alloy's StaticProjector
 * projects the model before projecting its tuples.
 */
export function projectInstance(instance, assignments = {}) {
    const source = normalizeInstance(instance)
    const projected = new Map(Object.entries(assignments))
    const removedTypes = new Set(projected.keys())

    // Projecting a type also removes all its subtypes from the model.
    let changed = true
    while (changed) {
        changed = false
        source.types.forEach(type => {
            if (!removedTypes.has(type.name)
                && (type.parents || []).some(parent => removedTypes.has(parent))) {
                removedTypes.add(type.name)
                changed = true
            }
        })
    }

    const typeByName = new Map(source.types.map(type => [type.name, type]))
    const projectionRootFor = typeName => {
        if (projected.has(typeName)) return typeName
        let current = typeByName.get(typeName)
        const seen = new Set()
        while (current && !seen.has(current.name)) {
            seen.add(current.name)
            const projectedParent = (current.parents || []).find(parent => removedTypes.has(parent))
            if (projectedParent) {
                if (projected.has(projectedParent)) return projectedParent
                current = typeByName.get(projectedParent)
            } else {
                const parent = (current.parents || []).find(name => typeByName.has(name))
                current = parent ? typeByName.get(parent) : undefined
            }
        }
        return undefined
    }

    const types = source.types.filter(type => !removedTypes.has(type.name))
    const sets = source.sets.filter(set => !(set.parents || []).some(parent => removedTypes.has(parent)))
    const rels = []

    source.rels.forEach(relation => {
        // Without relation type metadata, the columns cannot be projected
        // soundly. Preserve the relation unchanged rather than guessing.
        if (!Array.isArray(relation.types)) {
            rels.push({ ...relation, atoms: relation.atoms.map(tuple => tuple.slice()) })
            return
        }

        const removedColumns = []
        const remainingTypes = []
        relation.types.forEach((typeName, index) => {
            if (removedTypes.has(typeName)) removedColumns.push(index)
            else remainingTypes.push(typeName)
        })

        if (remainingTypes.length === 0) return

        const tuples = relation.atoms
            .filter(tuple => removedColumns.every(index => {
                const projectionRoot = projectionRootFor(relation.types[index])
                // If the model says the column type was removed as a subtype,
                // find the projected ancestor whose selected atom constrains it.
                if (!projectionRoot) return false
                const focusedAtom = projected.get(projectionRoot)
                return focusedAtom == null
                    ? tuple[index] == null
                    : tuple[index] === focusedAtom
            }))
            .map(tuple => tuple.filter((_, index) => !removedColumns.includes(index)))

        if (remainingTypes.length === 1) {
            const { types: _types, arity: _arity, ...setMetadata } = relation
            addProjectedSet(sets, {
                ...setMetadata,
                parents: [remainingTypes[0]],
                atoms: [...new Set(tuples.map(tuple => tuple[0]))]
            })
        } else {
            rels.push({
                ...relation,
                types: remainingTypes,
                arity: remainingTypes.length,
                atoms: tuples
            })
        }
    })

    return { types, sets, rels }
}

function addProjectedSet(sets, candidate) {
    const existing = sets.find(set => set.name === candidate.name
        && JSON.stringify(set.parents || []) === JSON.stringify(candidate.parents || []))
    if (!existing) {
        sets.push(candidate)
        return
    }
    existing.atoms = [...new Set([...(existing.atoms || []), ...(candidate.atoms || [])])]
}
