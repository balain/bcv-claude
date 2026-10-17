# BibleSearch — User's Guide

## Overview

BibleSearch lets you search the Bible in multiple translations and original
languages, read full chapters, and look up Hebrew and Greek words — all in your
browser, with no account or internet connection required after the first load.

---

## Getting Started

When you open the app for the first time, the database (~295 MB with the current sources) is downloaded
and saved in your browser's private storage. A progress indicator shows the
download percentage. After the download finishes the app saves the database
locally. Later visits reuse it while browser storage is available. A production
build caches the app shell too; local development does not enable that service worker.

Open **Search**, **Browse**, or **Class** from the header. Use the gear button for
settings and the **↻** button to re-download the Bible database. Developer setup
and hosting instructions are in the [README](README.md).

---

## Searching

### The Search Bar

The search bar at the top of the screen shows the current query and translation.
Tap or click it to expand it and make changes.

- **Query field** — type what you want to search for
- **Go button** — run the search (or press Enter)
- **Source selector** — choose which Bible translation or original language to
  search (see below)
- **▲ collapse** — collapse the bar back to its compact form after you're done

### Choosing a Translation

The source selector has two groups separated by a vertical divider:

| Group | Sources |
|---|---|
| English | KJV · ASV · LEB · NASB |
| Original languages | Heb (Hebrew MT) · LXX (Septuagint) · GNT (Greek NT) |

Click any pill to switch. The selected pill is highlighted: amber for original
languages, navy for English translations.

### Keyword Search

Type one or more words and press **Go**. The search is case-insensitive and
supports equivalent Greek accent encodings. For reliable Greek lemma searches,
select a word chip and use **Search lemma**; do not assume every unaccented
spelling will match accented text.

- **English search** matches against the verse text of the chosen translation
- **Hebrew (Heb) search** matches against surface forms, transliterations,
  glosses, and lemmas in the Hebrew MT interlinear
- **LXX search** matches against the same fields in the Septuagint interlinear
- **GNT search** matches against the same fields in the Greek NT interlinear

Keyword searches return at most 200 verses by default. Change **Maximum hits**
or enable **Unlimited hits** in Settings. Hit counts distinguish displayed
results from total matches. Book and Testament filters operate on the returned
verses; raise the limit if a needed match falls beyond the loaded results.

**Search LXX and GNT together** is on by default: selecting either Greek source
searches both Testaments. Turn it off in Settings to restrict the search to the
selected corpus. Hebrew searches remain confined to the Hebrew text.

### Reference Search

Enter a passage or list in the same search field:

| Input | Result |
|---|---|
| `John 3:16,18; Rom 8:28` | Specified verses, in input order |
| `Psalm 23` | A whole chapter |
| `John 3-4` | A chapter range |
| `John 3:16–4:6` | A range across chapters |
| `Jude 3` | Jude 1:3, because Jude has one chapter |

Reference searches display NASB with available interlinear text, ignore the
keyword hit limit, and remove duplicate verses. **Bible order** sorts them into
canonical order; it starts off. Invalid references are reported while valid
references still display. A bare book name remains a word search.

### Phrase Search

Surround multiple words with double quotation marks to search for an exact
sequence of words:

```
"in the beginning"
"loving kindness"
```

- **phrase** pill appears in the search bar to confirm the query is being
  treated as a phrase rather than independent keywords.

### Search History

Expand **Recent searches** below the search controls to view your recent searches. Tapping any
history entry will re-run that search immediately. History is saved locally in
your browser's storage.

### Clicking English Words


In any result card, click any English word to search for that word in the
currently-selected English translation (or NASB if an original-language source
is active).

After a single-word English search, select **Strong’s** beside the hit summary
to browse brief Hebrew and Greek definitions containing that English word.
You can highlight the word within definitions and select a lemma to search it.
This searches the brief definition index, not all LSJ/UBS study entries.

---

## Reading Results

### Result Cards

Each match appears as a card showing:

- **Reference** (e.g. `Gen 1:1`) — click to open the full chapter view
- **Language badge** — `Heb`, `LXX`, `GNT`, or `Heb/LXX` for OT verses that
  have both Masoretic and Septuagint text
- **English verse text** — the matching word is shown in the accent colour
- **Interlinear section** — Hebrew (right-to-left) and/or Greek word chips

Click the ▼/▲ button in the top-right corner of a card to collapse or expand it.

