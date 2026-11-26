const colors = [['inherit', 'Inherit'], ['#001f3f', 'Navy'], ['#0074D9', 'Blue'], ['#7FDBFF', 'Aqua'], ['#39CCCC', 'Teal'], ['#3D9970', 'Olive'], ['#2ECC40', 'Green'], ['#01FF70', 'Lime'], ['#FFDC00', 'Yellow'], ['#FF851B', 'Orange'], ['#FF4136', 'Red'], ['#85144b', 'Maroon'], ['#F012BE', 'Fuchsia'], ['#B10DC9', 'Purple'], ['#111111', 'Black'], ['#AAAAAA', 'Gray'], ['#DDDDDD', 'Silver'], ['#FFFFFF', 'White']]
const shapes = [['inherit', 'Inherit'], ['rectangle', 'Rectangle'], ['roundrectangle', 'Round Rectangle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['pentagon', 'Pentagon'], ['hexagon', 'Hexagon'], ['heptagon', 'Heptagon'], ['octagon', 'Octagon'], ['star', 'Star, diamond'], ['vee', 'Vee'], ['rhomboid', 'Rhomboid']]
const borders = [['inherit', 'Inherit'], ['solid', 'Solid'], ['dotted', 'Dotted'], ['dashed', 'Dashed'], ['double', 'Double']]
const layouts = [['breadthfirst', 'Breadthfirst'], ['random', 'Random'], ['grid', 'Grid'], ['circle', 'Circle'], ['cocentric', 'Cocentric'], ['cose', 'Cose']]

function select(className, values, value, attributes = {}) {
    const element = document.createElement('select')
    element.className = className
    Object.entries(attributes).forEach(([key, val]) => element.setAttribute(key, val))
    values.forEach(([optionValue, label]) => {
        const option = document.createElement('option')
        option.value = optionValue; option.textContent = label; option.selected = optionValue === value
        element.append(option)
    })
    return element
}

function item(label, control, action) {
    const li = document.createElement('li')
    const link = document.createElement('a')
    link.href = '#'; link.textContent = label
    if (action) link.dataset.action = action
    li.append(link)
    if (control) {
        li.classList.add('has-sub')
        const submenu = document.createElement('ul')
        const option = document.createElement('li')
        option.append(control)
        submenu.append(option)
        li.append(submenu)
        link.addEventListener('click', event => {
            event.preventDefault()
            const willOpen = !li.classList.contains('open')
            li.parentElement.querySelectorAll(':scope > li.open').forEach(openItem => {
                openItem.classList.remove('open')
                openItem.querySelectorAll('li.open').forEach(child => child.classList.remove('open'))
            })
            if (willOpen) li.classList.add('open')
        })
    }
    return li
}

/** DOM translation of Alloy4Fun's right-click menu, with application globals replaced by callbacks. */
export function createContextMenu({ container = document.body, theme, onProject, onResetProjection, onResetTheme, onLayout, onRefresh, canProject = () => true } = {}) {
    const menu = document.createElement('div'); menu.className = 'alloy-visualizer-menu'; menu.hidden = true
    const cssmenu = document.createElement('div'); cssmenu.className = 'alloy-visualizer-menu-list'; menu.append(cssmenu); container.append(menu)
    let target = { kind: 'background', labels: ['general'] }
    const hide = () => { menu.hidden = true }
    const update = () => onRefresh && onRefresh()

    function elementMenu(label, kind) {
        const ul = document.createElement('ul')
        const color = kind === 'edge' ? theme.getEdgeColor(label) : theme.getAtomColor(label)
        const colorPicker = select('changeAtomColorPicker', colors, color, { elm: label })
        colorPicker.addEventListener('change', e => { kind === 'edge' ? theme.updateEdgeColor(label, e.target.value) : theme.updateAtomColor(label, e.target.value); update() })
        ul.append(item(`Change color of ${label}`, colorPicker))
        if (kind === 'node') {
            const shapePicker = select('changeAtomShapePicker', shapes, theme.getAtomShape(label), { elm: label })
            shapePicker.addEventListener('change', e => { theme.updateAtomShape(label, e.target.value); update() })
            ul.append(item(`Change shape of ${label}`, shapePicker))
        }
        const borderPicker = select('changeAtomBorderPicker', borders, kind === 'edge' ? theme.getEdgeStyle(label) : theme.getAtomBorder(label), { elm: label })
        borderPicker.addEventListener('change', e => { kind === 'edge' ? theme.updateEdgeStyle(label, e.target.value) : theme.updateAtomBorder(label, e.target.value); update() })
        ul.append(item(`Change stroke of ${label}`, borderPicker))
        if (kind === 'edge') {
            const attribute = item(`${theme.isShowAsAttributesOn(label) ? 'Hide' : 'Show'} ${label} as attribute`, null, 'attribute')
            attribute.firstChild.setAttribute('elm', label)
            attribute.firstChild.addEventListener('click', e => { e.preventDefault(); theme.updateShowAsAttributes(label, !theme.isShowAsAttributesOn(label)); update() })
            ul.append(attribute)
            const arcs = item(`${theme.isShowAsArcsOn(label) ? 'Hide' : 'Show'} ${label}`, null, 'hide')
            arcs.firstChild.addEventListener('click', e => { e.preventDefault(); theme.updateShowAsArcs(label, !theme.isShowAsArcsOn(label)); update() })
            ul.append(arcs)
        } else {
            const visibility = item(`${theme.getInheritedAtomVisibility(label) ? 'Show' : 'Hide'} ${label}`, null, 'hide')
            visibility.firstChild.addEventListener('click', e => { e.preventDefault(); theme.updateAtomVisibility(label, !theme.getInheritedAtomVisibility(label)); update() })
            ul.append(visibility)
            if (canProject(label) && onProject) {
                const project = item(`Project over ${label}`, null, 'project')
                project.firstChild.addEventListener('click', e => { e.preventDefault(); onProject(label); hide() }); ul.append(project)
            }
        }
        cssmenu.append(ul)
    }

    function rebuild() {
        cssmenu.replaceChildren()
        if (target.kind === 'node' || target.kind === 'edge') { target.labels.forEach(label => elementMenu(label, target.kind)); return }
        const ul = document.createElement('ul')
        const layoutPicker = select('changeLayoutPicker', layouts, theme.getLayout())
        layoutPicker.addEventListener('change', e => { theme.updateLayout(e.target.value); update(); onLayout && onLayout(e.target.value) })
        ul.append(item('Change layout', layoutPicker))
        theme.getAllHiddenAtoms().forEach(label => { const i = item(`Show ${label}`, null, 'show'); i.firstChild.addEventListener('click', e => { e.preventDefault(); theme.updateAtomVisibility(label, false); update() }); ul.append(i) })
        theme.getAllHiddenRels().forEach(label => { const i = item(`Show ${label}`, null, 'show'); i.firstChild.addEventListener('click', e => { e.preventDefault(); theme.updateShowAsArcs(label, true); update() }); ul.append(i) })
        if (onResetProjection) { const i = item('Reset projection', null, 'reset-projection'); i.firstChild.addEventListener('click', e => { e.preventDefault(); onResetProjection(); hide() }); ul.append(i) }
        if (onResetTheme) { const i = item('Reset theme', null, 'reset-theme'); i.firstChild.addEventListener('click', e => { e.preventDefault(); onResetTheme(); hide() }); ul.append(i) }
        cssmenu.append(ul)
    }

    return {
        element: menu,
        open(nextTarget, position = {}) {
            target = { ...nextTarget, labels: nextTarget.labels || [nextTarget.label] }; rebuild()
            menu.hidden = false
            menu.style.position = 'absolute'
            menu.style.zIndex = '20'
            const bounds = menu.parentElement.getBoundingClientRect()
            menu.style.maxWidth = `${Math.max(0, bounds.width - 8)}px`
            menu.style.maxHeight = `${Math.max(0, bounds.height - 8)}px`
            menu.style.overflowY = 'auto'
            const maxLeft = Math.max(0, bounds.width - menu.offsetWidth - 4)
            const maxTop = Math.max(0, bounds.height - menu.offsetHeight - 4)
            menu.style.left = `${Math.min(Math.max(4, position.left || 0), maxLeft)}px`
            menu.style.top = `${Math.min(Math.max(4, position.top || 0), maxTop)}px`
        },
        hide,
        destroy() { menu.remove() }
    }
}
