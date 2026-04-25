# Database Model Plan — bcv-claude

## 1. Source-file analysis

### 1.1 TBESG.txt — Brief Greek lexicon (STEPBible, CC BY)
- **Size:** 4.7 MB, 11,125 lines. UTF-8 with BOM (`﻿` at file start). Tab-separated.
- **Header:** lines 1–89 are prose documentation + field-description block. Data begins ~line 91 after a `===` separator and a column header at line 88:
  `eStrong \t dStrong \t uStrong \t Greek \t Transliteration \t Morph \t Gloss \t Abbott-Smith lexicon`
- **Data row shape** (tab-separated, 8 columns):
  ```
  G0025  G0025 =  G0025  ἀγαπάω  agapaō  G:V  to love  <b>ἀγαπάω</b>, -ῶ, ...(AS)
  ```
- **Ambiguity / noise:** the file interleaves **person/place disambiguation blocks** starting with `$========== PERSON(s)` (lines 47, 57, 61…). Rows inside those blocks have a completely different schema (e.g. line 55: `Herod@Mat.2.1=G2264G \t description \t =+ \t ... \t references`). The ETL must **skip lines starting with `$`** and handle the name-disambiguation rows separately (or skip for v1).
- **Meaning column** contains raw HTML-ish markup (`<b>`, `<br/>`, `<ref='Mat.1.1'>…</ref>`) — we strip or preserve as needed.

### 1.2 TBESH.txt — Brief Hebrew lexicon
- **Size:** 3.3 MB, 11,736 lines. UTF-8 with BOM, TSV.
- **Same shape** as TBESG: `eStrong \t dStrong \t uStrong \t Hebrew \t Transliteration \t Morph \t Gloss \t Meaning` with `H####` Strong prefixes.
- Example (line 55): `H0001 \t H0001G = \t H0001G \t אָב \t av \t H:N-M \t father \t 1) father of an individual<br>2)…`
- **Morph codes** documented in header: `H:N-M`, `A:V`, `N:N-M-P`, etc. (Language:Type-Gender-Extra).

### 1.3 TFLSJ.txt — Full LSJ Greek lexicon (G0001–G5624)
- **Size:** 23 MB, 5,772 lines. UTF-8 with BOM, TSV.
- **Same 8-column shape** as TBESG but with a richer `LSJ Meaning` column containing extensive HTML (`<Level2>`, `<a href>` tooltips with citation metadata).
- Only NT-range Strongs (G0001–G5624). Fewer rows because LSJ entries are long, not because coverage is smaller.

### 1.4 TFLSJ-extra.txt — Full LSJ, LXX + variant Strong ranges
- **Size:** 8 MB, 5,389 lines. Same schema as TFLSJ, covers G6000+ (NASB variants, Apostolic Bible LXX words, Hebrew transliterations G10000–G19999, etc. per the header).
- Complementary to TFLSJ — ETL should **union** the two into one `lsj_lexicon` table.

### 1.5 kjv.txt — King James (Pure Cambridge Edition, public domain)
- **Size:** 4.6 MB. UTF-8 with BOM. Lines 1–2 are header (`KJV` / attribution), data from line 3.
- **Row shape:** `Genesis 1:1\tIn the beginning God created the heaven and the earth.`
- Square-bracketed words `[was]` are italicized supplied words — preserve or strip per UI preference.
- Book names are full English (`Genesis`, `1 Samuel`, `Song of Solomon`, `Revelation`). Need to map to `book_meta.abbr3`.

### 1.6 asv.txt — American Standard Version (1901, public domain)
- **Size:** 4.6 MB. UTF-8 with BOM. Same shape as kjv.txt (`Genesis 1:1\tIn the beginning…`). Two-line header.
- No bracket conventions. Clean text.

### 1.7 LEB.json — Lexham English Bible (permissive, Logos/Faithlife)
- **Size:** 11.6 MB. JSON, **nested** (not flat). Structure:
  ```json
  { "books": [ { "name": "Genesis", "chapters": [ { "chapter": 1, "name": "Genesis 1",
    "verses": [ { "verse": 1, "chapter": 1, "name": "Genesis 1:1", "text": "…" }, … ] } ] } ] }
  ```
- Text has leading/trailing whitespace and em-dashes (`\u2014`); trim on ingest.

