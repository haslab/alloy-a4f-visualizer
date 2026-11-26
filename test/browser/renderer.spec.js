import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.goto('/test/browser/harness.html')
    await page.waitForFunction(() => window.visualizer && window.testGraph)
})

async function settle(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function load(page, example) {
    await page.evaluate(async name => {
        const response = await fetch(`/demo/examples/${name}`)
        window.visualizer.setDocument(await response.json())
    }, example)
    await settle(page)
}

async function expectFitted(page) {
    const bounds = await page.evaluate(() => {
        const graph = window.testGraph
        const box = graph.elements(':visible').renderedBoundingBox()
        return { ...box, width: graph.width(), height: graph.height() }
    })
    expect(bounds.x1).toBeGreaterThanOrEqual(-1)
    expect(bounds.y1).toBeGreaterThanOrEqual(-1)
    expect(bounds.x2).toBeLessThanOrEqual(bounds.width + 1)
    expect(bounds.y2).toBeLessThanOrEqual(bounds.height + 1)
}

test('the actual demo lays out the single instance without overlap and applies theme edits', async ({ page }) => {
    await page.goto('/')
    await page.selectOption('#example', 'instance.json')
    await expect(page.locator('#status')).toHaveText('Loaded 1 state.')
    await settle(page)
    const nodes = await page.evaluate(() => {
        const graph = document.getElementById('graph')._cyreg.cy
        return graph.nodes().map(node => ({ box: node.boundingBox(), color: node.style('background-color') }))
    })
    expect(nodes).toHaveLength(3)
    for (let i = 0; i < nodes.length; i++) {
        expect(nodes[i].color).toBe('rgb(46,204,64)')
        for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i].box
            const b = nodes[j].box
            expect(a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1).toBe(true)
        }
    }
    await page.evaluate(() => document.getElementById('graph')._cyreg.cy.getElementById('Room$0').emit('cxttap'))
    // Theme pickers live inside expandable menu sections; dispatch change directly.
    await page.locator('.changeAtomColorPicker[elm="Room"]').selectOption('#FF4136', { force: true })
    expect(await page.evaluate(() => document.getElementById('graph')._cyreg.cy.getElementById('Room$0').style('background-color'))).toBe('rgb(255,65,54)')
})

test('demo navigation uses official inline SVGs without icon CSS or font requests', async ({ page }) => {
    const fontRequests = []
    page.on('request', request => { if (request.url().includes('fortawesome') || request.url().includes('.woff2')) fontRequests.push(request.url()) })
    await page.goto('/')
    await page.selectOption('#example', 'trace.json')
    await expect(page.locator('.alloy-trace-controls')).toBeVisible()
    const previous = page.getByRole('button', { name: 'Previous trace state', exact: true })
    await expect(previous.locator('svg')).toHaveAttribute('data-icon', 'arrow-left')
    const next = page.getByRole('button', { name: 'Next trace state', exact: true })
    await expect(next.locator('svg')).toHaveAttribute('data-icon', 'arrow-right')
    const size = await next.locator('svg').boundingBox()
    expect(size.height).toBe(48)
    expect(size.width).toBeGreaterThan(48)
    await next.click()
    await next.click()
    await expect(next.locator('svg')).toHaveAttribute('data-icon', 'undo')
    await expect(next.locator('svg path')).toHaveAttribute('d', /^M/)
    expect(fontRequests).toEqual([])
    await expect(page.getByRole('button', { name: 'Next trace state', exact: true })).toBeEnabled()
})

test('higher-arity labels render distinctly, including parallel edges and a self-loop', async ({ page }) => {
    await load(page, 'higher-arity.json')
    const labels = await page.evaluate(() => window.testGraph.edges().map(edge => edge.style('label')))
    expect(labels).toEqual([
        'knows', 'visits [Day$0]', 'visits [Day$1]', 'visits [Day$0]',
        'books [Room$0,Day$0]', 'books [Room$1,Day$1]', 'between [Room$1]'
    ])
    await expectFitted(page)
})

test('higher-arity trace labels update and loop without moving the viewport', async ({ page }) => {
    await load(page, 'higher-arity-trace.json')
    const viewport = () => page.evaluate(() => ({ zoom: window.testGraph.zoom(), pan: window.testGraph.pan() }))
    const before = await viewport()
    const labels = () => page.evaluate(() => window.testGraph.edges().map(edge => edge.style('label')))
    expect(await labels()).toEqual(['visits [Day$0]', 'books [Room$0,Day$0]'])
    await page.getByRole('button', { name: 'Next trace state', exact: true }).click()
    await settle(page)
    expect(await labels()).toEqual(['visits [Day$1]', 'books [Room$1,Day$1]'])
    expect(await viewport()).toEqual(before)
    await page.getByRole('button', { name: 'Next trace state', exact: true }).click()
    await settle(page)
    expect(await labels()).toEqual(['visits [Day$0]', 'books [Room$0,Day$0]'])
    expect(await viewport()).toEqual(before)
})

