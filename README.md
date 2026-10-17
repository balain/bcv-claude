# BibleSearch

A fast, offline-capable Bible search tool with interlinear Hebrew and Greek, built as a progressive web app using React and SQLite running entirely in the browser.

See the [User's Guide](GUIDE.md), [Technical Specification](SPEC.md), and
[Sources and Attribution](SOURCES.md) for usage, implementation, and source references.

## Features

- **Full-text search** across four English translations and three original-language sources — KJV, ASV, LEB, NASB, Hebrew MT (WLC), LXX, and GNT
- **Phrase search** — wrap terms in double quotes: `"holy spirit"`, `"in the beginning"`
- **Reference search** — enter verses, chapters, or ranges such as `John 3:16,18; Rom 8:28`, `Psalm 23`, `John 3-4`, or `John 3:16–4:6`. For single-chapter books, `Jude 3` means Jude 1:3. References display NASB with the available interlinear text, ignore the search hit limit, and preserve input order while removing duplicate verses. The Bible order toggle sorts references into canonical order and defaults to off. Invalid references are reported alongside valid results; bare book names remain word searches.
- **Interlinear display** — every result card shows the underlying Hebrew (WLC) and/or Greek (LXX / GNT) text alongside the English translation
- **Dual OT interlinear** — OT verses show both the Masoretic (WLC) and Septuagint (LXX) in parallel
- **Word lookup** — tap any Hebrew or Greek word chip to see its lemma, transliteration, Strong's number, gloss, and full lexical definition
- **Study lexicons** — switch between BDB and UBS for Hebrew, or LSJ and UBS for Greek. UBS entries retain distinct meanings, semantic domains, and Scripture references. Sources are stored in the main database for offline use.
- **Source credits** — Settings → Source material credits lists source attribution, license terms, and a download of the adapted UBS data.
- **English Strong's lookup** — select Strong's beside a single-word English search to browse all Hebrew and Greek lexicon definitions containing that word, then select a lemma to search it.
- **Lemma / form search** — search from within a word-lookup card to find all occurrences of a root or inflected form
- **GlossCard** — single-word original-language searches display the word's gloss and meaning above the result list
- **Chapter view** — click any Book:Chapter:Verse reference to read the full NASB chapter, with prev/next chapter navigation and optional original-language interlinear per verse
- **Browse chapter navigation** — a single scrolling chapter row stays below the book list while verses scroll. Every book has a numeric chapter jump; chapter buttons, previous/next arrows, passage input, and URL stay synchronized.
- **Search history** — quick access to your recent searches, persisted locally
- **Search settings** — open the gear button to configure combined LXX/GNT searches (enabled by default) and the maximum number of verse hits (200 by default, or unlimited). Preferences are saved locally and apply to searches from word definitions too.
- **Cross-references** — scroll through all related passages with an eight-word NASB preview, open a target passage, or add a personal reference; saved personal notes appear alongside their references
- **Bookmarks** — save verses from search, Browse, and Class Mode; reopen them from Browse
- **Word Study Mode** — study English, Greek, Hebrew, Aramaic, transliterations, forms, and Strong’s identifiers; explore full-corpus frequencies, lexical entries, sourced relationships, and a responsive word map. Save notes, attach studies to Class sessions, compare counts, and export/import studies.
- **Class Mode** — create sessions, capture references, add reference context notes, and export/import session JSON. Dedicated topic, follow-up, and standalone-note editing controls are not yet enabled.
- **Distribution chart** — optional bar chart showing hit density across the biblical canon
- **Book filter** — click any book pill to narrow results to a single book
- **OPFS caching** — the ~295 MB database is downloaded once and cached in the browser's Origin Private File System; subsequent loads are instant, no network required
- **LAN access** — `npm run dev` binds to all interfaces; accessing from another device requires HTTPS for secure browser storage and isolation features

## Technology

| Layer | Choice |
|---|---|
| UI framework | React 19 + TypeScript |
| Bundler | Vite 8 (Rolldown) |
| Database | SQLite via `@sqlite.org/sqlite-wasm`, deserialized in-memory with OPFS byte cache |
| Search | FTS5 with `unicode61 remove_diacritics 2` tokenizer |
| Fonts | Playfair Display · DM Serif Display · DM Sans (Google Fonts) |

## Quick Start

### Prerequisites

- Node.js 24 recommended (CI uses 24); Vite requires Node.js 20.19+ within 20.x, or 22.12+
- Python 3.10+ for the importer; no third-party Python packages are required
- The input files listed in [Data Sources](#data-sources), placed in `data/`
- Network access for npm installation, the explicit BDB/UBS download, and the first OpenBible cross-reference download

### Install and run

```bash
mkdir -p data
npm ci
python3 scripts/study_lexicons.py --download  # pinned, openly licensed BDB and UBS sources
python3 scripts/build_db.py   # builds data/bcv.db (~295 MB)
npm run dev
```

Open `http://localhost:5173` in a browser. On first load the database is
downloaded and cached in OPFS; subsequent loads skip the network fetch entirely.

The dev server binds to `0.0.0.0`. For another device, use an HTTPS reverse
proxy or trusted local HTTPS setup that preserves the isolation headers below.
Plain HTTP on a LAN IP does not provide the same secure-context exception as localhost.

The BDB/UBS downloader does not fetch the user-supplied Bible texts or STEP TSV
files. Obtain those separately; links and pinned source versions are in
[SOURCES.md](SOURCES.md). The builder also produces `data/ubs-study.json` and
the optional legacy `data/bcv-lsj.db`. Missing required study files fail the build;
an unavailable OpenBible download produces a warning and an empty built-in
cross-reference table. A previously cached `data/cross-references.txt` is reused.

For a local production preview, run `npm run build` followed by `npm run preview`
and open the URL Vite prints. The preview server serves `data/` at `/db/`.
Production service-worker caching is enabled in builds, not in `npm run dev`.

### Build for production

```bash
npm run build
```

The output in `dist/` is a static site. Serve it with any HTTPS host that can
set the required security headers:

When hosting under a subdirectory, set the base path when building. For
`https://example.org/bcv/`, use:

```bash
BASE_PATH=/bcv/ npm run build
```

Deploy the contents of `dist/` into the server's `/bcv/` directory, and serve
`data/bcv.db` at `/bcv/db/bcv.db` and `data/ubs-study.json` at
`/bcv/db/ubs-study.json`. These files are not copied into `dist/` by the build.
Rebuild whenever the hosting path changes;
otherwise JavaScript URLs point to the site root and the page cannot start.

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers are required by the SharedArrayBuffer API used by SQLite WASM.
The `vite.config.ts` dev and preview servers set them automatically. Use HTTPS
in production, serve `.wasm` as `application/wasm`, and deploy the app and updated
database together. Do not upload `bible-nau.db`, raw source files, or personal
session exports as public site assets. The legacy `bcv-lsj.db` is not needed by the app.

## Data Sources

The `data/` directory is gitignored. The ETL script (`scripts/build_db.py`)
expects the following files to be present before it is run. Users are
responsible for obtaining each file under the terms of its respective license.

| File | Description | License |
|---|---|---|
| `data/bible-nau.db` | NASB source SQLite export | © The Lockman Foundation — requires a separate license for use or distribution |
| `data/kjv.txt` | King James Version | Public domain |
| `data/asv.txt` | American Standard Version (1901) | Public domain |
| `data/LEB.json` | Lexham English Bible | © Faithlife Corporation — retain the publisher's license and attribution supplied with the text |
| `data/TBESH.txt` | Hebrew lexical tags, lemmas, and glosses only | CC BY 4.0, STEP Bible / Tyndale House Cambridge. Online Bible abridged-BDB meanings are excluded because they carry a separate permission requirement. |
| `data/TBESG.txt` | Translators' Brief Lexicon — Greek | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), STEPBible.org / Tyndale House Cambridge |
| `data/TFLSJ.txt` | Translators' Formatted LSJ (full Greek lexicon) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), STEPBible.org / Tyndale House Cambridge |
| `data/TFLSJ-extra.txt` | Additional biblical Greek LSJ entries, when supplied | CC BY 4.0, STEP Bible / Tyndale House Cambridge |
| `data/study-sources/{BrownDriverBriggs,LexicalIndex,AugIndex}.xml` | Open Scriptures BDB transcription and identifiers | CC BY 4.0, Open Scriptures Hebrew Bible Project; original BDB text is public domain. Transcription is incomplete. |
| `data/study-sources/ubs-greek.json` | UBS Dictionary of New Testament Greek, English v1.1 | CC BY-SA 4.0, © United Bible Societies 2023; adapted from SDGNT and Louw–Nida, with SIL Scripture references |
| `data/study-sources/ubs-hebrew.json` | UBS Dictionary of Biblical Hebrew, English v0.9.3 | CC BY-SA 4.0, © United Bible Societies 2023; adapted from SDBH © 2000–2023 UBS; coverage is incomplete |
| `data/cross-references.txt` | OpenBible.info cross-references; downloaded automatically when absent | CC BY 4.0; primarily based on the public-domain Treasury of Scripture Knowledge |

Source repository links, pinned revisions, full attribution, transformation notes,
and the distinction between original text and electronic annotations are in
[SOURCES.md](SOURCES.md). `TFLSJ-extra.txt` is optional; `TFLSJ.txt` supplies
the primary biblical LSJ entries. STEP files must retain their TSV column header.

The download script pins BDB and UBS source revisions and writes a SHA-256
manifest alongside their attribution/license files. The importer converts source
XML/JSON/TSV into plain-text definitions and normalized lookup keys, preserving
UBS senses and semantic domains. UBS reference word offsets are omitted from
displayed verse references. These changes are recorded in `study_sources`.
Adapted UBS entries in `study_entries` and their identifiers in `study_strongs`
remain licensed under **CC BY-SA 4.0**, independently of the MIT application code
and the other data. The builder also exports `data/ubs-study.json` with attribution,
license information, and the adapted UBS entries. Ship that file at
`/db/ubs-study.json` alongside `/db/bcv.db` so the credits download works.
Retain these notices and the share-alike license when redistributing UBS adaptations.

Study lexicons now live in `bcv.db` (approximately 295 MB with the current inputs).
The optional legacy `bcv-lsj.db` is still built for compatibility, but the app does
not need it. Deploy the updated app and database together. This release uses a
new OPFS cache key so existing clients download the updated database once.

The Hebrew interlinear text (Westminster Leningrad Codex) and the Greek NT
interlinear (Robinson-Pierpont GNT 2005, dedicated to the public domain) are
embedded in `bible-nau.db`. The LXX interlinear is derived from the CATSS
project. Redistribution rights for its electronic transcription and annotations
must be checked separately from the underlying Rahlfs edition.

> **Important:** This application's source code is released under the MIT
> License. Bible text content and lexicon data are not covered by that license.
> Before deploying this application publicly, verify that you hold the
> appropriate rights to redistribute any included Bible text.

## Refreshing the OPFS Cache

If you rebuild `bcv.db` (e.g., after adding new data), browsers that have
already cached the old database will continue to serve it from OPFS until you
clear it. Use the header's **↻ Re-download database** button to replace the Bible
cache and reload the app. This leaves Class Mode data alone. If that fails:

- Chrome/Edge: DevTools → Application → Storage → Clear site data
- Firefox: DevTools → Storage → Clear All

Clearing all site data also removes personal Class Mode data, bookmarks, history,
and preferences. Export each Class session first. Browser storage is tied to the
origin: changing scheme, host, or port creates a separate local store.

## Validation

```bash
npm run build
npm run test:references
npm run test:study
npm run lint
```

Reference-parser tests use Node's built-in test runner. Study-import tests use
Python's standard-library `unittest` and temporary fixtures; neither test command
needs downloaded Bible data. A successful build bundles the app but does not
rebuild or validate the contents of `data/bcv.db`. Lint currently reports existing
issues and is informational in CI.

## Project Structure

```
bcv-claude/
├── scripts/
│   ├── build_db.py          # ETL: main DB, UBS export, legacy LSJ DB
│   └── study_lexicons.py    # Pinned source downloads and study importer
├── src/
│   ├── App.tsx              # Root component, global state
│   ├── types.ts             # Shared TypeScript interfaces
│   ├── index.css            # Design tokens (CSS vars) and global styles
│   ├── components/
│   │   ├── SearchBar.tsx    # Query input and source selector
│   │   ├── BookNav.tsx      # Book filter pill strip
│   │   ├── MiniChart.tsx    # Hit distribution bar chart
│   │   ├── GlossCard.tsx    # Lexical summary card for orig-lang searches
│   │   ├── ResultCard.tsx   # Single search-result card with interlinear
│   │   ├── WordChip.tsx     # Tappable original-language word token
│   │   ├── DefinitionSheet.tsx  # Word definition bottom sheet
│   │   ├── ChapterView.tsx  # Full-chapter reading overlay / embedded Browse view
│   │   ├── CrossRefList.tsx # Scrollable related passages and previews
│   │   ├── SettingsPanel.tsx # Search, appearance, and source-credit link
│   │   └── SourceCredits.tsx # Attribution and license view
│   ├── lib/
│   │   ├── db.ts            # Main-thread RPC client for db.worker.ts
│   │   ├── referenceSearch.ts # Passage-list and range parser
│   │   ├── sourceCredits.ts # In-app source metadata
│   │   └── class/          # Personal data schema, client, import/export
│   └── workers/
│       ├── db.worker.ts     # Bible search, study lookup, chapter / cross-ref fetch
│       └── class.worker.ts  # Personal session / cross-reference data
├── data/                    # gitignored — user-provided sources + built DB
├── tests/                   # Reference parser and study importer regression tests
├── SPEC.md                  # Technical specification
├── GUIDE.md                 # User's guide
├── SOURCES.md               # Source links, revisions, attribution, licenses
├── LICENSE                  # MIT (source code only)
└── README.md
```

## License

Application source code: [MIT](LICENSE)

Bible texts and lexicon data: see [Data Sources](#data-sources) above.

### Dependency maintenance

Both npm and pnpm lockfiles are supported. When changing dependencies or security
overrides, update both `package-lock.json` and `pnpm-lock.yaml` using
`npm install --package-lock-only` and `pnpm install --lockfile-only` (pnpm 10.32.1).
Keep `overrides` and `pnpm.overrides` in `package.json` synchronized.
CI validates clean installs, security audits, and production builds with both
package managers. Lint is currently informational until existing errors are fixed.

## Word Study

Open **Word Study** or choose **Study word** from a word definition. English
input uses the current or last-used English translation. Select a candidate when
the input is ambiguous, then switch between Overview and Word map. Counts are
independent of the Search hit limit. Related details start visible; change future
defaults in Settings or save the current visibility controls as defaults.

The existing build pipeline imports word-study relationships from the installed
BDB and UBS sources. To add those tables to an existing local Bible database:

```bash
python3 scripts/word_study_data.py --database data/bcv.db
```

Refresh the Bible database in the app after updating its data. Class notes and
saved studies use the separate user database and are preserved. No new sources
are downloaded by this command. BDB root-section links retain their editorial
provenance; shared glosses are labeled as lexical discovery. Verified
translation-specific word alignments are not included in the installed datasets.

Saved studies have their own JSON backup/import controls. Studies attached to a
Class session are also included in session exports. Standalone study imports
clear Class attachments because numeric session IDs differ between devices.

Word Study query and persistence regression tests (Node 24 with `node:sqlite`):

```bash
node --test tests/wordStudy.test.mjs tests/wordStudyStorage.test.mjs
npm run test:study
```
