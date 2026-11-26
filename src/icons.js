import { iconDefinitions } from './iconDefinitions.js'

// Names and SVG paths come only from the pinned, official icon definitions.
export function iconMarkup(name) {
    const { viewBox, paths } = iconDefinitions[name]
    return `<svg class="cbutton__icon alloy-visualizer-icon" viewBox="${viewBox}" data-icon="${name}" aria-hidden="true" focusable="false">${paths.map(path => `<path d="${path}"/>`).join('')}</svg>`
}
