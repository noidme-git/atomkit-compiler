# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — open a GitHub Security Advisory on
this repository (**Security → Report a vulnerability**). Do not file a public
issue for a suspected vulnerability. We aim to acknowledge within 3 business days.

## Supported versions

atomkit-compiler is **pre-1.0 (0.x)** — only the latest published minor receives
fixes, and minor versions may include breaking changes. Pin a version and read the
[CHANGELOG](./CHANGELOG.md) before upgrading.

## Security model / trust boundary

The compiler takes an AQL string / atomkit document (trusted authoring input) and
emits **standalone React (TSX) source** whose only runtime dependency is React. It
carries the runtime's static defences into the generated code:

- **No raw HTML, no `eval`** — text is emitted as JS-string expressions (`{"…"}`),
  never `dangerouslySetInnerHTML`; nothing needs escaping.
- **Styles resolved through atomkit's whitelist** at compile time into literal
  style objects; unknown/dangerous properties are dropped by `resolveStyle`.
- **Dimension props sanitised** — `min` / `width` / `gutter` / `height` are
  `node.props` (not `style`), so they bypass the runtime whitelist; the compiler
  runs them through `safeDim()` (rejects `<>{};`, `url()`, `expression()`,
  `image-set()`, `cross-fade()`, length > 64) and falls back to a safe default.
- **URL guards** — hrefs / image srcs pass through `safeHref` / `safeImageSrc` at
  compile time; an icon `path` is emitted only if it matches the SVG-path charset.
- **Line-terminator safety** — U+2028 / U+2029 (legal in JSON strings but ES source
  line terminators) are escaped so emitted literals parse on every toolchain.
- **Grid columns clamped** to `0…24`.
- **a11y parity with the runtime** — icons emit `role="img"` when labelled and
  `aria-hidden` when not; `aria-describedby` is carried through.

## Governance: the compiler FAILS CLOSED

Static compiled output **cannot** enforce *runtime* governance — per-viewer role /
consent / PII gating happens at render time against facts (auth, roles, consent)
that don't exist at compile time. Rather than silently emit protected content, the
compiler **omits** any node flagged `protected` / `roles` / `consentCategory` /
`pii`, or `hidden` — and recursively strips governed descendants of otherwise-public
containers. It emits a provenance comment counting what was dropped.

**If a node must be shown conditionally per viewer, render it through the
`@noidmejs/atomkit` runtime renderer (which enforces governance), not the compiler.**

## What the host must provide

- The **Content-Security-Policy** for the deployed page (`img-src`, `frame-src`, and
  `connect-src` if you later add data binding).
- **Colour contrast, focus indication, target size** — theme concerns not enforced.
- Treat the **AQL / document input as trusted authoring** — the compiler hardens the
  output, but it is not a sandbox for adversarial source authored by untrusted users.

## Known limitations (0.x)

- Covers **static structure + style + a11y + analytics**. Dynamic concerns (API
  data-binding, responsive media queries, runtime PII/consent gating, the client
  `video` atom) are runtime features — use the atomkit renderer for those.
- Not yet independently penetration-tested.
