# Word Study Mode

Status: implementation plan with local implementation notes below. Implementation authorized on 2026-10-16.
Date: 2026-10-13.

## Purpose

Add Word Study as a fourth application mode beside Search, Browse, and Class. A user supplies an English, Greek, Hebrew, or biblical Aramaic word, lemma, variant, transliteration, or Strong’s identifier and explores its identity, meanings, forms, frequency, passages, and corresponding words. The same study is available as a scrolling text overview and an interactive word map.

Desktop and mobile are equal requirements. Neither view may contain essential information unavailable in the other. The experience should help readers follow evidence from a definition or relationship to actual passages.

## Confirmed decisions

- Deliver in three stages: foundation, exploration, and study workspace.
- Include roots, derivations, synonyms, and antonyms where supported by sources.
- Show these additional relationship details by default. Provide controls to hide/show them in the current study and a persistent global setting governing future display.
- English input starts with the current English translation. If the current source is an original-language corpus, use the most recently used English translation.
- Include biblical Aramaic entries and identify them explicitly.
- Provide complete frequency analysis, Strong’s entries and related entries, passage access, and both scrolling and point-and-click exploration.
- Support desktop, tablet, and mobile layouts.

## Working assumptions and unresolved decisions

These defaults make the plan implementable but are not confirmed user preferences:

- Serve general Bible readers with progressively expandable technical detail.
- Keep the core study fully offline after its data has downloaded, consistent with the existing application. Online enrichment and AI explanations are outside the initial scope.
- Reuse existing text and lexical datasets first; additional relationship or alignment datasets require a separate source and coverage evaluation.
- If no English translation has ever been selected, use NASB, consistent with current chapter/reference behavior. Confirm this fallback before implementation.
- Stage 3 includes saved studies, notes, comparison, and Class Mode attachment; their relative priority remains open.
- Initially cover the books present in the application. Do not imply coverage of the entire Septuagint or other texts beyond the loaded corpus.

Before implementation, confirm the audience, offline/enrichment policy, fallback translation, and Stage 3 priorities. Lack of alignment data is a scope decision: it must not be concealed by presenting definition matches as actual translation equivalents.

## Existing foundation and gaps

This plan is based on repository inspection, rather than assuming the README or technical specification describes every current feature.

| Existing area | Reuse | Work needed |
| --- | --- | --- |
| `src/App.tsx` | Search/Browse/Class mode selection and hash navigation | Word Study mode, entry/return paths, history |
| `src/lib/db.ts`, `src/workers/db.worker.ts` | Worker RPC, lexical lookup, study lookup, passage retrieval | Candidate resolution, aggregate statistics, relations, paginated occurrences |
| `tokens` | WLC/LXX/GNT surface forms, lemmas, Strong’s, morphology, glosses | Canonical identities, normalization, mapping provenance, coverage audit |
| `lex_brief` | Extended/display/unified Strong’s and lexical summaries | Preserve multiple identities and entries rather than taking one match |
| `study_entries`, `study_strongs`, `study_sources` | Structured BDB/LSJ/UBS entries, senses and attribution | Source-preserving relation extraction and explicit Aramaic metadata |
| `DefinitionSheet`, `EnglishStrongsPopup`, `WordChip` | Existing word discovery | Open study actions with context |
| `MiniChart` and passage components | Existing visual/navigation patterns | Full-corpus statistics and linked drill-down |
| Local settings and Class database | Persistent preferences and user study information | Study preferences and Stage 3 storage/migrations |

Current English Strong’s discovery searches definitions/glosses; it does not establish token alignment with the selected English translation. Original-language tokens carry glosses, but these are not necessarily the English wording of NASB, KJV, ASV, or LEB. WLC/LXX passage correspondence likewise does not establish a word-to-word translation pairing.

Current brief lexicon storage uses `(dstrong, lang)` as its primary key, and some lookups return one row. Audit import collisions before promising complete extended-entry coverage. The study importer currently normalizes UBS Aramaic `A` identifiers to Hebrew `H` identifiers; preserve the original identifier and language metadata while retaining lookup compatibility.

