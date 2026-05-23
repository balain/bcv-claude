# BibleSearch — Technical Specification

## Overview

BibleSearch is a single-page application that runs an SQLite database entirely
inside the browser. All search and lookup operations execute in a dedicated Web
Worker against an in-memory copy of the database; the main thread communicates
with the worker via a simple message-passing RPC protocol. No server is required
at runtime.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser Main Thread                                         │
│                                                              │
│  App.tsx ──→ SearchBar / BookNav / MiniChart / GlossCard    │
│           ──→ ResultCard ──→ WordChip                        │
│           ──→ DefinitionSheet / SearchHistory                │
│           ──→ ChapterView ──→ WordChip / DefinitionSheet     │
│           ──→ ClassMode ──→ SessionList / SessionView        │
│                                                              │
│  lib/db.ts        (DBClient singleton) ──→ bcv-worker        │
│  lib/class/db.ts  (ClassClient singleton) ──→ class-worker    │
│                                                              │
│       │                                                      │
│       │  postMessage / onMessage (structured clone)          │
│       ▼                                                      │
├───────────────────────────────┬──────────────────────────────┤
│  Web Worker (db.worker.ts)    │ Web Worker (class.worker.ts) │
│                               │                              │
│  OPFS cache ──→ deserialize   │ IDB / OPFS ──→ class.db      │
│  FTS5 search / chapter fetch  │ Sessions / Refs / Notes      │
└───────────────────────────────┴──────────────────────────────┘

  OPFS (Origin Private File System)
    bcv.db    ← written once on first download, read on every load
    class.db  ← persistent user data for Class Mode