### 1.8 bible-nau.db — **ALREADY POPULATED** (345 MB)
Existing SQLite tables (from `.schema`):

| Table | Content | Row shape |
|---|---|---|
| `books` | book master (id, abbrev) | `id, abbrev, name, openbible_abbrev, ntId` |
| `nau` | NASB per-word index | `Book, Chapter, Verse, WordNum, VerseNum, Word, WordCaps` |
| `nau_verses` | NASB verse text | `Book, Chapter, Verse, VerseNum, Content` |
| `morph` | Greek NT tagged words | `Book, Chapter, Verse, WordNum, Part, Morph, WordA, WordB, WordC, Lemma, prechar, postchar, notes, BookName` |
| `morph_verses` | Greek NT verse text | `Book, Chapter, Verse, Content, ContentProcessed, BCV` |
| `heb` | Hebrew MT words | `id, orig, bcv, book, chapter, verse, strong_id, strong, BSB, WLC, parsing` |
| `lxx` | Septuagint words | `book, chapter, verse, wordnum, lnum, lex, morph, word, lemma` |
| `strongs` | Strong's entries v1 | `word, strongs_def, kjv_def, lemma, translit, derivation` |
| `strongs2` | Strong's entries v2 | `number, lemma, xlit, pronounce, description` |
| `openbible` / `openbible_book_list` | cross-references with votes | |
| `stopwords`, `stopwords-greek`, `stopwords-morph` | search-stopword lists |  |

Indices on `(Book, Chapter, Verse)`, `Word`, `WordCaps`, `Lemma`, `WordA` already exist.

**Note:** `heb` has a `BSB` column — Berean Standard Bible English text per Hebrew word. That gives us a free English gloss alignment for OT. No ESV column is present, so "English" for OT defaults to BSB (or we add it). Only NASB for NT in `nau_verses`.

---

## 2. Proposed schema (split: `bcv.db` + optional `bcv-lsj.db`)

Build **two** derived SQLite files. Leave upstream `bible-nau.db` immutable.

- **`bcv.db`** (~60 MB, shipped with app) — verses, tokens, brief lexicon, FTS. Fully functional offline on install.
- **`bcv-lsj.db`** (~35 MB, optional download) — full LSJ `meaning` HTML + FTS over LSJ text. Fetched when the user taps "Load full LSJ" in settings, stored in OPFS, `ATTACH`ed at runtime.

The app falls back to `lex_brief` (in `bcv.db`) for every Greek word when LSJ isn't attached; tapping a word still shows gloss/lemma/translit/form. LSJ adds the deep etymology view.

### 2.0 Core schema (derived `bcv.db`)

```sql
-- Book master — 66 rows, seeded from src/lib/search.ts ORDER[]
CREATE TABLE book_meta (
  id          INTEGER PRIMARY KEY,      -- 1..66 (Gen=1, Rev=66)
  abbr3       TEXT NOT NULL UNIQUE,     -- 'Gen', 'Jhn'  (frontend convention)
  osis        TEXT NOT NULL UNIQUE,     -- STEPBible OSIS code
  name        TEXT NOT NULL,            -- 'Genesis'
  testament   TEXT NOT NULL CHECK (testament IN ('OT','NT')),
  chapters    INTEGER NOT NULL
);

-- One row per verse per translation. 4 translations × ~31,100 verses ≈ 124k rows.
CREATE TABLE verses (
  book_id     INTEGER NOT NULL REFERENCES book_meta(id),
  chapter     INTEGER NOT NULL,
  verse       INTEGER NOT NULL,
  translation TEXT NOT NULL,            -- 'NASB' | 'KJV' | 'ASV' | 'LEB'
  text        TEXT NOT NULL,
  PRIMARY KEY (translation, book_id, chapter, verse)
);
CREATE INDEX verses_bcv ON verses(book_id, chapter, verse);

-- Original-language tokens. One row per word across Heb MT, LXX, GNT.
CREATE TABLE tokens (
  id          INTEGER PRIMARY KEY,
  book_id     INTEGER NOT NULL REFERENCES book_meta(id),
  chapter     INTEGER NOT NULL,
  verse       INTEGER NOT NULL,
  word_num    INTEGER NOT NULL,         -- order within verse
  corpus      TEXT NOT NULL,            -- 'MT' | 'LXX' | 'GNT'
  surface     TEXT NOT NULL,            -- original script glyph(s)
  translit    TEXT,
  gloss       TEXT,
  lemma       TEXT,
  strong      TEXT,                     -- dStrong, e.g. 'G0025', 'H0001G'
  morph       TEXT                      -- parsing code
);
CREATE INDEX tokens_bcv      ON tokens(book_id, chapter, verse, word_num);
CREATE INDEX tokens_strong   ON tokens(strong);
CREATE INDEX tokens_lemma    ON tokens(lemma);
```