## User journeys

### Starting a study

1. Open Word Study, or choose “Study word” from an original-language token, definition, English word action, or Strong’s result.
2. Enter a word or identifier. Detect likely language but provide an explicit language override.
3. Resolve the input to candidates, showing lemma, script, transliteration, language, gloss, Strong’s, corpus availability, and match reason.
4. Automatically open an unambiguous exact match. For ambiguous input, let the user select; never silently choose the first lexicon result.
5. Display the overview, then let the user explore a form, relationship, chart, or passage.

For an English word, first show its usage in the selected English translation. Offer separately labeled lexical candidates derived from gloss/definition search. Verified original-language renderings appear only where translation-specific alignment exists. Otherwise show the coverage limitation and offer lexical discovery and passage exploration.

For an original-language token, carry its corpus, exact form, lemma, identifier, and originating passage into the study. The initial target is the resolved lemma, with the selected form highlighted and an easy “This form only” filter.

### Exploring and returning

- Selecting a related lemma opens its study and adds a breadcrumb/history entry.
- Selecting a chart bar, form, corpus, or count filters the passage list.
- Opening a chapter preserves study selection, filters, expanded sections, map position, and scroll position on return.
- Browser Back restores the previous study or originating mode. Provide an explicit return action for Class/Browse contexts.
- Switching Overview/Word map preserves the same selected target and filters.

## Input and identity rules

Support native script, transliteration, accented/unaccented Greek, pointed/unpointed Hebrew, inflected forms, lemmas, common spelling variants supported by data, and Strong’s identifiers with or without leading zeroes. Accept documented Aramaic aliases without inventing an independent Strong’s numbering system.

Use Unicode normalization for matching; preserve source spelling for display. Exact matches outrank normalized matches, indexed transliteration aliases, surface-form matches, and lexical text matches. A stripped spelling may represent multiple lemmas; normalization must not merge their identities.

Use stable lexical IDs and explicit many-to-many mappings among lemmas, entries, and Strong’s identifiers. A root, lemma, surface form, lexical sense, and Strong’s entry are different entities. Strong’s must not be the only identity key, and a Strong’s entry is an indexing/lexical aid rather than a claim that all occurrences have one meaning.

Track English translation independently from the active corpus. Persist the last English selection whenever an English source is explicitly selected. Validate restored preferences against available translations. Display the selected translation prominently and allow changes within the study.

Aramaic tokens remain part of the loaded OT corpus but receive an explicit language label and filter when source metadata supports it. Do not classify language from an `H` prefix alone. Unknown language remains unknown.

## Overview content

The default section order is:

1. **Word identity:** lemma, language, transliteration, available pronunciation guidance, concise gloss, Strong’s identifiers, selected translation/corpus.
2. **Usage summary:** complete occurrence and verse counts, corpus scope, forms, distribution and coverage indicators.
3. **Meanings and entries:** source-separated definitions, lexical senses, supporting references, morphology summary, expandable original source detail.
4. **Corresponding words:** English wording where aligned; lexical glosses otherwise; Hebrew/Aramaic–Greek links with evidence labels.
5. **Related words:** roots, derivations, synonyms, antonyms, and related Strong’s entries grouped by relationship type.
6. **Forms and grammar:** surface forms, counts, available parsing, and links to occurrences. Decode known morphology schemes; retain raw codes and label undecoded values.
7. **Passages:** paginated context with matched tokens, English translation, interlinear options, and full chapter access.
8. **Sources and coverage:** source editions/revisions, attribution, relationship evidence, missing data, and counting conventions.

Pronunciation guidance is text-based unless an audio source is explicitly added. Senses are source-defined; do not assign every token to a sense unless occurrence-level annotation exists. Different sources can disagree without being collapsed into a synthetic authoritative definition.

## Frequency analysis

Compute statistics in the worker over the complete selected dataset, independent of Search’s maximum-hit setting and occurrence pagination.

