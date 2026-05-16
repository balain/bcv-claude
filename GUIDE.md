# BibleSearch — User's Guide

## Overview

BibleSearch lets you search the Bible in multiple translations and original
languages, read full chapters, and look up Hebrew and Greek words — all in your
browser, with no account or internet connection required after the first load.

---

## Getting Started

When you open the app for the first time, the database (~210 MB) is downloaded
and saved in your browser's private storage. A progress indicator shows the
download percentage. After the download finishes the app saves the database
locally, so every future visit starts instantly without any network access.

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
accent-insensitive — searching for `αγαπη` also matches `ἀγάπη`.

- **English search** matches against the verse text of the chosen translation
- **Hebrew (Heb) search** matches against surface forms, transliterations,
  glosses, and lemmas in the Hebrew MT interlinear
- **LXX search** matches against the same fields in the Septuagint interlinear
- **GNT search** matches against the same fields in the Greek NT interlinear

Results are capped at 200 to keep the interface responsive. If more than 200
results exist, a ⚠ badge appears next to the hit count.

### Phrase Search

Surround multiple words with double quotation marks to search for an exact
sequence of words:

```
"in the beginning"
"in the beginning"
"loving kindness"
```

A **phrase** pill appears in the search bar to confirm the query is being
treated as a phrase rather than independent keywords.

### Clicking English Words

In any result card, click any English word to search for that word in the
currently-selected English translation (or NASB if an original-language source
is active).

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

### Searching from the Definition Sheet

Two buttons at the top of the sheet let you run a new search directly:

- **Search `<lemma>` →** — searches for all occurrences of the dictionary form
  (root) in the same corpus as the tapped word
- **Search form →** — searches for the exact inflected form as it appears in
  the text

Both buttons close the sheet and update the main result list.

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

## Tips

| Goal | How |
|---|---|
| Find a specific verse | Search `"exact phrase from the verse"` in the target translation |
| Look up a Hebrew root | Search the root in Heb source, then tap a result word chip |
| Compare MT and LXX | Search in Heb or LXX — both corpora appear side-by-side in OT cards |
| Narrow results to one book | Run a search, then click the book pill in the filter strip |
| Browse a passage | Click any verse reference to open the chapter view, then use ◀ ▶ to navigate |
| Reload fresh DB data | Clear site data in browser DevTools if the DB has been rebuilt |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Enter (in search bar) | Run the search |
| Esc | Close an open definition sheet or chapter view (browser default) |

---

## Browser Compatibility

BibleSearch requires a modern browser with support for:

- Web Workers with ES modules
- SharedArrayBuffer (requires COOP/COEP headers — set automatically by the dev
  server and must be configured on any production host)
- Origin Private File System (OPFS) — for the local database cache
- WebAssembly — for SQLite WASM

Tested on Chrome 120+, Edge 120+, and Firefox 121+. Safari 17+ should work but
OPFS write performance may vary.