`heb.BSB` is **not** copied into `verses` — it's a per-word gloss, not a verse translation; the 4 shipped translations (NASB/KJV/ASV/LEB) fully cover English display. BSB stays available through `tokens.gloss` if we want per-word alignment for OT.

### 2.1 Lexicon tables (ETL target for the four TSVs)

```sql
-- Unified Strong's-keyed lexicon from TBESG + TBESH
CREATE TABLE lex_brief (
  estrong      TEXT NOT NULL,        -- e.g. 'G0025', 'H0001'
  dstrong      TEXT,                 -- 'G0025' or 'H0001G'
  ustrong      TEXT,                 -- unified
  lang         TEXT NOT NULL,        -- 'G' | 'H'
  lemma        TEXT NOT NULL,        -- original-script headword ἀγαπάω / אָב
  translit     TEXT NOT NULL,        -- agapaō / av
  morph        TEXT,                 -- 'G:V', 'H:N-M'
  gloss        TEXT,                 -- one-word
  meaning      TEXT,                 -- full entry (HTML retained)
  meaning_plain TEXT,                -- HTML-stripped, for FTS
  PRIMARY KEY (dstrong, lang)
);
CREATE INDEX lex_brief_estrong ON lex_brief(estrong);
CREATE INDEX lex_brief_ustrong ON lex_brief(ustrong);
CREATE INDEX lex_brief_lemma   ON lex_brief(lemma);
CREATE INDEX lex_brief_translit ON lex_brief(translit);

```

### 2.1b `bcv-lsj.db` — optional companion

```sql
-- Lives in a SEPARATE file, ATTACHed as `lsj` when loaded
CREATE TABLE lex_lsj (
  estrong       TEXT NOT NULL,
  dstrong       TEXT,
  ustrong       TEXT,
  lemma         TEXT NOT NULL,
  translit      TEXT NOT NULL,
  morph         TEXT,
  gloss         TEXT,
  meaning       TEXT,                -- raw HTML w/ tooltips
  meaning_plain TEXT,
  source        TEXT NOT NULL,       -- 'lsj' | 'lsj-extra'
  PRIMARY KEY (dstrong)
);
CREATE INDEX lex_lsj_estrong ON lex_lsj(estrong);

-- FTS for LSJ meaning text (not shared with core; each FTS lives with its content table)
CREATE VIRTUAL TABLE lex_lsj_fts USING fts5(
  meaning_plain,
  content='lex_lsj', content_rowid='rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);
```

**Runtime integration.** On app start, check OPFS for `bcv-lsj.db`. If present, `ATTACH DATABASE 'file:/opfs/bcv-lsj.db' AS lsj` in the worker; definition-sheet queries use `LEFT JOIN lsj.lex_lsj USING (dstrong)`. If absent, those columns come back NULL and the UI renders the brief-lexicon view only.

### 2.2 FTS5 indexes

```sql
-- English verse search across all 4 translations
CREATE VIRTUAL TABLE verses_fts USING fts5(
  text,
  translation UNINDEXED, book_id UNINDEXED, chapter UNINDEXED, verse UNINDEXED,
  content='verses', content_rowid='rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Original-language search: translit / gloss / lemma across MT, LXX, GNT
CREATE VIRTUAL TABLE tokens_fts USING fts5(
  surface, translit, gloss, lemma,
  corpus UNINDEXED, book_id UNINDEXED, chapter UNINDEXED, verse UNINDEXED,
  content='tokens', content_rowid='id',
  tokenize = 'unicode61 remove_diacritics 2'
);
```
Contentless FTS5 (`content='…'`) avoids duplicating row text. Triggers keep the FTS in sync if we ever update; for a build-once derived DB, a single post-insert `INSERT INTO fts(rowid,…) SELECT …` is enough.

