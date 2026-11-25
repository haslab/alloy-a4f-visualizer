import { relationLabel } from './themeModel.js'

const defaultSignatureSettings = () => ({
    nodeColors: [{ type: 'univ', color: '#2ECC40' }],
    nodeShapes: [{ type: 'univ', shape: 'ellipse' }],
    nodeBorders: [{ type: 'univ', border: 'solid' }],
    nodeVisibility: [
        { type: 'univ', visibility: false },
        { type: 'Int', visibility: true },
        { type: 'seq/Int', visibility: true }
    ]
})

const defaultTheme = () => ({
    sigSettings: defaultSignatureSettings(),
    relationSettings: {
        edgeColors: [],
        edgeStyles: [],
        showAsAttributes: [],
        showAsArcs: []
    },
    generalSettings: {
        currentLayout: 'breadthfirst',
        metaPrimSigs: [{ type: 'univ', parent: null }],
        metaSubsetSigs: []
    }
})

function copy(value) {
    return JSON.parse(JSON.stringify(value))
}

function findSetting(settings, key, value) {
    return settings.find(setting => setting[key] === value)
}

function relationId(relation) {
    if (typeof relation === 'string') return relation
    return `${relation.parent_sig}<:${relation.relation}`
}

function relationName(relation) {
    if (relation && typeof relation === 'object') return relation.relation
    if (typeof relation !== 'string') return undefined
    const separator = relation.lastIndexOf('<:')
    return separator < 0 ? relation : relation.slice(separator + 2)
}

function findRelationSetting(settings, key, relation) {
    const id = relationId(relation)
    const exact = findSetting(settings, key, id)
    if (exact) return exact

    // Alloy4Fun's persisted themes historically keyed relation settings by
    // field name. Prefer qualified IDs when present, but retain those themes.
    const name = relationName(relation)
    return name && name !== id ? findSetting(settings, key, name) : undefined
}

/**
 * Owns the visualizer theme without depending on an application or renderer.
 * The returned snapshot is safe to persist and restore.
 */
