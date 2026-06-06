#!/usr/bin/env python3
"""
Build bcv.db (core) and bcv-lsj.db (optional full LSJ) from ./data sources.

Usage: python3 scripts/build_db.py

Outputs:
  data/bcv.db
  data/bcv-lsj.db

Cross-reference data:
  OpenBible data is downloaded automatically from https://a.openbible.info/data/cross-references.zip
  and cached at data/cross-references.txt.  Attribution: OpenBible.info / Treasury of Scripture
  Knowledge (public domain).

  josephilipraja/bible-cross-reference-json is NOT bundled by default (GPL-2.0 license).
  To import it locally, place the JSON files at data/josephilipraja/ and they will be picked up.
"""
from __future__ import annotations

import io
import json
import os
import re
import sqlite3
import sys
import unicodedata
import urllib.request
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SRC_DB = DATA / "bible-nau.db"
OUT_DB = DATA / "bcv.db"
LSJ_DB = DATA / "bcv-lsj.db"

# ---------------------------------------------------------------------------
# Canonical book list — must match src/lib/search.ts ORDER
# ---------------------------------------------------------------------------
# (abbr3, osis, full-name, testament, chapters)
BOOKS = [
    ("Gen", "Gen", "Genesis", "OT", 50),
    ("Exo", "Exod", "Exodus", "OT", 40),
    ("Lev", "Lev", "Leviticus", "OT", 27),
    ("Num", "Num", "Numbers", "OT", 36),
    ("Deu", "Deut", "Deuteronomy", "OT", 34),
    ("Jos", "Josh", "Joshua", "OT", 24),
    ("Jdg", "Judg", "Judges", "OT", 21),
    ("Rut", "Ruth", "Ruth", "OT", 4),
    ("1Sa", "1Sam", "1 Samuel", "OT", 31),
    ("2Sa", "2Sam", "2 Samuel", "OT", 24),
    ("1Ki", "1Kgs", "1 Kings", "OT", 22),
    ("2Ki", "2Kgs", "2 Kings", "OT", 25),
    ("1Ch", "1Chr", "1 Chronicles", "OT", 29),
    ("2Ch", "2Chr", "2 Chronicles", "OT", 36),
    ("Ezr", "Ezra", "Ezra", "OT", 10),
    ("Neh", "Neh", "Nehemiah", "OT", 13),
    ("Est", "Esth", "Esther", "OT", 10),
    ("Job", "Job", "Job", "OT", 42),
    ("Psa", "Ps", "Psalms", "OT", 150),
    ("Pro", "Prov", "Proverbs", "OT", 31),
    ("Ecc", "Eccl", "Ecclesiastes", "OT", 12),
    ("Sng", "Song", "Song of Solomon", "OT", 8),
    ("Isa", "Isa", "Isaiah", "OT", 66),
    ("Jer", "Jer", "Jeremiah", "OT", 52),
    ("Lam", "Lam", "Lamentations", "OT", 5),
    ("Eze", "Ezek", "Ezekiel", "OT", 48),
    ("Dan", "Dan", "Daniel", "OT", 12),
    ("Hos", "Hos", "Hosea", "OT", 14),
    ("Joe", "Joel", "Joel", "OT", 3),
    ("Amo", "Amos", "Amos", "OT", 9),
    ("Oba", "Obad", "Obadiah", "OT", 1),
    ("Jon", "Jonah", "Jonah", "OT", 4),
    ("Mic", "Mic", "Micah", "OT", 7),
    ("Nah", "Nah", "Nahum", "OT", 3),
    ("Hab", "Hab", "Habakkuk", "OT", 3),
    ("Zep", "Zeph", "Zephaniah", "OT", 3),
    ("Hag", "Hag", "Haggai", "OT", 2),
    ("Zec", "Zech", "Zechariah", "OT", 14),
    ("Mal", "Mal", "Malachi", "OT", 4),
    ("Mat", "Matt", "Matthew", "NT", 28),
    ("Mar", "Mark", "Mark", "NT", 16),
    ("Luk", "Luke", "Luke", "NT", 24),
    ("Jhn", "John", "John", "NT", 21),
    ("Act", "Acts", "Acts", "NT", 28),
    ("Rom", "Rom", "Romans", "NT", 16),
    ("1Co", "1Cor", "1 Corinthians", "NT", 16),
    ("2Co", "2Cor", "2 Corinthians", "NT", 13),
    ("Gal", "Gal", "Galatians", "NT", 6),
    ("Eph", "Eph", "Ephesians", "NT", 6),
    ("Phl", "Phil", "Philippians", "NT", 4),
    ("Col", "Col", "Colossians", "NT", 4),
    ("1Th", "1Thess", "1 Thessalonians", "NT", 5),
    ("2Th", "2Thess", "2 Thessalonians", "NT", 3),
    ("1Ti", "1Tim", "1 Timothy", "NT", 6),
    ("2Ti", "2Tim", "2 Timothy", "NT", 4),
    ("Tit", "Titus", "Titus", "NT", 3),
    ("Phm", "Phlm", "Philemon", "NT", 1),
    ("Heb", "Heb", "Hebrews", "NT", 13),
    ("Jas", "Jas", "James", "NT", 5),
    ("1Pe", "1Pet", "1 Peter", "NT", 5),
    ("2Pe", "2Pet", "2 Peter", "NT", 3),
    ("1Jn", "1John", "1 John", "NT", 5),
    ("2Jn", "2John", "2 John", "NT", 1),
    ("3Jn", "3John", "3 John", "NT", 1),
    ("Jud", "Jude", "Jude", "NT", 1),
    ("Rev", "Rev", "Revelation", "NT", 22),
]