### 2.3 Aggregation (book distribution chart)

A simple `GROUP BY bookAbbr COUNT(*)` on the filtered result set — no dedicated table. The 66-element array the chart expects is assembled client-side against `book_meta.abbr3` ORDER.

---

## 3. ETL approach

### 3.1 Inputs / outputs
- **Inputs (SQLite):** `data/bible-nau.db` — NASB verses (`nau_verses`), GNT tokens (`morph`), Hebrew MT tokens (`heb`), LXX tokens (`lxx`), Strong's (`strongs` / `strongs2`). Read-only.
- **Inputs (flat files):** `kjv.txt`, `asv.txt`, `LEB.json`, `TBESG.txt`, `TBESH.txt`, `TFLSJ.txt`, `TFLSJ-extra.txt`.
- **Output:** a fresh `data/bcv.db` built from scratch on each ETL run.

### 3.2 Parsing the four TSV lexicons (one pass each)
1. Open as UTF-8, strip BOM.
2. Skip until the line that starts with `eStrong\t` (column header), then skip the `====` separator.
3. For each subsequent line:
   - `continue` if blank or starts with `$` (person/place blocks in TBESG/TBESH — v1 skip).
   - Split on `\t` — expect 8 columns. Trim each.
   - Derive `lang` from the `eStrong` first char (`G`/`H`).
   - `meaning_plain = strip_html(meaning)` (keep `<ref>` text content; drop tags).
   - Upsert into `lex_brief` (for TBESG/TBESH) or `lex_lsj` (for TFLSJ + TFLSJ-extra).
4. On TFLSJ-extra, stamp `source='lsj-extra'`.

Expected rows: TBESG ~11k, TBESH ~11k → `lex_brief` ≈ 22k. TFLSJ ~5.7k + TFLSJ-extra ~5.4k → `lex_lsj` ≈ 11k.

### 3.3 Book mapping
Seed `book_meta` from the `ORDER` array in `src/lib/search.ts` (lines 33–38) and join to the existing `books`/`openbible_book_list` tables' abbreviations. Need to hand-verify mapping: e.g. `Jhn` (frontend) vs `Jhn` or `John` (DB). STEPBible OSIS uses `Mat, Mrk, Luk, Jhn, Act, Rom…` which matches. OT names also match (Gen, Exo, Lev…). Double-check `Jud` (Jude) vs `Jdg` (Judges) — the frontend ORDER already disambiguates.

### 3.4 English translations
- **NASB:** `INSERT INTO verses SELECT … FROM bible-nau.db.nau_verses` (ATTACH the upstream DB read-only). Need to map `nau_verses.Book` (text) → `book_meta.id`; build a lookup table.
- **KJV / ASV:** stream-parse `kjv.txt` / `asv.txt`. Skip 2-line header. Split on first tab: left side is `Book C:V`, right side is verse text. Book name is full English — lookup against `book_meta.name` (handle "Song of Solomon" vs `Sng`, "Psalms" vs "Psalm").
- **LEB:** `json.load` + walk the nested `books[].chapters[].verses[]` structure. Trim text.

At query time the app selects one `translation` value; the schema is already set up for future additions (BSB, WEB, etc.) without migration.

### 3.5 Order of operations
1. Create fresh `data/bcv.db`; run schema DDL.
2. Seed `book_meta` (66 rows) from frontend `ORDER`.
3. ATTACH `bible-nau.db`; copy NASB verses → `verses`; copy GNT/Heb/LXX tokens → `tokens`.
4. Parse `kjv.txt`, `asv.txt`, `LEB.json` → `verses` (translation IN ('KJV','ASV','LEB')).
5. Parse `TBESG.txt` → `lex_brief` (Greek rows).
6. Parse `TBESH.txt` → `lex_brief` (Hebrew rows).
7. Populate `verses_fts` and `tokens_fts` from their content tables.
8. `ANALYZE; VACUUM;` → **`bcv.db`** finalized.
9. Create fresh `data/bcv-lsj.db`; run LSJ schema DDL (`lex_lsj` + `lex_lsj_fts`).
10. Parse `TFLSJ.txt` + `TFLSJ-extra.txt` → `lex_lsj` (with `source` stamp).
11. Populate `lex_lsj_fts`.
12. `ANALYZE; VACUUM;` → **`bcv-lsj.db`** finalized as a separate artifact.