test('Cytoscape 3 delivers node/edge/background interactions and every existing layout', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await load(page, 'instance.json')
    await expect(page.locator('.alloy-trace-controls')).toBeHidden()
    await expect(page.locator('.alloy-projection-controls')).toBeHidden()
    await expectFitted(page)
    await page.evaluate(() => { window.testGraph.edges().first().emit('tap') })
    expect(await page.evaluate(() => window.testGraph.edges().first().selected())).toBe(true)
    expect(await page.evaluate(() => window.testGraph.edges().first().numericStyle('width'))).toBe(5)
    await page.evaluate(() => { window.testGraph.edges().first().emit('cxttap') })
    await expect(page.locator('.alloy-visualizer-menu')).toBeVisible()
    await expect(page.locator('.alloy-visualizer-menu')).toContainText('knows')
    await page.evaluate(() => { window.testGraph.nodes().first().emit('cxttap') })
    await expect(page.locator('.alloy-visualizer-menu')).toContainText('Person')
    for (const layout of ['breadthfirst', 'grid', 'circle', 'random', 'cocentric', 'cose']) {
        await page.evaluate(async name => {
            const graph = window.testGraph
            graph.emit('cxttap')
            const picker = document.querySelector('.changeLayoutPicker')
            await new Promise(resolve => {
                graph.one('layoutstop', resolve)
                picker.value = name
                picker.dispatchEvent(new Event('change', { bubbles: true }))
            })
        }, layout)
        await settle(page)
        await expectFitted(page)
    }
    expect(errors).toEqual([])
})

test('trace navigation preserves viewport and positions of temporarily absent atoms', async ({ page }) => {
    await load(page, 'trace.json')
    const viewport = await page.evaluate(() => ({ zoom: window.testGraph.zoom(), pan: window.testGraph.pan() }))
    await page.getByRole('button', { name: 'Next trace state', exact: true }).click()
    await settle(page)
    await expectFitted(page)
    expect(await page.evaluate(() => ({ zoom: window.testGraph.zoom(), pan: window.testGraph.pan() }))).toEqual(viewport)
    await page.evaluate(() => {
        const atom = window.testGraph.getElementById('Node$1')
        atom.position({ x: 320, y: 180 })
        atom.emit('free')
    })
    expect(await page.evaluate(() => window.preferenceChanges.at(-1).nodePositions['Node$1'])).toEqual({ x: 320, y: 180 })
    await page.getByRole('button', { name: 'Next trace state', exact: true }).click()
    expect(await page.evaluate(() => window.testGraph.getElementById('Node$1').length)).toBe(0)
    await page.getByRole('button', { name: 'Next trace state', exact: true }).click()
    expect(await page.evaluate(() => window.testGraph.getElementById('Node$1').position())).toEqual({ x: 320, y: 180 })
})

test('projection refits the canvas and only exposes navigation while projected', async ({ page }) => {
    await load(page, 'instance.json')
    await page.evaluate(() => window.visualizer.projection.setProjection({ Person: 'Person$0' }))
    await settle(page)
    await expect(page.locator('.alloy-projection-controls')).toBeVisible()
    expect(await page.evaluate(() => window.testGraph.getElementById('Room$0').length)).toBe(1)
    await expectFitted(page)
    await page.evaluate(() => { window.testGraph.zoom(100); window.testGraph.pan({ x: 9000, y: 9000 }) })
    await page.getByRole('button', { name: 'Next Person atom' }).click()
    await settle(page)
    await expectFitted(page)
    expect(await page.evaluate(() => window.testGraph.zoom())).toBeLessThan(100)
    await page.evaluate(() => window.visualizer.projection.clear())
    await settle(page)
    await expect(page.locator('.alloy-projection-controls')).toBeHidden()
    await expectFitted(page)
})

test('two mounted components navigate independently and clean up on remount', async ({ page }) => {
    await load(page, 'trace.json')
    await page.evaluate(async () => {
        const { createVisualizer } = await import('/src/index.js')
        const host = document.createElement('section')
        host.id = 'second-host'
        host.style.cssText = 'width: 600px; height: 400px'
        const graph = document.createElement('div')
        host.append(graph)
        document.body.append(host)
        window.secondVisualizer = createVisualizer(graph)
        window.secondVisualizer.setDocument(await (await fetch('/demo/examples/trace.json')).json())
    })
    await settle(page)
    const second = page.locator('#second-host')
    await second.getByRole('button', { name: 'Next trace state', exact: true }).click()
    expect(await page.evaluate(() => [window.visualizer.trace.index(), window.secondVisualizer.trace.index()])).toEqual([0, 1])
    expect(await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(element => element.id)
        return ids.length === new Set(ids).size
    })).toBe(true)
    await page.evaluate(async () => {
        window.secondVisualizer.destroy()
        window.secondVisualizer.destroy()
        const host = document.getElementById('second-host')
        window.destroyedClasses = [host.classList.contains('visualizer-canvas'), host.firstElementChild.classList.contains('visualizer-graph')]
        const { createVisualizer } = await import('/src/index.js')
        window.secondVisualizer = createVisualizer(host.firstElementChild)
    })
    expect(await page.evaluate(() => window.destroyedClasses)).toEqual([false, false])
    await expect(second.locator('.alloy-visualizer-controls')).toHaveCount(1)
    await expect(second.locator('.alloy-visualizer-menu')).toHaveCount(1)
    await expect(page.locator('.alloy-trace-controls').first()).toBeVisible()
})

test('invalid document replacements preserve the document and saved positions', async ({ page }) => {
    await load(page, 'instance.json')
    const before = await page.evaluate(() => window.visualizer.snapshot())
    const message = await page.evaluate(() => {
        try { window.visualizer.setDocument({ states: [], loop: -1 }) }
        catch (error) { return error.message }
    })
    expect(message).toContain('exactly one state')
    expect(await page.evaluate(() => window.visualizer.snapshot())).toEqual(before)
    await load(page, 'trace.json')
    await page.getByRole('button', { name: 'Next trace state', exact: true }).click()
    expect(await page.evaluate(() => window.visualizer.trace.index())).toBe(1)
})

test('renderer follows host pane size changes', async ({ page }) => {
    await load(page, 'instance.json')
    await page.evaluate(() => {
        const host = document.getElementById('graph').parentElement
        host.style.width = '600px'
        host.style.height = '350px'
    })
    await expect.poll(() => page.evaluate(() => [window.testGraph.width(), window.testGraph.height()])).toEqual([598, 348])
})
