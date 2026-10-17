# Dedicated LXX lexicons: licensing requests

Prepared: 2026-10-17. Status: **draft inquiries; not sent**. No permission, quote, or digital dataset has been obtained. MACULA's separate open-data license does not cover these lexicons.

## Contacts and titles

| Work | Publisher / initial contact | Verified source |
| --- | --- | --- |
| Takamitsu Muraoka, *A Greek-English Lexicon of the Septuagint* (2009), ISBN 9789042922488 | Peeters Publishers, `peeters@peeters-leuven.be`. Ask to be routed to the rights/licensing department for this title. This is the published general contact, not a verified dedicated rights address. | [Peeters contact](https://www.peeters-leuven.be/cms.php?lang=en&topic=contact), [title description](https://www.peeters-leuven.be/detail.php?lang=fr&search_key=9789042922488) |
| Johan Lust, Erik Eynikel, Katrin Hauspie, *A Greek-English Lexicon of the Septuagint* (LEH) | Deutsche Bibelgesellschaft. Start through its [permissions inquiry](https://www.die-bibel.de/abdruckgenehmigung), or contact `info@die-bibel.de` requesting the correct electronic-content rights contact. Its imprint lists `lizenzen@dbg.de` for commercial text/data-mining licenses; ask whether that team also handles app redistribution rather than assuming those rights are identical. | [Permissions](https://www.die-bibel.de/abdruckgenehmigung), [publisher imprint](https://shop.die-bibel.de/Kundenservice/Impressum/), [digital third-edition description](https://www.logos.com/product/415865/a-greek-english-lexicon-of-the-septuagint-3rd-ed) |

Contacts were checked against publisher pages on the preparation date. Ask the publisher to confirm the rightsholder, edition, and availability of licensed machine-readable data. A retail print, ebook, or Bible-software purchase is not evidence of rights to reproduce the work in this app. Do not scrape or import a retail edition while negotiating.

## Project description to provide

BibleSearch is a React/SQLite progressive web app for desktop, tablet, and mobile. Its application source is MIT-licensed. It searches biblical texts and displays source-attributed definitions, forms, frequencies, relationships, and passage evidence. Reference data downloads to a browser-local database for offline use. Saved user notes are stored separately.

The licensing inquiry must disclose that a full offline dataset is delivered to the user's browser and could be extracted. It must not promise copy protection or access restrictions that the app does not implement. The MIT license on application code would not apply to licensed lexicon content.

Before sending, fill in these currently unconfirmed business details:

- Licensee's legal name, organization (if applicable), and reply contact.
- Public app URL and whether access is public, authenticated, congregation-only, or personal.
- Whether use is free, donation-supported, subscription-based, or otherwise commercial; do not assume noncommercial status.
- Current/expected audience, installations or users, territory, term, and budget.
- Whether full offline distribution is mandatory, or a server/API lookup would be acceptable if offline rights are declined.

## Rights and deliverables to ask about

1. Display full entries, including source-defined senses, examples, grammar, synonyms/antonyms, cross-references and bibliographic material, with required attribution.
2. Convert supplied data to SQLite/JSON, normalize lemma keys, build search indexes, and connect identifiers to the app's Greek entries while preserving original content and provenance.
3. Distribute and cache the data in desktop/mobile browsers for offline use, including hosting and browser storage. Request explicit terms for the extractability of browser-local content.
4. Show limited excerpts in a saved or exported study, and clarify whether public sharing of those exports is permitted. If export rights are declined, exclude licensed text from exports.
5. Use and display any supplied Hebrew equivalents, relationship fields, identifiers and references, including derived indexes and statistics; ask whether those require separate rights.
6. Obtain a machine-readable file (TEI/XML/JSON/CSV or similar), a schema and identifier documentation, correction/update access, and a representative licensed sample for evaluation.
7. Clarify attribution wording, fees/minimums/royalties, territory, duration, user limits, reporting, third-party material, corrections, termination and treatment of cached copies after termination.
8. If full-data/offline distribution is unavailable, ask about API or entry-level lookup licensing and whether an independent app is permitted to use it.

## Draft inquiry: Muraoka / Peeters

Subject: Digital-content licensing inquiry — Muraoka's Greek-English Lexicon of the Septuagint

Dear Peeters Rights and Licensing Team,

I am developing BibleSearch, a Bible study application for desktop and mobile browsers. I would like to discuss licensing Takamitsu Muraoka's *A Greek-English Lexicon of the Septuagint* (2009), ISBN 9789042922488, for use in its word-study mode.

The application displays source-attributed lexical entries alongside Greek and Hebrew passages, usage frequencies, and source-supported word relationships. Its application source code is open source under the MIT license; any licensed lexicon content would remain separately licensed and would not be included under MIT.

The current architecture downloads reference data into a local SQLite database in each user's browser for offline use. We therefore need explicit permission for digital reproduction, conversion/indexing, display, distribution, and browser-local caching. A browser-local dataset is extractable; we do not currently provide DRM. We would also like to discuss limited entry excerpts in user-created study exports and reuse of any included relationship/reference fields.

Licensee: [legal name / organization]
Application URL and access model: [URL; public/private/authenticated]
Revenue model: [free/donation-supported/paid; describe accurately]
Expected audience and territory: [estimate; territory]
Proposed term: [term]

Could you confirm who controls these electronic rights, whether a machine-readable edition is available, the permitted scope and commercial terms, and whether a licensed sample and schema can be provided for evaluation? If full offline distribution is not available, please indicate any API or online lookup licensing options.

Thank you,
[Name and reply contact]

## Draft inquiry: LEH / Deutsche Bibelgesellschaft

Subject: Electronic-content licensing inquiry — Lust–Eynikel–Hauspie Septuagint lexicon

Dear Rights and Licensing Team,

I am developing BibleSearch, a desktop and mobile Bible study application, and would like to discuss licensing the *Greek-English Lexicon of the Septuagint* by Johan Lust, Erik Eynikel and Katrin Hauspie. Please confirm the current edition available for digital licensing; I have found a digital third-edition listing (2015), ISBN 9783438051387.

The intended use is source-attributed lexical lookup, full entry display, indexed lemma search, and navigation to LXX passages and source-defined relationships. The app's software is MIT-licensed, but licensed lexicon content would be distributed under a separate agreement.

The current app downloads reference data to a browser-local SQLite database for offline use on desktop and mobile. This requires explicit reproduction, conversion/indexing, hosting, distribution, and offline caching rights. Such a dataset can be extracted from browser storage; the app does not currently provide DRM. Please also clarify whether limited excerpts may appear in saved/exported user studies and whether the included Hebrew equivalents, relationship information, and derived indexes can be used.

Licensee: [legal name / organization]
Application URL and access model: [URL; public/private/authenticated]
Revenue model: [free/donation-supported/paid; describe accurately]
Expected audience and territory: [estimate; territory]
Proposed term: [term]

Could you direct this request to the appropriate content-licensing contact, confirm rights ownership, and advise on machine-readable data availability, licensing terms, fees and attribution requirements? A sample file and schema would help us evaluate integration. If offline distribution is unavailable, we would welcome details of any API or online lookup arrangement.

Thank you,
[Name and reply contact]

## Follow-through

Send only after the placeholders are completed and the user authorizes sending. Log the date and recipient separately for each inquiry. If unanswered, follow up after roughly two weeks with the same scope and request the appropriate department; do not infer permission from silence. No automation or reminder has been created.

Before importing any licensed sample, retain its written evaluation terms. Before release, obtain a written agreement covering the actual app behavior, then implement its restrictions: separate data delivery and notices, any access controls, export limits, term limits and required updates. If offline rights are not granted, retain existing open lexicons and evaluate a separately authorized online integration.

## Tracker

| Resource | Status | Sent | Reply / quote | Permission / data received |
| --- | --- | --- | --- | --- |
| Muraoka / Peeters | Draft prepared | Not sent | None | None |
| LEH / Deutsche Bibelgesellschaft | Draft prepared | Not sent | None | None |
