# Component API

## Mount and load

Use a bundler that resolves npm imports, CSS and relative font URLs. The graph
needs an attached parent with a nonzero size. The component stylesheet supplies
a 400px default canvas height; override it in the host if needed.

```html
<div style="height: 500px"><div id="graph"></div></div>
```

```js
import { createVisualizer } from 'alloy-a4f-visualizer'
import 'alloy-a4f-visualizer/visualizer.css'

const visualizer = createVisualizer(document.getElementById('graph'), {
  preferences: savedPreferences,
  appearance: 'light',
  onPreferencesChange(preferences) {
    persistPreferences(preferences)
  }
})
visualizer.setDocument(instanceOrTrace)
```

Neither Font Awesome CSS nor a remote font service is needed: the stylesheet
loads the bundled navigation font. Give each visualizer its own parent surface.
Mount only in the browser, and call `destroy()` before removing or reusing its
container. Imports are safe on the server, but mounting requires the DOM.

## Methods

| Method | Purpose |
| --- | --- |
| `setDocument(document, initialIndex?)` | Load a new document and fit it. Trace states share a layout and viewport. Saved positions apply to the first document; replacement documents reset them. Invalid input leaves the previous document intact. |
| `trace.next()`, `trace.previous()`, `trace.setIndex(index)` | Navigate states; the last state follows `loop`. |
| `projection.setProjection({ Person: 'Person$0' })`, `projection.clear()` | Focus an atom for each projected type, or clear projection. |
| `setTheme(theme)` | Apply signature, relation and general settings. |
| `setAppearance('light' \| 'dark')` | Choose foreground/outline colours; the host supplies a matching background. |
| `preferences()`, `capturePositions()` | Read preferences or capture current atom coordinates. |
| `snapshot()` | Read the document, current state, theme, positions and projection. |
| `destroy()` | Release controls, renderer, subscriptions and resize observer. Safe to call twice. |

The host obtains instances and handles persistence and navigation between
separate solver solutions. The component owns theme editing, layouts, positions,
trace-state controls, projection controls and the context menu. Resizing a host
pane resizes the renderer without resetting the viewport.

## Preferences

Preferences retain the original Alloy4Fun model-theme shape:

```js
{ sigSettings, relationSettings, generalSettings, nodePositions }
```

`onPreferencesChange` reports theme edits, completed node drags, layouts and
explicit position captures. The host decides where to store them. Projection
assignments are not included in saved preferences; derived projected states are
never stored.

## Instance format

See the [JSON schema](../schema/instance-trace.schema.json) and
[examples](../demo/examples/). Both instances and traces use `states` and `loop`.
For a non-trace, `loop` is -1 and there is exactly one state. Otherwise `loop`
is the index of the state reached after the last state.

Each state has three arrays:

- `types`: `{ name, parents, atoms, isVar? }`. A type has at most one immediate
  parent. Use an empty array for a root, or `["univ"]` for a top-level Alloy type.
- `sets`: the same fields, but multiple parents are allowed, for example
  `sig S in A + B {}`. This also represents unary relations produced by projection.
- `rels`: `{ name, atoms, arity?, types? }`. `atoms` contains tuples; `types`
  gives the signature name of each column. Arity can be inferred from nonempty
  tuples. Provide explicit arity and types for empty relations and projection.

Legacy `parent` strings are accepted and normalized to `parents` arrays.
Optional `scope` metadata (`bitwidth`, `maxseq`, `mintrace`, `maxtrace`) is
preserved but does not affect rendering. Extra solver-response fields are also
allowed. Runtime normalization additionally checks loop bounds and tuple lengths.

Only top-level, non-mutable types are projectable, matching the Alloy GUI.
Untyped relations can be displayed but are preserved unchanged by projection.

The schema export is `alloy-a4f-visualizer/schema`. The old stylesheet path
`alloy-a4f-visualizer/src/visualizer.css` remains an alias. Low-level graph,
renderer, style, interaction and theme helpers are exported for custom hosts;
see [src/index.js](../src/index.js).