```

### Dual-Worker Architecture

The application uses two separate Web Workers to isolate heavy database operations:

1.  **Bible Worker (`db.worker.ts`)**: Manages the large (~210 MB) read-only Bible database. It handles FTS5 searching, chapter fetching, and interlinear data assembly. The database is stored in OPFS for fast access.
2.  **Class Worker (`class.worker.ts`)**: Manages the persistent user database (`class.db`). It handles CRUD operations for teaching sessions, series, and notes. This database is also stored in OPFS (via `sqlite-wasm` VFS) to ensure user data survives browser restarts.

### Key constraints

- **SharedArrayBuffer** (required by `@sqlite.org/sqlite-wasm`) needs both
  `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` response headers.
- **`createSyncAccessHandle`** (used for writing the OPFS cache) is only
  available in dedicated workers — not in the main thread or shared workers.
- Vite 8 uses Rolldown instead of Rollup; `vite-plugin-wasm` and
  `vite-plugin-top-level-await` are incompatible and are not used.

---

## Database Schema

Built by `scripts/build_db.py` from user-provided source files.
Output: `data/bcv.db` (~210 MB).

### `book_meta`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Canonical order (1 = Genesis … 66 = Revelation) |
| `abbr3` | TEXT | Three-letter abbreviation, e.g. `Gen`, `1Co` |
| `osis` | TEXT | OSIS book ID |
| `name` | TEXT | Full English name |
| `testament` | TEXT | `OT` or `NT` |
| `chapters` | INTEGER | Total chapter count |

### `verses`

| Column | Type | Notes |
|---|---|---|
| `book_id` | INTEGER FK → book_meta.id | |
| `chapter` | INTEGER | |
| `verse` | INTEGER | |
| `translation` | TEXT | `KJV`, `ASV`, `LEB`, `NASB`, `Heb` (transliteration), `GNT` (transliteration) |
| `text` | TEXT | Verse text |

FTS5 virtual table `verses_fts` mirrors `(translation, text)`.

### `tokens`

One row per word token in the interlinear texts.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `book_id` | INTEGER FK → book_meta.id | |
| `chapter` | INTEGER | |
| `verse` | INTEGER | |
| `word_num` | INTEGER | 1-based position within verse |
| `corpus` | TEXT | `WLC` (Hebrew MT), `LXX` (Septuagint), `GNT` (Greek NT) |
| `surface` | TEXT | Surface form with pointing/accents |
| `translit` | TEXT | Latin transliteration |
| `gloss` | TEXT | Brief English gloss |
| `lemma` | TEXT | Dictionary form |
| `strong` | TEXT | Strong's number (e.g. `H1234`, `G0001`) |
| `morph` | TEXT | Morphology code |

FTS5 virtual table `tokens_fts` mirrors `(corpus, surface, translit, gloss, lemma)`.

Token counts (approximate):

| Corpus | Tokens |
|---|---|
| WLC (Hebrew OT) | 305,572 |
| LXX (Greek OT) | 507,306 |
| GNT (Greek NT) | 137,554 |

### `lex_brief`

One row per lexicon entry.

| Column | Type | Notes |
|---|---|---|
| `estrong` | TEXT | Extended Strong's (e.g. `H0001a`) |
| `dstrong` | TEXT | Display Strong's (e.g. `H0001`) |
| `ustrong` | TEXT | Unified Strong's (nullable) |
| `lang` | TEXT | `Heb` or `Grk` |
| `lemma` | TEXT | Dictionary form (nullable) |
| `translit` | TEXT | Latin transliteration (nullable) |
| `morph` | TEXT | Morphology summary (nullable) |
| `gloss` | TEXT | Brief English gloss (nullable) |
| `meaning_plain` | TEXT | Full plain-text definition (nullable) |

Sourced from STEPBible TBESH (Hebrew) and TBESG (Greek) TSV files.
Approximately 22,700 entries total (11,682 Hebrew + 11,035 Greek).

### Class Database (`class.db`)

Managed by the Class Worker. Persistent user data.

#### `series`
Groups sessions together (e.g., "Gospel of John").
- `external_id`: UUID for syncing.
- `title`, `description`, `started_on`, `ended_on`.

#### `sessions`
A single teaching event.
- `series_id`: FK to `series`.
- `title`, `taught_on`, `location`, `primary_text`.
- `status`: `active` or `archived`.

#### `scripture_refs`
Scripture references captured during a session.
- `session_id`: FK to `sessions`.
- `book_id`, `chapter`, `verse_start`, `verse_end`.
- `raw_input`: The original text entered (e.g., "Jn 3:16").
- `context_note`: Optional teacher note.

#### `topics`
Taxonomy for tagging sessions.
- `name`, `parent_id`, `description`.

#### `notes`
Rich text or plain text notes tied to a session and optionally a reference.
- `session_id`, `ref_id`, `topic_id`, `body`.

#### `follow_ups`
Tasks or questions to be addressed later.
- `kind`: `question`, `word_study`, `cross_ref`, etc.
- `status`: `open`, `in_progress`, `done`, `dropped`.

---

## ETL Pipeline (`scripts/build_db.py`)

Load order is critical — lexicons must be built before tokens so gloss data is
available during token import.

1. Create `book_meta`, `verses`, `tokens`, `lex_brief`, `lex_names` tables
2. **`load_lex_brief`** — parse TBESH and TBESG TSV files; build in-memory
   dicts keyed by exact lemma and by NFD-stripped/lowercased lemma for fuzzy
   matching
3. **`load_verses_nasb`** — import from `bible-nau.db` SQLite source
4. **`load_tokens_wlc`** — import Hebrew interlinear from `bible-nau.db`
5. **`load_tokens_gnt`** — import Greek NT interlinear from `bible-nau.db`;
   enrich gloss/strong via `_lex_lookup()` with Unicode normalization
6. **`load_tokens_lxx`** — import LXX interlinear; same enrichment
7. **`load_verses_kjv`**, **`load_verses_asv`**, **`load_verses_leb`** — import
   remaining English translations
8. Build FTS5 virtual tables (`verses_fts`, `tokens_fts`) with
   `unicode61 remove_diacritics 2` tokenizer
9. `ANALYZE` + `VACUUM`

### Unicode normalization for lexicon lookup

Greek lemmas from different sources may use different Unicode normalization
forms and may or may not carry diacritical marks. `_strip_diacritics(s)` applies
NFD decomposition and removes characters in Unicode category `Mn` (non-spacing
marks), then lowercases. Both the exact form and the stripped form are indexed,
and `_lex_lookup()` tries exact first, then stripped — achieving ~98% gloss
coverage for GNT and ~95% for LXX tokens.

---

## Worker RPC Protocol

All messages are plain JavaScript objects transferred via `postMessage` (no
transferable objects).

### Request messages (main thread → worker)

```ts
{ id: string; type: 'search';               query: string; source: Source }
{ id: string; type: 'lookup';               strong: string }
{ id: string; type: 'lookup_lemma';         lemma: string; lang: 'Heb' | 'Grk' }
{ id: string; type: 'fetch_chapter';        abbr3: string; chapter: number; translation: string }
{ id: string; type: 'fetch_chapter_originals'; abbr3: string; chapter: number; testament: 'OT' | 'NT' }
```

### Response messages (worker → main thread)

```ts
// Success
{ id: string; ok: true;  data: any }
// Error
{ id: string; ok: false; error: string }
// Status broadcasts (no id)
{ type: 'ready' }
{ type: 'progress'; message: string }
{ type: 'error';    message: string }
```

`DBClient` in `lib/db.ts` wraps these into Promises using a `Map<id, {resolve, reject}>` pending table and a monotonically-increasing sequence number.

---

## Search Algorithm

### English search (`Source ∈ {KJV, ASV, LEB, NASB}`)

```sql
WITH hits AS (
  SELECT book_id, chapter, verse, text, abbr3, name, testament
  FROM verses JOIN book_meta …
  WHERE translation = ?translation
    AND rowid IN (SELECT rowid FROM verses_fts WHERE verses_fts MATCH ?fts)
  ORDER BY book_id, chapter, verse LIMIT 200
)
SELECT … FROM hits
LEFT JOIN tokens t ON … AND corpus IN ('WLC','LXX') -- OT
                          OR corpus = 'GNT'          -- NT