### 3.6 Expected row counts / size
- `verses`: 4 translations × ~31,100 verses ≈ **124,400 rows**.
- `tokens`: MT ~470k + LXX ~600k + GNT ~138k ≈ **~1.2M rows**.
- `lex_brief` (in core): ~22k. `lex_lsj` (in companion): ~11k.
- Estimated sizes after `VACUUM`:
  - **`bcv.db` ≈ 55–70 MB** (verses dominate; tokens compact; brief lexicon tiny).
  - **`bcv-lsj.db` ≈ 30–40 MB** (LSJ HTML meanings + FTS).

---

## 3.7 "Load full LSJ" UX

- Settings panel gains a row: **"Full Greek lexicon (LSJ)"** with status (`Not loaded` / `Downloading 42%` / `Loaded · 35 MB`) and a primary action button.
- On tap: fetch `bcv-lsj.db` (served as a static asset; gzip-able to ~25 MB over the wire), write to OPFS, `ATTACH` it in the worker, persist an "lsj_loaded" flag.
- Definition sheet gets a subtle chip when LSJ is attached — e.g. a small "LSJ" pill next to the Strong's number, expanding into the longer etymology entry inline or via a secondary "Full entry" toggle inside the sheet.
- When LSJ isn't loaded: the chip is absent; the sheet renders only `lex_brief` content; no nag.
- Resilience: if OPFS eviction wipes the file, the next query returns NULL from the left-joined LSJ columns; a background check on app start detects missing OPFS content and flips the settings row back to "Not loaded".

## 4. Open questions (confirm before coding)

### Resolved decisions
- UI translations: **NASB, KJV, ASV, LEB** (ESV + NIV dropped).
- Minimum iOS: **17+**.
- Runtime: **`@sqlite.org/sqlite-wasm` + OPFS**, Web Worker, COOP/COEP headers.
- LSJ: **split** — core `bcv.db` ships with brief lexicon; `bcv-lsj.db` optional via "Load full LSJ" button.

### Still open
1. **Person/place disambiguation blocks** in TBESG/TBESH (`Herod@Mat.2.1=G2264G`) — separate `lex_names` table now, or skip v1?
2. **dStrong vs eStrong vs uStrong** — which one does the frontend's `strong`/`root` field map to? Recommend `dStrong` as primary key, expose `uStrong` for search grouping, show `eStrong` in the UI.
3. **LSJ HTML sanitization** — keep raw HTML with a sanitizer (DOMPurify) on render, or strip to structured JSON at ETL time? Raw-plus-sanitize preserves tooltips; strip-to-JSON is safer and enables custom rendering.

---

## 5. Risks / unknowns

- **Bundle size.** Upstream 345 MB SQLite is not shippable. Split strategy: **`bcv.db` ~60 MB** (shipped) + **`bcv-lsj.db` ~35 MB** (opt-in download via "Load full LSJ" in settings).
- **Licensing.**
  - STEPBible data (all four TSVs) — CC BY; attribution required.
  - NASB (`nau_verses`) — Lockman Foundation; **redistribution is restricted**. Confirm we have a license to ship it in an app.
  - KJV — public domain.
  - ASV (1901) — public domain.
  - LEB — Lexham/Faithlife; free for non-commercial digital distribution with attribution; confirm the license file shipped in the app.
- **Encoding.** BOMs in all four TSVs; Hebrew is RTL with cantillation + vowel points; Greek has polytonic diacritics. `unicode61 remove_diacritics 2` in FTS handles search but display must preserve the original.
- **Meaning HTML** contains `<ref='Mat.1.1'>` and `<a href="javascript:void(0)" title="...">` tooltip constructs — easy XSS vectors if rendered with `dangerouslyInnerHTML`. Sanitize or convert to structured JSON at ETL time.
- **Strong's number variants.** TBESG documents 10+ number ranges (G0001–G5624, G6000s NASB variants, G10000s Hebrew transliterations, G20000s LXX-only). The `morph`/`heb` tables may reference numbers we don't have lexicon rows for. Plan for LEFT JOINs and graceful fallback (show morph code even if no lemma).
- **Book-abbreviation drift.** The frontend uses `Jhn`, `Mrk`, `1Sa`, `Sng`; STEPBible refs use `Jhn`, `Mrk`, `1Sa`, `Sng` (same). But `Jud` vs `Jdg` vs `Jude` is a known gotcha — verify each of the 66 mappings.
- **No sample data inspected in `bible-nau.db`.** Row shapes are inferred from column names; confirm before ETL with `SELECT * … LIMIT 5` on each table.

