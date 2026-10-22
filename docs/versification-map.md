# Versification mapping (STEP TVTMS) — implementation plan

Status: implemented 2026-10-22 (steps 1–7). Combines the original TVTMS plan (from the removed
`worktree-versification-map` session) with the Scripture-link previews in
lexicon material (`src/lib/scriptureLinks.ts`, `src/components/ScriptureRefLink.tsx`).

## Decisions made in step 1 (as built)

- **Source:** `Versification/TVTMS … CC BY.txt` at STEPBible-Data `ed476a8`, the Expanded table.
  TVTMS's Standard is English (NRSV/KJV-based). NASB differs from it in three places
  (Phil 1:16/17 order, 3 John 14/15), which the inverted NASB→Standard map handles.
- **How rows are chosen:** an edition (CATSS LXX, Robinson–Pierpont GNT, NASB) is
  evaluated against the Tests, and the first passing row wins. Filtering by SourceType alone
  is wrong for CATSS, which has Hebrew chapter numbers in Malachi but Greek verse order.
  Lexicon citations can't be tested, so they use the `Hebrew` rows directly.
- **When tests fail** (CATSS splits a verse in Jer 25, so every "Jer.25:19=Last" test fails):
  choose among identity and the targets TVTMS lists for that verse, scored by how well the LXX
  glosses overlap the NASB wording over a five-verse window. Free search across a
  book was tried and rejected, because it confuses parallel passages (Exod 26 vs 36) and
  generic lines.
- **Hand overrides** (`CATSS_OVERRIDES`): Prov 32–36 → 25–29; Mal 3:22–24 → 4:5, 4:6, 4:4;
  CATSS Jer 30 → the MT 49 oracles; Lam 0:1 has no English verse. Each block is
  checked by its content score against identity.
- **Collisions:** a test- or identity-based placement that shares an English verse with a
  content-backed one, and scores clearly lower, is dropped (6 verses in Exod 36–39).
- **Citation numbering, checked against the data:** in BDB, the word an entry defines appears
  at the Hebrew-mapped verse in 213 of 225 moved Psalm citations (2 at the raw verse), so
  BDB and UBS use the `Heb` map. In STEP brief/LSJ, the word appears at the raw verse 96 times
  vs 31 at the Hebrew-mapped one, so STEP citations are used as written.
- **Results** (build of 2026-10-22):
  - 0 LXX/GNT tokens fall outside NASB verses, and all 8 spot checks pass.
  - LXX: 4,671 verses placed by TVTMS tests, 173 by override, 123 by content. 82 verses have
    no English counterpart (Greek Daniel additions, Ps 151, Lam prologue, collisions).
  - GNT: 2 Cor 13:13 → 13:14 and Rev 12:18 → 13:1.
  - MACULA Hebrew: unmatched 31,461 → 12,893; validated 265,383 → 284,014. Greek corroborated
    at the reference: 105,204 → 125,519.
  - 1,973 Hebrew citation remaps. Duplicate LXX `word_num`s (the old `CAST` bug): 0.

## Problem

Every corpus is joined on `(book_id, chapter, verse)`, but the corpora do not
share one numbering. Probing the current `data/bcv.db` and `data/bible-nau.db`:

