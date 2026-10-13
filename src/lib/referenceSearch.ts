import { BOOK_BY_ID } from './books';
import { parseRefs } from './class/refParser';

export interface ReferenceRange {
  bookId: number;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
  raw: string;
}

export interface ReferenceQuery {
  ranges: ReferenceRange[];
  errors: string[];
}

function bookPrefix(segment: string) {
  const match = /^(.+?[a-z.])\s*(\d[\s\S]*)$/i.exec(segment);
  if (!match) return null;
  const parsed = parseRefs(`${match[1]} 1:1`);
  const ref = parsed.refs[0];
  return ref && !parsed.errors.length && ref.confidence === 'exact' ?
    { bookId: ref.bookId, numeric: match[2] } : null;
}

/** References require a book and number; bare book names remain word searches. */
export function parseReferenceQuery(input: string): ReferenceQuery | null {
  const trimmed = input.trim();
  if (trimmed.startsWith('"')) return null;
  const segments = trimmed.split(/[;,\n]+/).map((s) => s.trim()).filter(Boolean);
  if (!segments.some((s) => bookPrefix(s)) && !/[a-z][\s\S]*\d\s*:\s*\d/i.test(trimmed)) return null;

  const ranges: ReferenceRange[] = [];
  const errors: string[] = [];
  let bookId: number | null = null;
  let chapter: number | null = null;
  let verseContext = false;

  for (const raw of segments) {
    const prefix = bookPrefix(raw);
    if (prefix) {
      bookId = prefix.bookId;
      chapter = null;
      verseContext = BOOK_BY_ID.get(bookId)?.chapters === 1;
    } else if (!/^\d/.test(raw)) {
      errors.push(`Unrecognized reference: ${raw}`);
      continue;
    }
    const numeric = (prefix?.numeric ?? raw).replace(/[–—]/g, '-').replace(/(\d)\s*\.\s*(\d)/g, '$1:$2');
    const match = /^(\d+)(?:\s*:\s*(\d+))?(?:\s*-\s*(\d+)(?:\s*:\s*(\d+))?)?$/.exec(numeric);
    if (!match || bookId === null) {
      errors.push(`Invalid reference: ${raw}`);
      continue;
    }
    const book = BOOK_BY_ID.get(bookId)!;
    const explicitVerse = match[2] !== undefined;
    const isVerse = explicitVerse || verseContext;
    const startChapter: number = explicitVerse ? Number(match[1]) : isVerse ? chapter ?? 1 : Number(match[1]);
    const startVerse = explicitVerse ? Number(match[2]) : isVerse ? Number(match[1]) : null;
    const endChapter: number = match[4] !== undefined ? Number(match[3]) :
      match[3] !== undefined && !isVerse ? Number(match[3]) : startChapter;
    const endVerse = match[4] !== undefined ? Number(match[4]) :
      match[3] !== undefined && isVerse ? Number(match[3]) : startVerse;
    if ((!isVerse && match[4] !== undefined) || startChapter < 1 || endChapter > book.chapters ||
      startChapter > book.chapters || endChapter < startChapter ||
      (startVerse !== null && startVerse < 1) || (endVerse !== null && endVerse < 1) ||
      (startChapter === endChapter && startVerse !== null && endVerse !== null && endVerse < startVerse)) {
      errors.push(`Invalid chapter or range: ${raw}`);
      continue;
    }
    ranges.push({ bookId, startChapter, startVerse, endChapter, endVerse, raw });
    chapter = endChapter;
    verseContext = isVerse;
  }
  return { ranges, errors };
}
