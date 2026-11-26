# Alloy A4F Visualizer

An interactive visualizer for Alloy instances and traces, originally developed
for Alloy4Fun. It handles layouts, themes, atom positions, trace navigation and
local projection, independently of any framework, database or Alloy server.

## Try the demo

Requires Node.js 22 or 24:

```sh
npm ci
npm run demo
```

Open <http://localhost:4173> and choose an example or load your own JSON file.
Right-click a node, edge or the canvas to edit its appearance and layout.

## Use in an application

Install from [GitHub](https://github.com/haslab/alloy-a4f-visualizer), using a
specific tag or commit for reproducible builds. Import the component and its
stylesheet:

```js
import { createVisualizer } from 'alloy-a4f-visualizer'
import 'alloy-a4f-visualizer/visualizer.css'

const visualizer = createVisualizer(document.getElementById('graph'))
visualizer.setDocument(instanceOrTrace)

// When removing the view:
visualizer.destroy()
```

Mount into an attached element with its own parent container. The stylesheet
provides the default canvas styling and local navigation icons. Your application
supplies instances and optionally saves preferences.

See the [API reference](docs/API.md) for sizing, dark/light appearance,
preferences, methods and framework integration.

## JSON format

Both instances and traces have the same shape:

```json
{
  "states": [{ "types": [], "sets": [], "rels": [] }],
  "loop": -1
}
```

- **Instance:** one state and `loop: -1`.
- **Trace:** one or more states; `loop` is the index to return to after the last.
- Each state contains types, subsets (`sets`) and relation tuples (`rels`).

See the [examples](demo/examples/), [JSON schema](schema/instance-trace.schema.json)
and [format details](docs/API.md#instance-format).

The demo includes higher-arity instance/trace examples for ternary and quaternary
labels, parallel edges, self-loops and subsets with multiple parents.

## Development

```sh
npm ci
npm run check
```

This runs core, package and browser checks. Browser tests use installed Google
Chrome by default. Alternatively, run `npx playwright install chromium` and
`E2E_CHANNEL=chromium npm run check`.

### Projection integration test

The optional projection test uses the separate
[Alloy Web API](https://github.com/haslab/alloy-web-api), a Java/Quarkus service
that exposes the Alloy library over HTTP. It obtains instances through
`/getInstances` and compares this visualizer's local projection with Alloy's
reference result from `/getProjection`.

Follow the API project's README to build and start it, then run:

```sh
ALLOY_WEB_API_URL=http://localhost:4001 npm run test:projection
```

The API is only needed for this integration test, not for the demo or rendering.
Without `ALLOY_WEB_API_URL`, the ordinary test suite skips this comparison.

## Credits and licensing

Source code is licensed under the [MIT License](LICENSE), preserving the
original Alloy4Fun copyright notice.

Rendering uses [Cytoscape.js](https://js.cytoscape.org/). Navigation uses the
official Font Awesome Free 5.6.3 SVG icons by Fonticons, Inc., bundled locally
under CC BY 4.0; see [the third-party notice](LICENSES/FontAwesome-NOTICE.md).
