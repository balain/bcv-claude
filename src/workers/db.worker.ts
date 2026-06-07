/**
 * SQLite worker: loads bcv.db and answers search/lookup queries.
 *
 * Storage strategy:
 *   1. OPFS byte cache — on first visit, download the DB and write raw bytes to
 *      Origin Private File System using the Synchronous Access Handle API (worker-only).
 *      On subsequent visits, read straight from OPFS — no network round-trip.
 *   2. In-memory sqlite3_deserialize — works in all environments; the cached bytes
 *      eliminate the download cost while still giving us a reliable in-memory DB.
 *
 * Message protocol:
 *   → { id, type: 'search', query, source }
 *   → { id, type: 'lookup', strong }
 *   ← { id, ok: true, data }
 *   ← { id, ok: false, error }
 *   ← { type: 'ready' }
 *   ← { type: 'progress', message }
 *   ← { type: 'error', message }
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite resolves this to the correct URL at both dev and build time
import sqlite3WasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';

// DedicatedWorkerGlobalScope lives in the WebWorker lib, not DOM — cast to avoid tsconfig mismatch
declare const self: typeof globalThis & { postMessage(msg: unknown): void; addEventListener(type: string, fn: (e: MessageEvent) => void): void };

// ─── types ───────────────────────────────────────────────────────────────────

export type Source = 'KJV' | 'ASV' | 'LEB' | 'NASB' | 'Heb' | 'LXX' | 'GNT';
const ENG_SOURCES = new Set<Source>(['KJV', 'ASV', 'LEB', 'NASB']);

// ─── global DB handle ─────────────────────────────────────────────────────────

let db: any = null;
let sqlite3Module: any = null;
/** True once we've confirmed cross_refs table exists in the loaded DB. */
let hasCrossRefs = false;

// ─── message helpers ─────────────────────────────────────────────────────────

function post(msg: object) { self.postMessage(msg); }

// ─── DB loading ───────────────────────────────────────────────────────────────

const DB_NAME = 'bcv.db';
const DB_URL = import.meta.env.BASE_URL + 'db/bcv.db';

/** Minimum plausible DB size — rejects obviously corrupt/empty OPFS entries. */
const CACHE_MIN_BYTES = 10_000_000; // 10 MB
/** First 15 bytes of every valid SQLite file. */
const SQLITE_MAGIC = [83,81,76,105,116,101,32,102,111,114,109,97,116,32,51]; // "SQLite format 3"
const OPFS_WRITE_CHUNK_BYTES = 4 * 1024 * 1024;

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function isValidSQLiteBytes(buf: Uint8Array): boolean {
  if (buf.byteLength < 100) return false;
  if (!SQLITE_MAGIC.every((b, i) => buf[i] === b)) return false;
  let pageSize = (buf[16] << 8) | buf[17];
  if (pageSize === 1) pageSize = 65536;
  if (pageSize < 512 || pageSize > 65536 || !isPowerOfTwo(pageSize)) return false;
  const pageCount =
    ((buf[28] << 24) >>> 0) +
    (buf[29] << 16) +
    (buf[30] << 8) +
    buf[31];
  if (pageCount <= 0) return false;
  return buf.byteLength >= pageSize * pageCount;
}

async function fetchWithProgress(): Promise<Uint8Array> {
  post({ type: 'progress', message: 'Downloading database…' });
  const resp = await fetch(DB_URL);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);

  const total = Number(resp.headers.get('content-length') ?? 0);
  const reader = resp.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      const pct = Math.round((received / total) * 100);
      if (pct % 10 === 0) post({ type: 'progress', message: `Loading… ${pct}%` });
    }
  }

  const buf = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { buf.set(chunk, offset); offset += chunk.length; }
  return buf;
}

