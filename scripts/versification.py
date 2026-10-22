"""Map source verse numbering to the app's English (NASB) numbering using STEP's TVTMS.

TVTMS (CC BY 4.0) lists, for every verse where Bible traditions differ, how a
verse in a given Bible renumbers to STEP's Standard (NRSV-based) versification.
Each Expanded row applies only when its Tests are true for the Bible being
converted; the first passing row for a SourceRef wins. Verses without a row
keep their numbers.

    source --(rows whose tests pass for that source)--> Standard
    NASB   --(rows whose tests pass for NASB)---------> Standard, inverted

Downloads are explicit: python3 scripts/versification.py --download
"""
from __future__ import annotations
import argparse
from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import re
import shutil
from typing import Callable
import urllib.request

DATA = Path(__file__).resolve().parent.parent / "data" / "versification"
REVISION = "ed476a8ee6e3f7b3a46fc48af6c7dabc02387b1d"
FILE_NAME = "TVTMS.txt"
SOURCE_URL = (
    f"https://raw.githubusercontent.com/STEPBible/STEPBible-Data/{REVISION}/Versification/"
    "TVTMS%20-%20Translators%20Versification%20Traditions%20with%20Methodology%20for%20Standardisation"
    "%20for%20Eng%2BHeb%2BLat%2BGrk%2BOthers%20-%20STEPBible.org%20CC%20BY.txt"
)
CHECKSUM = "63058e0f20201af4bdaa7d830da5be8f493455d947c5f147d84840b33db9ddf8"
ATTRIBUTION = "TVTMS versification data created by STEP Bible (Tyndale House Cambridge), https://github.com/STEPBible/STEPBible-Data; CC BY 4.0."

# TVTMS uses the Paratext/USX book codes.
BOOK_CODES = (
    "Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam "
    "Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php "
    "Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev"
).split()
BOOK_ID = {code.lower(): i for i, code in enumerate(BOOK_CODES, 1)}

TITLE = 0  # Psalm titles are verse 0 in this module.


@dataclass(frozen=True)
class Ref:
    book: int
    chapter: int
    verse: int
    part: str = ""  # TVTMS subverse ("a", "b", "0", …); "" = whole verse


@dataclass
class Row:
    source_type: str
    src: Ref
    std: Ref | None  # None = no canonical counterpart (Greek Esther additions, apocrypha)
    action: str
    tests: list[str] = field(default_factory=list)


REF_RE = re.compile(r"^([1-4]?[A-Za-z]{2,3})\.(\d+|[A-F]):(Title|\d+)(?:(?:!|\.)([a-z]\d?|\d+))?")


def parse_ref(text: str) -> Ref | None:
    """First reference of a TVTMS cell ("Gen.31:55", "Psa.3:Title", "Exo.28:22!c", "Gen.5:32; 6:1")."""
    m = REF_RE.match(text.strip())
    if not m or m.group(1).lower() not in BOOK_ID or not m.group(2).isdigit():
        return None
    verse = TITLE if m.group(3) == "Title" else int(m.group(3))
    return Ref(BOOK_ID[m.group(1).lower()], int(m.group(2)), verse, m.group(4) or "")


def checksum(path: Path) -> str:
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def download(directory: Path = DATA) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / FILE_NAME
    if not path.exists() or checksum(path) != CHECKSUM:
        temp = path.with_suffix(".part")
        with urllib.request.urlopen(SOURCE_URL, timeout=90) as source, temp.open("wb") as out:
            shutil.copyfileobj(source, out)
        if checksum(temp) != CHECKSUM:
            temp.unlink()
            raise ValueError(f"Checksum mismatch: {FILE_NAME}")
        temp.replace(path)
    manifest = {FILE_NAME: {"url": SOURCE_URL, "revision": REVISION, "sha256": CHECKSUM}}
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def load_rows(path: Path = DATA / FILE_NAME, verify: bool = True) -> list[Row]:
    if verify and (not path.exists() or checksum(path) != CHECKSUM):
        raise ValueError(f"Missing or changed TVTMS source: {path}; run --download")
    lines = path.read_text(encoding="utf-8-sig").split("\n")
    start = next(i for i, line in enumerate(lines) if line.startswith("#DataStart(Expanded)"))
    end = next(i for i, line in enumerate(lines) if line.startswith("#DataEnd(Expanded)"))
    rows = []
    for line in lines[start + 1:end]:
        f = line.split("\t")
        if len(f) < 9 or not f[1].strip() or f[0] == "SourceType" or f[0].startswith("'"):
            continue
        src = parse_ref(f[1])
        if src is None:
            continue
        tests = [t.strip() for t in f[8].split("&") if t.strip()]
        rows.append(Row(f[0].strip(), src, parse_ref(f[2]), f[3].strip().rstrip("*"), tests))
    return rows


