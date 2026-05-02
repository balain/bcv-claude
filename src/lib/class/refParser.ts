// ============================================================================
// refParser.ts — Bible reference parser for Class Mode
//
// Parses freeform reference strings ("Rom 8:28", "Phil 2.5-8", "1 cor 13",
// "Heb 4:12; Jn 1:1") into canonical ParsedRef objects keyed against the
// 66-book Protestant canon (book_id 1=Genesis ... 66=Revelation, matching
// bcv-claude's book_meta.id).
//
// Design: hand-written tokenizer, no regex-soup. Aliases are normalized
// (lowercase, Roman-numeral prefixes folded to digits, non-alphanumerics
// stripped) so "1 Sam", "1Sam", "I Sam", "1sam" all hit the same key.
// ============================================================================

export interface ParsedRef {
  bookId: number;
  bookName: string;
  chapter: number;
  verseStart: number | null;   // null = whole chapter
  verseEnd: number | null;     // null = single verse (or whole chapter when verseStart is null)
  rawInput: string;
  confidence: 'exact' | 'inferred' | 'ambiguous';
  ambiguities?: BookCandidate[];
}

export interface BookCandidate {
  bookId: number;
  bookName: string;
}

export interface ParseContext {
  lastBookId?: number;
  lastChapter?: number;
}

export interface ParseResult {
  refs: ParsedRef[];
  errors: string[];
  /** Updated context after this parse, suitable for feeding into the next call. */
  context: ParseContext;
}

// ----------------------------------------------------------------------------
// Book table
// ----------------------------------------------------------------------------

interface BookDef {
  id: number;
  name: string;
  aliases: string[];
}