/** Read cached DB bytes from OPFS. Returns null if absent, too small, or corrupt. */
async function readOpfsCache(): Promise<Uint8Array | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_NAME); // throws if absent
    const file = await fh.getFile();
    if (file.size < CACHE_MIN_BYTES) return null;
    post({ type: 'progress', message: 'Reading from cache…' });
    const buf = new Uint8Array(await file.arrayBuffer());
    if (!isValidSQLiteBytes(buf)) return null;
    return buf;
  } catch {
    return null;
  }
}

/**
 * Write DB bytes to OPFS using the Synchronous Access Handle API.
 * This API is only available in dedicated workers — ideal for our use case.
 * Returns true if the write succeeded (so callers can mark the cache valid).
 */
async function writeOpfsCache(data: Uint8Array): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_NAME, { create: true });
    // createSyncAccessHandle is worker-only and not in the DOM tsconfig lib
    const sah = await (fh as any).createSyncAccessHandle();
    try {
      sah.truncate(0);
      let offset = 0;
      while (offset < data.byteLength) {
        const end = Math.min(offset + OPFS_WRITE_CHUNK_BYTES, data.byteLength);
        const written = sah.write(data.subarray(offset, end), { at: offset });
        if (written <= 0) {
          throw new Error(`OPFS write stalled at ${offset} of ${data.byteLength} bytes`);
        }
        offset += written;
      }
      if (offset !== data.byteLength) {
        throw new Error(`OPFS write incomplete: ${offset} of ${data.byteLength} bytes`);
      }
      sah.truncate(data.byteLength);
      sah.flush();
    } finally {
      sah.close();
    }
    const file = await fh.getFile();
    if (file.size !== data.byteLength) {
      throw new Error(`OPFS cache size mismatch: wrote ${file.size} of ${data.byteLength} bytes`);
    }
    return true;
  } catch (e) {
    console.warn('OPFS cache write failed (DB will re-download on next visit):', e);
    return false;
  }
}

/**
 * Returns DB bytes, pulling from OPFS cache when available.
 * Trusts the cache as long as it passes the size and magic-byte checks.
 * Use the force_refresh message to manually bust the cache.
 */
async function getDbBytes(): Promise<Uint8Array> {
  const cached = await readOpfsCache();
  if (cached) return cached;

  const data = await fetchWithProgress();
  post({ type: 'progress', message: 'Saving to cache…' });
  const wrote = await writeOpfsCache(data);
  if (!wrote) {
    post({ type: 'progress', message: 'Cache unavailable — will re-download next visit' });
  }
  return data;
}

/** Wipe the OPFS cached file so the next getDbBytes() re-fetches from network. */
async function clearOpfsCache(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(DB_NAME);
  } catch { /* already absent — fine */ }
}

async function getSqlite3(): Promise<any> {
  if (!sqlite3Module) {
    sqlite3Module = await (sqlite3InitModule as any)({
      printErr: console.error,
      locateFile: (p: string) => p === 'sqlite3.wasm' ? sqlite3WasmUrl : p,
    });
  }
  return sqlite3Module;
}

function closeDbQuietly(handle: any): void {
  try {
    handle?.close?.();
  } catch (e) {
    console.warn('DB close failed:', e);
  }
}