| Statistic | Definition |
| --- | --- |
| Token occurrences | Count distinct matched token IDs within the selected scope |
| Distinct verses | Count distinct book/chapter/verse references; label corpus-specific versus combined counts |
| Form frequency | Count tokens by source surface form, with optional normalized grouping clearly labeled |
| Book distribution | Occurrences and distinct verses per book within each selected corpus |
| Relative frequency | Matched tokens / eligible corpus tokens in the same scope × 1,000 |
| English frequency | Exact word-token occurrences in the selected translation; distinguish requested variants |
| Rendering distribution | Counts from verified, translation-specific alignments only; identify denominator and coverage |

Show WLC, LXX, and GNT separately by default. A combined total may be offered with an explicit “across corpora” label; it is not a count of unique passages or independent witnesses. Distinguish Hebrew from Aramaic within WLC when metadata supports it.

Filters include corpus, language, testament, book/range, lemma versus exact form, and English translation where applicable. Chart selection updates the visible filter summary; clearing filters restores the study scope. Display zero-count corpus availability rather than silently removing it.

Deduplicate tokens reached through multiple lexical mappings. Expanding related words must not automatically increase the selected lemma’s counts. A word-family aggregate requires an explicit selection and a visible member list. Missing denominator data disables relative frequency with an explanation. Missing mappings do not mean zero usage.

English matching uses a documented tokenizer and case/punctuation policy, with explicit handling of apostrophes and hyphens. Exact word counts must not use substring matching. Derived English variants are opt-in and listed. Audit tokenizer behavior against each loaded translation.

## Relationship model and evidence

The map is a graph rendered as expandable branches, not a claim that every word belongs to a single tree. Cycles and multiple parents are valid.

| Relationship | Display rule |
| --- | --- |
| Root / derivation | Source-supported linguistic relationship; identify direction and source |
| Synonym / antonym | Source-supported, language- and sense-specific relation; show context restrictions |
| Related Strong’s entry | Explain the link: alias, extended entry, derivation, source cross-reference, etc. |
| English gloss / definition match | Label as lexical discovery, not a translation pairing |
| Verified rendering | Identify translation, aligned tokens, passage evidence and alignment source |
| Hebrew/Aramaic–Greek rendering | Requires alignment and versification mapping; show supporting passages |
| Passage association | Label as words found in corresponding passages, without asserting equivalence |

Do not infer synonyms from shared glosses, antonyms from word opposition in a verse, roots from spelling similarity, or lexical equivalence from shared verses. Do not transfer the entire range of a root’s meanings to a derived word. Avoid numerical confidence scores without a calibrated method; use understandable evidence categories and sources.

Each edge stores relationship type, direction, source/revision, evidence category, optional sense/context, supporting references, and explanatory note. Related entries absent from the token corpus can still be shown with “lexicon only.” Distinguish “no sourced relationship found” from “relationship data unavailable.”

## Visibility preferences

- Default global preference: additional relationships visible.
- Provide global toggles for roots, derivations, synonyms, and antonyms, plus a master show/hide control. Related Strong’s links remain available in the entry section.
- Provide the same temporary visibility controls in each study. Temporary changes affect both Overview and Word map but do not silently rewrite global defaults.
- Provide an explicit “Use these defaults for future studies” action and equivalent Settings controls.
- New studies inherit persisted defaults; restoring history restores that study’s local visibility choices.
- Hiding details changes presentation only, not statistics, identity resolution, or stored data.
- When hidden, show a compact “Related details hidden” control so users can discover and restore the information.

Persist settings locally, following existing validation/fallback patterns. “Global” means across this app on the current browser/device; cross-device synchronization is not implied.

## Desktop, tablet, and mobile design

### Desktop

Use a study header with input, target identity, corpus/translation selection, and Overview/Word map controls. Overview has a section navigator and readable content column; wider screens can show a passage/detail pane. Word map has a centered selected node, progressively expanded typed branches, and an adjacent detail panel.

### Mobile and narrow tablet layouts