BOOK_ID = {b[0]: i + 1 for i, b in enumerate(BOOKS)}


def _aliases() -> dict[str, str]:
    """Map every known naming variant → canonical abbr3."""
    m: dict[str, str] = {}
    # Canonical + osis
    for abbr, osis, name, _, _ in BOOKS:
        m[abbr.lower()] = abbr
        m[osis.lower()] = abbr
        m[name.lower()] = abbr
        m[name.replace(" ", "").lower()] = abbr
    # Upstream bible-nau books.abbrev → frontend abbr3
    for old, new in [
        ("sol", "Sng"), ("phi", "Phl"), ("joh", "Jhn"),
        ("jam", "Jas"), ("1jo", "1Jn"), ("2jo", "2Jn"), ("3jo", "3Jn"),
    ]:
        m[old] = new
    # heb.book style ("1st Samuel", "Psalm", "Song of Solomon")
    for n, abbr in [
        ("1st samuel", "1Sa"), ("2nd samuel", "2Sa"),
        ("1st kings", "1Ki"), ("2nd kings", "2Ki"),
        ("1st chronicles", "1Ch"), ("2nd chronicles", "2Ch"),
        ("psalm", "Psa"), ("song of solomon", "Sng"),
    ]:
        m[n] = abbr
    # KJV/ASV full English extras
    for n, abbr in [
        ("1 samuel", "1Sa"), ("2 samuel", "2Sa"),
        ("1 kings", "1Ki"), ("2 kings", "2Ki"),
        ("1 chronicles", "1Ch"), ("2 chronicles", "2Ch"),
        ("1 corinthians", "1Co"), ("2 corinthians", "2Co"),
        ("1 thessalonians", "1Th"), ("2 thessalonians", "2Th"),
        ("1 timothy", "1Ti"), ("2 timothy", "2Ti"),
        ("1 peter", "1Pe"), ("2 peter", "2Pe"),
        ("1 john", "1Jn"), ("2 john", "2Jn"), ("3 john", "3Jn"),
        ("song of songs", "Sng"),
        # LEB Roman-numeral style
        ("i samuel", "1Sa"), ("ii samuel", "2Sa"),
        ("i kings", "1Ki"), ("ii kings", "2Ki"),
        ("i chronicles", "1Ch"), ("ii chronicles", "2Ch"),
        ("i corinthians", "1Co"), ("ii corinthians", "2Co"),
        ("i thessalonians", "1Th"), ("ii thessalonians", "2Th"),
        ("i timothy", "1Ti"), ("ii timothy", "2Ti"),
        ("i peter", "1Pe"), ("ii peter", "2Pe"),
        ("i john", "1Jn"), ("ii john", "2Jn"), ("iii john", "3Jn"),
        ("revelation of john", "Rev"),
    ]:
        m[n] = abbr
    return m


ALIASES = _aliases()

# OpenBible cross-reference data
OPENBIBLE_URL = "https://a.openbible.info/data/cross-references.zip"
OPENBIBLE_CACHE = DATA / "cross-references.txt"

# josephilipraja dataset (optional, GPL-2.0)
JOSEPHILIPRAJA_DIR = DATA / "josephilipraja"


