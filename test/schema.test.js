import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeDocument } from '../src/schema.js'

test('normalization rejects malformed host data with clear errors', () => {
    const state = { types: [], sets: [], rels: [] }
    for (const value of [null, [], 'instance', { states: {} }, { states: [null], loop: -1 },
        { states: [state], loop: '0' }, { states: [{ ...state, types: {} }], loop: -1 },
        { states: [{ ...state, types: [{ name: 'A', atoms: [1] }] }], loop: -1 },
        { states: [{ ...state, rels: [{ name: 'r', atoms: ['A$0'] }] }], loop: -1 }]) {
        assert.throws(() => normalizeDocument(value), TypeError)
    }
    for (const loop of [-2, 1]) assert.throws(() => normalizeDocument({ states: [state], loop }), RangeError)
    assert.throws(() => normalizeDocument({ states: [state, state], loop: -1 }), RangeError)
    assert.throws(() => normalizeDocument({ states: [{ ...state,
        rels: [{ name: 'r', arity: 2, atoms: [['A$0']] }]
    }], loop: -1 }), RangeError)
})

test('normalization supports legacy parents and untyped relations without mutating input', () => {
    const input = { states: [{ types: [{ name: 'A', parent: 'univ', atoms: ['A$0'] }],
        sets: [], rels: [{ name: 'r', atoms: [['A$0', 'A$0']] }] }], loop: -1 }
    const result = normalizeDocument(input)
    assert.deepEqual(result.states[0].types[0].parents, ['univ'])
    assert.equal(result.states[0].rels[0].arity, 2)
    result.states[0].rels[0].atoms[0][0] = 'changed'
    assert.equal(input.states[0].rels[0].atoms[0][0], 'A$0')
})

test('types have at most one parent while subsets may have multiple parents', () => {
    const input = { states: [{
        types: [{ name: 'A', parents: ['univ'], atoms: ['A0'] }, { name: 'B', parents: [], atoms: ['B0'] }],
        sets: [{ name: 'S', parents: ['A', 'B'], atoms: ['A0', 'B0'] }],
        rels: []
    }], loop: -1 }
    assert.deepEqual(normalizeDocument(input).states[0].sets[0].parents, ['A', 'B'])
    input.states[0].types[0].parents = ['univ', 'B']
    assert.throws(() => normalizeDocument(input), /type can have at most one parent/)
})
