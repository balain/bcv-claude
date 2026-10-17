# Sources and Attribution

Application code is [MIT licensed](LICENSE). Bible texts, lexicons, annotations,
and cross-references retain their own terms. These references describe current
importer inputs, not blanket permission to publish user-supplied databases.
The app's **Settings → Source material credits** view contains acknowledgments
and a download of the adapted UBS entries.

## Open Scriptures BDB

- [Open Scriptures Hebrew Lexicon](https://github.com/openscriptures/HebrewLexicon).
- Pinned revision: [21c9add13bc727d3a951361778e97e3ff7afd1ce](https://github.com/openscriptures/HebrewLexicon/tree/21c9add13bc727d3a951361778e97e3ff7afd1ce).
- Inputs: `BrownDriverBriggs.xml`, `LexicalIndex.xml`, `AugIndex.xml`, source README.
- Credit: Open Scriptures Hebrew Bible Project; Brown, Driver, and Briggs,
  *A Hebrew and English Lexicon of the Old Testament* (1906).
- License: project files [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
  original BDB text public domain. The transcription remains incomplete.

XML is rendered as text, preserving numbered senses and references, omitting
transcription status, and joining lexical/augmented Strong's IDs. Multiple
entries sharing an identifier stay separate. This source also supplies
replacement Hebrew brief definitions.

## STEP Bible / Tyndale House

- [STEPBible Data](https://github.com/STEPBible/STEPBible-Data) and its
  [Lexicons directory](https://github.com/STEPBible/STEPBible-Data/tree/master/Lexicons).
- Credit: Data created by [STEP Bible](https://www.stepbible.org/) based on work
  at Tyndale House Cambridge.
- Terms: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), subject to
  specific source notices inside each supplied file.
- Inputs: `data/TBESH.txt`, `data/TBESG.txt`, `data/TFLSJ.txt`, optional
  `data/TFLSJ-extra.txt`; obtained separately from the BDB/UBS downloader.

TBESG provides Abbott-Smith-based brief Greek entries with supplementary
material. TFLSJ supplies formatted Liddell–Scott–Jones entries for biblical
vocabulary, including NT and Septuagint words. TSV/HTML becomes SQLite/plain
text; bibliographic anchor titles become literary references. STEP versions
are supplied locally rather than automatically pinned by the downloader.

TBESH supplies Hebrew lemmas, lexical tags, morphology summaries, and glosses.
Its Online Bible abridged-BDB meanings request separate permission. The importer
excludes these meanings and substitutes the Open Scriptures transcription.
A general CC BY heading does not remove the specific permission notice.

## United Bible Societies

- [UBS open-license resources](https://github.com/ubsicap/ubs-open-license) and
  [dictionary descriptions](https://github.com/ubsicap/ubs-open-license/tree/main/dictionaries).
- Pinned revision: [33dcc8c671511151551804e073f1d461bc5d5b1a](https://github.com/ubsicap/ubs-open-license/tree/33dcc8c671511151551804e073f1d461bc5d5b1a).
- License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

| Resource | Version | Attribution |
|---|---|---|
| UBS Dictionary of New Testament Greek | English v1.1 | © United Bible Societies 2023; adapted from Semantic Dictionary of Biblical Greek © UBS 2018–2023, itself adapted from Louw–Nida © UBS 1988, 1989; exhaustive Scripture references contributed by SIL |
| UBS Dictionary of Biblical Hebrew | English v0.9.3 | © United Bible Societies 2023; adapted from Semantic Dictionary of Biblical Hebrew © 2000–2023 UBS; coverage incomplete |

JSON becomes SQLite meanings, glosses, domains, usage notes, and footnotes.
Inline style/link codes become readable text. Word-position references become
deduplicated verse labels. Adapted UBS entries and identifier mappings remain
CC BY-SA 4.0, separately from MIT application code. Retain credit, license
links, and change notices with redistributed adaptations. The builder exports
them with metadata in `data/ubs-study.json`; deploy at `<base>/db/ubs-study.json`.

## Bible texts and interlinear annotations

| Resource | Input / provenance | Reference and terms |
|---|---|---|
| KJV | `data/kjv.txt` | Public domain in the United States; rights vary by jurisdiction |
| ASV (1901) | `data/asv.txt` | Public domain in the United States |
| NASB | Supplied `data/bible-nau.db` | © The Lockman Foundation; [publisher permissions](https://www.lockman.org/permission-to-quote-copyright-trademark-information/) govern redistribution |
| Lexham English Bible | `data/LEB.json` | © Faithlife Corporation; retain/consult the publisher's license supplied with the text; see [Lexham](https://lexhampress.com/) |
| Westminster Leningrad Codex | Hebrew text/interlinear from supplied source DB | [Unicode/XML Leningrad Codex](https://www.tanach.us/); WLC text public domain; annotation rights require separate verification |
| Robinson–Pierpont Greek NT (2005) | Greek NT/interlinear from supplied source DB | [Byzantine text project](https://github.com/byztxt/byzantine-majority-text); text dedicated to public domain; annotations retain their own terms |
| Septuagint / CATSS | LXX interlinear from supplied source DB | [CATSS electronic texts](https://ccat.sas.upenn.edu/gopher/text/religion/biblical/lxxmorph/); electronic transcription/morphology terms must be checked separately from the underlying Rahlfs edition |

The downloader does not retrieve these texts. Possessing a source database
does not establish permission to publish it. BDAG is not bundled: personal
schema fields named `bdag_ref` store user references, not BDAG dictionary content.

## Cross-references

[OpenBible.info Bible Cross References](https://www.openbible.info/labs/cross-references/)
provides the default [download](https://a.openbible.info/data/cross-references.zip),
cached as `data/cross-references.txt`. Credit OpenBible.info and the Treasury
of Scripture Knowledge. The TSK basis is public domain; OpenBible's page labels
its compiled/contributed content [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The importer converts references and vote counts into SQLite. Verse previews
use the app's NASB data, not the ESV quotations displayed on OpenBible's site.

The builder can also load supplied
[josephilipraja/bible-cross-reference-json](https://github.com/josephilipraja/bible-cross-reference-json)
files under `data/josephilipraja/`. This optional GPL-2.0 source is not downloaded
by default and requires its own redistribution assessment. Personal references
are stored separately in the local Class DB.

## Retaining source information

`python3 scripts/study_lexicons.py --download` retrieves pinned BDB/UBS inputs
and source notices. URLs and SHA-256 hashes are in
`data/study-sources/manifest.json`. The built `study_sources` table records
revision, attribution, license, URL, and transformations. Retain the exact STEP
files used for a release because their versions are supplied locally.

`data/` is Git-ignored: code commits do not contain downloaded sources, built
databases, or the UBS export. Publish only authorized artifacts with notices;
retain raw inputs and the manifest for reproducibility.