### Collapsing the Interlinear

For English searches, the interlinear section starts collapsed to keep the list
readable. Click the collapsed strip (showing the corpus labels and a ▶) to
expand it. Click anywhere in the open interlinear area — but not on a word chip
— to collapse it again.

### Book Filter

The book filter strip appears below the search bar when results span multiple
books. Click any book pill to show only hits from that book; click it again (or
click another book) to change the filter. The active filter pill is highlighted.

When results contain both Testaments, **All / OT / NT** filters let you restrict
the displayed verses. With a finite hit limit, filtering does not load additional
matches from the database.

### Cross-references

Expand **Cross-refs** below a result or chapter verse. The list scrolls through
all available references rather than stopping after the first few. Each target
shows its first eight words from NASB; a range previews its starting verse.
Tap the reference to read the target passage. Vote counts appear in search
results when available.

Use **+** to add your own target reference. Personal references appear first and
are marked with a star; they are stored locally with Class data. Existing notes
on personal references are displayed, but the quick-add field accepts only a reference.
A missing preview does not prevent navigation to the reference.

### Bookmarks

Use the star beside a verse to save or remove a bookmark. Bookmarks are shared
between search, Browse, and Class reference lists. Open saved bookmarks from
the bookmark panel in **Browse**. They are stored in this browser, separately
from session exports.

### Distribution Chart

Click the 📊 button in the top-right header to toggle a bar chart showing how
hits are distributed across the biblical canon. Each bar represents one book;
OT bars are amber and NT bars are indigo.

### GlossCard

When you search for a single word in an original language (Hebrew, LXX, or GNT)
and results are found, a summary card appears above the results showing the
word's lemma, transliteration, short gloss, and full lexical definition. Click
the card header to collapse or expand the definition text. The card remembers
its open/closed state across searches.

---

## Looking Up Words

### Tapping a Word Chip

In any interlinear section, tap or click any Hebrew or Greek word chip to open
a definition sheet at the bottom of the screen. The sheet shows:

- The word's surface form in large script
- Its transliteration in italics
- Its full lexical definition (when available)
- A detail table: Lemma · Strong's number · Gloss · Morphological form

The **Study lexicons** section offers **BDB** and **UBS** for Hebrew, and
**LSJ** and **UBS** for Greek wherever an entry is available. Select a source
to compare its definitions. UBS distinguishes individual meanings and lists
semantic domains; expand **Scripture references** under a meaning to see its
passages. LSJ's **Literary references** preserve citations from the source's
bibliographic hover text. Expand **Usage notes** for additional UBS discussion.
The brief Greek definition can be expanded independently of the study sources.
BDB's digital transcription and the UBS Hebrew dictionary are still
incomplete. These resources work offline after the database has downloaded.
Some Strong's identifiers correspond to several dictionary entries; these are
shown separately so you can select the meaning appropriate to the passage.

Open **Settings → Source material credits** for acknowledgments, source links,
license terms, and a download of the adapted UBS dictionary data.
Repository links and pinned source versions are also in [Sources and Attribution](SOURCES.md).

### Searching from the Definition Sheet

Two buttons at the top of the sheet let you run a new search directly:

- **Search `<lemma>` →** — searches for all occurrences of the dictionary form
  (root), using the tapped word's Hebrew or Greek source
- **Search form →** — searches for the exact inflected form as it appears in
  the text

Both buttons close the sheet and update the main result list.
For Greek words, the combined LXX/GNT setting still applies.

Close the sheet by tapping the scrim (the dim area behind the sheet), swiping
it downward, or pressing ✕.

---

## Chapter View

Click any verse reference (e.g. `1Ch 22:10`) in a result card to open the
full-chapter reading view. The clicked verse is highlighted and scrolled into
view automatically.

### Navigation

- **◀ / ▶ buttons** in the header jump to the previous or next chapter
- **Footer buttons** (`◀ Genesis 1` / `Genesis 3 ▶`) provide the same
  navigation with the chapter number visible at a glance
- At the first or last chapter of a book the corresponding button is dimmed and
  inactive

### Original Language Toggle

The sub-header bar (labelled **NASB**) contains a **Heb / LXX ▶** (OT) or
**Greek ▶** (NT) toggle button. Clicking it expands the original-language
interlinear below each verse — Hebrew in a warm parchment background
(right-to-left), Greek/LXX in a cool blue-white background (left-to-right).
Click the button again to collapse all interlinear sections.