| Corpus | Numbering in source | Evidence | Effect today |
|---|---|---|---|
| NASB, KJV, ASV, LEB | English | — | Reference scheme |
| WLC tokens / `Heb` verses | Already English (BSB-aligned source) | Mal has 4 chapters, Joel 3; Ps 3 has 8 verses (title folded into v1) | Aligned |
| GNT (Robinson–Pierpont) | Mostly English | 2 Cor 13 has 13 verses (NASB 14); Rom 16 ends at 24, no 25–27 | Minor misalignments |
| LXX (CATSS) | Septuagint (Rahlfs) | LXX Ps 22:1 = "κύριος ποιμαίνει με" (Eng Ps 23), so English Ps 23 currently shows LXX Ps 23 (= Eng Ps 24); Mal 3 has 24 verses; Joel has 4 chapters; Jer 25 ends at v20 | **Wrong LXX text under most Psalms, Mal 4, Joel 2–3, Jer 25–51, etc.** |
| LXX sub-verses | `2a`, `2b`, … (6,567 rows) | `CAST(verse AS INTEGER)` in `load_tokens_lxx` | Sub-verses collapse into one verse with duplicate `word_num`s |
| LXX verse 0 | 88 token rows | `verse=0` | Titles/superscriptions not shown |
| MACULA (`morphId`) | Hebrew (BHS) | Rows exist for Ps 3:9; none for Mal 4 | 7,857 Psalm rows `unmatched` against English-numbered WLC tokens |

The lexicon citations that are now links have the same problem:

| Citation source | Numbering | Evidence (refs past the end of the English chapter) |
|---|---|---|
| BDB (inline and OSIS lists) | Hebrew | `Nu 17:27`, `Lv 5:22`: 89 of 8,318 OT refs |
| UBS Dictionary of Biblical Hebrew | Hebrew | `Numbers 30:17`, `1 Kings 5:19`: 1,713 of 255,961 |
| STEP brief Greek / LSJ (Abbott-Smith) | Mixed; to be confirmed | `Psa.88:12` (Abaddon) is Heb/LXX v12 but Eng 88:11; `Est.4:62` is from the Greek Esther additions |
| UBS Dictionary of NT Greek | English-like NT | No overflow |

The overflow counts understate the problem. Titled Psalms are off by one verse
with no error, so a BDB `ψ 51:12` link opens the wrong verse instead of failing.
The stopgap in `validRef()` (Joel 4 → 3, Mal 3:19–24 → 4:1–6) only covers the
cases where the chapter is missing outright.

Cross-references (OpenBible), Class Mode refs, bookmarks and the reference
parser are all English. **So the internal scheme stays English. LXX and MACULA
(plus the GNT edge cases) get remapped into English at build time, and
Hebrew-numbered citations get mapped into English when they are linkified.**

## Source