Use one content column, a compact sticky header, and a section selector. Avoid squeezing desktop sidebars into the page. Overview scrolls normally. Word map provides large tap targets, expand/collapse actions, fit/reset controls, and a linear branch navigator so every relation is reachable without precision panning or pinch zoom. Opening details uses a sheet that can expand to full screen; long passages and definitions scroll within a clear single active reading surface.

Only pin controls that fit comfortably at large text sizes. Preserve visible focus and account for device safe areas, landscape orientation, and the software keyboard. Hebrew/Aramaic text uses proper right-to-left text direction within an otherwise language-appropriate interface.

### Map interaction

- Center the selected lemma with its script, transliteration, gloss, and identifier.
- Group branches by Forms, Entries, English, Other languages, and Related words.
- Distinguish edge types through labels and line styling as well as color.
- Load and expand branches on demand; show counts and “more” controls for large groups.
- Selecting a node opens details; a separate action navigates to that word’s study.
- Show revisited nodes/cycles as links rather than duplicating unbounded subtrees.
- Filters and hidden relationship types apply equally in the map and overview.

### Accessibility

All map operations have button/list equivalents, meaningful labels, logical focus order, and keyboard support. Charts have readable data tables. Counts and evidence never rely on color alone. Use at least 44 CSS-pixel touch targets where practicable, readable contrast, reduced-motion support, and live loading/error announcements. Respect existing theme and font-size controls. Focus returns to the originating control when a sheet or chapter closes.

## Data and architecture plan

Keep database work in the existing Bible worker. Add focused Word Study modules rather than growing `App.tsx` into the entire feature. Reuse passage rendering and definition presentation where their contracts fit.

Proposed components: `WordStudyMode`, `WordStudyInput`, `WordCandidatePicker`, `WordStudyOverview`, `WordFrequencyPanel`, `WordRelationsPanel`, `WordMap`, `WordStudyPassages`, and `WordStudySettings`. Names are provisional; shared study state supplies both views.

Proposed worker operations:

- `word_study_resolve`: input, language hint, corpus context, English translation → ranked candidates and match explanations.
- `word_study_overview`: lexical target → identity, source entries, coverage and capabilities.
- `word_study_stats`: target and explicit filters → complete counts, distribution, forms, denominators.
- `word_study_relations`: target, relation types, cursor → sourced edges and nodes.
- `word_study_occurrences`: target, filters, cursor/page size → bounded passages and next cursor.
- `word_study_alignments`: target, translation/corpora, filters → available verified renderings and coverage.

Return structured typed responses with explicit capability flags. Cancel or ignore stale responses when the target changes; do not let an earlier query overwrite a newer study. Cache results by dataset version, lexical identity, translation and filters. Counts and graph branches load independently so a large graph cannot block basic reading.

### Proposed schema additions

Design migrations after the source audit. Prefer adding canonical tables and mappings without breaking existing token/search consumers:

- `lexemes`: stable ID, language (including Aramaic), lemma, normalized lookup key, identity provenance.
- `lexeme_aliases`: spelling/transliteration alias, type, language, source, target ID.
- `lexeme_entries` and `lexeme_strongs`: many-to-many source-entry and identifier mappings, including original and normalized identifiers.
- `token_lexemes`: token-to-lexeme mapping with provenance and ambiguity status.
- `lexical_relations`: typed, directed, sourced relationships with sense/context/evidence metadata.
- `alignment_sources`, `alignments`, and members: corpus/translation-specific token groups, supporting many-to-many and phrase renderings.
- Corpus metadata/denominators and an English token index if required by measured count/query costs.

Reuse `study_sources` where compatible. Preserve attribution and source license metadata, including separation already used for adapted source material. Source import changes need source-specific permission/attribution review before distribution; this document does not approve new datasets.

Create indexes for normalized resolution, corpus/lexeme/book filtering, relation traversal, and alignment lookup. Precompute stable corpus totals at build time. Measure storage growth and query plans before choosing full precomputed lemma statistics versus runtime aggregation.

Audit Hebrew segmentation, prefixes/suffixes, homographs, uncertain Greek lemma-to-Strong’s enrichment, extended identifier collisions, morphology schemes, Aramaic metadata, and MT/LXX verse numbering. Do not fabricate missing token alignment. Keep raw values for reproducibility.

