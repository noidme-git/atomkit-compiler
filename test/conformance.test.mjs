// Compiler ↔ runtime conformance.
//
// The compiler is a SECOND, hand-written implementation of atom semantics
// (default styles, tag choice, prop coercion). Nothing used to test that compiled
// TSX renders the same DOM as the runtime renderer, so the two drifted: unknown
// atoms failed closed at runtime but open in codegen, `row wrap` and `list
// ordered` used different truthiness, and `list` compiled to a native bulleted
// <ul> instead of the runtime's marker-less flex column with role="list".
//
// This harness compiles each document to TSX, transpiles it, renders it, and
// diffs the HTML against the runtime's. "No lock-in" is only true while this passes.
//
// Transpiled with esbuild rather than the TypeScript API: TypeScript 7 removed the
// classic ("Strada") programmatic Compiler API entirely — `import * as ts from
// 'typescript'` now yields only { version, versionMajorMinor }, and transpileModule
// is undefined. A stable programmatic API is not expected before TS 7.1.

import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Render, defaultAtoms, compilePage } from '@noidmejs/atomkit';
import { compileDocumentToReact } from '../dist/index.js';

/** Transpile emitted TSX and evaluate it into a React component.
 *
 *  Transpiled to CommonJS and evaluated through a module shim rather than by
 *  rewriting the source: esbuild hoists `export default` into a trailing
 *  `export { X as default }`, so a regex that rewrites the export statement
 *  silently yields nothing and the harness goes blind while still reporting green. */
function componentFrom(tsx) {
  const js = transformSync(tsx, { loader: 'tsx', jsx: 'transform', format: 'cjs', target: 'es2020' }).code;
  const mod = { exports: {} };
  const req = (name) => {
    if (name === 'react') return React;
    throw new Error(`compiled component required an unexpected module: ${name}`);
  };
  new Function('require', 'module', 'exports', js)(req, mod, mod.exports);
  const Component = mod.exports.default;
  if (typeof Component !== 'function') throw new Error('compiled TSX did not export a component');
  return Component;
}

const runtimeHtml = (doc) =>
  renderToStaticMarkup(React.createElement(Render, { document: doc, registry: defaultAtoms, context: { consent: { analytics: true } } }));

const compiledHtml = (doc) => renderToStaticMarkup(React.createElement(componentFrom(compileDocumentToReact(doc))));

// The runtime wraps output in a Fragment and may prepend a <style> block for
// responsive rules; the compiler emits neither. Compare the node markup only.
const stripStyleBlock = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, '');

const CORPUS = [
  ['text + heading', 'page "p" {\n  heading "Title" level=3\n  text "Body" as=span\n}'],
  ['container dims', 'page "p" {\n  container width=720px gutter=8px { text "x" }\n}'],
  ['section contained', 'page "p" {\n  section { text "x" }\n}'],
  ['section full-bleed', 'page "p" {\n  section contain=false { text "x" }\n}'],
  ['row wrap=false (string)', 'page "p" {\n  row wrap=false { text "a" }\n}'],
  ['row default wrap', 'page "p" {\n  row { text "a" }\n}'],
  ['grid cols', 'page "p" {\n  grid cols=3 { text "a" }\n}'],
  ['grid min', 'page "p" {\n  grid min=240px { text "a" }\n}'],
  ['grid cols clamped', 'page "p" {\n  grid cols=100000 { text "a" }\n}'],
  ['stack', 'page "p" {\n  stack { text "a" }\n}'],
  ['list unordered marker-less', 'page "p" {\n  list { text "a"\n    text "b" }\n}'],
  ['list ordered (string true)', 'page "p" {\n  list ordered=true { text "a" }\n}'],
  ['list with marker', 'page "p" {\n  list marker=disc { text "a" }\n}'],
  ['chip', 'page "p" {\n  chip "New"\n}'],
  ['link external', 'page "p" {\n  link "Go" href=https://x.example external\n}'],
  ['button', 'page "p" {\n  button "Click"\n}'],
  ['divider + spacer', 'page "p" {\n  divider\n  spacer height=40px\n}'],
  ['image with alt', 'page "p" {\n  image src=/a.webp alt="A"\n}'],
  ['hostile dimension prop', 'page "p" {\n  container width="1px;position:fixed" { text "x" }\n}'],
  ['analytics attrs', 'page "p" {\n  text "t" track=cta event=click category=nav\n}'],
  ['a11y attrs', 'page "p" {\n  text "t" aria-label="L" role=note tabindex=0 lang=fr\n}'],
];

let checked = 0;
for (const [name, aql] of CORPUS) {
  const doc = compilePage(aql);
  const a = stripStyleBlock(runtimeHtml(doc));
  const b = compiledHtml(doc);
  assert.equal(b, a, `compiled output diverges from the runtime for: ${name}\n  runtime : ${a}\n  compiled: ${b}`);
  checked += 1;
}

// Unknown atoms must fail CLOSED on BOTH sides (renderNode returns null; codegen
// omits + warns). Previously the compiler emitted a generic <div> with the text.
{
  const doc = { version: 1, root: [{ id: 'x', type: 'not-an-atom', props: { text: 'leak' } }] };
  assert.ok(!runtimeHtml(doc).includes('leak'), 'runtime fails closed on an unknown atom');
  const warns = [];
  const tsx = compileDocumentToReact(doc, { onWarn: (w) => warns.push(w) });
  assert.ok(!tsx.includes('leak'), 'compiler fails closed on an unknown atom');
  assert.equal(warns.length, 1);
  assert.match(warns[0].reason, /unknown atom type/);
  assert.equal(compiledHtml(doc), runtimeHtml(doc), 'both render nothing');
}

// Runtime-only atoms are omitted + reported, never approximated with a <div>.
{
  const doc = compilePage('page "p" {\n  video url=https://youtu.be/abc title="T"\n}');
  const warns = [];
  compileDocumentToReact(doc, { onWarn: (w) => warns.push(w) });
  assert.match(warns[0].reason, /runtime-only/);
}

// Dynamic features the static build cannot carry must be REPORTED, not silent —
// build.ts used to claim the ejected component "keeps the client-side fetch".
{
  const doc = compilePage('page "p" {\n  heading "H" size=12px md:size=4rem\n  text "v" api=https://a.example/x bind=text\n}');
  const warns = [];
  const tsx = compileDocumentToReact(doc, { onWarn: (w) => warns.push(w) });
  assert.ok(warns.some((w) => /responsive/.test(w.reason)), 'responsive overrides are reported as dropped');
  assert.ok(warns.some((w) => /does NOT fetch/.test(w.reason)), 'data bindings are reported as not emitted');
  assert.ok(tsx.includes('do not match the runtime renderer'), 'divergences are recorded in the emitted file');
}

// Every registered atom is either compiled or explicitly runtime-only: adding a
// new atom to the core registry without teaching the compiler now fails here.
{
  const uncovered = [];
  for (const type of Object.keys(defaultAtoms)) {
    const doc = { version: 1, root: [{ id: '0', type, props: { text: 'x', path: 'M0 0', summary: 's' } }] };
    const warns = [];
    compileDocumentToReact(doc, { onWarn: (w) => warns.push(w) });
    if (warns.some((w) => /unknown atom type/.test(w.reason))) uncovered.push(type);
  }
  assert.deepEqual(uncovered, [], `atoms known to the runtime but not the compiler: ${uncovered.join(', ')}`);
}

console.log(`✓ conformance: ${checked} documents render identically via runtime SSR and compiled TSX (+ fail-closed unknown atoms, reported divergences, full atom coverage)`);