def resolve_book(raw: str) -> int | None:
    if raw is None:
        return None
    k = raw.strip().lower()
    abbr = ALIASES.get(k)
    return BOOK_ID.get(abbr) if abbr else None


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
SCHEMA_CORE = """
CREATE TABLE book_meta (
  id INTEGER PRIMARY KEY,
  abbr3 TEXT UNIQUE NOT NULL,
  osis TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  testament TEXT NOT NULL CHECK (testament IN ('OT','NT')),
  chapters INTEGER NOT NULL
);

CREATE TABLE verses (
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  translation TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (translation, book_id, chapter, verse)
);
CREATE INDEX idx_verses_bcv ON verses(book_id, chapter, verse);

CREATE TABLE tokens (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_num INTEGER NOT NULL,
  corpus TEXT NOT NULL,
  surface TEXT,
  translit TEXT,
  gloss TEXT,
  lemma TEXT,
  strong TEXT,
  morph TEXT
);
CREATE INDEX idx_tokens_bcv ON tokens(corpus, book_id, chapter, verse, word_num);
CREATE INDEX idx_tokens_strong ON tokens(strong);
CREATE INDEX idx_tokens_lemma ON tokens(lemma);

CREATE TABLE lex_brief (
  estrong TEXT NOT NULL,
  dstrong TEXT NOT NULL,
  ustrong TEXT,
  lang TEXT NOT NULL CHECK (lang IN ('Heb','Grk')),
  lemma TEXT,
  translit TEXT,
  morph TEXT,
  gloss TEXT,
  meaning TEXT,
  meaning_plain TEXT,
  PRIMARY KEY (dstrong, lang)
);
CREATE INDEX idx_lex_brief_estrong ON lex_brief(estrong);

CREATE TABLE lex_names (
  key TEXT NOT NULL,
  dstrong TEXT,
  lang TEXT,
  description TEXT,
  refs TEXT,
  PRIMARY KEY (key)
);

CREATE TABLE cross_refs (
  id               INTEGER PRIMARY KEY,
  source_book_id   INTEGER NOT NULL,
  source_chapter   INTEGER NOT NULL,
  source_verse     INTEGER NOT NULL,
  target_book_id   INTEGER NOT NULL,
  target_chapter   INTEGER NOT NULL,
  target_verse_start INTEGER NOT NULL,
  target_verse_end INTEGER,
  votes            INTEGER,
  source_dataset   TEXT NOT NULL,
  UNIQUE(source_book_id, source_chapter, source_verse,
         target_book_id, target_chapter, target_verse_start, source_dataset)
);
CREATE INDEX idx_cross_refs_source ON cross_refs(source_book_id, source_chapter, source_verse, votes DESC);
CREATE INDEX idx_cross_refs_target ON cross_refs(target_book_id, target_chapter, target_verse_start);

CREATE VIRTUAL TABLE verses_fts USING fts5(
  text,
  content='verses',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE tokens_fts USING fts5(
  surface, translit, gloss, lemma,
  content='tokens',
  tokenize='unicode61 remove_diacritics 2'
);
"""

