#!/usr/bin/env node
// atomkit-compile <file.aql> [-o out.tsx] [--name Component]
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { compileToReact } from './index.js';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('-'));
if (!input) {
  console.error('usage: atomkit-compile <file.aql> [-o out.tsx] [--name Component]');
  process.exit(1);
}
const oIdx = args.indexOf('-o');
const nIdx = args.indexOf('--name');
const output = oIdx >= 0 ? args[oIdx + 1]! : input.replace(/\.aql$/, '.tsx');
const name = (nIdx >= 0 ? args[nIdx + 1]! : basename(input).replace(/\.aql$/, '')).replace(/[^A-Za-z0-9_]/g, '') || 'Page';

try {
  const code = compileToReact(readFileSync(input, 'utf8'), { name });
  writeFileSync(output, code);
  console.log(`atomkit: compiled ${input} -> ${output}`);
} catch (err) {
  console.error(`atomkit: compile failed — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