# ---------------------------------------------------------------------------
# Test evaluation against a concrete Bible
# ---------------------------------------------------------------------------
@dataclass
class Inventory:
    """What a Bible contains: words per verse (and per subverse), and Psalm titles."""
    words: dict[tuple[int, int, int], int] = field(default_factory=dict)
    subverses: dict[tuple[int, int, int], dict[int, int]] = field(default_factory=dict)  # subverse n → words
    titles: set[tuple[int, int]] = field(default_factory=set)
    last: dict[tuple[int, int], int] = field(default_factory=dict)

    def add(self, book: int, chapter: int, verse: int, words: int, subverse: int = 0) -> None:
        key = (book, chapter, verse)
        if subverse:
            self.subverses.setdefault(key, {})[subverse] = self.subverses.get(key, {}).get(subverse, 0) + words
        self.words[key] = self.words.get(key, 0) + words
        if verse > self.last.get((book, chapter), 0):
            self.last[(book, chapter)] = verse


TERM_RE = re.compile(r"^([1-4]?[A-Za-z]{2,3})\.(\d+):(\d+)(?:\.(\d+))?(?:\*(\d+))?$")


def _term_words(term: str, inv: Inventory) -> int | None:
    total = 0
    for part in term.split("+"):
        m = TERM_RE.match(part.strip())
        if not m or m.group(1).lower() not in BOOK_ID:
            return None
        key = (BOOK_ID[m.group(1).lower()], int(m.group(2)), int(m.group(3)))
        words = inv.words.get(key, 0)
        if m.group(4) is not None:  # ".0" = the verse without its added subverses
            sub = inv.subverses.get(key, {})
            words = words - sum(sub.values()) if m.group(4) == "0" else sub.get(int(m.group(4)), 0)
        total += words * int(m.group(5) or 1)
    return total


def evaluate(test: str, inv: Inventory) -> bool | None:
    """True/False for a TVTMS test; None when the test names something outside the 66 books."""
    m = re.match(r"^([1-4]?[A-Za-z]{2,3})\.(\d+):TextBeforeV1=(Exist|NotExist)$", test)
    if m:
        book = BOOK_ID.get(m.group(1).lower())
        if book is None:
            return None
        has = (book, int(m.group(2))) in inv.titles
        return has if m.group(3) == "Exist" else not has
    m = re.match(r"^([1-4]?[A-Za-z]{2,3})\.(\d+|[A-F]):(\d+)(?:\.(\d+))?=(Exist|NotExist|Last)$", test)
    if m:
        book = BOOK_ID.get(m.group(1).lower())
        if book is None or not m.group(2).isdigit():
            return None
        key = (book, int(m.group(2)), int(m.group(3)))
        if m.group(4) is not None:
            exists = len(inv.subverses.get(key, {})) >= int(m.group(4))
        else:
            exists = inv.words.get(key, 0) > 0
        if m.group(5) == "Last":
            return inv.last.get(key[:2]) == key[2]
        return exists if m.group(5) == "Exist" else not exists
    m = re.match(r"^(.+?)([<>])(.+)$", test)
    if m:
        a, b = _term_words(m.group(1), inv), _term_words(m.group(3), inv)
        if a is None or b is None:
            return None
        return a < b if m.group(2) == "<" else a > b
    return None


def derive_map(rows: list[Row], inv: Inventory) -> dict[Ref, Row]:
    """For each SourceRef in this Bible, the first row whose tests all pass."""
    chosen: dict[Ref, Row] = {}
    for row in rows:
        if row.src in chosen:
            continue
        results = [evaluate(t, inv) for t in row.tests]
        if results and all(r is True for r in results):
            chosen[row.src] = row
    return chosen