SCHEMA_LSJ = """
CREATE TABLE lex_lsj (
  estrong TEXT NOT NULL,
  dstrong TEXT NOT NULL PRIMARY KEY,
  ustrong TEXT,
  lemma TEXT,
  translit TEXT,
  morph TEXT,
  gloss TEXT,
  meaning_json TEXT,
  meaning_plain TEXT,
  source TEXT
);
CREATE INDEX idx_lex_lsj_estrong ON lex_lsj(estrong);

CREATE VIRTUAL TABLE lex_lsj_fts USING fts5(
  meaning_plain,
  content='lex_lsj',
  tokenize='unicode61 remove_diacritics 2'
);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def strip_html(s: str) -> str:
    return WS_RE.sub(" ", TAG_RE.sub(" ", s or "")).strip()


def read_tsv_lines(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig") as f:
        return f.read().splitlines()


# ---------------------------------------------------------------------------
# Verse loaders
# ---------------------------------------------------------------------------
def load_nasb(out: sqlite3.Connection) -> int:
    src = sqlite3.connect(f"file:{SRC_DB}?mode=ro", uri=True)
    rows = src.execute(
        "SELECT Book, Chapter, Verse, Content FROM nau_verses"
    ).fetchall()
    src.close()
    batch = []
    for raw_book, ch, vs, content in rows:
        bid = resolve_book(raw_book)
        if bid is None:
            continue
        batch.append((bid, ch, vs, "NASB", content))
    out.executemany(
        "INSERT OR IGNORE INTO verses(book_id,chapter,verse,translation,text) VALUES(?,?,?,?,?)",
        batch,
    )
    return len(batch)


def load_heb_verses(out: sqlite3.Connection) -> int:
    src = sqlite3.connect(f"file:{SRC_DB}?mode=ro", uri=True)
    rows = src.execute(
        "SELECT book, chapter, verse, content FROM heb_verses"
    ).fetchall()
    src.close()
    batch = []
    for raw, ch, vs, content in rows:
        bid = resolve_book(raw)
        if bid is None:
            continue
        batch.append((bid, ch, vs, "Heb", (content or "").strip()))
    out.executemany(
        "INSERT OR IGNORE INTO verses(book_id,chapter,verse,translation,text) VALUES(?,?,?,?,?)",
        batch,
    )
    return len(batch)


def load_gnt_verses(out: sqlite3.Connection) -> int:
    """GNT text from morph_verses.Content (plain Greek, no markup)."""
    src = sqlite3.connect(f"file:{SRC_DB}?mode=ro", uri=True)
    rows = src.execute(
        "SELECT Book, Chapter, Verse, Content FROM morph_verses"
    ).fetchall()
    src.close()
    batch = []
    for raw, ch, vs, content in rows:
        bid = resolve_book(raw)
        if bid is None:
            continue
        batch.append((bid, ch, vs, "GNT", (content or "").strip()))
    out.executemany(
        "INSERT OR IGNORE INTO verses(book_id,chapter,verse,translation,text) VALUES(?,?,?,?,?)",
        batch,
    )
    return len(batch)


VERSE_LINE_RE = re.compile(r"^(.+?)\s+(\d+):(\d+)\t(.+)$")


def load_plain_text(out: sqlite3.Connection, path: Path, translation: str) -> int:
    lines = read_tsv_lines(path)
    batch = []
    for line in lines:
        m = VERSE_LINE_RE.match(line)
        if not m:
            continue
        book, ch, vs, text = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        bid = resolve_book(book)
        if bid is None:
            continue
        batch.append((bid, ch, vs, translation, text.strip()))
    out.executemany(
        "INSERT OR IGNORE INTO verses(book_id,chapter,verse,translation,text) VALUES(?,?,?,?,?)",
        batch,
    )
    return len(batch)


def load_leb(out: sqlite3.Connection) -> int:
    with (DATA / "LEB.json").open("r", encoding="utf-8") as f:
        data = json.load(f)
    batch = []
    for book in data.get("books", []):
        bid = resolve_book(book.get("name", ""))
        if bid is None:
            continue
        for ch in book.get("chapters", []):
            chnum = ch.get("chapter")
            for v in ch.get("verses", []):
                batch.append(
                    (bid, chnum, v["verse"], "LEB", (v.get("text") or "").strip())
                )
    out.executemany(
        "INSERT OR IGNORE INTO verses(book_id,chapter,verse,translation,text) VALUES(?,?,?,?,?)",
        batch,
    )
    return len(batch)


# ---------------------------------------------------------------------------
# Token loaders
# ---------------------------------------------------------------------------
def load_tokens_heb(out: sqlite3.Connection) -> int:
    src = sqlite3.connect(f"file:{SRC_DB}?mode=ro", uri=True)
    rows = src.execute(
        "SELECT id, book, chapter, verse, strong_id, strong, BSB, WLC, parsing FROM heb"
    ).fetchall()
    src.close()
    # Need word_num — use row order within verse.
    per_verse: dict[tuple, int] = {}
    batch = []
    for rid, book, ch, vs, sid, strong, bsb, wlc, parsing in rows:
        bid = resolve_book(book)
        if bid is None:
            continue
        key = (bid, ch, vs)
        wn = per_verse.get(key, 0) + 1
        per_verse[key] = wn
        strong_code = f"H{int(sid):04d}" if sid is not None else None
        batch.append(
            (
                bid, ch, vs, wn, "WLC",
                wlc, None, bsb, strong or None, strong_code, parsing,
            )
        )
    out.executemany(
        "INSERT INTO tokens(book_id,chapter,verse,word_num,corpus,surface,translit,gloss,lemma,strong,morph) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        batch,
    )
    return len(batch)


def _strip_diacritics(s: str) -> str:
    """Return s with all combining diacritic marks removed (NFD decompose → drop Mn)."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    ).lower()