async function openDb(sqlite3: any, preloaded?: Uint8Array): Promise<any> {
  const data = preloaded ?? await getDbBytes();
  post({ type: 'progress', message: 'Initializing…' });

  let stage = 'allocating database bytes';
  const p = sqlite3.wasm.allocFromTypedArray(data);
  if (!p) {
    throw new Error(`Unable to allocate ${data.byteLength} bytes for SQLite database`);
  }
  let openedDb: any = null;
  let sqliteOwnsBytes = false;
  try {
    stage = 'opening in-memory database';
    openedDb = new sqlite3.oo1.DB();
    stage = 'deserializing database bytes';
    const rc = sqlite3.capi.sqlite3_deserialize(
      openedDb.pointer, 'main', p, data.byteLength, data.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
      sqlite3.capi.SQLITE_DESERIALIZE_RESIZABLE,
    );
    sqliteOwnsBytes = rc === sqlite3.capi.SQLITE_OK;
    stage = 'checking deserialize result';
    openedDb.checkRc(rc);
    // Check if this DB was built with cross_refs support
    stage = 'checking cross_refs schema';
    const crRows: any[][] = openedDb.exec(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='cross_refs'",
      { returnValue: 'resultRows' }
    );
    hasCrossRefs = crRows.length > 0;
    stage = 'validating verse data';
    const verseRows: any[][] = openedDb.exec(
      "SELECT count(*) FROM verses WHERE translation='NASB'",
      { returnValue: 'resultRows' }
    );
    const verseCount = Number(verseRows[0]?.[0] ?? 0);
    if (verseCount <= 0) {
      throw new Error('database opened without NASB verse rows');
    }
    return openedDb;
  } catch (e) {
    closeDbQuietly(openedDb);
    if (!sqliteOwnsBytes && sqlite3.wasm?.dealloc) sqlite3.wasm.dealloc(p);
    throw new Error(`openDb failed while ${stage}: ${String(e)}`);
  }
}

// ─── SQL queries ──────────────────────────────────────────────────────────────

// All SELECTs share the same column layout so groupRows can use positional indices.
// Columns: abbr3[0] book_name[1] testament[2] chapter[3] verse[4] text[5]
//          word_num[6] surface[7] translit[8] gloss[9] lemma[10] strong[11] morph[12] corpus[13]

const VERSE_SQL_ENG = `
  WITH hits AS (
    SELECT v.book_id, v.chapter, v.verse, v.text, b.abbr3, b.name AS book_name, b.testament
    FROM verses v
    JOIN book_meta b ON b.id = v.book_id
    WHERE v.translation = ?1
      AND v.rowid IN (SELECT rowid FROM verses_fts WHERE verses_fts MATCH ?2)
    ORDER BY v.book_id, v.chapter, v.verse
    LIMIT 200
  )
  SELECT h.abbr3, h.book_name, h.testament, h.chapter, h.verse, h.text,
         t.word_num, t.surface, t.translit, t.gloss, t.lemma, t.strong, t.morph, t.corpus
  FROM hits h
  LEFT JOIN tokens t
    ON t.book_id = (SELECT id FROM book_meta WHERE abbr3 = h.abbr3)
    AND t.chapter = h.chapter AND t.verse = h.verse
    AND (
      (h.testament = 'OT' AND t.corpus IN ('WLC', 'LXX')) OR
      (h.testament = 'NT' AND t.corpus = 'GNT')
    )
  ORDER BY h.book_id, h.chapter, h.verse,
           CASE t.corpus WHEN 'WLC' THEN 0 WHEN 'GNT' THEN 0 ELSE 1 END, t.word_num
`;

// Single-corpus token search (GNT only — NT verses don't have LXX counterparts).
const VERSE_SQL_TOKEN = `
  WITH hit_verses AS (
    SELECT DISTINCT t.book_id, t.chapter, t.verse
    FROM tokens_fts f
    JOIN tokens t ON t.rowid = f.rowid
    WHERE tokens_fts MATCH ?1 AND t.corpus = ?2
    LIMIT 200
  )
  SELECT b.abbr3, b.name AS book_name, b.testament, hv.chapter, hv.verse,
         COALESCE(v.text, '') AS text,
         t.word_num, t.surface, t.translit, t.gloss, t.lemma, t.strong, t.morph, t.corpus
  FROM hit_verses hv
  JOIN book_meta b ON b.id = hv.book_id
  LEFT JOIN verses v ON v.book_id = hv.book_id AND v.chapter = hv.chapter
        AND v.verse = hv.verse AND v.translation = ?3
  LEFT JOIN tokens t ON t.book_id = hv.book_id AND t.chapter = hv.chapter
        AND t.verse = hv.verse AND t.corpus = ?2
  ORDER BY hv.book_id, hv.chapter, hv.verse, t.word_num
`;