- [STEPBible-Data](https://github.com/STEPBible/STEPBible-Data) file *TVTMS – Translators
  Versification Traditions with Methodology for Standardisation for
  Eng+Heb+Lat+Grk+Others*. CC BY 4.0, same credit line as the existing STEP data.
- Pin a commit and SHA-256 in `data/versification/manifest.json`, following
  `study_lexicons.download()` / `macula_equivalents.py --download`.
- TVTMS maps each tradition (Hebrew, Greek/LXX, Latin, English variants) to a
  STEP "standard" reference via rows with an action (keep, renumber, merged,
  empty, Psalm title, …) and tests that detect which tradition a Bible follows.
  **The column layout and action vocabulary still need checking against the
  pinned file in step 1. Nothing below assumes exact column names.**

## Design

### Data model (`PRAGMA user_version=3`)

```sql
-- One row per source verse (or verse part) → English verse.
CREATE TABLE versification_map (
  tradition   TEXT NOT NULL,          -- 'LXX', 'Heb', 'GNT'
  src_book_id INTEGER NOT NULL,
  src_chapter INTEGER NOT NULL,
  src_verse   INTEGER NOT NULL,
  src_part    TEXT NOT NULL DEFAULT '', -- 'a', 'b', … ('' = whole verse)
  book_id     INTEGER,                -- NULL = no English counterpart (e.g. Ps 151)
  chapter     INTEGER,
  verse       INTEGER,
  action      TEXT NOT NULL,          -- normalized TVTMS action
  PRIMARY KEY (tradition, src_book_id, src_chapter, src_verse, src_part)
);

-- Keep the source coordinates on each token for display and auditing.
ALTER TABLE tokens ADD COLUMN src_chapter INTEGER;
ALTER TABLE tokens ADD COLUMN src_verse INTEGER;
ALTER TABLE tokens ADD COLUMN src_part TEXT;
```

(The table goes in `SCHEMA_CORE` rather than `ALTER`, since the DB is rebuilt from scratch.)
`tokens.book_id/chapter/verse` become **English** for every corpus.
`macula_equivalents` gets the same `src_*` columns.

**Change for citations:** fill the `Heb` tradition completely, even though WLC
tokens are already English and don't need it. Citation mapping is its only consumer.
Store only rows that differ from identity; a missing row means "same as English".

### Mapping rules

1. Identity is the default. Only rows TVTMS lists as differing get remapped.
2. Psalm titles: in the Hebrew/LXX traditions the title is verse 1 (or LXX
   verse 0). English folds it into verse 1, which matches the existing WLC rows.
   Map title → English v1 and shift the rest down by one.
3. Merges (many source verses → one English verse): append tokens in source
   order and renumber `word_num` sequentially within the English verse.
4. Splits (one source verse → several English verses): TVTMS works at verse
   level, not word level, so assign the whole source verse to the **first**
   English target and record the span. Count these in the build report. This is
   a known limitation.
5. No English counterpart (Ps 151, LXX-only pluses in Esther/Daniel/Jeremiah):
   `book_id = NULL` in the map. Skip the tokens and report counts per book.
   Exposing them is a follow-up.
6. LXX sub-verses (`2a`, `2b`): parse the suffix into `src_part`. Never `CAST`.

### Citation links

- `linkifyScripture(text, dialect, map?)`: after a citation is parsed, it is
  passed through the source's tradition map before `validRef()`.
  - A mapped citation links to the English verse. The link text keeps the
    source's own wording (`ψ 51:12`).
  - A citation mapped to `book_id = NULL` (Greek Esther additions, Ps 151) stays plain text.
  - The Joel/Malachi stopgap in `validRef()` is removed; the `Heb` map covers it.
- Each source gets a tradition, in `studyTradition(source)` next to `studyDialect()`:
  - BDB and UBS-Hebrew: `Heb`.
  - UBS-Greek: identity, though its few OT refs are probably `Heb`; check this.
  - STEP brief and LSJ: decided in step 1 by checking OT citations (e.g. `Psa.88:12`)
    against TVTMS's Hebrew, LXX and English columns.
- Delivery to the UI: a worker message `versification_diffs` returns the non-identity rows
  for the citation traditions, probably a few thousand. `dbClient` loads and caches them
  once. `ScriptureText` uses a `useVersificationMap()` hook and renders plain text until the
  map arrives, so links are never shown with Hebrew coordinates.
- The preview header shows both numberings when they differ: "Psalms 51:10 · cited as 51:12 (Hebrew)".
- Each original-language section in the preview gets a source label where its numbering
  differs (e.g. "Greek (LXX) · 50:12"), using the `src_*` columns from step 6.

## Steps

1. **Fetch and inspect TVTMS.** Add `scripts/versification.py --download` to pin
   the commit and record the hash. Read the file's header and notes, and
   decide which section to parse (condensed rules or expanded per-verse list;
   the expanded list is probably simpler and more reliable).
   Settle STEP's citation tradition here too, and record both decisions in this doc.
2. **Parser.** In `scripts/versification.py`, write
   `load_tvtms(path) -> dict[tradition, list[MapRow]]` and
   `map_ref(tradition, book, ch, vs, part) -> Target | None`. Translate STEP
   OSIS book names through `build_db.BOOKS`. Normalize actions to a small enum.
3. **Unit tests** (`tests/versification_test.py`, picked up by `npm run test:study`).
   Use fixture TVTMS rows, without the real download, covering: Ps 3 title shift;
   LXX Ps 22 → Eng 23; LXX Ps 9 → Eng 9–10 split; LXX Ps 113 → Eng 114–115;
   LXX Ps 146–147 → Eng 147; Mal 3:19–24 → 4:1–6; Joel 3–4 → 2:28–3:21;
   Gen 31:55 ↔ 32:1; sub-verse `2a`; unmapped Ps 151.
4. **Build integration** (`scripts/build_db.py`):
   - Create `versification_map` and fill it before loading tokens.
   - `load_tokens_lxx`: read `verse` as text, split the suffix, map to English, renumber `word_num`.
   - `load_tokens_heb` / `load_heb_verses`: identity, but run the orphan check below to confirm.
   - `load_tokens_gnt`: map through the Greek-NT tradition. Then check 2 Cor 13:12–14,
     Rom 14:24–26 / 16:25–27 and 3 John 14–15 against NASB by hand.
   - `macula_equivalents.load_macula`: map `morphId` Hebrew coordinates to English
     before looking up WLC tokens. Keep the `src_*` coordinates.
   - Set `PRAGMA user_version=3`.
5. **Build-time validation.** Fail on errors and print the rest:
   - Orphans: tokens per corpus whose English `(b,c,v)` has no NASB verse. Expect 0 for WLC/GNT.
     LXX may only orphan intentionally unmapped material.
   - Spot checks: LXX at Eng Ps 23:1 starts `ψαλμὸς τῷ Δαυιδ κύριος ποιμαίνει`;
     LXX at Eng Mal 4:5 mentions `Ηλιαν`; LXX at Eng Joel 2:28 contains `ἐκχεῶ`.
   - MACULA: the Psalm `unmatched` count drops well below 7,857. Print before/after counts by status.
   - Citations: rerun the lexicon scan. The share of BDB/UBS-Hebrew links past the end of an
     English chapter should be about 0, and spot checks should pass: BDB `ψ 51:12` → Eng 51:10
     ("a steadfast spirit"), and `Nu 17:27` → Eng 17:12.
6. **Runtime.**
   - `fetch_chapter_originals` returns `src_chapter/src_verse/src_part` for each corpus section.
   - `ChapterView`, `ResultCard` and the link preview show a small label (e.g. "LXX 22:1")
     when the source and English refs differ. Types go in `src/types.ts`.
   - Add the `versification_diffs` worker message and `dbClient` cache, and pass the map into
     `linkifyScripture`.
   - Tests: extend `tests/scriptureLinks.test.mjs` with a fixture map. Cover `ψ 51:12` → 51:10,
     the Joel 4 / Mal 3:19 cases, plain text for a NULL target, and identity for NT refs.
7. **Cache and docs.** Bump the OPFS cache name (e.g. `bcv-study-v2.db`) so clients
   fetch the rebuilt DB. Then update `SPEC.md` (schema, pipeline step, user_version),
   `SOURCES.md` (TVTMS entry, revision, CC BY 4.0), and `src/lib/sourceCredits.ts`
   (credits entry).

## Out of scope / follow-ups

- Parsing "LXX Ps 22:1" or Hebrew-numbered input in `referenceSearch.ts`. The
  `versification_map` table makes this easy later, since a runtime reverse lookup is just a query.
- Word-level alignment for split verses.
- Displaying LXX-only material (Ps 151, Greek Esther and Daniel additions, deuterocanon).
- Latin/Vulgate traditions.

## Risks

- TVTMS's "standard" is STEP's English-based scheme. Where it differs from NASB
  (e.g., 3 John 14/15), NASB decides. The orphan check catches these, and
  they get a small override list in `versification.py`.
- CATSS LXX numbering may differ from Rahlfs as TVTMS describes it (e.g., Jer
  chapter order, Daniel OG vs Theodotion). The orphan and spot checks per
  book are the safeguard. Expect a few hand overrides.
- STEP's citations may mix traditions within a single entry ("in LXX: …" vs Hebrew refs).
  If no one tradition fits, handle `in LXX:` spans separately from the rest of the entry.
