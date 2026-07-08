# @noidmejs/atomkit-compiler

**Compile [AQL](https://github.com/noidme-git/atomkit) → standalone React (TSX) you own.**
No runtime lock-in: the only dependency of the emitted component is React itself.

```bash
npm i -D @noidmejs/atomkit-compiler
```

## Node API

```ts
import { compileToReact } from '@noidmejs/atomkit-compiler';

const tsx = compileToReact(`
page "Home" {
  section pad-y=72 bg="#f7f9fc" {
    heading "Hello" level=1 color=#0b1220
    button "Get started" href=/start track=cta
  }
}
`, { name: 'Home' });

// → import * as React from 'react';
//   export default function Home() { return ( <> <section …> … </section> </> ); }
```

## CLI

```bash
atomkit-compile page.aql -o page.tsx --name Home
```

Wire it into your build to turn `.aql` files into components at deploy time.

## What it does

- Parses AQL (via `@noidmejs/atomkit`) to the document tree, then emits JSX.
- **Styles resolved at compile time** through atomkit's whitelist → literal style objects.
- **hrefs / image srcs guarded** at compile time (`safeHref` / `safeImageSrc`).
- **Text emitted as JS-string expressions**, so nothing needs escaping.
- a11y + analytics attributes compiled in.

## Scope (v0.1)

Covers **static structure + style + a11y + analytics** — great for marketing/content
pages you want to own as code. Dynamic concerns (API data-binding, responsive media
queries, runtime PII/consent gating, the client `video` atom) are **runtime** features:
use the `@noidmejs/atomkit` renderer for those. A Vite/Next `.aql` plugin and a
document/Next-RSC backend are on the roadmap.

MIT © noidmejs