def _build_lex_grk(out: sqlite3.Connection) -> dict[str, tuple[str | None, str | None, str | None]]:
    """
    Build a Greek lemma lookup dict from lex_brief.
    Returns diacritic-stripped lemma → (gloss, translit, estrong).
    Two-pass: exact-match entries overwrite stripped entries so collisions
    always resolve to the best key.
    """
    # First pass: stripped → values (lowest priority)
    stripped_index: dict[str, tuple[str | None, str | None, str | None]] = {}
    # Second pass: exact → values (highest priority, stored separately then merged)
    exact_index: dict[str, tuple[str | None, str | None, str | None]] = {}

    for lb_lemma, lb_gloss, lb_translit, lb_estrong in out.execute(
        "SELECT lemma, gloss, translit, estrong FROM lex_brief WHERE lang='Grk'"
    ).fetchall():
        if not lb_lemma:
            continue
        val = (lb_gloss, lb_translit, lb_estrong)
        exact_index[lb_lemma.strip()] = val
        key = _strip_diacritics(lb_lemma)
        if key not in stripped_index:          # first writer wins for stripped
            stripped_index[key] = val

    # Merge: stripped base, exact overwrites
    combined = {**stripped_index}
    for lemma, val in exact_index.items():
        combined[_strip_diacritics(lemma)] = val  # let exact wins resolve stripped key too
    return combined


def _lex_lookup(
    lex: dict[str, tuple[str | None, str | None, str | None]],
    lemma: str | None,
) -> tuple[str | None, str | None, str | None]:
    """Return (gloss, translit, estrong) for a lemma, trying exact then stripped."""
    if not lemma:
        return (None, None, None)
    key = lemma.strip()
    val = lex.get(key)
    if val is None:
        val = lex.get(_strip_diacritics(key))
    return val or (None, None, None)


def load_tokens_gnt(out: sqlite3.Connection) -> int:
    src = sqlite3.connect(f"file:{SRC_DB}?mode=ro", uri=True)
    rows = src.execute(
        "SELECT BookName, Chapter, Verse, WordNum, WordA, WordB, Lemma, Morph FROM morph"
    ).fetchall()
    src.close()

    lex_grk = _build_lex_grk(out)

    batch = []
    for bookname, ch, vs, wn, wa, wb, lemma, morph in rows:
        bid = resolve_book(bookname)
        if bid is None:
            continue
        gloss, translit, strong = _lex_lookup(lex_grk, lemma)
        batch.append(
            (bid, ch, vs, wn, "GNT", wa, translit, gloss, lemma, strong, morph)
        )
    out.executemany(
        "INSERT INTO tokens(book_id,chapter,verse,word_num,corpus,surface,translit,gloss,lemma,strong,morph) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        batch,
    )
    return len(batch)


# LXX book numbers 1-39 map directly to canonical OT books by position.
# Books ≥ 70 are deuterocanonical (Tobit, Judith, etc.) — skipped for now.
# Psalms = 19 (151 chapters in LXX; chapter 151 is excluded by chapter count check).
_LXX_BOOK_ID = {i: i for i in range(1, 40)}  # lxx.book → canonical book_id


def load_tokens_lxx(out: sqlite3.Connection) -> int:
    src = sqlite3.connect(f"file:{SRC_DB}?mode=ro", uri=True)
    rows = src.execute(
        "SELECT book, chapter, CAST(verse AS INTEGER), wordnum, word, lemma, morph "
        "FROM lxx WHERE book BETWEEN 1 AND 39"
    ).fetchall()
    src.close()

    lex_grk = _build_lex_grk(out)

    batch = []
    for lxx_book, ch, vs, wn, word, lemma, morph in rows:
        bid = _LXX_BOOK_ID.get(lxx_book)
        if bid is None:
            continue
        gloss, translit, strong = _lex_lookup(lex_grk, lemma)
        batch.append(
            (bid, ch, vs, wn, "LXX", word, translit, gloss, lemma, strong, morph)
        )
    out.executemany(
        "INSERT OR IGNORE INTO tokens(book_id,chapter,verse,word_num,corpus,surface,translit,gloss,lemma,strong,morph) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        batch,
    )
    return len(batch)


