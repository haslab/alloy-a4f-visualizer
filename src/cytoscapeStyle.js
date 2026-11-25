import { nodeLabel } from './themeModel.js'

export function createCytoscapeStyle(sigSettings, relationSettings, appearance = 'light') {
    const dark = appearance === 'dark'
    const foreground = dark ? '#f3f4f6' : 'black'
    const outline = dark ? '#111827' : 'black'
    const border = dark ? '#e5e7eb' : 'black'
    const outlineWidth = dark ? 2 : 0
    return [
        {
            selector: 'node',
            style: {
                'background-color'(ele) {
                    const sigs = ele.data().subsetSigs
                    return sigSettings.getInheritedAtomColor(sigs.length > 0 ? sigs[0] : ele.data().type)
                },
                label(ele) {
                    const edges = typeof ele.cy === 'function' ? ele.cy().edges() : []
                    return nodeLabel(ele.data(), relationSettings.getAttributeLabel(ele, edges))
                },
                color: foreground,
                'text-outline-color': outline,
                'text-outline-width': outlineWidth,
                'border-style'(ele) {
                    const sigs = ele.data().subsetSigs
                    return sigSettings.getInheritedAtomBorder(sigs.length > 0 ? sigs[0] : ele.data().type)
                },
                'text-valign': 'center',
                shape(ele) {
                    const sigs = ele.data().subsetSigs
                    return sigSettings.getInheritedAtomShape(sigs.length > 0 ? sigs[0] : ele.data().type)
                },
                visibility(ele) {
                    if (ele.data().type === 'seq/Int') return 'hidden'
                    let visible = true
                    const sigs = ele.data().subsetSigs
                    if (sigs.length > 0) sigs.forEach(sig => { visible = visible && sigSettings.getInheritedAtomVisibility(sig) })
                    else visible = sigSettings.getInheritedAtomVisibility(ele.data().type)
                    return visible ? 'hidden' : 'visible'
                },
                width: 'label', height: 'label',
                'padding-bottom': '10px', 'padding-top': '10px',
                'padding-left': '10px', 'padding-right': '10px',
                'border-color': border, 'border-width': 2, 'border-opacity': dark ? 0.9 : 0.8
            }
        },
        {
            selector: 'edge',
            style: {
                width: 1,
                'line-color'(ele) { return relationSettings.getEdgeColor(ele.data()) },
                'target-arrow-color'(ele) { return relationSettings.getEdgeColor(ele.data()) },
                'target-arrow-shape': 'triangle',
                label(ele) { return relationSettings.getEdgeLabel(ele.data()) },
                color: foreground,
                'text-outline-color': dark ? outline : '#ff3300',
                'text-outline-width': outlineWidth,
                'curve-style': 'bezier', 'text-valign': 'center',
                'edge-text-rotation': 'autorotate',
                'line-style'(ele) { return relationSettings.getEdgeStyle(ele.data()) },
                visibility(ele) { return relationSettings.isShowAsArcsOn(ele.data()) ? 'visible' : 'hidden' }
            }
        },
        { selector: ':selected', style: { 'background-opacity': 0.5 } },
        { selector: '.multiline-manual', style: { 'text-wrap': 'wrap' } },
        { selector: 'edge:selected', style: { width: 5 } },
        { selector: ':parent', style: { 'background-opacity': 0.3, 'text-valign': 'top' } }
    ]
}
