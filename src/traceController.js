/**
 * Controls navigation within one Alloy trace.
 *
 * A trace is an ordered list of states and an optional loop target. The
 * controller contains no rendering or application/server dependencies.
 */
export function createTraceController({ onChange } = {}) {
    let states = []
    let loopTo
    let traceDocument = false
    let index = -1
    const listeners = new Set()

    if (onChange) listeners.add(onChange)

    function notify() {
        if (index >= 0) {
            for (const listener of listeners) listener(states[index], index)
        }
        return current()
    }

    function current() {
        return index >= 0 ? states[index] : undefined
    }

    function setTrace(trace, initialIndex = 0) {
        states = trace && trace.states ? trace.states : []
        traceDocument = Boolean(trace && Number.isInteger(trace.loop) && trace.loop >= 0)
        loopTo = traceDocument ? trace.loop : undefined
        if (states.length === 0) index = -1
        else setIndex(initialIndex)
        return current()
    }

    function setIndex(nextIndex) {
        if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= states.length) {
            throw new RangeError(`Trace state index out of range: ${nextIndex}`)
        }
        index = nextIndex
        return notify()
    }

    function next() {
        if (index < 0 || states.length === 0) return undefined
        if (index < states.length - 1) return setIndex(index + 1)
        if (Number.isInteger(loopTo)) return setIndex(loopTo)
        return current()
    }

    function previous() {
        if (index <= 0) return current()
        return setIndex(index - 1)
    }

    function subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
    }

    return {
        setTrace,
        setIndex,
        current,
        next,
        previous,
        subscribe,
        index: () => index,
        length: () => states.length,
        hasNext: () => index >= 0 && (index < states.length - 1 || Number.isInteger(loopTo)),
        hasPrevious: () => index > 0,
        isTrace: () => traceDocument
    }
}