---

## 6. SQLite-in-browser: `sql.js` vs `@sqlite.org/sqlite-wasm`

Both compile SQLite to WebAssembly. The difference is who maintains it and how the DB file is exposed to the engine.

### sql.js (kripken, community; used by many projects since 2013)
**Pros**
- Simple API. `new SQL.Database(uint8Array)` → runs. Works out of the box with any bundler.
- **Ubiquitous, battle-tested.** Fewest surprises on iOS Safari; well-known behavior on old WebKit versions.
- Small API surface; easy to wrap in a hook for React.
- Works in a Web Worker trivially (pass the `Uint8Array` across).

**Cons**
- **Loads the entire DB into memory.** A 100 MB `bcv.db` → 100 MB JS heap. iOS Safari's WebView (used by home-screen PWAs and in-app WKWebView) has a ~**1 GB JS heap ceiling** per tab, typically crashing tabs well below that on older devices. 100 MB is fine on modern iPhones (A14+, 4 GB+ RAM) but marginal on iPhone SE 2/3 or older iPads.
- No persistence helper — you must save/restore via IndexedDB yourself.
- No FTS5 by default in some older builds; must pick a build flavor with FTS5 compiled in (the `sql.js` default build has had FTS5 for years, but verify).
- Slower to initial-load large DBs because it reads the full buffer before serving any query.

### @sqlite.org/sqlite-wasm (official, maintained by the SQLite team since 2022)
**Pros**
- **OPFS-backed VFS** (Origin-Private File System) — reads pages on demand from a persistent file, so memory use is proportional to the working set, not the DB size. A 100 MB DB can run in <30 MB of RAM for typical queries.
- Official upstream; FTS5, JSON1, RTree all included; kept current with each SQLite release.
- Persistent: download once, stored in OPFS, subsequent launches instant.
- Worker-first API — runs off the main thread cleanly.

**Cons**
- **More complex integration.** OPFS requires cross-origin isolation headers (`COOP: same-origin` + `COEP: require-corp`) for the synchronous `SharedArrayBuffer` API the worker uses. Vite dev server and any production host must set these. Breaks third-party iframes that don't opt in.
- **OPFS support on iOS Safari:** Shipped in Safari 17 (Sep 2023, iOS 17+). **Users on iOS 16 or earlier cannot use OPFS.** We'd need a fallback — typically bundles both libraries and degrades to sql.js on older iOS.
- Safari's OPFS implementation has had bugs historically; as of 2025 it's stable but less battle-tested than on Chrome.
- Larger wasm binary (~1.5 MB) vs sql.js (~1 MB) on initial load.
- API is lower level — you write SQL strings and consume row objects; fewer ergonomic helpers.

### Feasibility on iPhone
Both will run. The practical constraints:

| Constraint | sql.js | sqlite-wasm (OPFS) |
|---|---|---|
| iOS 16 and earlier | ✅ works | ❌ no OPFS; falls back to the sql.js story |
| iOS 17+ (Safari/WKWebView) | ✅ works | ✅ works, best path |
| 100 MB DB on iPhone SE 2 (3 GB RAM) | ⚠️ marginal — may evict tab on memory pressure | ✅ fine; pages in on demand |
| 100 MB DB on iPhone 15 (6 GB RAM) | ✅ fine | ✅ fine, faster cold start after first download |
| Cold start (first visit) | Downloads full DB, parses into heap: ~2–5s on 5G | Downloads to OPFS: same network time, query latency ~immediate |
| Warm start (return visit) | Must redownload or rehydrate from IndexedDB (awkward) | DB already in OPFS: opens instantly |
| PWA / home-screen install | Supported; cache via service worker | Supported; OPFS persists across launches |
| Native iOS app (if we ever wrap in WKWebView) | Works, but same RAM story | OPFS works in WKWebView on iOS 17+ |

### Recommendation