ORDER BY book_id, chapter, verse, corpus_order, word_num
```

Results carry both WLC and LXX sections for OT verses, enabling the dual
interlinear display.

### Original-language search — OT (`Source ∈ {Heb, LXX}`)

Searches `tokens_fts` on the target corpus (`WLC` for Heb, `LXX` for LXX),
then joins *both* WLC and LXX tokens so the result card shows both versions
regardless of which corpus matched.

### Original-language search — NT (`Source = GNT`)

Searches `tokens_fts` filtered to `corpus = 'GNT'` and joins GNT tokens only.

### Phrase search

`ftsEscape(q)` detects a phrase query: a string that starts and ends with a
double-quote character. The interior is passed through as a single FTS5 phrase
token (`"word1 word2"`). Non-phrase queries are split on whitespace and each
term is individually quoted.

### Result cap

All hit CTEs use `LIMIT 200`. The UI displays a warning badge when the result
count equals 200.

### Highlighting

After DB results are assembled, each token's `highlight` flag is set client-side
by checking whether the query string (lowercased) appears in the token's gloss,
transliteration, or surface form. This drives amber/indigo colouring of word
chips in the interlinear and the match-word highlight in English verse text.

---

## OPFS Caching

```
First load:
  fetch /db/bcv.db  →  Uint8Array
  validate magic bytes ("SQLite format 3") + minimum size (10 MB)
  write to OPFS via createSyncAccessHandle (worker-only API)
  sqlite3_deserialize into in-memory DB

Subsequent loads:
  readOpfsCache()  →  Uint8Array (from OPFS file)
  validate
  sqlite3_deserialize (skips network fetch)
