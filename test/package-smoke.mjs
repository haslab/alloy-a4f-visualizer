import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Test a real consumer installation rather than importing the working tree.
const root = fileURLToPath(new URL('../', import.meta.url))
const temporary = await mkdtemp(path.join(tmpdir(), 'alloy-visualizer-package-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
function run(args, cwd) {
    return execFileSync(npm, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

try {
    const [packed] = JSON.parse(run(['pack', '--json', '--pack-destination', temporary], root))
    for (const { path: entry } of packed.files) {
        assert.match(entry, /^(src\/|schema\/|docs\/|LICENSES\/|demo\/examples\/|README\.md$|LICENSE$|package\.json$)/,
            `Unexpected release file: ${entry}`)
    }
    await writeFile(path.join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
    run(['install', path.join(temporary, packed.filename), '--offline', '--ignore-scripts',
        '--omit=dev', '--no-audit', '--no-fund', '--package-lock=false'], temporary)
    const consumer = `
        import assert from 'node:assert/strict'
        import { readFileSync } from 'node:fs'
        import { createVisualizer, normalizeDocument, instanceToGraph } from 'alloy-a4f-visualizer'
        import { instanceToGraph as graphModel } from 'alloy-a4f-visualizer/graph-model'
        import { replaceGraph } from 'alloy-a4f-visualizer/renderer'
        import { createCytoscapeStyle } from 'alloy-a4f-visualizer/style'
        import { bindGraphInteractions } from 'alloy-a4f-visualizer/interactions'
        import { nodeLabel } from 'alloy-a4f-visualizer/theme'
        for (const value of [createVisualizer, graphModel, replaceGraph, createCytoscapeStyle, bindGraphInteractions, nodeLabel]) {
            assert.equal(typeof value, 'function')
        }
        const document = normalizeDocument({ states: [{ types: [], sets: [], rels: [] }], loop: -1 })
        assert.equal(instanceToGraph(document.states[0]).nodes.length, 0)
        const css = new URL(import.meta.resolve('alloy-a4f-visualizer/visualizer.css'))
        assert.ok(readFileSync(css, 'utf8').includes('fonts/fa-solid-900.woff2'))
        assert.equal(readFileSync(new URL('./fonts/fa-solid-900.woff2', css)).subarray(0, 4).toString(), 'wOF2')
        assert.equal(import.meta.resolve('alloy-a4f-visualizer/src/visualizer.css'), import.meta.resolve('alloy-a4f-visualizer/visualizer.css'))
        const schema = JSON.parse(readFileSync(new URL(import.meta.resolve('alloy-a4f-visualizer/schema')), 'utf8'))
        assert.equal(schema.title, 'Alloy visualizer instance or trace')
    `
    await writeFile(path.join(temporary, 'consumer.mjs'), consumer)
    execFileSync(process.execPath, ['consumer.mjs'], { cwd: temporary, stdio: 'inherit' })
    const manifest = JSON.parse(await readFile(path.join(temporary, 'node_modules/alloy-a4f-visualizer/package.json')))
    assert.equal(manifest.name, 'alloy-a4f-visualizer')
    assert.equal(manifest.license, 'MIT')
    const license = await readFile(path.join(temporary, 'node_modules/alloy-a4f-visualizer/LICENSE'), 'utf8')
    assert.match(license, /MIT License/)
    assert.match(license, /Copyright \(c\) 2017 INESC TEC/)
    console.log(`Package smoke test passed: ${packed.filename} (${packed.entryCount} files)`)
} finally {
    await rm(temporary, { recursive: true, force: true })
}
