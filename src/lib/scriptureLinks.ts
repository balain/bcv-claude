// Finds Scripture references inside third-party lexicon text (BDB, STEP,
// UBS) so the UI can render them as links. Each source cites books in its own
// style, so callers pick a dialect:
//   bdb     — BDB abbreviations ("Jb 8:12", "1 S 2:36", "ψ 10:16") plus OSIS ("Job.8.12")
//   step    — STEP/Abbott-Smith ("Luk.1:5, 7:11"); Kingdoms naming: 1Ki = 1 Samuel … 4Ki = 2 Kings
//   default — full or common names ("Song of Solomon 6:11") and UBS numeric codes
// Only chapter:verse citations are linked; bare numbers are too often page cites.
// Sources that number the OT the Hebrew way (BDB, UBS) pass a CitationMap so the
// link opens the English verse; the link text keeps the source's own numbering.

import { BOOK_META, BOOK_BY_ID } from './books';
import { resolveBookAlias } from './class/refParser';

export type ScriptureDialect = 'bdb' | 'step' | 'default';

export interface ScriptureRef {
  bookId: number;
  chapter: number;
  verse: number;
}

/** `cited` is the source's own numbering when it differs from the English `ref`. */
export type ScriptureSegment = { text: string; ref?: ScriptureRef; cited?: ScriptureRef };

/** Hebrew (BHS) "book:chapter:verse" → English verse; null = no English counterpart. Absent = same number. */
export type CitationMap = Map<string, ScriptureRef | null>;

/** Citation style of a study-lexicon source (STEP's LSJ uses the same tags as its brief lexicon). */
export function studyDialect(source: string): ScriptureDialect {
  return source === 'bdb' ? 'bdb' : source === 'lsj' ? 'step' : 'default';
}

/**
 * Whether a source cites the OT in Hebrew numbering. Checked against the data: the
 * word a BDB entry defines appears at the Hebrew-mapped verse (213 of 225 moved Psalm
 * citations), while STEP's citations already follow English numbering.
 */
export function usesHebrewNumbering(source: string): boolean {
  return source === 'bdb' || source.startsWith('ubs-');
}

const BDB_BOOKS: Record<string, number> = {
  gn: 1, ex: 2, lv: 3, nu: 4, dt: 5, de: 5, jos: 6, ju: 7, ru: 8, '1s': 9, '1sa': 9, '2s': 10, '2sa': 10,
  '1k': 11, '2k': 12, '1ch': 13, '2ch': 14, ezr: 15, ne: 16, est: 17, jb: 18, 'ψ': 19, pr: 20, ec: 21,
  qor: 21, ct: 22, is: 23, je: 24, la: 25, ez: 26, dn: 27, ho: 28, jo: 29, am: 30, ob: 31, jon: 32,
  mi: 33, na: 34, hb: 35, zp: 36, hg: 37, zc: 38, mal: 39,
};

const STEP_BOOKS: Record<string, number> = {
  '1ki': 9, '2ki': 10, '3ki': 11, '4ki': 12, mrk: 41, php: 50, phi: 50, jol: 29, nam: 34, rut: 8, deu: 5, '1jo': 62,
};

const ABBR3_BOOKS = new Map(BOOK_META.map((b) => [b.abbr3.toLowerCase(), b.id]));

function resolveBook(token: string, dialect: ScriptureDialect): number | null {
  // BDB writes "I S", "II K" for the numbered books.
  const arabic = token.replace(/^(I{1,3}) /, (_, roman: string) => `${roman.length} `);
  const key = arabic.toLowerCase().replace(/[^a-z0-9ψ]/g, '');
  const table = dialect === 'bdb' ? BDB_BOOKS : dialect === 'step' ? STEP_BOOKS : undefined;
  return table?.[key] ?? resolveBookAlias(arabic) ?? ABBR3_BOOKS.get(key) ?? null;
}

function validRef(bookId: number | null, chapter: number, verse: number): ScriptureRef | null {
  const book = bookId === null ? undefined : BOOK_BY_ID.get(bookId);
  return book && chapter >= 1 && chapter <= book.chapters && verse >= 1 ? { bookId: book.id, chapter, verse } : null;
}

