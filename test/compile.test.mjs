import assert from 'node:assert/strict';
import { compileToReact, compileDocumentToReact } from '../dist/index.js';

const aql = `page "Home" {
  section pad-y=40 bg="var(--soft)" {
    heading "Hello" level=1 color=#0b1220
    text "Body copy here"
    button "Go" href=#careers external track=cta_top aria-label="Go to careers"
    grid cols=2 gap=16 {
      text "a"
      text "b"
    }
    image src=/media/x.webp alt="a photo"
  }
}`;

const code = compileToReact(aql, { name: 'Home' });

assert.ok(code.includes('import * as React'), 'imports React');
assert.ok(code.includes('export default function Home'), 'named component');
assert.ok(code.includes('<section'), 'section');
assert.ok(code.includes('<h1'), 'heading level → h1');
assert.ok(code.includes('{"Hello"}'), 'text emitted as a JS-string expression (no escaping needed)');
assert.ok(code.includes('gridTemplateColumns'), 'grid template computed at compile time');
assert.ok(code.includes('repeat(2,minmax(0,1fr))'), 'grid cols=2 → template');
assert.ok(code.includes('<a href={"#careers"}') && code.includes('target="_blank"'), 'button → external anchor');
assert.ok(code.includes('data-analytics-id={"cta_top"}'), 'analytics attribute compiled in');
assert.ok(code.includes('aria-label={"Go to careers"}'), 'a11y attribute compiled in');
assert.ok(code.includes('<img src={"/media/x.webp"}') && code.includes('alt={"a photo"}'), 'image with guarded src + alt');
assert.ok(!code.includes('@noidmejs/atomkit'), 'emitted code has NO atomkit runtime dependency (only React)');

// --- Governance: static output CANNOT enforce runtime gating, so it fails closed
//     by OMITTING any governed (protected/roles/pii/consent) or hidden node. ---
const governedDoc = {
  version: 1,
  root: [
    { id: 'ok', type: 'text', props: { text: 'Public copy' } },
    { id: 'secret', type: 'text', props: { text: 'Internal roadmap' }, meta: { security: { protected: true, roles: ['admin'] } } },
    { id: 'email', type: 'text', props: { text: 'a@b.com' }, meta: { security: { pii: true } } },
    { id: 'hidden', type: 'text', props: { text: 'Draft' }, hidden: true },
  ],
};
const gCode = compileDocumentToReact(governedDoc, { name: 'Gov' });
assert.ok(gCode.includes('Public copy'), 'public node is emitted');
assert.ok(!gCode.includes('Internal roadmap'), 'protected/roles node is OMITTED (fail-closed)');
assert.ok(!gCode.includes('a@b.com'), 'pii node is OMITTED (fail-closed)');
assert.ok(!gCode.includes('Draft'), 'hidden node is OMITTED');
assert.ok(gCode.includes('omitted 3 governed/hidden node(s)'), 'emits a provenance note counting omitted nodes');

// --- Governed CHILDREN are stripped even when the parent is public. ---
const nestedDoc = {
  version: 1,
  root: [
    { id: 'sec', type: 'section', props: {}, children: [
      { id: 'pub', type: 'text', props: { text: 'Visible child' } },
      { id: 'priv', type: 'text', props: { text: 'Secret child' }, meta: { security: { pii: true } } },
    ] },
  ],
};
const nCode = compileDocumentToReact(nestedDoc, { name: 'Nested' });
assert.ok(nCode.includes('Visible child') && !nCode.includes('Secret child'), 'governed child stripped, public sibling kept');

// --- Dimension props bypass the runtime style whitelist, so the compiler
//     sanitises them; a hostile value must fall back, never reach the output. ---
const evilDoc = {
  version: 1,
  root: [
    { id: 'sp', type: 'spacer', props: { height: 'url(javascript:alert(1))' } },
    { id: 'ct', type: 'container', props: { width: 'expression(alert(1))' }, children: [] },
  ],
};
const eCode = compileDocumentToReact(evilDoc, { name: 'Evil' });
assert.ok(!eCode.includes('javascript:') && !eCode.includes('expression('), 'hostile dimension values rejected → fallback');
assert.ok(eCode.includes('24px') && eCode.includes('1200px'), 'sanitised dimensions fall back to safe defaults');

// --- Icon a11y parity with the runtime: labelled → role="img", unlabelled → aria-hidden. ---
const iconDoc = {
  version: 1,
  root: [
    { id: 'i1', type: 'icon', props: { path: 'M4 4 L20 20' } },
    { id: 'i2', type: 'icon', props: { path: 'M4 4 L20 20' }, a11y: { ariaLabel: 'Search' } },
  ],
};
const iCode = compileDocumentToReact(iconDoc, { name: 'Icons' });
assert.ok(iCode.includes('aria-hidden'), 'unlabelled icon → aria-hidden');
assert.ok(iCode.includes('role="img"') && iCode.includes('Search'), 'labelled icon → role="img" + aria-label');

console.log('✓ compiler tests passed — AQL → standalone React (+ governance, dim-sanitise, icon a11y)');
console.log('\n----- sample output -----\n' + code);