const BOOKS: BookDef[] = [
  { id: 1,  name: 'Genesis',         aliases: ['gen', 'ge', 'gn', 'genesis'] },
  { id: 2,  name: 'Exodus',          aliases: ['ex', 'exo', 'exod', 'exodus'] },
  { id: 3,  name: 'Leviticus',       aliases: ['lev', 'le', 'lv', 'leviticus'] },
  { id: 4,  name: 'Numbers',         aliases: ['num', 'nu', 'nm', 'nb', 'numbers'] },
  { id: 5,  name: 'Deuteronomy',     aliases: ['deut', 'dt', 'de', 'deuteronomy'] },
  { id: 6,  name: 'Joshua',          aliases: ['josh', 'jos', 'jsh', 'joshua'] },
  { id: 7,  name: 'Judges',          aliases: ['judg', 'jdg', 'jg', 'jdgs', 'judges'] },
  { id: 8,  name: 'Ruth',            aliases: ['ruth', 'ru', 'rth'] },
  { id: 9,  name: '1 Samuel',        aliases: ['1sam', '1sa', '1sm', '1s', '1samuel', 'firstsamuel'] },
  { id: 10, name: '2 Samuel',        aliases: ['2sam', '2sa', '2sm', '2s', '2samuel', 'secondsamuel'] },
  { id: 11, name: '1 Kings',         aliases: ['1kgs', '1ki', '1kg', '1k', '1kings', 'firstkings'] },
  { id: 12, name: '2 Kings',         aliases: ['2kgs', '2ki', '2kg', '2k', '2kings', 'secondkings'] },
  { id: 13, name: '1 Chronicles',    aliases: ['1chr', '1ch', '1chron', '1chronicles', 'firstchronicles'] },
  { id: 14, name: '2 Chronicles',    aliases: ['2chr', '2ch', '2chron', '2chronicles', 'secondchronicles'] },
  { id: 15, name: 'Ezra',            aliases: ['ezra', 'ezr', 'ez'] },
  { id: 16, name: 'Nehemiah',        aliases: ['neh', 'ne', 'nehemiah'] },
  { id: 17, name: 'Esther',          aliases: ['esth', 'est', 'es', 'esther'] },
  { id: 18, name: 'Job',             aliases: ['job', 'jb'] },
  { id: 19, name: 'Psalms',          aliases: ['ps', 'psa', 'pss', 'psalm', 'psalms', 'psm'] },
  { id: 20, name: 'Proverbs',        aliases: ['prov', 'pr', 'prv', 'proverbs'] },
  { id: 21, name: 'Ecclesiastes',    aliases: ['eccl', 'ecc', 'ec', 'qoh', 'ecclesiastes'] },
  { id: 22, name: 'Song of Solomon', aliases: ['song', 'sos', 'ss', 'cant', 'canticles', 'songofsolomon', 'songofsongs'] },
  { id: 23, name: 'Isaiah',          aliases: ['isa', 'is', 'isaiah'] },
  { id: 24, name: 'Jeremiah',        aliases: ['jer', 'je', 'jr', 'jeremiah'] },
  { id: 25, name: 'Lamentations',    aliases: ['lam', 'la', 'lamentations'] },
  { id: 26, name: 'Ezekiel',         aliases: ['ezek', 'eze', 'ezk', 'ezekiel'] },
  { id: 27, name: 'Daniel',          aliases: ['dan', 'da', 'dn', 'daniel'] },
  { id: 28, name: 'Hosea',           aliases: ['hos', 'ho', 'hosea'] },
  { id: 29, name: 'Joel',            aliases: ['joel', 'joe', 'jl'] },
  { id: 30, name: 'Amos',            aliases: ['amos', 'am', 'amo'] },
  { id: 31, name: 'Obadiah',         aliases: ['obad', 'oba', 'ob', 'obadiah'] },
  { id: 32, name: 'Jonah',           aliases: ['jon', 'jnh', 'jonah'] },
  { id: 33, name: 'Micah',           aliases: ['mic', 'mi', 'micah'] },
  { id: 34, name: 'Nahum',           aliases: ['nah', 'na', 'nahum'] },
  { id: 35, name: 'Habakkuk',        aliases: ['hab', 'hb', 'habakkuk'] },
  { id: 36, name: 'Zephaniah',       aliases: ['zeph', 'zep', 'zp', 'zephaniah'] },
  { id: 37, name: 'Haggai',          aliases: ['hag', 'hg', 'haggai'] },
  { id: 38, name: 'Zechariah',       aliases: ['zech', 'zec', 'zc', 'zechariah'] },
  { id: 39, name: 'Malachi',         aliases: ['mal', 'ml', 'malachi'] },
  { id: 40, name: 'Matthew',         aliases: ['matt', 'mt', 'matthew'] },
  { id: 41, name: 'Mark',            aliases: ['mark', 'mk', 'mr', 'mrk'] },
  { id: 42, name: 'Luke',            aliases: ['luke', 'lk', 'lu', 'luk'] },
  { id: 43, name: 'John',            aliases: ['john', 'jn', 'joh', 'jhn'] },
  { id: 44, name: 'Acts',            aliases: ['acts', 'ac', 'act'] },
  { id: 45, name: 'Romans',          aliases: ['rom', 'ro', 'rm', 'romans'] },
  { id: 46, name: '1 Corinthians',   aliases: ['1cor', '1co', '1corinthians', 'firstcorinthians'] },
  { id: 47, name: '2 Corinthians',   aliases: ['2cor', '2co', '2corinthians', 'secondcorinthians'] },
  { id: 48, name: 'Galatians',       aliases: ['gal', 'ga', 'galatians'] },
  { id: 49, name: 'Ephesians',       aliases: ['eph', 'ephes', 'ephesians'] },
  { id: 50, name: 'Philippians',     aliases: ['phil', 'php', 'phl', 'philippians'] },
  { id: 51, name: 'Colossians',      aliases: ['col', 'colossians'] },
  { id: 52, name: '1 Thessalonians', aliases: ['1thess', '1thes', '1th', '1thessalonians', 'firstthessalonians'] },
  { id: 53, name: '2 Thessalonians', aliases: ['2thess', '2thes', '2th', '2thessalonians', 'secondthessalonians'] },
  { id: 54, name: '1 Timothy',       aliases: ['1tim', '1ti', '1t', '1timothy', 'firsttimothy'] },
  { id: 55, name: '2 Timothy',       aliases: ['2tim', '2ti', '2t', '2timothy', 'secondtimothy'] },
  { id: 56, name: 'Titus',           aliases: ['tit', 'titus'] },                  // 'ti' deliberately omitted (collides with 1/2 Tim)
  { id: 57, name: 'Philemon',        aliases: ['phlm', 'phm', 'pm', 'philemon'] },
  { id: 58, name: 'Hebrews',         aliases: ['heb', 'he', 'hebrews'] },
  { id: 59, name: 'James',           aliases: ['jas', 'jm', 'jam', 'james'] },
  { id: 60, name: '1 Peter',         aliases: ['1pet', '1pe', '1p', '1peter', 'firstpeter'] },
  { id: 61, name: '2 Peter',         aliases: ['2pet', '2pe', '2p', '2peter', 'secondpeter'] },
  { id: 62, name: '1 John',          aliases: ['1jn', '1jo', '1j', '1john', 'firstjohn'] },
  { id: 63, name: '2 John',          aliases: ['2jn', '2jo', '2j', '2john', 'secondjohn'] },
  { id: 64, name: '3 John',          aliases: ['3jn', '3jo', '3j', '3john', 'thirdjohn'] },
  { id: 65, name: 'Jude',            aliases: ['jude', 'jud', 'jd'] },
  { id: 66, name: 'Revelation',      aliases: ['rev', 're', 'rv', 'apoc', 'apocalypse', 'revelation'] },
];