const REF_FORMS = [
  // UBS numeric code: BBBCCCVVVWWWWW with an optional {N:…} note marker
  String.raw`(?<code>\d{14})(?:\{N:\d+\})?`,
  // Book with chapter:verse or OSIS chapter.verse
  String.raw`(?<book>(?:(?:[1-4]|I{1,3}) ?)?(?:[A-Z][A-Za-z]{0,14}|ψ)(?: of [A-Z][a-z]+)?)(?:\.|\. | )(?<chapter>\d{1,3})(?<sep>[:.])(?<verse>\d{1,3})`,
  // Bare chapter:verse, linked only when it continues the previous reference
  String.raw`(?<cchapter>\d{1,3}):(?<cverse>\d{1,3})`,
];
const NOT_MID_WORD = String.raw`(?<![\p{L}\d.:])`;
const OPTIONAL_RANGE = String.raw`(?:[-–]\d{1,3}(?::\d{1,3})?)?(?![\d:])`;
const REF_PATTERN = new RegExp(`${NOT_MID_WORD}(?:${REF_FORMS.join('|')})${OPTIONAL_RANGE}`, 'gu');

export function linkifyScripture(text: string, dialect: ScriptureDialect = 'default', citations?: CitationMap): ScriptureSegment[] {
  const segments: ScriptureSegment[] = [];
  let cursor = 0;
  let lastEnd = -1;
  let lastBookId: number | null = null;

  type Resolved = { ref: ScriptureRef; cited?: ScriptureRef };
  const resolve = (bookId: number | null, chapter: number, verse: number): Resolved | null => {
    const key = `${bookId}:${chapter}:${verse}`;
    if (bookId === null || !citations?.has(key)) {
      const ref = validRef(bookId, chapter, verse);
      return ref && { ref };
    }
    const english = citations.get(key);
    const ref = english && validRef(english.bookId, english.chapter, english.verse);
    return ref ? { ref, cited: { bookId, chapter, verse } } : null;
  };
  const push = (start: number, end: number, { ref, cited }: Resolved, label?: string) => {
    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({ text: label ?? text.slice(start, end), ref, ...(cited && { cited }) });
    cursor = end;
    lastEnd = end;
    lastBookId = ref.bookId;
  };
  const continues = (start: number) => lastBookId !== null && /^\s*[,;]\s*$/.test(text.slice(lastEnd, start));

  for (const match of text.matchAll(REF_PATTERN)) {
    const g = match.groups!;
    const start = match.index!;
    const end = start + match[0].length;

    if (g.code) {
      const [book, chapter, verse] = [Number(g.code.slice(0, 3)), Number(g.code.slice(3, 6)), Number(g.code.slice(6, 9))];
      const found = resolve(book, chapter, verse);
      if (found) push(start, end, found, `${BOOK_BY_ID.get(book)!.name} ${chapter}:${verse}`);
    } else if (g.book) {
      // OSIS uses "Book.ch.v"; other styles use "ch:v".
      if (g.sep === '.' && !/\.$/.test(match[0].slice(0, g.book.length + 1))) continue;
      const chapter = Number(g.chapter);
      const verse = Number(g.verse);
      let found = resolve(resolveBook(g.book, dialect), chapter, verse);
      let offset = 0;
      // "+ 3 Ex 4:5": the leading number may be a count, not part of the book name.
      const prefix = /^(?:[1-4]|I{1,3}) ?/.exec(g.book);
      if (!found && prefix) {
        found = resolve(resolveBook(g.book.slice(prefix[0].length), dialect), chapter, verse);
        offset = prefix[0].length;
      }
      if (found) push(start + offset, end, found);
      else {
        // An unrecognized word before "ch:v" can still precede a continuation.
        const numStart = start + match[0].indexOf(`${g.chapter}${g.sep}${g.verse}`);
        if (g.sep === ':' && continues(numStart)) {
          const cont = resolve(lastBookId, chapter, verse);
          if (cont) push(numStart, end, cont);
        }
      }
    } else if (continues(start)) {
      const found = resolve(lastBookId, Number(g.cchapter), Number(g.cverse));
      if (found) push(start, end, found);
    }
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
