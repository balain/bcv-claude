#!/usr/bin/env python3
"""
Patch an existing bcv.db to add cross_refs data without a full rebuild.

Usage: python3 scripts/patch_cross_refs.py
"""
from __future__ import annotations

import io
import re
import sqlite3
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT_DB = DATA / "bcv.db"

OPENBIBLE_URL = "https://a.openbible.info/data/cross-references.zip"
OPENBIBLE_CACHE = DATA / "cross-references.txt"
JOSEPHILIPRAJA_DIR = DATA / "josephilipraja"

CROSS_REFS_SCHEMA = """
CREATE TABLE IF NOT EXISTS cross_refs (
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
CREATE INDEX IF NOT EXISTS idx_cross_refs_source
  ON cross_refs(source_book_id, source_chapter, source_verse, votes DESC);
CREATE INDEX IF NOT EXISTS idx_cross_refs_target
  ON cross_refs(target_book_id, target_chapter, target_verse_start);
"""

# ── book alias map (copied from build_db.py) ─────────────────────────────────

BOOKS = [
    ("Gen","Gen","Genesis","OT",50),("Exo","Exod","Exodus","OT",40),
    ("Lev","Lev","Leviticus","OT",27),("Num","Num","Numbers","OT",36),
    ("Deu","Deut","Deuteronomy","OT",34),("Jos","Josh","Joshua","OT",24),
    ("Jdg","Judg","Judges","OT",21),("Rut","Ruth","Ruth","OT",4),
    ("1Sa","1Sam","1 Samuel","OT",31),("2Sa","2Sam","2 Samuel","OT",24),
    ("1Ki","1Kgs","1 Kings","OT",22),("2Ki","2Kgs","2 Kings","OT",25),
    ("1Ch","1Chr","1 Chronicles","OT",29),("2Ch","2Chr","2 Chronicles","OT",36),
    ("Ezr","Ezra","Ezra","OT",10),("Neh","Neh","Nehemiah","OT",13),
    ("Est","Esth","Esther","OT",10),("Job","Job","Job","OT",42),
    ("Psa","Ps","Psalms","OT",150),("Pro","Prov","Proverbs","OT",31),
    ("Ecc","Eccl","Ecclesiastes","OT",12),("Sng","Song","Song of Solomon","OT",8),
    ("Isa","Isa","Isaiah","OT",66),("Jer","Jer","Jeremiah","OT",52),
    ("Lam","Lam","Lamentations","OT",5),("Eze","Ezek","Ezekiel","OT",48),
    ("Dan","Dan","Daniel","OT",12),("Hos","Hos","Hosea","OT",14),
    ("Joe","Joel","Joel","OT",3),("Amo","Amos","Amos","OT",9),
    ("Oba","Obad","Obadiah","OT",1),("Jon","Jonah","Jonah","OT",4),
    ("Mic","Mic","Micah","OT",7),("Nah","Nah","Nahum","OT",3),
    ("Hab","Hab","Habakkuk","OT",3),("Zep","Zeph","Zephaniah","OT",3),
    ("Hag","Hag","Haggai","OT",2),("Zec","Zech","Zechariah","OT",14),
    ("Mal","Mal","Malachi","OT",4),("Mat","Matt","Matthew","NT",28),
    ("Mar","Mark","Mark","NT",16),("Luk","Luke","Luke","NT",24),
    ("Jhn","John","John","NT",21),("Act","Acts","Acts","NT",28),
    ("Rom","Rom","Romans","NT",16),("1Co","1Cor","1 Corinthians","NT",16),
    ("2Co","2Cor","2 Corinthians","NT",13),("Gal","Gal","Galatians","NT",6),
    ("Eph","Eph","Ephesians","NT",6),("Phl","Phil","Philippians","NT",4),
    ("Col","Col","Colossians","NT",4),("1Th","1Thess","1 Thessalonians","NT",5),
    ("2Th","2Thess","2 Thessalonians","NT",3),("1Ti","1Tim","1 Timothy","NT",6),
    ("2Ti","2Tim","2 Timothy","NT",4),("Tit","Titus","Titus","NT",3),
    ("Phm","Phlm","Philemon","NT",1),("Heb","Heb","Hebrews","NT",13),
    ("Jas","Jas","James","NT",5),("1Pe","1Pet","1 Peter","NT",5),
    ("2Pe","2Pet","2 Peter","NT",3),("1Jn","1John","1 John","NT",5),
    ("2Jn","2John","2 John","NT",1),("3Jn","3John","3 John","NT",1),
    ("Jud","Jude","Jude","NT",1),("Rev","Rev","Revelation","NT",22),
]

BOOK_ID = {b[0]: i + 1 for i, b in enumerate(BOOKS)}