// Dual-corpus OT search — for Heb and LXX sources. Finds hit verses via the
// searched corpus (?2), then joins BOTH WLC and LXX tokens so each result card
// can show the Hebrew MT alongside the Septuagint Greek.
const VERSE_SQL_OT_DUAL = `
  WITH hit_verses AS (
    SELECT DISTINCT t.book_id, t.chapter, t.verse
    FROM tokens_fts f
    JOIN tokens t ON t.rowid = f.rowid
    WHERE tokens_fts MATCH ?1 AND t.corpus = ?2
    LIMIT 200
  )
  SELECT b.abbr3, b.name AS book_name, b.testament, hv.chapter, hv.verse,
         COALESCE(v.text, '') AS text,
         t.word_num, t.surface, t.translit, t.gloss, t.lemma, t.strong, t.morph, t.corpus
  FROM hit_verses hv
  JOIN book_meta b ON b.id = hv.book_id
  LEFT JOIN verses v ON v.book_id = hv.book_id AND v.chapter = hv.chapter
        AND v.verse = hv.verse AND v.translation = ?3
  LEFT JOIN tokens t ON t.book_id = hv.book_id AND t.chapter = hv.chapter
        AND t.verse = hv.verse AND t.corpus IN ('WLC', 'LXX')
  ORDER BY hv.book_id, hv.chapter, hv.verse,
           CASE t.corpus WHEN 'WLC' THEN 0 ELSE 1 END, t.word_num
`;

const LOOKUP_SQL = `
  SELECT estrong, dstrong, ustrong, lang, lemma, translit, morph, gloss, meaning_plain
  FROM lex_brief WHERE estrong = ?1 OR dstrong = ?1 LIMIT 1
`;

const LOOKUP_LEMMA_SQL = `
  SELECT estrong, dstrong, ustrong, lang, lemma, translit, morph, gloss, meaning_plain
  FROM lex_brief WHERE lang = ?2 AND lemma = ?1 LIMIT 1
`;

const CHAPTER_SQL = `
  SELECT v.verse, v.text, bm.chapters AS total_chapters
  FROM verses v
  JOIN book_meta bm ON bm.id = v.book_id
  WHERE v.book_id = (SELECT id FROM book_meta WHERE abbr3 = ?1)
    AND v.chapter = ?2
    AND v.translation = ?3
  ORDER BY v.verse
`;

// Fetch all original-language tokens for a chapter.
// ?1 = abbr3, ?2 = chapter, ?3 = testament ('OT'|'NT')
const CHAPTER_ORIGINALS_SQL = `
  SELECT t.verse, t.word_num, t.surface, t.translit, t.gloss, t.lemma, t.strong, t.morph, t.corpus
  FROM tokens t
  WHERE t.book_id = (SELECT id FROM book_meta WHERE abbr3 = ?1)
    AND t.chapter = ?2
    AND (
      (?3 = 'OT' AND t.corpus IN ('WLC', 'LXX')) OR
      (?3 = 'NT' AND t.corpus = 'GNT')
    )
  ORDER BY t.verse,
    CASE t.corpus WHEN 'WLC' THEN 0 WHEN 'GNT' THEN 0 ELSE 1 END,
    t.word_num
`;

const CROSS_REFS_SQL = `
  SELECT cr.source_book_id, cr.source_chapter, cr.source_verse,
         cr.target_book_id, cr.target_chapter, cr.target_verse_start, cr.target_verse_end,
         cr.votes, cr.source_dataset,
         bm.abbr3 AS target_abbr3, bm.name AS target_book_name
  FROM cross_refs cr
  JOIN book_meta bm ON bm.id = cr.target_book_id
  WHERE cr.source_book_id = ?1 AND cr.source_chapter = ?2 AND cr.source_verse = ?3
  ORDER BY cr.votes DESC
  LIMIT 50
`;

