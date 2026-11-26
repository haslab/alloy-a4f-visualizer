import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { normalizeDocument, instanceToGraph, relationLabel, createThemeState, projectInstance } from '../src/index.js'

function example(name) {
    return JSON.parse(readFileSync(new URL(`../demo/examples/${name}`, import.meta.url), 'utf8'))
}

test('every published JSON example normalizes without mutating its input', () => {
    for (const name of readdirSync(new URL('../demo/examples/', import.meta.url)).filter(name => name.endsWith('.json'))) {
        const input = example(name)
        const original = structuredClone(input)
        const document = normalizeDocument(input)
        assert.ok(document.states.length > 0, name)
        assert.deepEqual(input, original, name)
    }
})

test('higher-arity labels retain all intermediate columns and parallel tuples', () => {
    const state = normalizeDocument(example('higher-arity.json')).states[0]
    const graph = instanceToGraph(state)
    assert.equal(graph.edges.length, 7)
    assert.deepEqual(graph.edges.map(edge => relationLabel(edge.data)), [
        'knows', 'visits [Day$0]', 'visits [Day$1]', 'visits [Day$0]',
        'books [Room$0,Day$0]', 'books [Room$1,Day$1]', 'between [Room$1]'
    ])
    const visits = graph.edges.filter(edge => edge.data.relation === 'visits')
    assert.equal(visits[0].data.source, visits[1].data.source)
    assert.equal(visits[0].data.target, visits[1].data.target)
    const self = graph.edges.at(-1).data
    assert.equal(self.source, self.target)
    assert.deepEqual(graph.nodes.find(node => node.data.id === 'Person$0').data.subsetSigs, ['Chosen:Person'])
    assert.deepEqual(graph.nodes.find(node => node.data.id === 'Room$1').data.subsetSigs, ['Chosen:Room'])
})

test('higher-arity attribute labels retain ordered tail tuples', () => {
    const graph = instanceToGraph(normalizeDocument(example('higher-arity.json')).states[0])
    const theme = createThemeState()
    theme.init({ relationSettings: { showAsAttributes: [
        { relation: 'visits', parent_sig: 'Person', showAsAttributes: true },
        { relation: 'books', parent_sig: 'Person', showAsAttributes: true }
    ] } })
    const label = theme.getAttributeLabel({ id: 'Person$0' }, graph.edges.map(edge => edge.data))
    assert.equal(label, 'visits: Day$0→Room$0,Day$1→Room$0\nbooks: Room$0→Day$0→Item$0,Room$1→Day$1→Item$0\n')
})

test('trace examples change higher-arity labels without changing their static atom domains', () => {
    const { states } = normalizeDocument(example('higher-arity-trace.json'))
    assert.deepEqual(states[0].types, states[1].types)
    assert.deepEqual(states.map(state => instanceToGraph(state).edges.map(edge => relationLabel(edge.data))), [
        ['visits [Day$0]', 'books [Room$0,Day$0]'],
        ['visits [Day$1]', 'books [Room$1,Day$1]']
    ])
})

test('higher-arity projection removes selected columns before creating labels', () => {
    const state = normalizeDocument(example('higher-arity.json')).states[0]
    const projected = projectInstance(state, { Room: 'Room$0' })
    const labels = instanceToGraph(projected).edges.map(edge => relationLabel(edge.data))
    assert.ok(labels.includes('books [Day$0]'))
    assert.ok(!labels.some(label => label.includes('Room$')))
})