// Build the alias → bookId map at module load.
const ALIAS_INDEX: Map<string, number[]> = new Map();
for (const b of BOOKS) {
  for (const alias of b.aliases) {
    const arr = ALIAS_INDEX.get(alias);
    if (arr) arr.push(b.id);
    else ALIAS_INDEX.set(alias, [b.id]);
  }
}

const BOOK_BY_ID: Map<number, BookDef> = new Map(BOOKS.map(b => [b.id, b]));

// ----------------------------------------------------------------------------
// Normalization
// ----------------------------------------------------------------------------

/**
 * Normalize a raw book token to its lookup key.
 * - lowercase
 * - leading "i", "ii", "iii" (with following whitespace) → "1", "2", "3"
 * - "first"/"second"/"third" prefixes preserved as text (matched in aliases)
 * - strip every non-alphanumeric character
 */
function normalizeBookToken(s: string): string {
  let t = s.toLowerCase().trim();
  // Roman numerals: "iii", "ii", "i" only when followed by whitespace (otherwise "isaiah" would match)
  if (/^iii\s+/.test(t)) t = '3 ' + t.slice(3).trimStart();
  else if (/^ii\s+/.test(t)) t = '2 ' + t.slice(2).trimStart();
  else if (/^i\s+/.test(t)) t = '1 ' + t.slice(1).trimStart();
  // Strip non-alphanumeric
  return t.replace(/[^a-z0-9]/g, '');
}

// ----------------------------------------------------------------------------
// Tokenizer
// ----------------------------------------------------------------------------

/**
 * Split input into per-ref segments. Semicolon is the hard separator;
 * everything else (book tokens, numerics) lives within a segment.
 */