# ---------------------------------------------------------------------------
# Brief lexicon
# ---------------------------------------------------------------------------
def load_lex_brief(out: sqlite3.Connection) -> tuple[int, int]:
    n_lex = 0
    n_names = 0
    for path, lang in [(DATA / "TBESH.txt", "Heb"), (DATA / "TBESG.txt", "Grk")]:
        lines = read_tsv_lines(path)
        # Find the real column-header row: starts with eStrong and second tab-field is dStrong.
        # Earlier prose lines also start with "eStrong" but have a description in col 2.
        start = 0
        for i, ln in enumerate(lines):
            if re.match(r"^eStrong[^\t]*\tdStrong\t", ln):
                start = i + 1
                break
        in_names = False
        for ln in lines[start:]:
            if not ln.strip():
                continue
            if ln.startswith("$"):
                in_names = "PERSON" in ln or "PLACE" in ln
                continue
            cols = ln.split("\t")
            if len(cols) < 8:
                continue
            if in_names:
                # person/place rows: key@Ref=Strong \t description \t ... \t refs
                key = cols[0].strip()
                desc = cols[1].strip() if len(cols) > 1 else ""
                refs = cols[-1].strip()
                # try extract dstrong from key (after "=")
                dstrong = None
                if "=" in key:
                    dstrong = key.split("=", 1)[1].strip()
                out.execute(
                    "INSERT OR IGNORE INTO lex_names(key,dstrong,lang,description,refs) VALUES(?,?,?,?,?)",
                    (key, dstrong, lang, desc, refs),
                )
                n_names += 1
                continue
            e, d, u, lemma, translit, morph, gloss, meaning = cols[:8]
            d_norm = d.replace(" =", "").strip()
            # collapse extra whitespace in complex dstrong values
            d_norm = d_norm.split()[0] if d_norm else d_norm
            meaning_plain = strip_html(meaning)
            out.execute(
                "INSERT OR IGNORE INTO lex_brief"
                "(estrong,dstrong,ustrong,lang,lemma,translit,morph,gloss,meaning,meaning_plain)"
                " VALUES(?,?,?,?,?,?,?,?,?,?)",
                (e.strip(), d_norm, u.strip(), lang, lemma, translit, morph, gloss, meaning, meaning_plain),
            )
            n_lex += 1
    return n_lex, n_names


