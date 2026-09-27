#!/usr/bin/env node
// Prints a few columns of a digest CSV, aligned, for a readable scan report.
//
// ⚠️⚠️ WHY THIS FILE EXISTS. The scan report used to extract columns with
// `awk -F','` on HARDCODED INDICES, and printed gibberish for an unknown
// length of time: the years-required column printed as a date, the "why"
// column as a title, the verdict as a company. The indices came from a column
// order that no longer existed. Two defects, not one:
//   1. Hardcoded INDICES drift silently the moment a column moves. Hence the
//      selection BY NAME here: a renamed or moved column is a loud error,
//      never a neighbouring column printed in its place.
//   2. `-F','` splits inside quoted fields. Titles and reasons almost always
//      contain commas, so the split was wrong even when the indices were right.
// Never go back to indices.
//
// Usage: node csv-table.mjs <file.csv> <column...> [--limit N] [--width N]

import { readFileSync } from 'node:fs';
import { parseCsv } from './lib/text.mjs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  process.stderr.write('Usage: node csv-table.mjs <file.csv> <column...> [--limit N] [--width N]\n');
  process.exit(2);
}

let limit = 12;
let width = 38;
const wanted = [];
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === '--limit') limit = Number(rest[(i += 1)]);
  else if (rest[i] === '--width') width = Number(rest[(i += 1)]);
  else wanted.push(rest[i]);
}

// parseCsv strips a trailing \r: without it, in a CRLF file, the LAST column is
// called "link\r" and every selection by name fails on it.
const rows = parseCsv(readFileSync(file, 'utf8'));
if (!rows.length) process.exit(0);
const header = rows[0];
const cols = wanted.length ? wanted : header;

// ⚠️ A missing column is an ERROR, not an empty field: that silence is exactly
// what let the report print nonsense.
const idx = cols.map((name) => {
  const i = header.indexOf(name);
  if (i === -1) {
    process.stderr.write(`✗ column "${name}" missing from ${file}\n  available columns: ${header.join(', ')}\n`);
    process.exit(1);
  }
  return i;
});

const cut = (s) => (s.length > width ? `${s.slice(0, width - 1)}…` : s);
const body = rows.slice(1, 1 + limit).map((r) => idx.map((i) => cut((r[i] ?? '').trim())));
const widths = idx.map((_, c) => Math.max(...body.map((r) => r[c].length), 0));
for (const r of body) {
  console.log(`  ${r.map((v, c) => v.padEnd(widths[c])).join('  ')}`.trimEnd());
}
const more = Math.max(0, rows.length - 1 - limit);
if (more) console.log(`  … and ${more} more, see the file`);