function rowToCrossRef(row: any[]) {
  const [srcBk, srcCh, srcVs, tgtBk, tgtCh, tgtVsStart, tgtVsEnd, votes, dataset, tgtAbbr3, tgtBookName] = row;
  const label = tgtVsEnd
    ? `${tgtBookName} ${tgtCh}:${tgtVsStart}–${tgtVsEnd}`
    : `${tgtBookName} ${tgtCh}:${tgtVsStart}`;
  return {
    sourceBookId: srcBk, sourceChapter: srcCh, sourceVerse: srcVs,
    targetBookId: tgtBk, targetChapter: tgtCh,
    targetVerseStart: tgtVsStart, targetVerseEnd: tgtVsEnd ?? null,
    targetLabel: label, targetAbbr3: tgtAbbr3,
    votes: votes ?? null, sourceDataset: dataset,
  };
}

function execFetchCrossRefs(bookId: number, chapter: number, verse: number): any[] {
  if (!db || !hasCrossRefs) return [];
  const rows: any[][] = db.exec(CROSS_REFS_SQL, { bind: [bookId, chapter, verse], returnValue: 'resultRows' });
  return rows.map(rowToCrossRef);
}

function execFetchCrossRefsBulk(verses: Array<{ bookId: number; chapter: number; verse: number }>) {
  if (!db || !hasCrossRefs || verses.length === 0) return [];
  return verses.map(({ bookId, chapter, verse }) => ({
    key: `${bookId}:${chapter}:${verse}`,
    refs: execFetchCrossRefs(bookId, chapter, verse),
  }));
}

function ftsEscape(q: string): string {
  // Phrase search: if the query starts AND ends with a double-quote, treat the
  // interior as a single FTS5 phrase (e.g. `"holy spirit"` → `"holy spirit"`).
  if (q.length >= 2 && q.startsWith('"') && q.endsWith('"')) {
    const interior = q.slice(1, -1).trim();
    if (interior.length > 0) {
      return `"${interior.replace(/"/g, '""')}"`;
    }
    // Empty or whitespace-only interior — fall through to word-by-word on the raw string
  }
  const terms = q.trim().split(/\s+/).filter(Boolean);
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(' ');
}

const CORPUS_LANG: Record<string, 'Heb' | 'Grk'> = { WLC: 'Heb', GNT: 'Grk', LXX: 'Grk' };

/** Strip diacritics (nikkud, Greek accents, etc.) for accent-insensitive comparison.
 *  Mirrors the Python ETL's _strip_diacritics() — NFD decompose then drop Mn category. */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}

function makeToken(row: any[], qLow: string, corpus: string) {
  const qNorm = stripDiacritics(qLow);
  const gloss = row[9]?.toLowerCase() ?? '';
  const surfaceNorm = stripDiacritics(row[7] ?? '');
  const translitNorm = stripDiacritics(row[8] ?? '');
  return {
    surface: row[7] ?? '', translit: row[8] ?? '', gloss: row[9] ?? '',
    root: row[10] ?? null, strong: row[11] ?? null, lemma: row[10] ?? null,
    form: row[12] ?? null, corpus: corpus as 'WLC' | 'GNT' | 'LXX',
    highlight: gloss.includes(qLow) || translitNorm.includes(qNorm) || surfaceNorm.includes(qNorm),
  };
}

/** Group flat rows into per-verse objects, partitioning tokens by corpus (col 13). */
function groupRows(rows: any[][], q: string) {
  const map = new Map<string, any>();
  const qLow = q.toLowerCase();

  for (const row of rows) {
    const key = `${row[0]}:${row[3]}:${row[4]}`;
    if (!map.has(key)) {
      map.set(key, { abbr3: row[0], book_name: row[1], testament: row[2],
        chapter: row[3], verse: row[4], text: row[5] ?? '',
        tokensByCorpus: {} as Record<string, any[]> });
    }
    if (row[6] != null) {
      const corpus: string = row[13] ?? 'WLC';
      const entry = map.get(key)!;
      if (!entry.tokensByCorpus[corpus]) entry.tokensByCorpus[corpus] = [];
      entry.tokensByCorpus[corpus].push(makeToken(row, qLow, corpus));
    }
  }

  return Array.from(map.values());
}