def tradition_map(rows: list[Row], tradition: str) -> dict[Ref, Row]:
    """Rows for a named tradition (e.g. "Hebrew"), for sources we cannot test, such as lexicon citations."""
    chosen: dict[Ref, Row] = {}
    for row in rows:
        if tradition in row.source_type.split("+") and row.src not in chosen:
            chosen[row.src] = row
    return chosen


@dataclass
class Mapper:
    """source → Standard → NASB. Refs without an entry keep their numbers."""
    to_standard: dict[Ref, Row]
    standard_to_nasb: dict[Ref, Ref]

    def map(self, ref: Ref) -> Ref | None:
        row = self.to_standard.get(ref) or (self.to_standard.get(Ref(ref.book, ref.chapter, ref.verse)) if ref.part else None)
        std = ref if row is None else row.std
        if std is None:
            return None
        if std.part and std in self.standard_to_nasb:
            return self.standard_to_nasb[std]
        # English Bibles number a Psalm title as part of verse 1.
        whole = Ref(std.book, std.chapter, std.verse or 1)
        return self.standard_to_nasb.get(whole, whole)


Verse = tuple[int, int, int]  # (book, chapter, verse) in English numbering

SCHEMA = """
CREATE TABLE versification_map (
  tradition   TEXT NOT NULL,      -- 'Heb' (lexicon citations), 'LXX', 'GNT'
  src_book_id INTEGER NOT NULL,
  src_chapter INTEGER NOT NULL,
  src_verse   INTEGER NOT NULL,
  book_id     INTEGER,            -- NULL = no English counterpart
  chapter     INTEGER,
  verse       INTEGER,
  how         TEXT NOT NULL,      -- tvtms | override | content | collision | none
  PRIMARY KEY (tradition, src_book_id, src_chapter, src_verse)
);
"""

_STOP = set(
    "the a an and of to in for on with by from at as is be was were are it he she they his her their them him "
    "you your i me my we our us that this these those which who whom not no but or so if then there all will "
    "shall have has had do did said say says lord god".split()
)


def content_words(text: str | None) -> frozenset[str]:
    """Distinctive English words, for comparing a verse's glosses with an English verse."""
    return frozenset(w for w in re.findall(r"[a-z]+", (text or "").lower()) if len(w) > 2 and w not in _STOP)


def window_scorer(source: dict[Verse, frozenset[str]], english: dict[Verse, frozenset[str]]) -> Callable[[Verse, Verse], float]:
    """Gloss overlap averaged over a five-verse window, which keeps short verses from matching by chance."""
    def score(src: Verse, target: Verse) -> float:
        total = n = 0
        for k in range(-2, 3):
            glosses = source.get((src[0], src[1], src[2] + k))
            if glosses:
                words = english.get((target[0], target[1], target[2] + k))
                total += len(glosses & words) / len(glosses) if words else 0
                n += 1
        return total / n if n else 0.0
    return score


def _block(book: int, chapter: int, verses: range, to_chapter: int, offset: int) -> dict[Verse, Verse]:
    return {(book, chapter, v): (book, to_chapter, v + offset) for v in verses}


# CATSS LXX numbering that TVTMS does not describe, checked against verse content:
#   Prov 32–36 hold MT/English Prov 25–29.
#   Mal 3:22–24 use Hebrew chapter numbers but Greek verse order (Elijah, then Moses).
#   Jer 30 joins Rahlfs' oracles: Edom, Ammon, Kedar/Hazor, Damascus (MT 49).
#   Lam 0:1 is the LXX prologue, with no English counterpart.
CATSS_OVERRIDES: dict[Verse, Verse | None] = {
    **{k: v for c in range(32, 37) for k, v in _block(20, c, range(1, 40), c - 7, 0).items()},
    (39, 3, 22): (39, 4, 5), (39, 3, 23): (39, 4, 6), (39, 3, 24): (39, 4, 4),
    **_block(24, 30, range(1, 17), 49, 6),
    **_block(24, 30, range(17, 22), 49, -16),
    **_block(24, 30, range(23, 29), 49, 5),
    **_block(24, 30, range(29, 34), 49, -6),
    (25, 0, 1): None,
}


