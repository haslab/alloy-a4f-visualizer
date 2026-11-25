# alloy-a4f-visualizer

A standalone, reusable visualizer for Alloy instances and traces. It was
originally extracted from Alloy4Fun, but the visualizer itself is an
independent browser component: hosts provide Alloy instance data and optional
preferences; the component owns graph rendering, layouts, themes, atom
positions, trace-state navigation, and projection interaction.

It has no dependency on Meteor, MongoDB, Alloy4Fun services, or the Alloy
solver API. Its input is Alloy instance data in the visualizer's documented
`states`/`loop` envelope. API-response normalization is deliberately outside
the current scope.

## Instance and trace document

An instance or trace has this common shape:

```json
{
  "states": [{ "types": [], "sets": [], "rels": [] }],
  "loop": -1
}
```

`loop: -1` means a single instance and requires exactly one state. A
non-negative loop value identifies a trace and points to its loop target.
Each state's `types`, `sets`, and `rels` contain the Alloy instance data. The
formal schema and examples are in [`schema/`](./schema/) and
[`demo/examples/`](./demo/examples/). Optional solver metadata such as
`bitwidth`, `maxseq`, `mintrace`, and `maxtrace` may be included and is ignored
by graph rendering.

## Use as a component

Install the package in a host project and mount it on a graph container:

```js
import { createVisualizer } from 'alloy-a4f-visualizer'

const visualizer = createVisualizer(document.getElementById('graph'), {
  preferences: savedPreferences,
  appearance: 'dark', // 'light' is also supported
  onPreferencesChange(preferences) {
    persistPreferences(preferences)
  }
})

visualizer.setDocument(instanceOrTrace)
```

Trace and projection controls are created and owned by the component; the host
does not provide control-specific DOM slots. Hosts remain responsible for
obtaining instance documents and persisting preferences. Call `destroy()` when
the component is unmounted. `appearance` selects light or dark graph label and
border colors; hosts should style the graph container background to match their
own surface. The returned visualizer also exposes `setAppearance('light' |
'dark')` for runtime changes.

For compatibility with existing Alloy4Fun model themes, `preferences` and
`onPreferencesChange` use the shape `{ sigSettings, relationSettings,
generalSettings, nodePositions }`. Projection is handled locally but is not
included in persisted preferences yet; derived projected states are never
persisted. See the exported controller and state APIs in [`src/index.js`](./src/index.js).

## Standalone demo

```sh
npm install
npm run demo
```

Open <http://localhost:4173>, paste or select a JSON document, and load it to
inspect the instance or trace.

## Development

```sh
npm test
```

## Third-party attribution

The navigation controls use the Font Awesome Free solid webfont, version
5.6.3, by Fonticons, Inc. ([fontawesome.com](https://fontawesome.com)). The
font is distributed under the SIL Open Font License 1.1; its license and
required attribution are included in [`LICENSES/FontAwesome-LICENSE.txt`](./LICENSES/FontAwesome-LICENSE.txt).
The webfont is installed from the exact `@fortawesome/fontawesome-free@5.6.3`
dependency and bundled locally by consuming applications; no Font Awesome CDN
or second Font Awesome version is required.

## Repository and A4F integration

The intended GitHub repository is
[`haslab/alloy-a4f-visualizer`](https://github.com/haslab/alloy-a4f-visualizer).
This checkout is prepared with the package identity and repository metadata,
but Git repository initialization, remote creation, commits, tags, and pushes
are intentionally left to the maintainer.

While both checkouts are on the same development machine, Alloy4Fun can depend
on this package through a local `file:` dependency. Once the GitHub repository
exists and has its initial commit, switch A4F's dependency to the repository
URL and pin it to a release tag (rather than a moving branch) before building
or deploying A4F. Keep the package name `alloy-a4f-visualizer` consistent in
both projects.
