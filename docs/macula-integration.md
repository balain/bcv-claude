# MACULA Hebrew–LXX equivalents

Implemented locally on `dev`, 2026-10-17. This is a sourced-equivalent layer, not a new LXX lexicon and not a universal Hebrew–Greek dictionary.

## Source and permission

- [MACULA Hebrew](https://github.com/Clear-Bible/macula-hebrew), pinned revision `47db250bd55d0d8577f2a94fba114ef16c35b23c`.
- [Pinned license](https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/47db250bd55d0d8577f2a94fba114ef16c35b23c/LICENSE.md): the MACULA layer explicitly includes Greek equivalents drawn from the Septuagint and Hebrew/Greek Strong's numbers under CC BY 4.0.
- Attribution: MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/; © 2022–2024 Biblica, Inc.; CC BY 4.0.
- Import only the source morpheme reference, Hebrew text and identifier, and Greek equivalent text and identifier. Do not import unrelated third-party annotations merely because they appear in the same file.
- Retain the downloaded license, source file, revision, and checksum manifest under `data/macula/`. These are separate from the app's MIT license.

## Reproduce the import

```bash
python3 scripts/macula_equivalents.py --download
python3 scripts/macula_equivalents.py --database data/bcv.db
```

The first command explicitly downloads the pinned source and license, checking hard-coded SHA-256 hashes. The second updates a copied database and publishes it only after a successful import. It never modifies the browser's Class/user database. Normal `scripts/build_db.py` builds include MACULA when these verified local source files are installed; otherwise the feature reports that the optional dataset is unavailable.

The app needs the updated `data/bcv.db` on the server as well as the updated frontend build. The browser Bible-cache filename has a new version, leaving saved Class data intact. Subsequent source/database updates can be loaded with the app's Bible database refresh control. Do not clear all browser site data.

Build with the deployment's base path, for example `BASE_PATH=/bcv/ npm run build` for a `/bcv/` site, and deploy the whole bundle plus the updated Bible database using the existing deployment instructions.

## Evidence and validation

Each `macula_equivalents` record retains a source morpheme ID, its Hebrew reference and word number, source Hebrew and Greek forms, canonical lexical identifiers when supported, and separate validation statuses.

1. Parse the source morpheme ID into book/chapter/verse/word/morph coordinates.
2. Retain only ordinary lexical Hebrew Strong's numbers. MACULA's private grammatical identifiers may look like dictionary numbers with suffixes; never strip their suffixes and treat them as ordinary lexical entries. Unsupported source identifiers are excluded and counted.
3. Reassemble all source morphemes of the Hebrew orthographic word. Match against installed WLC tokens using both normalized full-word surface and explicit dictionary identifier. Position resolves a unique candidate only after those checks. Otherwise leave the mapping ambiguous/unmatched.
4. Preserve the recorded Greek equivalent even if it cannot be found in the installed LXX. For corroboration, require matching normalized Greek surface and explicit Greek identifier at the stored reference, plus a validated Hebrew occurrence. Multiple Greek candidates remain ambiguous.
5. Never label a same-reference Greek candidate as proof of MT/LXX versification alignment. No automatic verse renumbering, fuzzy spelling repair, or reconstructed Vorlage is introduced.
6. Missing Greek fields mean **annotation not provided**, not that the LXX omitted the Hebrew word. Complex or absent Greek identifiers remain unresolved; do not manufacture a number from a gloss.

Normalization removes marks/punctuation and folds case for validation; source text is preserved. It does not correct letters. For example, a source form with ξ where the loaded text has χ remains unresolved.

The validation labels are:

| Layer | Status | Meaning |
| --- | --- | --- |
| Hebrew | `validated` | Full source word surface plus identifier match the installed WLC occurrence |
| Hebrew | `ambiguous` / `unmatched` | No unique validated Hebrew occurrence |
| Greek | `surface_and_identifier` | A unique Greek surface/identifier candidate exists at the stored reference and Hebrew is validated; cross-edition verse alignment remains unverified |
| Greek | `ambiguous` | Multiple Greek candidates at that reference |
| Greek | `unresolved` | The recorded equivalent cannot be corroborated by the configured checks |
| Greek | `not_provided` | Source Greek annotation is absent |

## Queries and UI

Word Study offers forward Hebrew → Greek and reverse Greek → Hebrew lookup by source dictionary identifier, grouped record counts, book/form filters, source coverage, and 40-record evidence pages. Each reference opens chapter context. The responsive panel appears in both Overview and Word map.

English studies ask the user to select a lexical candidate; shared English glosses do not create translation alignments. GNT-only studies do not present LXX links as GNT evidence. Greek forms are source forms, and source dictionary identifiers are not automatically merged into a single complete lemma/sense analysis.

Coverage uses source morpheme records as its denominator. It is not the proportion of all verses or all occurrences in the Bible. The UI separately reports source records, records with validated Hebrew occurrences, records with provided Greek annotations, and Greek candidate checks. Extended lexical senses can share a base dictionary number; the source does not necessarily distinguish them. Such entries must not be presented as sense-specific rendering distributions.

Evidence includes unresolved source records so readers can inspect gaps rather than receiving a falsely complete result. Group totals include recorded source equivalents, with separate corroborated counts. No probabilities or AI-generated links are used.

## Local audit

For the pinned source and current local Bible database:

- Source morphemes: 475,037.
- Excluded private/nonlexical/unsupported identifiers: 176,311.
- Imported lexical source records: 298,726.
- Hebrew validation: 265,383 validated; 31,461 unmatched; 1,882 ambiguous.
- Greek candidate checks: 105,204 corroborated at stored reference; 26,801 ambiguous; 112,459 unresolved; 54,262 annotations not provided.

These numbers describe this import, not a guarantee for every edition. The database stores its own metadata and counts. Source records such as Genesis 1:1 ברא → ἐποίησεν are inspectable by source ID; unresolved spelling differences are preserved.

## Testing and future work

Python tests cover checksums, private identifier collisions, exact Hebrew validation, Greek ambiguity, missing annotations, Unicode spelling differences and rollback on duplicate IDs. SQLite query tests cover bidirectional lookup, book/form filters, full counts independent of evidence pagination, base/extended Strong's identities and legacy databases without the dataset. Browser checks cover both directions, source evidence, and mobile overflow.

Future exact token alignment requires an edition-aware versification map and curated many-to-many token groups (for example, appropriately licensed CATSS data). Neither matching Strong's numbers alone nor a shared English gloss supplies that evidence.

Dedicated Muraoka/LEH integration remains dependent on separate permission and licensed digital data; see [licensing plan and draft inquiries](lxx-licensing.md).
