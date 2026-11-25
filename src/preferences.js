/** Serialize persisted preferences using the existing model-theme shape. */
export function serializePreferences(theme, positions) {
    return {
        ...theme,
        nodePositions: positions || {}
    }
}

/** Resolve the initial trace state, preserving A4F's stored theme state when present. */
export function resolveInitialStateIndex(document, requestedIndex, legacyPreferences) {
    const states = document && (document.states || document.instance)
    if (!Array.isArray(states) || states.length === 0) return 0

    const index = requestedIndex === undefined
        ? legacyPreferences && legacyPreferences.currentState
        : requestedIndex
    if (!Number.isInteger(index)) return 0
    return Math.max(0, Math.min(index, states.length - 1))
}

/** Use a stored state only for the first document installed by this visualizer. */
export function createInitialStateResolver(legacyPreferences) {
    let pendingState = legacyPreferences && legacyPreferences.currentState
    return (document, requestedIndex) => {
        const index = resolveInitialStateIndex(document, requestedIndex, { currentState: pendingState })
        pendingState = undefined
        return index
    }
}
