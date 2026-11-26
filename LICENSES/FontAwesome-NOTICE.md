# Navigation icons

Font Awesome Free 5.6.3 by Fonticons, Inc. (<https://fontawesome.com>).
Official solid SVG paths are reproduced without modification from the pinned
`@fortawesome/free-solid-svg-icons@5.6.3` development dependency.

The icons are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The upstream package code is MIT licensed; see [the upstream license notice](FontAwesome-LICENSE.txt).
The font license in that notice does not apply: no fonts are distributed here.

`src/iconDefinitions.js` contains only the five required icons. To regenerate,
run `node scripts/generate-icons.cjs` from the project root. Review and commit
the generated definitions alongside the source script. Use `--check` to verify
that regeneration is unnecessary without writing any files.
The regular test suite checks the definitions against the pinned upstream icons.

Controls render inline SVG with `currentColor`. No icon CSS, font loading,
runtime Font Awesome dependency, CDN or host icon setup is required.
