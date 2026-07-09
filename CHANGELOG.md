# Changelog

All notable changes to `@noidmejs/atomkit-compiler`. Pre-1.0: minor versions may break.

## 0.4.0

### BREAKING
- **Node >= 22.** `engines` was `">=18"`, but Node 18 reached end-of-life on
  2025-04-30 and Node 20 on 2026-04-30 (per `nodejs/Release/schedule.json`).
  Installing on Node 18/20/21 now fails with `EBADENGINE` under `--engine-strict`.
  CI tests on 22 (maintenance LTS), 24 (active LTS) and 26 (current).

### Changed
- `typescript` devDependency → `^7.0.0`; `@types/node` → `^22` (tracks the
  MINIMUM supported runtime, not the newest — typing against Node 26 while
  claiming `>=22` would bless APIs that do not exist on the oldest runtime we support).
- `prepublishOnly` now runs `npm run build && npm test`, not just the build.

### Fixed
- **The conformance harness no longer depends on the TypeScript Compiler API.**
  TypeScript 7 removed the classic ("Strada") programmatic API entirely: `import *
  as ts from 'typescript'` now yields only `{ version, versionMajorMinor }`, and
  `ts.transpileModule` is `undefined`. A stable programmatic API is not expected
  before TS 7.1. `test/conformance.test.mjs` now transpiles the emitted TSX with
  **esbuild** (new devDependency) and evaluates it through a CommonJS module shim
  rather than rewriting the source — esbuild hoists `export default` into a
  trailing `export { X as default }`, so the old regex would have silently
  yielded nothing and the harness would have gone blind while still reporting green.
  Verified: 21/21 documents still match, and an injected divergence is still caught.
- `tsconfig.json` gains `"types": ["node"]` — TS 7 no longer includes `@types/*`
  implicitly, so `cli.ts` failed to resolve `node:fs`/`process`/`console`.
- Requires `@noidmejs/atomkit` `^0.7.0`.

## 0.3.0

The compiler is a second, hand-written implementation of atom semantics, and
nothing tested that compiled TSX rendered the same DOM as the runtime. It had
already drifted. "No lock-in" is only true while the new conformance suite passes.

### Fixed — BREAKING
- **Unknown atom types failed OPEN.** The runtime renders nothing for an
  unregistered type (`renderNode` returns `null`), but codegen emitted a generic
  `<div>` carrying the node's text — so a custom or misspelled atom leaked raw
  content into the compiled build while rendering as nothing under SSR. Codegen now
  fails closed and reports it.
- **`list` compiled to a native bulleted `<ul>`** with browser default margins and
  no list role, while the runtime renders a marker-less flex column with
  `role="list"` / `role="listitem"` — silently dropping the WCAG 1.3.1 fix core
  added in 0.5.0. Now identical.
- **Prop coercion diverged from the runtime.** `row wrap` compared `=== false` and
  `list ordered` compared `=== true`, but AQL yields the *strings* `'false'` /
  `'true'`. Both now use the runtime's `isFalse`/`isTrue` semantics.
- **`video` was compiled to a generic `<div>`.** It is a runtime-only atom; it is
  now omitted and reported rather than approximated.
- **`safeDim` was a second, hand-maintained copy** of the runtime's dimension
  sanitiser. It is now imported from `@noidmejs/atomkit` — the guarantee cannot drift.
- `grid cols` is clamped to 24 on both sides; `accordion-item` emits the runtime's
  `cursor: pointer` summary style.

### Added
- **`CompileOptions.onWarn`** — reports every node the compiler cannot reproduce
  faithfully: unknown atoms, runtime-only atoms, dropped responsive overrides, and
  data bindings. The emitted file records the same list in its header comment.
  **The compiled component does not fetch**; a data-bound node renders its authored
  fallback forever. This was previously undocumented and actively mis-stated.
- **`test/conformance.test.mjs`** — transpiles the emitted TSX with the real
  TypeScript compiler, renders it, and diffs the HTML against the runtime renderer
  over a 21-document corpus. Also asserts every registered atom is either compiled
  or explicitly runtime-only, so adding an atom to core without teaching the
  compiler now fails CI.

## 0.2.0
### Security / governance (from the adversarial audit)
- **Governance-aware codegen, fail-closed**: nodes flagged `protected` / `roles` /
  `consentCategory` / `pii`, or `hidden`, are **omitted** from the emitted code —
  including governed descendants of public containers — with a provenance comment
  counting what was dropped. Static output cannot enforce runtime gating, so it
  refuses to emit gated content rather than leak it.
- **Dimension props sanitised** (`min` / `width` / `gutter` / `height`): these are
  `props`, not `style`, so they bypass the runtime whitelist. New `safeDim()` rejects
  `<>{};`, `url()`, `expression()`, `image-set()`, `cross-fade()` and over-long values,
  falling back to safe defaults.
- **U+2028 / U+2029 escaped** in emitted string literals (legal in JSON, but ES source
  line terminators) so output parses on every toolchain.
- **Grid columns clamped** to `0…24`.
### Accessibility
- **Icon a11y parity with the runtime** — labelled icons emit `role="img"`, unlabelled
  emit `aria-hidden`; `aria-describedby` carried through.
### Other
- Depends on `@noidmejs/atomkit` `^0.5.0`.

## 0.1.0
- Initial release: AQL / atomkit document → standalone React (TSX), no runtime
  lock-in; styles resolved + URLs guarded at compile time; text as JS-string
  expressions; a11y + analytics attributes; `atomkit-compile` CLI.
