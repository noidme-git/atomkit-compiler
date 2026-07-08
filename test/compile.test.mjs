import assert from 'node:assert/strict';
import { compileToReact } from '../dist/index.js';

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

console.log('✓ compiler tests passed — AQL → standalone React');
console.log('\n----- sample output -----\n' + code);
