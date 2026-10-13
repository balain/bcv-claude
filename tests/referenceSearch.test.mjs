import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Compile the parser and its existing helpers without requiring a TS test runner.
const dir = mkdtempSync(join(tmpdir(), 'bcv-reference-tests-'));
for (const [file, output] of [
  ['src/lib/books.ts', 'books.mjs'],
  ['src/lib/class/refParser.ts', 'refParser.mjs'],
  ['src/lib/referenceSearch.ts', 'referenceSearch.mjs'],
]) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replace("'./books'", "'./books.mjs'")
    .replace("'./class/refParser'", "'./refParser.mjs'");
  writeFileSync(join(dir, output), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText);
}
const { parseReferenceQuery: parse } = await import(pathToFileURL(join(dir, 'referenceSearch.mjs')).href);
after(() => rmSync(dir, { recursive: true, force: true }));

test('word searches and bare book names remain word searches', () => {
  for (const input of ['love', 'John', 'Jude', '1 John', 'love 3', '"John 3:16"']) assert.equal(parse(input), null);
});

test('supports aliases and ordered reference lists with verse continuations', () => {
  const result = parse('Jude 3; Jn 3:16,18; Rom 8:28');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.ranges.map((r) => [r.bookId, r.startChapter, r.startVerse]), [
    [65, 1, 3], [43, 3, 16], [43, 3, 18], [45, 8, 28],
  ]);
});

test('single-chapter books interpret bare numbers as verses', () => {
  for (const book of ['Obadiah', 'Philemon', '2 John', '3 John', 'Jude']) {
    const { ranges, errors } = parse(`${book} 3–5`);
    assert.deepEqual(errors, []);
    assert.equal(ranges[0].startChapter, 1);
    assert.equal(ranges[0].startVerse, 3);
    assert.equal(ranges[0].endVerse, 5);
  }
});

test('supports whole chapters, chapter ranges and cross-chapter verse ranges', () => {
  const result = parse('Psalm 23; John 3-4; John 3:16–4:6');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.ranges.map((r) => [r.startChapter, r.startVerse, r.endChapter, r.endVerse]), [
    [23, null, 23, null], [3, null, 4, null], [3, 16, 4, 6],
  ]);
});

test('continuations retain the intended chapter or verse context', () => {
  const result = parse('John 3,4; John 3:16,18-20; 4:2,4');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.ranges.map((r) => [r.startChapter, r.startVerse, r.endVerse]), [
    [3, null, null], [4, null, null], [3, 16, 16], [3, 18, 20], [4, 2, 2], [4, 4, 4],
  ]);
});

test('invalid references report errors while valid references survive', () => {
  const result = parse('John 3:16; John 99; John 3:20-16; nonsense; Jude 3; Romans 0:1');
  assert.equal(result.errors.length, 4);
  assert.deepEqual(result.ranges.map((r) => r.bookId), [43, 65]);
  assert.equal(parse('Jhon 3:16').errors.length, 1);
});