### Routing and persistence

Use the current hash-routing approach, with a proposed `#/study` route and stable target/filter parameters. Encode Unicode and validate all route values. Resolved identity, corpus, translation and view should support reload and deep links; transient map geometry can stay in local state. A shared link opens the referenced study without changing the recipient’s global defaults.

Separate global preferences, transient study state, and saved user studies. Integrate schema/data version detection with existing OPFS cache behavior so upgraded study data is actually loaded. Preserve Class user data during Bible cache replacement. Older datasets expose reduced capabilities rather than causing a blank screen.

## Delivery stages

### Stage 1 — Foundation

1. Audit sources/schema/coverage and settle unresolved defaults.
2. Implement identities, normalized candidate resolution, explicit Aramaic metadata, and translation tracking.
3. Add worker aggregation and paginated occurrence APIs with typed contracts.
4. Add the mode, entry actions, overview, source-separated entries, forms, chart/table, filters and passages.
5. Add relationship visibility settings and an initial list of any source-supported relationships already available. Report unavailable relation categories clearly.
6. Validate responsive layout, offline operation, counting accuracy and navigation restoration.

Exit criteria: each supported input type can resolve or explain ambiguity; complete counts match independent queries; mobile and desktop can reach entries/forms/passages; English translation selection follows the confirmed rule; Aramaic is labeled from evidence; counts ignore result caps.

### Stage 2 — Exploration

1. Add sourced root/derivation/synonym/antonym relations and related entry traversal as data permits.
2. Build the interactive graph and equivalent list navigation from the same relation model.
3. Add translation-specific rendering analysis and cross-language links only where verified alignment is available; otherwise retain clearly labeled lexical discovery and passage associations.
4. Synchronize view selection, filters, local visibility, history and deep links.
5. Validate large branch sets, cycles, touch interaction, keyboard navigation and relationship provenance.

Exit criteria: every displayed edge has a type and source/evidence; toggles work in both views and persist as specified; no inferred gloss/verse association appears as verified translation; all map information is available on mobile and to keyboard/screen-reader users.

### Stage 3 — Study workspace

1. Store named studies, notes, selected targets, filters, references and chosen related words in the persistent user database.
2. Attach studies to Class sessions/follow-ups with return navigation.
3. Add comparison of selected words/corpora/translations with compatible counting scopes.
4. Include saved studies in existing backup/export/import flows with schema versioning.
5. Provide a readable export with references, sources, coverage and counting scope; choose formats after priorities are confirmed.

Exit criteria: studies survive reload, restore meaningful navigation state, attach to Class sessions, and round-trip through backup/import without losing attribution or notes. Dataset updates re-resolve identities and explicitly report missing/changed mappings.

## Verification and acceptance scenarios

- English input while NASB is active uses NASB; after selecting KJV and switching to Greek, English input uses KJV, including after reload.
- Accented/unaccented Greek and pointed/unpointed Hebrew resolve consistently while preserving distinct homographs.
- An inflected form resolves to candidate lemmas and supports both exact-form and lemma counts.
- Extended Strong’s entries are not lost or silently replaced by the first display-number match.
- Aramaic aliases preserve source identifiers and show the correct language; unsupported classification is labeled unknown.
- A repeated word in one verse contributes multiple token occurrences and one distinct verse.
- Multiple source mappings to the same token do not inflate counts.
- Book and form filters recompute numerator and denominator within the same scope.
- A 200-hit Search cap does not limit any Word Study statistic; passage pages remain bounded.
- Lexical gloss results, passage associations and verified alignments remain visibly distinct.
- Alignment groups with multiple words do not produce misleading one-to-one claims or duplicate counts.
- All four additional relation types start visible; local toggles do not change future defaults until explicitly saved; global preferences survive reload.
- Graph cycles, empty branches and large relation sets remain navigable without unbounded rendering.
- Back/forward, chapter return and Overview/Word map switching preserve study context.
- Test narrow phone widths, tablet layouts, desktop, large text, RTL text, landscape, keyboard-only use and reduced motion.
- Missing optional data, older databases, failed downloads and offline reloads produce useful partial states with retry actions.
- Run applicable database/import tests, meaningful worker/UI tests, production build and project checks once implementation exists. Independently compare representative counts against direct SQL/source fixtures.