def _aliases() -> dict[str, str]:
    m: dict[str, str] = {}
    for abbr, osis, name, _, _ in BOOKS:
        m[abbr.lower()] = abbr
        m[osis.lower()] = abbr
        m[name.lower()] = abbr
        m[name.replace(" ", "").lower()] = abbr
    for old, new in [
        ("sol","Sng"),("phi","Phl"),("joh","Jhn"),
        ("jam","Jas"),("1jo","1Jn"),("2jo","2Jn"),("3jo","3Jn"),
    ]:
        m[old] = new
    for n, abbr in [
        ("1st samuel","1Sa"),("2nd samuel","2Sa"),
        ("1st kings","1Ki"),("2nd kings","2Ki"),
        ("1st chronicles","1Ch"),("2nd chronicles","2Ch"),
        ("psalm","Psa"),("song of solomon","Sng"),
        ("1 samuel","1Sa"),("2 samuel","2Sa"),
        ("1 kings","1Ki"),("2 kings","2Ki"),
        ("1 chronicles","1Ch"),("2 chronicles","2Ch"),
        ("1 corinthians","1Co"),("2 corinthians","2Co"),
        ("1 thessalonians","1Th"),("2 thessalonians","2Th"),
        ("1 timothy","1Ti"),("2 timothy","2Ti"),
        ("1 peter","1Pe"),("2 peter","2Pe"),
        ("1 john","1Jn"),("2 john","2Jn"),("3 john","3Jn"),
        ("song of songs","Sng"),
        ("i samuel","1Sa"),("ii samuel","2Sa"),
        ("i kings","1Ki"),("ii kings","2Ki"),
        ("i chronicles","1Ch"),("ii chronicles","2Ch"),
        ("i corinthians","1Co"),("ii corinthians","2Co"),
        ("i thessalonians","1Th"),("ii thessalonians","2Th"),
        ("i timothy","1Ti"),("ii timothy","2Ti"),
        ("i peter","1Pe"),("ii peter","2Pe"),
        ("i john","1Jn"),("ii john","2Jn"),("iii john","3Jn"),
        ("revelation of john","Rev"),
    ]:
        m[n] = abbr
    return m


ALIASES = _aliases()


def resolve_book(raw: str) -> int | None:
    k = raw.strip().lower()
    abbr = ALIASES.get(k)
    return BOOK_ID.get(abbr) if abbr else None


def _parse_osis_ref(ref: str) -> tuple[int, int, int, int | None] | None:
    parts = ref.strip().split(".")
    if len(parts) < 3:
        return None
    try:
        chapter = int(parts[1])
        verse_raw = parts[2]
        if "-" in verse_raw:
            vs_parts = verse_raw.split("-", 1)
            vs = int("".join(c for c in vs_parts[0] if c.isdigit()) or "0")
            ve_str = "".join(c for c in vs_parts[1] if c.isdigit())
            ve: int | None = int(ve_str) if ve_str else None
        else:
            digits = "".join(c for c in verse_raw if c.isdigit())
            vs = int(digits) if digits else 0
            ve = None
        book_id = resolve_book(parts[0])
        if book_id is None or vs == 0:
            return None
        return (book_id, chapter, vs, ve)
    except (ValueError, IndexError):
        return None


def download_openbible() -> bool:
    if OPENBIBLE_CACHE.exists():
        print(f"  Using cached {OPENBIBLE_CACHE.name}")
        return True
    print("  Downloading OpenBible cross-references…")
    try:
        req = urllib.request.Request(OPENBIBLE_URL, headers={"User-Agent": "bcv-claude/build"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            txt = [n for n in zf.namelist() if n.endswith(".txt")]
            if not txt:
                print(f"  ERROR: no .txt in zip (found {zf.namelist()})")
                return False
            content = zf.read(txt[0]).decode("utf-8")
        OPENBIBLE_CACHE.write_text(content, encoding="utf-8")
        print(f"  Cached → {OPENBIBLE_CACHE.name}")
        return True
    except Exception as e:
        print(f"  ERROR downloading: {e}")
        return False


def load_openbible(conn: sqlite3.Connection) -> tuple[int, int]:
    if not download_openbible():
        return 0, 0
    lines = OPENBIBLE_CACHE.read_text(encoding="utf-8").splitlines()
    batch = []
    skipped = 0
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        if parts[0].lower() in ("from verse", "from", "from_verse"):
            continue
        from_ref, to_ref = parts[0].strip(), parts[1].strip()
        votes: int | None = None
        if len(parts) >= 3:
            v = parts[2].strip()
            if v.lstrip("-").isdigit():
                votes = int(v)
        src = _parse_osis_ref(from_ref)
        tgt = _parse_osis_ref(to_ref)
        if src is None or tgt is None:
            skipped += 1
            continue
        batch.append((src[0], src[1], src[2], tgt[0], tgt[1], tgt[2], tgt[3], votes, "openbible"))
    conn.executemany(
        """INSERT OR IGNORE INTO cross_refs
           (source_book_id,source_chapter,source_verse,
            target_book_id,target_chapter,target_verse_start,target_verse_end,
            votes,source_dataset)
           VALUES(?,?,?,?,?,?,?,?,?)""",
        batch,
    )
    return len(batch), skipped


def main() -> None:
    if not OUT_DB.exists():
        print(f"ERROR: {OUT_DB} not found — run build_db.py first")
        return

    print(f"Patching {OUT_DB} …")
    conn = sqlite3.connect(OUT_DB)
    conn.executescript("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")

    # Check if already patched
    existing = conn.execute(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='cross_refs'"
    ).fetchone()[0]
    if existing:
        count = conn.execute("SELECT count(*) FROM cross_refs").fetchone()[0]
        if count > 0:
            print(f"  cross_refs already populated ({count} rows). Nothing to do.")
            conn.close()
            return
        print("  cross_refs table exists but is empty — repopulating…")
    else:
        print("  Creating cross_refs table…")
        conn.executescript(CROSS_REFS_SCHEMA)

    n, sk = load_openbible(conn)
    print(f"  OpenBible: {n} rows inserted, {sk} skipped")
    conn.commit()
    conn.execute("ANALYZE")
    conn.commit()
    conn.close()
    print(f"  Done. DB size: {OUT_DB.stat().st_size // (1024*1024)} MB")


if __name__ == "__main__":
    main()
