import { normalizeInstance } from './schema.js'

/**
 * Applies projection assignments to one instance state.
 *
 * The source state is never mutated. Assignments map projected type names to
 * the atom selected for that type.
 */
export function projectInstance(instance, assignments = {}) {
    const source = normalizeInstance(instance)
    const projectedTypes = new Set(Object.keys(assignments))
    const projectedAtoms = new Set(Object.values(assignments))
    const sets = source.sets
        .filter(set => !projectedTypes.has(set.name))
        .map(set => ({ ...set, atoms: set.atoms.filter(atom => !projectedAtoms.has(atom)) }))
    const rels = []

    const result = {
        types: source.types
            .filter(type => !projectedTypes.has(type.name))
            .map(type => ({ ...type, atoms: type.atoms.filter(atom => !projectedAtoms.has(atom)) })),
        sets,
        rels
    }

    source.rels.forEach(relation => {
        const hasTypeMetadata = Array.isArray(relation.types)
        let types = hasTypeMetadata ? relation.types.slice() : undefined
        const originalArity = types ? types.length : undefined
        let tuples = relation.atoms.map(tuple => tuple.slice())

        if (types) {
            const projectedTypeNames = new Set()
            for (const [type, atom] of Object.entries(assignments)) {
                const columns = types
                    .map((columnType, index) => columnType === type ? index : -1)
                    .filter(index => index >= 0)
                if (columns.length === 0) continue

                // A projected atom may occur in any column of the same
                // projected type. For example, projecting Person onto P0
                // keeps both P0->P1 and P1->P0.
                tuples = tuples.filter(tuple => columns.some(index => tuple[index] === atom))
                projectedTypeNames.add(type)
            }

            const remainingTypes = types.slice()
            projectedTypeNames.forEach(type => {
                const index = remainingTypes.indexOf(type)
                if (index >= 0) remainingTypes.splice(index, 1)
            })
            tuples = tuples.map(tuple => {
                const result = tuple.slice()
                const remove = [...projectedTypeNames]
                    .map(type => types.findIndex((columnType, index) =>
                        columnType === type && tuple[index] === assignments[type]
                    ))
                    .filter(index => index >= 0)
                    .sort((left, right) => right - left)
                remove.forEach(index => result.splice(index, 1))
                return result
            })
            types = remainingTypes
        }

        if (types && originalArity > 1 && types.length === 1) {
            sets.push({
                name: relation.name,
                parents: types.slice(),
                atoms: [...new Set(tuples.map(tuple => tuple[0]))]
            })
        } else {
            rels.push({
                ...relation,
                ...(types ? { types, arity: types.length } : {}),
                atoms: tuples
            })
        }
    })

    return result
}