@dataclass
class Placement:
    target: Verse | None  # None = no English counterpart
    how: str  # override | tvtms | content | identity | none


def place_edition(
    rows: list[Row],
    inv: Inventory,
    standard_to_nasb: dict[Ref, Ref],
    english: set[Verse],
    score: Callable[[Verse, Verse], float],
    overrides: dict[Verse, Verse | None],
    margin: float = 0.05,
) -> dict[Verse, Placement]:
    """English verse for every verse of an edition (e.g. CATSS LXX).

    1. A hand override for an edition quirk TVTMS does not describe.
    2. The first TVTMS row whose tests pass for this edition.
    3. Otherwise the edition differs from every tradition TVTMS tests for (CATSS
       splits a verse in LXX Jer 25, so every "Jer.25:19=Last" test fails). Choose
       among identity and the targets TVTMS lists for the verse, using `score`
       (content similarity of a source verse to an English verse). Moving away from
       identity needs a `margin`. Candidates stay within TVTMS's own equivalences,
       because free search confuses parallel passages such as Exod 26 and 36.
    """
    passing = derive_map(rows, inv)
    options: dict[Ref, list[Ref]] = {}
    for row in rows:
        if row.std is not None:
            options.setdefault(row.src, []).append(row.std)
    mapper = Mapper(passing, standard_to_nasb)

    def english_of(std: Ref) -> Verse:
        ref = standard_to_nasb.get(Ref(std.book, std.chapter, std.verse or 1), Ref(std.book, std.chapter, std.verse or 1))
        return (ref.book, ref.chapter, ref.verse)

    placed: dict[Verse, Placement] = {}
    for verse in sorted(inv.words):
        ref = Ref(*verse)
        if verse in overrides:
            placed[verse] = Placement(overrides[verse], "override" if overrides[verse] else "none")
        elif ref in passing:
            target = mapper.map(ref)
            placed[verse] = Placement(None if target is None else (target.book, target.chapter, target.verse), "tvtms" if target else "none")
        elif ref in options:
            candidates = {english_of(std) for std in options[ref]} & english
            best = max(candidates, key=lambda t: score(verse, t), default=None)
            if verse in english and (best is None or score(verse, best) < score(verse, verse) + margin):
                placed[verse] = Placement(verse, "identity")
            else:
                placed[verse] = Placement(best, "content" if best else "none")
        else:
            placed[verse] = Placement(verse if verse in english else None, "identity" if verse in english else "none")

    # Two source verses on one English verse are usually a real merge (an LXX Psalm
    # title plus v1). But when one placement is backed by content (override or
    # content match) and a test- or identity-based one scores clearly lower, the
    # tests misled: CATSS Exod 36:8 passes the Hebrew tests while its text is Eng
    # 39:1. That weaker placement is dropped rather than shown under the wrong verse.
    by_target: dict[Verse, list[Verse]] = {}
    for verse, p in placed.items():
        if p.target:
            by_target.setdefault(p.target, []).append(verse)
    for target, sources in by_target.items():
        backed = [s for s in sources if placed[s].how in ("override", "content")]
        if not backed:
            continue
        best = max(score(s, target) for s in backed)
        for s in sources:
            if placed[s].how in ("tvtms", "identity") and score(s, target) <= best - 0.1:
                placed[s] = Placement(None, "collision")
    return placed


def standard_to_english(rows: list[Row], nasb: Inventory) -> dict[Ref, Ref]:
    """Invert NASB → Standard; only verses whose number actually changes are kept.

    When NASB splits a Standard verse (3 John 14 → NASB 14–15), the whole Standard
    verse maps to the first NASB verse, and each part (14!a, 14!b) to its own
    verse, so a source that splits the same way keeps its numbering.
    """
    out: dict[Ref, Ref] = {}
    for src, row in sorted(derive_map(rows, nasb).items(), key=lambda item: (item[0].book, item[0].chapter, item[0].verse)):
        if row.std is None or src.part:
            continue
        target = Ref(src.book, src.chapter, src.verse)
        if row.std.part:
            out.setdefault(row.std, target)
        out.setdefault(Ref(row.std.book, row.std.chapter, row.std.verse), target)
    return {std: nasb for std, nasb in out.items() if std != nasb}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--download", action="store_true", required=True)
    parser.parse_args()
    download()
