# BibleSearch

A fast, offline-capable Bible search tool with interlinear Hebrew and Greek, built as a progressive web app using React and SQLite running entirely in the browser.

## Features

- **Full-text search** across six translations — KJV, ASV, LEB, NASB, Hebrew MT (WLC), LXX, and GNT
- **Phrase search** — wrap terms in double quotes: `"holy spirit"`, `"in the beginning"`
- **Interlinear display** — every result card shows the underlying Hebrew (WLC) and/or Greek (LXX / GNT) text alongside the English translation
- **Dual OT interlinear** — OT verses show both the Masoretic (WLC) and Septuagint (LXX) in parallel
- **Word lookup** — tap any Hebrew or Greek word chip to see its lemma, transliteration, Strong's number, gloss, and full lexical definition
- **Lemma / form search** — search from within a word-lookup card to find all occurrences of a root or inflected form
- **GlossCard** — single-word original-language searches display the word's gloss and meaning above the result list
- **Chapter view** — click any Book:Chapter:Verse reference to read the full NASB chapter, with prev/next chapter navigation and optional original-language interlinear per verse
- **Search history** — quick access to your recent searches, persisted locally
- **Class Mode** — a specialized workspace for teachers and students to manage series, sessions, scripture references, and study notes with a dedicated local database
- **Distribution chart** — optional bar chart showing hit density across the biblical canon
- **Book filter** — click any book pill to narrow results to a single book
- **OPFS caching** — the ~210 MB database is downloaded once and cached in the browser's Origin Private File System; subsequent loads are instant, no network required
- **LAN access** — `npm run dev` binds to all interfaces so the app is reachable from phones and tablets on the same network

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

- Node.js 20+
- Python 3.9+ (for the ETL script)
- The data files listed in [Data Sources](#data-sources) placed in `data/`

### Install and run

```bash
npm install
python3 scripts/build_db.py   # builds data/bcv.db (~210 MB, ~2–3 min)
npm run dev
```

Open `http://localhost:5173` in a browser. On first load the database is
downloaded and cached in OPFS; subsequent loads skip the network fetch entirely.

To access from other devices on the same network, use your machine's LAN IP
address (the dev server binds to `0.0.0.0`).

### Build for production

```bash
npm run build
```

The output in `dist/` is a static site. Serve it with any HTTPS host that can
set the required security headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers are required by the SharedArrayBuffer API used by SQLite WASM.
The `vite.config.ts` dev server sets them automatically.

## Data Sources

The `data/` directory is gitignored. The ETL script (`scripts/build_db.py`)
expects the following files to be present before it is run. Users are
responsible for obtaining each file under the terms of its respective license.

| File | Description | License |
|---|---|---|
| `data/bible-nau.db` | NASB source SQLite export | © The Lockman Foundation — requires a separate license for use or distribution |
| `data/kjv.txt` | King James Version | Public domain |
| `data/asv.txt` | American Standard Version (1901) | Public domain |
| `data/LEB.json` | Lexham English Bible | © Faithlife Corporation — free for non-commercial use with attribution |
| `data/TBESH.txt` | Translators' Brief Lexicon — Hebrew | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), STEPBible.org / Tyndale House Cambridge |
| `data/TBESG.txt` | Translators' Brief Lexicon — Greek | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), STEPBible.org / Tyndale House Cambridge |
| `data/TFLSJ.txt` | Translators' Formatted LSJ (full Greek lexicon) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), STEPBible.org / Tyndale House Cambridge |

The Hebrew interlinear text (Westminster Leningrad Codex) and the Greek NT
interlinear (Robinson-Pierpont GNT 2005, dedicated to the public domain) are
embedded in `bible-nau.db`. The LXX interlinear is derived from the CATSS
project (based on Rahlfs' 1935 Septuagint edition, which is in the public
domain in most jurisdictions).

> **Important:** This application's source code is released under the MIT
> License. Bible text content and lexicon data are not covered by that license.
> Before deploying this application publicly, verify that you hold the
> appropriate rights to redistribute any included Bible text.

## Refreshing the OPFS Cache

If you rebuild `bcv.db` (e.g., after adding new data), browsers that have
already cached the old database will continue to serve it from OPFS until you
clear it. To force a fresh download:

- Chrome/Edge: DevTools → Application → Storage → Clear site data
- Firefox: DevTools → Storage → Clear All

## Project Structure

```
bcv-claude/
├── scripts/
│   └── build_db.py          # ETL: builds data/bcv.db from raw sources
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
│   │   └── ChapterView.tsx  # Full-chapter reading overlay
│   ├── lib/
│   │   ├── db.ts            # Main-thread RPC client for db.worker.ts
│   │   └── search.ts        # Distribution-chart helper
│   └── workers/
│       └── db.worker.ts     # SQLite worker: search, lookup, chapter fetch
├── data/                    # gitignored — user-provided sources + built DB
├── SPEC.md                  # Technical specification
├── GUIDE.md                 # User's guide
├── LICENSE                  # MIT (source code only)
└── README.md
```

## License

Application source code: [MIT](LICENSE)

Bible texts and lexicon data: see [Data Sources](#data-sources) above.