# ---------------------------------------------------------------------------
# LSJ parser — structured JSON
# ---------------------------------------------------------------------------
class LSJStripper(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in ("br", "level2", "level3"):
            self.buf.append(" ")

    def handle_endtag(self, tag):
        if tag in ("br", "level2", "level3"):
            self.buf.append(" ")

    def handle_data(self, data):
        self.buf.append(data)

    def text(self) -> str:
        return WS_RE.sub(" ", "".join(self.buf)).strip()


def lsj_to_json(html: str) -> tuple[str, str]:
    """Return (meaning_json, meaning_plain)."""
    plain_parser = LSJStripper()
    plain_parser.feed(html or "")
    plain = plain_parser.text()
    # Structured: split by <Level2> / <Level3> / <BR />
    # For v1 we store a simple structure: {"html": original, "plain": plain}.
    # Future: parse into {"senses": [...], "citations": [...]}.
    obj = {"plain": plain}
    return json.dumps(obj, ensure_ascii=False), plain


def load_lsj(out: sqlite3.Connection) -> int:
    n = 0
    for path, source in [
        (DATA / "TFLSJ.txt", "LSJ"),
        (DATA / "TFLSJ-extra.txt", "LSJ-extra"),
    ]:
        if not path.exists():
            continue
        lines = read_tsv_lines(path)
        start = 0
        for i, ln in enumerate(lines):
            if re.match(r"^eStrong[^\t]*\tdStrong\t", ln):
                start = i + 1
                break
        for ln in lines[start:]:
            if not ln.strip() or ln.startswith("$") or ln.startswith("="):
                continue
            cols = ln.split("\t")
            if len(cols) < 8:
                continue
            e, d, u, lemma, translit, morph, gloss, meaning = cols[:8]
            d_norm = d.replace(" =", "").strip().split()[0] if d else d
            mj, mp = lsj_to_json(meaning)
            out.execute(
                "INSERT OR IGNORE INTO lex_lsj"
                "(estrong,dstrong,ustrong,lemma,translit,morph,gloss,meaning_json,meaning_plain,source)"
                " VALUES(?,?,?,?,?,?,?,?,?,?)",
                (e.strip(), d_norm, u.strip(), lemma, translit, morph, gloss, mj, mp, source),
            )
            n += 1
    return n


# ---------------------------------------------------------------------------
# Cross-reference ETL
# ---------------------------------------------------------------------------

def _download_openbible() -> bool:
    """Download and cache OpenBible cross-reference TSV. Returns True on success."""
    if OPENBIBLE_CACHE.exists():
        return True
    print("  Downloading OpenBible cross-references from openbible.info…")
    try:
        req = urllib.request.Request(
            OPENBIBLE_URL,
            headers={"User-Agent": "bcv-claude/build"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            names = zf.namelist()
            txt_names = [n for n in names if n.endswith(".txt")]
            if not txt_names:
                print(f"  WARNING: no .txt file in OpenBible zip (found: {names})")
                return False
            content = zf.read(txt_names[0]).decode("utf-8")
        OPENBIBLE_CACHE.write_text(content, encoding="utf-8")
        print(f"  Cached OpenBible data → {OPENBIBLE_CACHE.name}")
        return True
    except Exception as exc:
        print(f"  WARNING: Could not download OpenBible data: {exc}")
        print(f"  Cross-references will be empty. To add manually:")
        print(f"    curl -L {OPENBIBLE_URL} -o /tmp/cr.zip && unzip -p /tmp/cr.zip > {OPENBIBLE_CACHE}")
        return False


def _parse_osis_ref(ref: str) -> tuple[int, int, int, int | None] | None:
    """Parse 'Gen.1.1' or 'Gen.1.1-3' → (book_id, chapter, verse_start, verse_end)."""
    parts = ref.strip().split(".")
    if len(parts) < 3:
        return None
    book_raw = parts[0]
    try:
        chapter = int(parts[1])
        verse_raw = parts[2]
        if "-" in verse_raw:
            vs_parts = verse_raw.split("-", 1)
            vs_digits = "".join(c for c in vs_parts[0] if c.isdigit())
            ve_digits = "".join(c for c in vs_parts[1] if c.isdigit())
            verse_start = int(vs_digits) if vs_digits else 0
            verse_end: int | None = int(ve_digits) if ve_digits else None
        else:
            digits = "".join(c for c in verse_raw if c.isdigit())
            verse_start = int(digits) if digits else 0
            verse_end = None
        book_id = resolve_book(book_raw)
        if book_id is None or verse_start == 0:
            return None
        return (book_id, chapter, verse_start, verse_end)
    except (ValueError, IndexError):
        return None


def load_openbible_cross_refs(out: sqlite3.Connection) -> tuple[int, int]:
    """Load OpenBible cross-references. Returns (loaded, skipped)."""
    if not _download_openbible():
        return (0, 0)
    lines = OPENBIBLE_CACHE.read_text(encoding="utf-8").splitlines()
    batch: list[tuple] = []
    skipped = 0
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        # Skip header row
        if parts[0].lower() in ("from verse", "from", "from_verse"):
            continue
        from_ref = parts[0].strip()
        to_ref = parts[1].strip()
        votes: int | None = None
        if len(parts) >= 3:
            v_str = parts[2].strip()
            if v_str.lstrip("-").isdigit():
                votes = int(v_str)
        src = _parse_osis_ref(from_ref)
        tgt = _parse_osis_ref(to_ref)
        if src is None or tgt is None:
            skipped += 1
            continue
        src_book, src_ch, src_vs, _ = src
        tgt_book, tgt_ch, tgt_vs_start, tgt_vs_end = tgt
        batch.append((
            src_book, src_ch, src_vs,
            tgt_book, tgt_ch, tgt_vs_start, tgt_vs_end,
            votes, "openbible",
        ))
    out.executemany(
        """INSERT OR IGNORE INTO cross_refs
           (source_book_id, source_chapter, source_verse,
            target_book_id, target_chapter, target_verse_start, target_verse_end,
            votes, source_dataset)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        batch,
    )
    return (len(batch), skipped)


def load_josephilipraja_cross_refs(out: sqlite3.Connection) -> tuple[int, int]:
    """Load josephilipraja/bible-cross-reference-json (GPL-2.0, optional).
    Place JSON files under data/josephilipraja/ to enable. Not bundled by default."""
    if not JOSEPHILIPRAJA_DIR.exists():
        return (0, 0)
    batch: list[tuple] = []
    skipped = 0
    for json_path in sorted(JOSEPHILIPRAJA_DIR.glob("*.json")):
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        for verse_key, verse_obj in data.items():
            if not isinstance(verse_obj, dict):
                continue
            refs = verse_obj.get("r", {})
            if not isinstance(refs, dict):
                continue
            src = _parse_osis_ref(verse_key.replace(".", "."))
            if src is None:
                # Try "Book Chapter:Verse" format
                src = _parse_ref_colon(verse_key)
            if src is None:
                skipped += 1
                continue
            src_book, src_ch, src_vs, _ = src
            for target_key in refs:
                tgt = _parse_osis_ref(target_key)
                if tgt is None:
                    tgt = _parse_ref_colon(target_key)
                if tgt is None:
                    skipped += 1
                    continue
                tgt_book, tgt_ch, tgt_vs_start, tgt_vs_end = tgt
                batch.append((
                    src_book, src_ch, src_vs,
                    tgt_book, tgt_ch, tgt_vs_start, tgt_vs_end,
                    None, "josephilipraja",
                ))
    if batch:
        out.executemany(
            """INSERT OR IGNORE INTO cross_refs
               (source_book_id, source_chapter, source_verse,
                target_book_id, target_chapter, target_verse_start, target_verse_end,
                votes, source_dataset)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            batch,
        )
    return (len(batch), skipped)


_COLON_REF_RE = re.compile(r"^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$")


def _parse_ref_colon(ref: str) -> tuple[int, int, int, int | None] | None:
    """Parse 'Genesis 1:1' or 'Genesis 1:1-3' format."""
    m = _COLON_REF_RE.match(ref.strip())
    if not m:
        return None
    book_id = resolve_book(m.group(1))
    if book_id is None:
        return None
    ch = int(m.group(2))
    vs = int(m.group(3))
    ve: int | None = int(m.group(4)) if m.group(4) else None
    return (book_id, ch, vs, ve)


# ---------------------------------------------------------------------------
# Build pipeline
# ---------------------------------------------------------------------------
def build_core() -> None:
    if OUT_DB.exists():
        OUT_DB.unlink()
    conn = sqlite3.connect(OUT_DB)
    conn.executescript("PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF;")
    conn.executescript(SCHEMA_CORE)

    conn.executemany(
        "INSERT INTO book_meta(id,abbr3,osis,name,testament,chapters) VALUES(?,?,?,?,?,?)",
        [(i + 1, a, o, n, t, c) for i, (a, o, n, t, c) in enumerate(BOOKS)],
    )

    # lex_brief MUST load before tokens so gloss enrichment has data to join against
    nl, nn = load_lex_brief(conn)
    print(f"  lex_brief:       {nl}")
    print(f"  lex_names:       {nn}")
    conn.commit()

    print("  nasb verses:    ", load_nasb(conn))
    print("  kjv verses:     ", load_plain_text(conn, DATA / "kjv.txt", "KJV"))
    print("  asv verses:     ", load_plain_text(conn, DATA / "asv.txt", "ASV"))
    print("  leb verses:     ", load_leb(conn))
    print("  heb verses:     ", load_heb_verses(conn))
    print("  gnt verses:     ", load_gnt_verses(conn))
    print("  heb tokens:     ", load_tokens_heb(conn))
    print("  gnt tokens:     ", load_tokens_gnt(conn))
    print("  lxx tokens:     ", load_tokens_lxx(conn))

    conn.commit()
    n_cr, sk_cr = load_openbible_cross_refs(conn)
    print(f"  cross_refs (OpenBible): {n_cr} loaded, {sk_cr} skipped")
    n_jp, sk_jp = load_josephilipraja_cross_refs(conn)
    if n_jp:
        print(f"  cross_refs (josephilipraja): {n_jp} loaded, {sk_jp} skipped")
    conn.commit()
    print("  rebuilding FTS…")
    conn.execute("INSERT INTO verses_fts(verses_fts) VALUES('rebuild')")
    conn.execute("INSERT INTO tokens_fts(tokens_fts) VALUES('rebuild')")
    conn.commit()
    conn.execute("ANALYZE")
    conn.commit()
    conn.close()
    # VACUUM in a separate connection
    c2 = sqlite3.connect(OUT_DB)
    c2.execute("VACUUM")
    c2.close()
    print(f"  → {OUT_DB} ({OUT_DB.stat().st_size // (1024*1024)} MB)")


def build_lsj() -> None:
    if LSJ_DB.exists():
        LSJ_DB.unlink()
    conn = sqlite3.connect(LSJ_DB)
    conn.executescript("PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF;")
    conn.executescript(SCHEMA_LSJ)
    print("  lsj entries:    ", load_lsj(conn))
    conn.commit()
    conn.execute("INSERT INTO lex_lsj_fts(lex_lsj_fts) VALUES('rebuild')")
    conn.execute("ANALYZE")
    conn.commit()
    conn.close()
    c2 = sqlite3.connect(LSJ_DB)
    c2.execute("VACUUM")
    c2.close()
    print(f"  → {LSJ_DB} ({LSJ_DB.stat().st_size // (1024*1024)} MB)")


def main() -> None:
    print("Building bcv.db …")
    build_core()
    print("Building bcv-lsj.db …")
    build_lsj()
    print("Done.")


if __name__ == "__main__":
    main()