**Ship `@sqlite.org/sqlite-wasm` as primary**, with iOS 17+ as the minimum supported version. Benefits compound: smaller memory footprint, instant warm starts, official upstream, FTS5 guaranteed.

If we must support iOS 16, add `sql.js` as a detected fallback (feature-detect OPFS; if missing, load sql.js and fetch the DB into memory). This doubles the wasm budget on old devices but keeps the app usable.

Either way, run the SQLite engine in a Web Worker so the main thread stays responsive during search. Bundle the DB as a static asset served with the COOP/COEP headers Vite sets via the `vite-plugin-cross-origin-isolation` plugin (or manually).

**What to do next:** prototype `sqlite-wasm` + OPFS with a 20 MB slice of the DB on an iPhone to confirm perceived latency for the English FTS query. If that's ≤150ms warm, ship it.

---

### Critical files for implementation
- `/Users/john/code/GitHub/bcv-claude/src/types.ts`
- `/Users/john/code/GitHub/bcv-claude/src/lib/search.ts`
- `/Users/john/code/GitHub/bcv-claude/data/bible-nau.db`
- `/Users/john/code/GitHub/bcv-claude/data/TBESG.txt` (and TBESH/TFLSJ/TFLSJ-extra — same parser)
- `/Users/john/code/GitHub/bcv-claude/data/kjv.txt`, `asv.txt` (tab-separated `Book C:V\tText`)
- `/Users/john/code/GitHub/bcv-claude/data/LEB.json` (nested JSON)
- `/Users/john/code/GitHub/bcv-claude/src/data/verses.ts` (the 15-verse fixture to be replaced by the DB-driven loader)

---

## ETL build notes (Option 1 — lex_brief only)

Script: [scripts/build_db.py](../scripts/build_db.py). Python stdlib only; run with `python3 scripts/build_db.py`.

**Decisions:**
- `strongs` / `strongs2` from bible-nau.db are **not** imported. They overlap only 13% on lemma due to accent mismatches and `strongs` is Greek-only. `lex_brief` (TBESG + TBESH) is the sole brief lexicon; Strong's numbers are carried on `lex_brief.estrong` / `dstrong`, so callsites can still display Strong's codes.
- `morph` table (GNT) has no Strong's column. Greek tokens ship with lemma + morph only; resolving to Strong's at query time requires a lemma-string lookup against `lex_brief` (lossy: some lemma spelling/accent drift).
- `lxx.lex` is a Logos ID (`L704639…`), not a Strong's code. LXX tokens are **skipped in v1**; revisit once we have a Logos-ID ↔ Strong's map.
- Book-name aliases are normalized to frontend abbr3 (Sng/Phl/Jhn/Jas/1Jn…). Alias map in `scripts/build_db.py:_aliases` covers nau_verses, morph_verses ("Joh"/"Jam"/"Phi"), heb ("1st Samuel", "Psalm", "Song of Solomon"), KJV/ASV full English, and LEB Roman-numeral style ("I Samuel", "II Kings", "Revelation of John").
- Hebrew Strong's codes are reconstructed as `printf('H%04d', heb.strong_id)` to match TBESH's `H0001` format.

**Outputs (current run):**

| DB | Size | Contents |
|---|---|---|
| `data/bcv.db` | 130 MB | 4 English translations × 31k verses, Heb 23k, GNT 7.9k, 305k Hebrew tokens, 137k Greek tokens, 11.7k lex_brief, 11k lex_names, FTS5 on verses + tokens |
| `data/bcv-lsj.db` | 27 MB | 11k lex_lsj entries (TFLSJ + TFLSJ-extra), FTS5 on meaning_plain |

Core DB is above the 60 MB target — FTS5 adds ~60% overhead on tokens. If bundle size becomes a problem, options: drop token-level FTS (rely on lemma index), or split tokens into a separate on-demand DB.

**Known gaps / follow-ups:**
- LSJ `meaning_json` currently stores `{"plain": "…"}` — full structured sense hierarchy (Level2/Level3 + citation extraction from `<a title="…">` tooltips) is deferred.
- LXX tokens not yet imported.
- Greek NT tokens lack Strong's — resolve via lemma-match in the query layer or via a future morph→Strong's backfill.
- No `tokens_fts` test coverage yet; verify with a few manual queries before wiring to the UI.
