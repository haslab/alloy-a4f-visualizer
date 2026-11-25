import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import { projectInstance } from '../src/instanceProjection.js'

const apiUrl = process.env.ALLOY_WEB_API_URL
const builtInSignatures = new Set(['Int', 'String', 'univ', 'seq/Int'])

describe('Alloy API projection ground-truth comparison', { skip: !apiUrl }, function() {
    it('matches Alloy projection for a static instance with multiple relations', async function(t) {
        const model = await readFile(new URL('./fixtures/projection/person-room.als', import.meta.url), 'utf8')
        const sessionId = `visualizer-projection-${randomUUID()}`
        const solutions = await post('/getInstances', {
            model,
            numberOfInstances: 20,
            commandIndex: 0,
            sessionId,
            parentId: ''
        })

        assert.ok(Array.isArray(solutions) && solutions.length > 0, 'API returned no solver result')
        assert.equal(solutions[0].unsat, false, 'projection fixture unexpectedly has no solution')

        let projectionCases = 0
        for (let solutionIndex = 0; solutionIndex < Math.min(20, solutions.length); solutionIndex++) {
            const source = solutions[solutionIndex].instance?.[0]
            assert.ok(source, `API result ${solutionIndex} did not contain the source instance`)
            const eligibleTypes = new Map(source.types
                .filter(type => !builtInSignatures.has(type.name)
                    && type.parent === 'univ'
                    && type.isVar !== true)
                .map(type => [type.name, type]))
            const person = eligibleTypes.get('Person')
            const room = eligibleTypes.get('Room')
            if (solutionIndex === 0) {
                assert.ok(person, 'Person must be an eligible top-level static signature')
                assert.ok(room, 'Room must be an eligible top-level static signature')
            }
            for (const atom of person?.atoms || []) {
                projectionCases++
                await assertMatchesProjection(t, {
                    label: `instance ${solutionIndex + 1}: Person focused on ${atom}`,
                    source,
                    assignments: { Person: atom },
                    focusedAtoms: [atom],
                    sessionId,
                    solutionIndex
                })
            }
            for (const atom of room?.atoms || []) {
                projectionCases++
                await assertMatchesProjection(t, {
                    label: `instance ${solutionIndex + 1}: Room focused on ${atom}`,
                    source,
                    assignments: { Room: atom },
                    focusedAtoms: [atom],
                    sessionId,
                    solutionIndex
                })
            }
            for (const personAtom of person?.atoms || []) {
                for (const roomAtom of room?.atoms || []) {
                    projectionCases++
                    await assertMatchesProjection(t, {
                        label: `instance ${solutionIndex + 1}: Person ${personAtom} + Room ${roomAtom}`,
                        source,
                        assignments: { Person: personAtom, Room: roomAtom },
                        focusedAtoms: [personAtom, roomAtom],
                        sessionId,
                        solutionIndex
                    })
                }
            }
        }

        assert.ok(projectionCases > 0, 'no eligible signature atoms were available to project')
    })
})

async function assertMatchesProjection(t, { label, source, assignments, focusedAtoms, sessionId, solutionIndex }) {
    await t.test(label, async function() {
        const expected = await post('/getProjection', {
            sessionId,
            type: focusedAtoms,
            index: solutionIndex
        })
        assert.ok(Array.isArray(expected) && expected[0],
            `API returned no projection for ${focusedAtoms.join(', ')} in instance ${solutionIndex + 1}`)

        const actual = projectInstance(source, assignments)
        assert.deepEqual(canonicalize(actual), canonicalize(expected[0]),
            `local projection differs from Alloy for ${focusedAtoms.join(', ')}`
            + ` in instance ${solutionIndex + 1}`
            + `\nlocal: ${JSON.stringify(canonicalize(actual))}`
            + `\nAlloy: ${JSON.stringify(canonicalize(expected[0]))}`)
    })
}

async function post(path, body) {
    const response = await fetch(new URL(path, ensureTrailingSlash(apiUrl)), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    })
    const text = await response.text()
    assert.equal(response.ok, true, `${path} returned HTTP ${response.status}: ${text}`)
    try {
        return JSON.parse(text)
    } catch (error) {
        assert.fail(`${path} returned invalid JSON: ${text || '<empty body>'}; ${error.message}`)
    }
}

function ensureTrailingSlash(value) {
    return value.endsWith('/') ? value : `${value}/`
}

function canonicalize(instance) {
    return {
        types: (instance.types || []).map(node => ({
            name: node.name,
            parent: node.parent ?? (node.parents || [])[0] ?? null,
            atoms: [...(node.atoms || [])].sort()
        })).sort(byName),
        sets: (instance.sets || []).map(node => ({
            name: node.name,
            parent: node.parent ?? (node.parents || [])[0] ?? null,
            atoms: [...(node.atoms || [])].sort()
        })).sort(byName),
        rels: (instance.rels || []).map(relation => ({
            name: relation.name,
            atoms: (relation.atoms || []).map(tuple => tuple.slice())
                .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
        })).sort(byName)
    }
}

function byName(left, right) {
    return left.name.localeCompare(right.name)
}
