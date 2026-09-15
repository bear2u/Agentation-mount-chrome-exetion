import { readFile } from 'node:fs/promises';

const bundlePath = new URL('../dist/content.js', import.meta.url);
const bundle = await readFile(bundlePath, 'utf8');

const forbiddenRuntimeGlobals = [
  'process.env.NODE_ENV',
  'require("react")',
  "require('react')",
];

const found = forbiddenRuntimeGlobals.filter((value) => bundle.includes(value));

if (found.length > 0) {
  console.error(`Content bundle contains unsupported runtime globals: ${found.join(', ')}`);
  process.exit(1);
}

console.log('Content bundle runtime globals: verified');