function toResults(verses: any[], query: string, source: Source) {
  // Primary lang for the badge: OT sources → Heb, NT/LXX sources → Grk, English → by testament.
  const badgeLang = (testament: string): 'Heb' | 'Grk' => {
    if (source === 'GNT' || source === 'LXX') return 'Grk';
    if (source === 'Heb') return 'Heb';
    return testament === 'OT' ? 'Heb' : 'Grk';
  };

  return verses.map((v) => {
    // Build OriginalSection array in a stable order: WLC first, LXX second, GNT third.
    const originals = (['WLC', 'LXX', 'GNT'] as const)
      .filter((c) => (v.tokensByCorpus[c]?.length ?? 0) > 0)
      .map((c) => ({ corpus: c, lang: CORPUS_LANG[c], tokens: v.tokensByCorpus[c] }));

    return {
      ref: `${v.abbr3} ${v.chapter}:${v.verse}`,
      book: v.book_name,
      bookAbbr: v.abbr3,
      testament: v.testament,
      chapter: v.chapter,
      verse: v.verse,
      lang: badgeLang(v.testament),
      source,
      english: v.text,
      matchWord: query,
      originals,
    };
  });
}

function execSearch(source: Source, query: string) {
  if (!db) throw new Error('DB not ready');
  const fts = ftsEscape(query);
  let rows: any[][];

  if (ENG_SOURCES.has(source)) {
    rows = db.exec(VERSE_SQL_ENG, { bind: [source, fts], returnValue: 'resultRows' });
  } else if (source === 'Heb' || source === 'LXX') {
    // OT sources: fetch both WLC and LXX tokens so the card can show both.
    const hitCorpus = source === 'Heb' ? 'WLC' : 'LXX';
    rows = db.exec(VERSE_SQL_OT_DUAL, { bind: [fts, hitCorpus, 'NASB'], returnValue: 'resultRows' });
  } else if (source === 'GNT') {
    rows = db.exec(VERSE_SQL_TOKEN, { bind: [fts, 'GNT', 'NASB'], returnValue: 'resultRows' });
  } else {
    rows = [];
  }

  return toResults(groupRows(rows, query), query, source);
}

function rowToLex(row: any[]) {
  const [e, d, u, lang, lemma, translit, morph, gloss, meaning_plain] = row;
  return { estrong: e, dstrong: d, ustrong: u, lang, lemma, translit, morph, gloss, meaning: meaning_plain };
}

function execLookup(strong: string) {
  if (!db) throw new Error('DB not ready');
  const rows: any[][] = db.exec(LOOKUP_SQL, { bind: [strong], returnValue: 'resultRows' });
  return rows.length ? rowToLex(rows[0]) : null;
}

function execLookupLemma(lemma: string, lang: 'Heb' | 'Grk') {
  if (!db) throw new Error('DB not ready');
  const rows: any[][] = db.exec(LOOKUP_LEMMA_SQL, { bind: [lemma, lang], returnValue: 'resultRows' });
  return rows.length ? rowToLex(rows[0]) : null;
}

function execFetchChapter(abbr3: string, chapter: number, translation: string): { verses: { verse: number; text: string }[]; totalChapters: number } {
  if (!db) throw new Error('DB not ready');
  const rows: any[][] = db.exec(CHAPTER_SQL, { bind: [abbr3, chapter, translation], returnValue: 'resultRows' });
  return {
    verses: rows.map((row) => ({ verse: row[0] as number, text: row[1] as string })),
    totalChapters: (rows[0]?.[2] as number) ?? 1,
  };
}

