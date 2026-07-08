# Changelog

All notable changes to `@noidmejs/atomkit-compiler`. Pre-1.0: minor versions may break.

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