```

If the OPFS entry is absent, too small, or has bad magic bytes, the cache is
bypassed and a fresh network fetch occurs.

**Cache invalidation:** there is no automatic version check. After rebuilding
`bcv.db`, clear the OPFS cache manually via DevTools → Application → Storage →
Clear site data.

---

## Component Contracts

### `App`

Owns global state: `query`, `source`, `results`, `activeBook`, `dbStatus`,
`chapterView`, `glossEntry`, `glossCardOpen`, `selectedWord`, `selectedLang`.

Key derived values:
- `filtered` — `results` filtered by `activeBook`
- `books` — unique books from `results`, OT before NT
- `distribution` — bar-chart data from `computeDistribution(results)`

### `SearchBar`

Props: `collapsed`, `onToggle`, `query`, `source`, `onGo(query, source)`.
Manages its own draft state; calls `onGo` only on explicit submit (Go button or
Enter key). Shows a "phrase" pill when query is a quoted phrase.

### `ResultCard`

Props: `result: BibleResult`, `onWordTap(word, lang)`, `onEngWordClick(word)`,
`onRefClick(result)`.

Internal state: `expanded` (card body), `interlinearOpen` (originals section).
`interlinearOpen` defaults to `true` for original-language source searches,
`false` for English source searches. Clicking anywhere in the interlinear area
(except a word chip) toggles `interlinearOpen`.

### `ChapterView`

Props: `abbr3`, `bookName`, `chapter` (initial), `highlightVerse`, `testament`,
`onClose`, `onSearch(query, source)`.

Internal state: `currentChapter`, `currentHighlight`, `totalChapters`,
`verses`, `verseOriginals`, `originalsOpen`, `selectedWord`, `selectedLang`.

Fetches chapter verses and original-language tokens in parallel on mount and on
every chapter change. The highlighted verse is scrolled into view after data
loads; navigating to a different chapter resets the highlight and scrolls to
top. Renders `DefinitionSheet` for word lookups within its own stacking context
(z-index 200); `DefinitionSheet` at z-index 100 is relative to ChapterView's
positioned container.

### `DefinitionSheet`

Props: `word: WordToken`, `lang: Lang`, `onClose`, `onSearch(query, source)`.

Fetches the lex entry by Strong's number first, falling back to lemma lookup.
Derives the search source from `word.corpus` so LXX words search LXX, GNT
words search GNT, and WLC words search Heb.

### `GlossCard`

Props: `entry: LexEntry`, `lang: Lang`, `open: boolean`, `onToggle`.

Stateless display card. The parent (`App`) derives the entry from the first
highlighted token in the search results (not via a separate DB query) and
persists `open` across searches.

---

## TypeScript Interfaces

### `types.ts`

```ts
type Lang   = 'Heb' | 'Grk';
type Source = 'KJV' | 'ASV' | 'LEB' | 'NASB' | 'Heb' | 'LXX' | 'GNT';
type Testament = 'OT' | 'NT';

interface WordToken {
  surface: string; translit: string; gloss: string;
  root: string | null; strong?: string | null; lemma?: string | null;
  meaning?: string | null; form?: string | null; highlight?: boolean;
  corpus?: 'WLC' | 'GNT' | 'LXX';
}

interface OriginalSection {
  corpus: 'WLC' | 'GNT' | 'LXX';
  lang: Lang;
  tokens: WordToken[];
}

interface BibleResult {
  ref: string; book: string; bookAbbr: string; testament: Testament;
  chapter: number; verse: number; lang: Lang; source: Source;
  english: string; matchWord: string; originals: OriginalSection[];
}
```

### `lib/db.ts` (additional types)

```ts
interface ChapterVerse       { verse: number; text: string; }
interface ChapterFetchResult { verses: ChapterVerse[]; totalChapters: number; }
interface ChapterVerseOriginals {
  verse: number;
  originals: { corpus: 'WLC'|'LXX'|'GNT'; lang: 'Heb'|'Grk'; tokens: TokenShape[] }[];
}
interface LexEntry {
  estrong: string; dstrong: string; ustrong: string | null;
  lang: string; lemma: string | null; translit: string | null;
  morph: string | null; gloss: string | null; meaning: string | null;
}
```
