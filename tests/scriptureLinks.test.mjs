import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Compile the detector and its helpers without requiring a TS test runner.
const dir = mkdtempSync(join(tmpdir(), 'bcv-scripture-tests-'));
for (const [file, output] of [
  ['src/lib/books.ts', 'books.mjs'],
  ['src/lib/class/refParser.ts', 'refParser.mjs'],
  ['src/lib/scriptureLinks.ts', 'scriptureLinks.mjs'],
]) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replace("'./books'", "'./books.mjs'")
    .replace("'./class/refParser'", "'./refParser.mjs'");
  writeFileSync(join(dir, output), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText);
}
const { linkifyScripture } = await import(pathToFileURL(join(dir, 'scriptureLinks.mjs')).href);
after(() => rmSync(dir, { recursive: true, force: true }));

const links = (text, dialect) => linkifyScripture(text, dialect)
  .filter((s) => s.ref)
  .map((s) => `${s.text}=${s.ref.bookId}:${s.ref.chapter}:${s.ref.verse}`);

test('segments reassemble the original text when nothing is relabelled', () => {
  const text = 'while in its freshness Jb 8:12; concr., pl. green shoots Ct 6:11 (∥ x).';
  assert.equal(linkifyScripture(text, 'bdb').map((s) => s.text).join(''), text);
});

test('BDB abbreviations, numbered books and BDB-only meanings', () => {
  assert.deepEqual(links('Jb 8:12; Ct 6:11 payment 1 S 2:36 ψ 10:16 + Nu 21:30 +', 'bdb'),
    ['Jb 8:12=18:8:12', 'Ct 6:11=22:6:11', '1 S 2:36=9:2:36', 'ψ 10:16=19:10:16', 'Nu 21:30=4:21:30']);
  assert.deepEqual(links('Jo 2:3 Ez 6:3 Ezr 1:1 Ju 5:31 1 Ch 2:3', 'bdb'),
    ['Jo 2:3=29:2:3', 'Ez 6:3=26:6:3', 'Ezr 1:1=15:1:1', 'Ju 5:31=7:5:31', '1 Ch 2:3=13:2:3']);
});

test('BDB Roman-numeral books and Hebrew chapter numbering', () => {
  assert.deepEqual(links('asses I S 9:3, 20; II K 4:1 Is 4:5', 'bdb'), ['I S 9:3=9:9:3', 'II K 4:1=12:4:1', 'Is 4:5=23:4:5']);
  assert.deepEqual(links('Jo 4:10 Mal 3:20', 'bdb'), ['Jo 4:10=29:3:10', 'Mal 3:20=39:4:2']);
  assert.deepEqual(links('Joel 4:19', 'default'), ['Joel 4:19=29:3:19']);
});

test('BDB OSIS reference lists', () => {
  assert.deepEqual(links('Job.8.12', 'bdb'), ['Job.8.12=18:8:12']);
  assert.deepEqual(links('Song.6.11', 'bdb'), ['Song.6.11=22:6:11']);
  assert.deepEqual(links('1Chr.2.3', 'bdb'), ['1Chr.2.3=13:2:3']);
});

test('a leading count is not mistaken for a numbered book', () => {
  assert.deepEqual(links('Jb 20:7 + 2 Ex 4:5', 'bdb'), ['Jb 20:7=18:20:7', 'Ex 4:5=2:4:5']);
});

test('STEP style with continuations and Kingdoms naming', () => {
  assert.deepEqual(links('Aaron (Exo.4:14, al.): Luk.1:5, Act.7:40, Heb.5:4, 7:11', 'step'),
    ['Exo.4:14=2:4:14', 'Luk.1:5=42:1:5', 'Act.7:40=44:7:40', 'Heb.5:4=58:5:4', '7:11=58:7:11']);
  assert.deepEqual(links('Job.26:6, 28:22, 31:12', 'step'), ['Job.26:6=18:26:6', '28:22=18:28:22', '31:12=18:31:12']);
  assert.deepEqual(links('1Ki.21:1 3Ki.14:1 Mrk.1:1 Jhn.3:16', 'step'),
    ['1Ki.21:1=9:21:1', '3Ki.14:1=11:14:1', 'Mrk.1:1=41:1:1', 'Jhn.3:16=43:3:16']);
  assert.deepEqual(links('Ro 5:1-5', 'default'), ['Ro 5:1-5=45:5:1']);
});

test('UBS full names and numeric codes', () => {
  assert.deepEqual(links('Song of Solomon 6:11', 'default'), ['Song of Solomon 6:11=22:6:11']);
  assert.deepEqual(links('1 Corinthians 13:4', 'default'), ['1 Corinthians 13:4=46:13:4']);
  assert.deepEqual(links('02303002200028{N:001}', 'default'), ['Isaiah 30:22=23:30:22']);
});

test('non-Scripture citations stay plain', () => {
  for (const [text, dialect] of [
    ['1 Corinthians (title)', 'default'],
    ['Dl HA 65, Pr 114 Lag B N 207', 'bdb'],
    ['this is 3:4 and 5:6', 'bdb'],
    ['4th c.BC: Aristoteles Philosophus “Metaphysica” 1087a8)', 'default'],
    ['Herodas Mimographus 3.22.', 'default'],
    ['Sir.4:5 Wis.2:3', 'step'],
    ['Ob 2:1', 'bdb'],
  ]) assert.deepEqual(links(text, dialect), [], text);
});