When the interlinear is open, every word chip is tappable and opens the same
word-definition sheet described above. From the sheet, clicking a search button
closes the chapter view and runs the search in the main list.

Close the chapter view by tapping ✕ in the header or tapping the scrim behind
the panel.

---

## Browse and Settings

**Browse** lets you choose a book and chapter without running a word search.
A single horizontal chapter row stays below the book list while the verses
scroll. Select a chapter number, use the numeric chapter jump and Go button,
or use previous/next chapter controls. The selected chapter, passage field,
and browser URL stay synchronized. The passage field also accepts a reference
such as `John 3:16`.

In **Settings**, configure:

- **Search:** combined LXX/GNT searches, maximum hits, or unlimited hits.
- **Appearance:** System, Light, or Dark theme.
- **Font Size:** Small, Default, Large, or X-Large.
- **Source material credits:** source descriptions, attribution, licenses, and
  the adapted UBS data download. Escape returns from credits to Settings.

Preferences are saved locally. External source links and the downloadable UBS
file require a connection; the installed lexicon entries themselves work offline.

---

## Class Mode

Class Mode currently supports teaching sessions, captured references, context
notes on those references, and session import/export. To enter it, click the **Class** button in the main
navigation (or navigate to `#/class`).

### Sessions and Series

- Create a session with its title, date, and optional primary text.
- Filter the session list by active or archived status and open a session to
  capture references.
- Existing series and location metadata appear when present in imported data.
  Dedicated series editing is not available in the current UI.

### Quick Capture

Inside a session, use the **Quick Capture** field to rapidly record scripture
references mentioned during the teaching. The app parses your input (e.g.,
"Jn 3:16", "Gen 1:1-5") and adds it to the session's reference list.

### Reference List

Tapping any reference in the session list will open the **Chapter View** for
that passage, allowing you to follow along without leaving Class Mode.
You can mark a reference as an anchor, add or edit its context note, bookmark it,
or remove it from the session.

### Notes and Follow-ups

The **+ Topic**, **+ Follow-up**, and **+ Note** buttons are disabled placeholders.
The underlying database and import/export format support those records, but
their editing interfaces are not yet implemented. Reference context notes are
available now.

### Data Privacy and Backups

Class data stays in this browser unless you export it. Open each session and
select **Export** to save a `.classsession.json` file; use **Import…** in the
session list to restore or transfer it. The backup banner is a reminder, not an
automatic backup. Imports merge matching records using their identifiers and
update timestamps; review the import report.

Session exports are not complete browser backups: they do not contain bookmarks,
preferences, search history, or personal cross-reference overlays. Exported
sessions may include personal notes, dates, locations, and device identifiers;
share them deliberately.

If persistent storage is unavailable, Class Mode can fall back to memory and
its data is lost on reload. Browser storage can also be cleared or evicted.
Use exports for safekeeping, and export before clearing site data. A different
scheme, hostname, or port has a separate store.

---

## Tips

| Goal | How |
|---|---|
| Find a specific verse | Enter a reference such as `John 3:16` |
| Look up a Hebrew root | Search the root in Heb source, then tap a result word chip |
| Compare MT and LXX | Search in Heb or LXX — both corpora appear side-by-side in OT cards |
| Narrow results to one book | Run a search, then click the book pill in the filter strip |
| Browse a passage | Click any verse reference to open the chapter view, then use ◀ ▶ to navigate |
| Reload fresh DB data | Select **↻ Re-download database**; this preserves Class data |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Enter (in search bar) | Run the search |
| Esc | Close the English Strong's popup; return from source credits to Settings |

Use the close buttons, backdrop, or supported swipe gesture for word-definition
and chapter overlays; Escape is not a universal overlay shortcut.

---

## Browser Compatibility

BibleSearch requires a modern browser with support for:

- Web Workers with ES modules
- SharedArrayBuffer (requires COOP/COEP headers — set automatically by the dev
  server and must be configured on any production host)
- Origin Private File System (OPFS) — for the local database cache
- WebAssembly — for SQLite WASM

Use HTTPS, or localhost for development. A plain HTTP LAN address is not a
secure context. Recent checks exercised a Chromium browser at desktop and phone
widths and verified offline lookup after the database loaded; this is not a
version-by-version certification of every browser. If caching is unavailable,
the Bible worker can still load in memory but will need another download later.
