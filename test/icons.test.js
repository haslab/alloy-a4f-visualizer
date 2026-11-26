import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { iconDefinitions } from '../src/iconDefinitions.js'
import { iconMarkup } from '../src/icons.js'

const require = createRequire(import.meta.url)
test('bundled SVGs exactly match the official pinned Font Awesome definitions', () => {
    assert.equal(Object.keys(iconDefinitions).length, 5)
    for (const [name, definition] of Object.entries(iconDefinitions)) {
        const key = 'fa' + name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('')
        const { icon } = require(`@fortawesome/free-solid-svg-icons/${key}.js`)[key]
        assert.deepEqual(definition, { viewBox: `0 0 ${icon[0]} ${icon[1]}`, paths: [].concat(icon[4]) })
        assert.match(iconMarkup(name), /aria-hidden="true" focusable="false"/)
    }
})