## Performance and failure behavior

Use bounded passage pages, lazy graph expansion, indexed queries, stale-response protection and incremental loading. Establish performance budgets on representative desktop and lower-memory mobile devices during Stage 1; record dataset size, first-load cost, warm query latency and peak memory. Do not impose unsupported timing promises before measurements.

Show identity first, then independently loading statistics, entries and relationships. Distinguish ambiguous input, no occurrence, no lexical entry, unavailable relationship data, unavailable alignment, and a failed query. Preserve the usable study when one section fails. Offer retry without requiring the user to re-enter the word.

## Scope boundaries

This plan does not authorize code changes, new dataset acquisition, deployment, cloud sync, audio acquisition, AI-generated lexical conclusions, or automated assignment of meanings to individual verses. Those are separate implementation or product decisions. The intended core is sourced, reproducible word exploration that works on desktop and mobile.

## Local implementation — 2026-10-16

Implemented on the local `dev` branch using the existing offline datasets:

- New hash-routed Word Study mode, original-language definition and English lookup entry points.
- Unicode-normalized candidate resolution with explicit ambiguity and distinct extended/display entry IDs.
- English word counts in the selected/current/last-used translation; lexical candidates and cross-language shared-gloss discovery carry explicit evidence labels.
- Complete token/verse counts, corpus denominators, book distribution, form filters, source parsing, and 40-record passage pages. Ambiguous normalized lemma spellings require selected token identifiers.
- Responsive overview and expandable graphical branch layout; native button, details, and table controls supply keyboard/list equivalents.
- Source-separated brief/BDB/LSJ/UBS definitions and references, sourced semantic relations, and BDB root-section grouping links with editorial caveats.
- Persistent global relation visibility defaults plus per-study controls; explicit Aramaic alias/language metadata from UBS.
- Saved studies and notes in `class.db` (schema 3), optional Class-session attachments, standalone JSON backup/import, readable Markdown export, and an in-session frequency comparison table.
- Class-session exports/imports include attached studies and remap local session IDs. Standalone imports clear attachments.
- Worker-side queries use the existing schema plus `word_relations` and `word_languages`, avoiding a mandatory full Bible data rebuild. A versioned Bible cache refresh leaves the Class database intact.

Implementation choices: NASB is the fallback English translation; the core stays offline and uses progressive technical detail. The existing chapter reader still displays NASB, while study passage excerpts use the selected study translation.

Data boundaries: verified translation-specific alignments are unavailable. Corresponding-word discovery therefore shows shared glosses with explicit caveats rather than rendering statistics. Source morphology remains in its supplied notation. BDB root-section groupings are not asserted as independently verified etymologies. Source coverage limits, annotation ambiguity, and MT/LXX verse-number differences are displayed in the study. Counts reflect installed annotation coverage, not a claim to resolve every textual or lexical variant.

The initial word map is a responsive branch diagram using native expandable controls; free panning, positional graph editing, and a dedicated node-detail sheet are not included. The comparison table is transient. Deep links preserve study targets/filters/views; arbitrary scroll positions and manually expanded source sections are not serialized. Future additions can extend these behaviors without changing the evidence model.

Local validation includes fixture-based SQLite query tests, independent counts from the installed database, persistence and Class export/import tests, source-adapter tests, production build, and browser checks at desktop and phone widths.

### Relationship discovery correction — 2026-10-17

English studies now load sourced relationships for their original-language gloss candidates instead of returning an empty relationship panel. Each relationship identifies its originating lemma, identifier, language and source; these are not asserted to be relationships of the English word or aligned translations. Duplicate display aliases are deduplicated for relationship discovery. Selecting a related word retains its original language and resolves ambiguous lemmas explicitly.
