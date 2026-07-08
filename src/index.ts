// @noidmejs/atomkit-compiler — compile AQL / atomkit documents to standalone
// React (TSX) source you own. No runtime lock-in: the only dependency of the
// emitted code is React.
import { compilePage, type BuilderDocument } from '@noidmejs/atomkit';
import { emitNode } from './codegen.js';

export interface CompileOptions {
  /** Component name for the generated default export (sanitised). */
  name?: string;
}

/** Compile a parsed atomkit document to a React component (TSX source string). */
export function compileDocumentToReact(doc: BuilderDocument, opts: CompileOptions = {}): string {
  const name = (opts.name ?? 'Page').replace(/[^A-Za-z0-9_]/g, '') || 'Page';
  const body = doc.root.map((n) => emitNode(n, '      ')).join('\n');
  return (
    `import * as React from 'react';\n\n` +
    `export default function ${name}(): React.ReactElement {\n` +
    `  return (\n    <>\n${body}\n    </>\n  );\n}\n`
  );
}

/** Compile AQL source to a React component (TSX source string). */
export function compileToReact(aql: string, opts: CompileOptions = {}): string {
  return compileDocumentToReact(compilePage(aql), opts);
}

export { emitNode } from './codegen.js';
