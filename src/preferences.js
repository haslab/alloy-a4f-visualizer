/** Serialize persisted preferences using the existing model-theme shape. */
export function serializePreferences(theme, positions) {
    return {
        ...theme,
        nodePositions: positions || {}
    }
}
