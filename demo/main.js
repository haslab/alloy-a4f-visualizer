import { createVisualizer, normalizeDocument } from '../src/index.js'

const status = document.getElementById('status')
const visualizer = createVisualizer(document.getElementById('graph'))
const controller = visualizer.trace

function loadDocument(documentValue) {
    const normalized = normalizeDocument(documentValue)
    visualizer.setDocument(normalized)
    status.textContent = `Loaded ${controller.length()} state${controller.length() === 1 ? '' : 's'}.`
}

document.getElementById('load').addEventListener('click', () => {
    try { loadDocument(JSON.parse(document.getElementById('json').value)) }
    catch (error) { status.textContent = `Could not load JSON: ${error.message}` }
})

document.getElementById('file').addEventListener('change', async event => {
    const file = event.target.files[0]
    if (!file) return
    document.getElementById('json').value = await file.text()
    document.getElementById('load').click()
})

document.getElementById('example').addEventListener('change', async event => {
    if (!event.target.value) return
    try {
        const response = await fetch(`/demo/examples/${event.target.value}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        document.getElementById('json').value = await response.text()
        document.getElementById('load').click()
    } catch (error) {
        status.textContent = `Could not load example: ${error.message}`
    }
})

