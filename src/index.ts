// @noidmejs/atomkit-compiler — compile AQL / atomkit documents to standalone
// React (TSX) source you own. No runtime lock-in: the only dependency of the
// emitted code is React.
import { compilePage, type BuilderDocument, type BuilderNode } from '@noidmejs/atomkit';
import { emitNode } from './codegen.js';

export interface CompileOptions {
  /** Component name for the generated default export (sanitised). */
  name?: string;
}

// Static compiled output CANNOT enforce runtime governance (per-viewer role /
// consent / PII gating happens at render time). The compiler therefore FAILS
// CLOSED: any node flagged protected / roles / pii / consent, or hidden, is
// OMITTED from the emitted code. Render those through the @noidmejs/atomkit
// runtime renderer (which enforces governance) instead of compiling them.
function isGoverned(n: BuilderNode): boolean {
  const s = n.meta?.security;
  return !!(n.hidden || s?.protected || (s?.roles && s.roles.length > 0) || s?.pii || s?.consentCategory);
}
function stripGoverned(nodes: BuilderNode[], dropped: { n: number }): BuilderNode[] {
  return nodes
    .filter((x) => {
      if (isGoverned(x)) {
        dropped.n += 1;
        return false;
      }
      return true;
    })
    .map((x) => (x.children ? { ...x, children: stripGoverned(x.children, dropped) } : x));
}

/** Compile a parsed atomkit document to a React component (TSX source string). */
export function compileDocumentToReact(doc: BuilderDocument, opts: CompileOptions = {}): string {
  const name = (opts.name ?? 'Page').replace(/[^A-Za-z0-9_]/g, '') || 'Page';
  const dropped = { n: 0 };
  const root = stripGoverned(doc.root, dropped);
  const body = root.map((n) => emitNode(n, '      ')).join('\n');
  const note =
    dropped.n > 0
      ? `// atomkit-compiler: omitted ${dropped.n} governed/hidden node(s) — static output cannot enforce\n// runtime governance (role/consent/PII gating); render those via the @noidmejs/atomkit runtime.\n`
      : '';
  return (
    `import * as React from 'react';\n\n` +
    note +
    `export default function ${name}(): React.ReactElement {\n` +
    `  return (\n    <>\n${body}\n    </>\n  );\n}\n`
  );
}

/** Compile AQL source to a React component (TSX source string). */
export function compileToReact(aql: string, opts: CompileOptions = {}): string {
  return compileDocumentToReact(compilePage(aql), opts);
}

export { emitNode } from './codegen.js';