export function createThemeState({ onChange } = {}) {
    let theme = defaultTheme()
    const listeners = new Set()
    if (onChange) listeners.add(onChange)

    function snapshot() {
        return copy(theme)
    }

    function notify() {
        const value = snapshot()
        for (const listener of listeners) listener(value)
        return value
    }

    function init(value) {
        const defaults = defaultTheme()
        const signatureSettings = value && value.sigSettings
        const relationSettings = value && value.relationSettings
        const generalSettings = value && value.generalSettings
        theme = {
            sigSettings: {
                nodeColors: (signatureSettings && signatureSettings.nodeColors) || defaults.sigSettings.nodeColors,
                nodeShapes: (signatureSettings && signatureSettings.nodeShapes) || defaults.sigSettings.nodeShapes,
                nodeBorders: (signatureSettings && signatureSettings.nodeBorders) || defaults.sigSettings.nodeBorders,
                nodeVisibility: (signatureSettings && signatureSettings.nodeVisibility) || defaults.sigSettings.nodeVisibility
            },
            relationSettings: {
                edgeColors: (relationSettings && relationSettings.edgeColors) || defaults.relationSettings.edgeColors,
                edgeStyles: (relationSettings && relationSettings.edgeStyles) || defaults.relationSettings.edgeStyles,
                showAsAttributes: (relationSettings && relationSettings.showAsAttributes) || defaults.relationSettings.showAsAttributes,
                showAsArcs: (relationSettings && relationSettings.showAsArcs) || defaults.relationSettings.showAsArcs
            },
            generalSettings: {
                currentLayout: (generalSettings && generalSettings.currentLayout) || defaults.generalSettings.currentLayout,
                metaPrimSigs: generalSettings ? (generalSettings.metaPrimSigs || defaults.generalSettings.metaPrimSigs) : defaults.generalSettings.metaPrimSigs,
                metaSubsetSigs: generalSettings ? (generalSettings.metaSubsetSigs || defaults.generalSettings.metaSubsetSigs) : defaults.generalSettings.metaSubsetSigs
            }
        }
        return notify()
    }

    function reset() {
        theme = defaultTheme()
        return notify()
    }

    function parentOf(type) {
        const all = [
            ...(theme.generalSettings.metaPrimSigs || []),
            ...(theme.generalSettings.metaSubsetSigs || [])
        ]
        const setting = all.find(candidate => candidate.type === type)
        if (!setting) return null
        return setting.parent !== undefined ? setting.parent : (setting.parents || [])[0] || null
    }

    function inherited(type, collection, property, fallback) {
        let current = type
        const visited = new Set()
        while (current && !visited.has(current)) {
            visited.add(current)
            const setting = findSetting(theme.sigSettings[collection] || [], 'type', current)
            if (setting && setting[property] !== 'inherit') return setting[property]
            current = parentOf(current)
        }
        return fallback
    }

    function getSignature(collection, property, type, fallback) {
        const settings = theme.sigSettings[collection]
        let setting = findSetting(settings, 'type', type)
        if (!setting) {
            setting = { type, [property]: fallback }
            settings.push(setting)
        }
        return setting[property]
    }

    function setSignature(collection, property, type, value) {
        const settings = theme.sigSettings[collection]
        let setting = findSetting(settings, 'type', type)
        if (!setting) {
            setting = { type, [property]: value }
            settings.push(setting)
        } else setting[property] = value
        return notify()
    }

    function relationSetting(collection, key, relation, fallback) {
        const id = relationId(relation)
        const settings = theme.relationSettings[collection]
        const setting = findRelationSetting(settings, key, relation)
        if (setting) return setting
        const created = { [key]: id, [fallback.key]: fallback.value }
        settings.push(created)
        return created
    }

    function setRelation(collection, key, property, relation, value) {
        const setting = findRelationSetting(theme.relationSettings[collection], key, relation)
        if (setting) {
            setting[property] = value
            return notify()
        }
        return snapshot()
    }

    function addPrimSig(type, parent) {
        theme.generalSettings.metaPrimSigs.push({ type, parent })
        return snapshot()
    }

    function addSubSig(type, parent) {
        theme.generalSettings.metaSubsetSigs.push({ type, parent })
        return snapshot()
    }

    function getSigParent(type) {
        const setting = [
            ...theme.generalSettings.metaPrimSigs,
            ...theme.generalSettings.metaSubsetSigs
        ].find(candidate => candidate.type === type)
        if (!setting) throw null
        return setting.parent
    }

    function hasSubsetSig(type) {
        return theme.generalSettings.metaSubsetSigs.some(setting => setting.type === type)
    }

    function resetHierarchy() {
        theme.generalSettings.metaPrimSigs = [{ type: 'univ', parent: null }]
        theme.generalSettings.metaSubsetSigs = []
        return snapshot()
    }

    return {
        init,
        reset,
        snapshot,
        subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        getAtomColor: type => getSignature('nodeColors', 'color', type, 'inherit'),
        getAtomShape: type => getSignature('nodeShapes', 'shape', type, 'inherit'),
        getAtomBorder: type => getSignature('nodeBorders', 'border', type, 'inherit'),
        getAtomVisibility: type => getSignature('nodeVisibility', 'visibility', type, false),
        getInheritedAtomColor: type => inherited(type, 'nodeColors', 'color', '#2ECC40'),
        getInheritedAtomShape: type => inherited(type, 'nodeShapes', 'shape', 'ellipse'),
        getInheritedAtomBorder: type => inherited(type, 'nodeBorders', 'border', 'solid'),
        getInheritedAtomVisibility: type => inherited(type, 'nodeVisibility', 'visibility', false),
        updateAtomColor: (type, value) => setSignature('nodeColors', 'color', type, value),
        updateAtomShape: (type, value) => setSignature('nodeShapes', 'shape', type, value),
        updateAtomBorder: (type, value) => setSignature('nodeBorders', 'border', type, value),
        updateAtomVisibility: (type, value) => setSignature('nodeVisibility', 'visibility', type, value),
        getEdgeColor: relation => relationSetting('edgeColors', 'relation', relation, { key: 'color', value: '#0074D9' }).color,
        getEdgeStyle: relation => relationSetting('edgeStyles', 'relation', relation, { key: 'edgeStyle', value: 'solid' }).edgeStyle,
        isShowAsArcsOn: relation => relationSetting('showAsArcs', 'relation', relation, { key: 'showAsArcs', value: true }).showAsArcs,
        isShowAsAttributesOn: relation => relationSetting('showAsAttributes', 'relation', relation, { key: 'showAsAttributes', value: false }).showAsAttributes,
        getEdgeLabel: relationLabel,
        getAttributeLabel(node, edges = []) {
            const source = node && typeof node.data === 'function' ? node.data() : node
            if (!source || !source.id) return ''
            const attributes = {}
            edges.forEach(edge => {
                const data = typeof edge.data === 'function' ? edge.data() : edge
                if (data.source !== source.id || !data.relation || !this.isShowAsAttributesOn(data)) return
                if (!attributes[data.relation]) attributes[data.relation] = []
                attributes[data.relation].push(data.atoms || [])
            })
            return Object.entries(attributes).map(([name, tuples]) => {
                const values = tuples.map(tuple => tuple.slice(1).join('\u2192')).join(',')
                return `${name}: ${values}`
            }).join('\n') + (Object.keys(attributes).length ? '\n' : '')
        },
        updateEdgeColor: (relation, value) => setRelation('edgeColors', 'relation', 'color', relation, value),
        updateEdgeStyle: (relation, value) => setRelation('edgeStyles', 'relation', 'edgeStyle', relation, value),
        updateShowAsArcs: (relation, value) => setRelation('showAsArcs', 'relation', 'showAsArcs', relation, value),
        updateShowAsAttributes: (relation, value) => setRelation('showAsAttributes', 'relation', 'showAsAttributes', relation, value),
        getAllHiddenAtoms() {
            // Keep only hidden types present in the JSON document hierarchy.
            // Alloy4Fun receives Int and seq/Int in every solver instance,
            // while standalone JSON documents are not required to contain them.
            const knownTypes = new Set([
                ...(theme.generalSettings.metaPrimSigs || []).map(setting => setting.type),
                ...(theme.generalSettings.metaSubsetSigs || []).map(setting => setting.type)
            ])
            return (theme.sigSettings.nodeVisibility || [])
                .filter(setting => setting.visibility && knownTypes.has(setting.type))
                .map(setting => setting.type)
        },
        getAllHiddenRels() {
            return (theme.relationSettings.showAsArcs || [])
                .filter(setting => !setting.showAsArcs)
                .map(setting => setting.relation)
        },
        getLayout: () => theme.generalSettings.currentLayout,
        updateLayout(value) { theme.generalSettings.currentLayout = value; return notify() },
        addPrimSig,
        addSubSig,
        getSigParent,
        hasSubsetSig,
        resetHierarchy,
        setHierarchy({ metaPrimSigs = [], metaSubsetSigs = [] } = {}) {
            theme.generalSettings.metaPrimSigs = copy(metaPrimSigs)
            theme.generalSettings.metaSubsetSigs = copy(metaSubsetSigs)
            return snapshot()
        },
        relationId
    }
}