function splitSegments(input: string): string[] {
  return input.split(';').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Walk the start of `s` and return the longest prefix that, after
 * normalization, matches a known book alias. Returns null if no prefix
 * matches.
 *
 * Strategy: try increasingly long prefixes (up to the first digit-after-letter
 * transition or end of string).
 */
function matchBookPrefix(s: string): { matched: string; bookIds: number[]; rest: string } | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  // Find candidate end positions: every position right before a digit-following-letter,
  // or right before whitespace-then-digit, or end of string.
  const candidatePositions: number[] = [];
  for (let i = 1; i <= trimmed.length; i++) {
    const ch = trimmed[i];
    const prev = trimmed[i - 1];
    if (!ch) {
      candidatePositions.push(i);
      break;
    }
    // Letter followed by digit: book-name ends here
    if (/[a-z]/i.test(prev) && /\d/.test(ch)) candidatePositions.push(i);
    // Letter followed by space followed by digit: book-name ends at the letter
    if (/[a-z]/i.test(prev) && ch === ' ') {
      // peek ahead for first non-space
      let j = i;
      while (trimmed[j] === ' ') j++;
      if (j < trimmed.length && /\d/.test(trimmed[j]!)) candidatePositions.push(i);
    }
  }
  // Also try the entire string (in case there's no numeric part at all — bare book name)
  if (candidatePositions.length === 0 || candidatePositions[candidatePositions.length - 1]! !== trimmed.length) {
    candidatePositions.push(trimmed.length);
  }

  // Try longest-first
  candidatePositions.sort((a, b) => b - a);
  for (const end of candidatePositions) {
    const candidate = trimmed.slice(0, end).trim();
    if (!candidate) continue;
    const key = normalizeBookToken(candidate);
    if (!key) continue;
    const ids = ALIAS_INDEX.get(key);
    if (ids && ids.length > 0) {
      return { matched: candidate, bookIds: ids, rest: trimmed.slice(end).trim() };
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Numeric part
// ----------------------------------------------------------------------------

interface NumericRange {
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
}

/**
 * Parse the post-book numeric part: `chapter`, `chapter:verse`,
 * `chapter:verse-verse`, `chapter.verse`, `chapter verse`, etc.
 *
 * Comma-separated additional verses are returned as separate ranges.
 */
function parseNumericPart(s: string, chapterFromContext?: number): NumericRange[] | null {
  const trimmed = s.trim();
  if (!trimmed) {
    return chapterFromContext != null
      ? null  // no numeric content + no implied verse → can't infer anything new
      : null;
  }

  // Comma-separated subparts: "8:28,30" or "8, 9"
  const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length === 0) return null;

  const ranges: NumericRange[] = [];
  let currentChapter = chapterFromContext;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const r = parsePartialNumeric(part, currentChapter);
    if (!r) return null;
    ranges.push(r);
    currentChapter = r.chapter;
  }
  return ranges;
}

/**
 * Parse a single non-comma numeric block. Accepts:
 *   "8"           → chapter 8, no verses
 *   "8:28"        → ch 8 v 28
 *   "8:28-30"     → ch 8 v 28-30
 *   "8.28"        → ch 8 v 28
 *   "8 28"        → ch 8 v 28
 *   "28"          → if implicitChapter set, ch=implicit, v=28; else ch=28
 *
 * Range separator: '-' or '–' (en-dash).
 */
function parsePartialNumeric(s: string, implicitChapter?: number): NumericRange | null {
  // Normalize: "8.28" → "8:28", "8 28" → "8:28"
  let t = s.replace(/(\d)\s*\.\s*(\d)/g, '$1:$2');
  t = t.replace(/(\d)\s+(\d)/g, '$1:$2');
  // Range dash variants
  t = t.replace(/–/g, '-');
  t = t.trim();

  // Patterns:
  //   ^\d+$                       → just a number
  //   ^\d+:\d+$                   → ch:v
  //   ^\d+:\d+-\d+$               → ch:v-v
  //   ^\d+-\d+$                   → if implicitChapter: v-v in implied chapter; else ch range (treat as ch only, take first)
  let m: RegExpMatchArray | null;

  if ((m = t.match(/^(\d+):(\d+)-(\d+)$/))) {
    return { chapter: +m[1]!, verseStart: +m[2]!, verseEnd: +m[3]! };
  }
  if ((m = t.match(/^(\d+):(\d+)$/))) {
    return { chapter: +m[1]!, verseStart: +m[2]!, verseEnd: null };
  }
  if ((m = t.match(/^(\d+)-(\d+)$/))) {
    if (implicitChapter != null) {
      // Treat as verse range in the implied chapter
      return { chapter: implicitChapter, verseStart: +m[1]!, verseEnd: +m[2]! };
    }
    // Otherwise: ambiguous — choose first chapter only
    return { chapter: +m[1]!, verseStart: null, verseEnd: null };
  }
  if ((m = t.match(/^(\d+)$/))) {
    const n = +m[1]!;
    if (implicitChapter != null) {
      return { chapter: implicitChapter, verseStart: n, verseEnd: null };
    }
    return { chapter: n, verseStart: null, verseEnd: null };
  }
  return null;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Parse a freeform reference string into one or more ParsedRefs.
 * `ctx` carries the trailing book/chapter from the previous parse so a
 * bare "30" continues into the last reference.
 */
export function parseRefs(input: string, ctx: ParseContext = {}): ParseResult {
  const refs: ParsedRef[] = [];
  const errors: string[] = [];
  let runningCtx: ParseContext = { ...ctx };

  const segments = splitSegments(input);
  if (segments.length === 0) {
    return { refs: [], errors: ['empty input'], context: runningCtx };
  }

  for (const seg of segments) {
    const segRefs = parseOneSegment(seg, runningCtx);
    if (segRefs.refs.length > 0) {
      refs.push(...segRefs.refs);
      const last = segRefs.refs[segRefs.refs.length - 1]!;
      runningCtx = { lastBookId: last.bookId, lastChapter: last.chapter };
    }
    if (segRefs.error) errors.push(segRefs.error);
  }

  return { refs, errors, context: runningCtx };
}

interface SegmentParseResult {
  refs: ParsedRef[];
  error?: string;
}

function parseOneSegment(seg: string, ctx: ParseContext): SegmentParseResult {
  const bookMatch = matchBookPrefix(seg);

  if (bookMatch) {
    const { bookIds, rest, matched } = bookMatch;

    // Ambiguous book? Surface candidates but pick the first as primary.
    const isAmbiguous = bookIds.length > 1;
    const primaryId = bookIds[0]!;
    const primary = BOOK_BY_ID.get(primaryId)!;

    if (rest.length === 0) {
      // Bare book name, no numeric — caller probably mis-typed; defer
      return {
        refs: [],
        error: `book "${matched}" given without a chapter`,
      };
    }

    const numerics = parseNumericPart(rest);
    if (!numerics || numerics.length === 0) {
      return { refs: [], error: `unparseable numeric: "${rest}" in "${seg}"` };
    }

    const refs: ParsedRef[] = numerics.map(n => ({
      bookId: primaryId,
      bookName: primary.name,
      chapter: n.chapter,
      verseStart: n.verseStart,
      verseEnd: n.verseEnd,
      rawInput: seg,
      confidence: isAmbiguous ? 'ambiguous' : 'exact',
      ambiguities: isAmbiguous
        ? bookIds.map(id => ({ bookId: id, bookName: BOOK_BY_ID.get(id)!.name }))
        : undefined,
    }));
    return { refs };
  }

  // No book token: pure numeric continuation, requires context
  if (ctx.lastBookId == null) {
    return { refs: [], error: `cannot resolve "${seg}" without prior context` };
  }
  const numerics = parseNumericPart(seg, ctx.lastChapter);
  if (!numerics || numerics.length === 0) {
    return { refs: [], error: `unparseable: "${seg}"` };
  }
  const book = BOOK_BY_ID.get(ctx.lastBookId)!;
  return {
    refs: numerics.map(n => ({
      bookId: ctx.lastBookId!,
      bookName: book.name,
      chapter: n.chapter,
      verseStart: n.verseStart,
      verseEnd: n.verseEnd,
      rawInput: seg,
      confidence: 'inferred',
    })),
  };
}

/**
 * Format a ParsedRef back into a canonical string.
 */
export function formatRef(r: ParsedRef): string {
  const book = r.bookName;
  if (r.verseStart == null) return `${book} ${r.chapter}`;
  if (r.verseEnd == null) return `${book} ${r.chapter}:${r.verseStart}`;
  return `${book} ${r.chapter}:${r.verseStart}-${r.verseEnd}`;
}