function execFetchChapterOriginals(abbr3: string, chapter: number, testament: 'OT' | 'NT') {
  if (!db) throw new Error('DB not ready');
  const rows: any[][] = db.exec(CHAPTER_ORIGINALS_SQL, { bind: [abbr3, chapter, testament], returnValue: 'resultRows' });

  // Group by verse, then by corpus
  const verseMap = new Map<number, Map<string, any[][]>>();
  for (const row of rows) {
    const verse = row[0] as number;
    const corpus = row[8] as string;
    if (!verseMap.has(verse)) verseMap.set(verse, new Map());
    const corpusMap = verseMap.get(verse)!;
    if (!corpusMap.has(corpus)) corpusMap.set(corpus, []);
    corpusMap.get(corpus)!.push(row);
  }

  return Array.from(verseMap.entries()).map(([verse, corpusMap]) => ({
    verse,
    originals: (['WLC', 'LXX', 'GNT'] as const)
      .filter((c) => corpusMap.has(c))
      .map((c) => ({
        corpus: c,
        lang: CORPUS_LANG[c],
        tokens: corpusMap.get(c)!.map((r) => ({
          surface: r[2] ?? '', translit: r[3] ?? '', gloss: r[4] ?? '',
          root: r[5] ?? null, lemma: r[5] ?? null, strong: r[6] ?? null,
          form: r[7] ?? null, corpus: c as 'WLC' | 'GNT' | 'LXX',
          highlight: false,
        })),
      })),
  }));
}


// ─── message dispatch ─────────────────────────────────────────────────────────

self.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as { id: string; type: string; [k: string]: any };
  try {
    if (msg.type === 'search') {
      post({ id: msg.id, ok: true, data: execSearch(msg.source as Source, msg.query) });
    } else if (msg.type === 'lookup') {
      post({ id: msg.id, ok: true, data: execLookup(msg.strong) });
    } else if (msg.type === 'lookup_lemma') {
      post({ id: msg.id, ok: true, data: execLookupLemma(msg.lemma, msg.lang) });
    } else if (msg.type === 'fetch_chapter') {
      post({ id: msg.id, ok: true, data: execFetchChapter(msg.abbr3, msg.chapter, msg.translation) });
    } else if (msg.type === 'fetch_chapter_originals') {
      post({ id: msg.id, ok: true, data: execFetchChapterOriginals(msg.abbr3, msg.chapter, msg.testament) });
    } else if (msg.type === 'fetch_cross_refs') {
      post({ id: msg.id, ok: true, data: execFetchCrossRefs(msg.bookId, msg.chapter, msg.verse) });
    } else if (msg.type === 'fetch_cross_refs_bulk') {
      post({ id: msg.id, ok: true, data: execFetchCrossRefsBulk(msg.verses) });
    } else if (msg.type === 'force_refresh') {
      // Async: clear cache, re-download, and save DB bytes. The main-thread
      // client reloads the app afterward so sqlite-wasm opens the refreshed DB
      // in a clean page/worker lifecycle.
      (async () => {
        try {
          post({ type: 'progress', message: 'Clearing cache…' });
          await clearOpfsCache();
          const data = await fetchWithProgress();
          post({ type: 'progress', message: 'Saving to cache…' });
          await writeOpfsCache(data);
          post({ id: msg.id, ok: true, data: null });
        } catch (err) {
          post({ id: msg.id, ok: false, error: String(err) });
          post({ type: 'error', message: String(err) });
        }
      })();
      return; // don't fall through to the sync reply below
    } else {
      post({ id: msg.id, ok: false, error: `Unknown type: ${msg.type}` });
    }
  } catch (err) {
    post({ id: msg.id, ok: false, error: String(err) });
  }
});

// ─── init ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    // Type cast because @sqlite.org/sqlite-wasm types don't match the bundler-friendly build
    const sqlite3 = await getSqlite3();
    db = await openDb(sqlite3);
    post({ type: 'ready' });
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
})();
