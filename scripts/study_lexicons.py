"""Import openly licensed study lexicons. Keep CC BY-SA adaptations in their own tables.

Run `python3 scripts/study_lexicons.py --download` to fetch pinned BDB/UBS sources.
The database builder imports this module; source downloads are explicit, never implicit.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
SOURCES = DATA / "study-sources"
BDB_REV = "21c9add13bc727d3a951361778e97e3ff7afd1ce"
UBS_REV = "33dcc8c671511151551804e073f1d461bc5d5b1a"
DOWNLOADS = {
    **{name: f"https://raw.githubusercontent.com/openscriptures/HebrewLexicon/{BDB_REV}/{name}"
       for name in ("BrownDriverBriggs.xml", "LexicalIndex.xml", "AugIndex.xml", "readme.md")},
    **{name: f"https://raw.githubusercontent.com/ubsicap/ubs-open-license/{UBS_REV}/{path}"
       for name, path in {
           "ubs-greek.json": "dictionaries/greek/JSON/UBSGreekNTDic-v1.1-en.JSON",
           "ubs-hebrew.json": "dictionaries/hebrew/JSON/UBSHebrewDic-v0.9.3-en.JSON",
           "ubs-LICENSE.md": "LICENSE.md", "ubs-README.md": "README.md",
       }.items()},
}
NS = {"h": "http://openscriptures.github.com/morphhb/namespace"}
SCHEMA = """
CREATE TABLE IF NOT EXISTS study_sources (
  id TEXT PRIMARY KEY, revision TEXT NOT NULL, attribution TEXT NOT NULL,
  license TEXT NOT NULL, url TEXT NOT NULL, changes TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS study_entries (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, lang TEXT NOT NULL,
  lemma TEXT NOT NULL, lemma_key TEXT NOT NULL, senses TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS study_lemma ON study_entries(lang, lemma_key, source);
CREATE TABLE IF NOT EXISTS study_strongs (
  entry_id TEXT NOT NULL, strong TEXT NOT NULL, PRIMARY KEY(entry_id, strong)
);
CREATE INDEX IF NOT EXISTS study_strong ON study_strongs(strong);
"""


def lemma_key(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value)
                   if not unicodedata.category(c).startswith("M")).lower().strip()


def strong_key(value: str) -> str:
    # UBS marks Aramaic with A; this app uses Hebrew Strong's numbers for both.
    match = re.fullmatch(r"([HGAhga])0*(\d+)([a-zA-Z]*)", value.strip())
    if not match:
        return ""
    lang, number, suffix = match.groups()
    return ("G" if lang.upper() == "G" else "H") + number.zfill(4) + suffix


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def text(node: ET.Element | None) -> str:
    return compact("".join(node.itertext())) if node is not None else ""


def xml_text(node: ET.Element) -> str:
    """Preserve paragraph boundaries and suppress transcription status metadata."""
    tag = node.tag.rsplit("}", 1)[-1]
    if tag == "status":
        return ""
    prefix = "\n" if tag == "sense" else ""
    if tag == "sense" and node.get("n"):
        prefix += node.get("n", "") + ". "
    value = prefix + (node.text or "")
    for child in node:
        value += xml_text(child) + (child.tail or "")
    return value


def add_entry(conn: sqlite3.Connection, source: str, entry_id: str, lang: str,
              lemma: str, strongs: list[str], senses: list[dict]) -> None:
    if not lemma or not senses:
        return
    key = f"{source}:{entry_id}"
    conn.execute("INSERT OR REPLACE INTO study_entries VALUES(?,?,?,?,?,?)",
                 (key, source, lang, lemma, lemma_key(lemma), json.dumps(senses, ensure_ascii=False)))
    for strong in strongs:
        normalized = strong_key(strong)
        if normalized:
            conn.execute("INSERT OR IGNORE INTO study_strongs VALUES(?,?)", (key, normalized))


def load_bdb(conn: sqlite3.Connection, sources: Path) -> int:
    entries = {e.get("id"): e for e in ET.parse(sources / "BrownDriverBriggs.xml").findall(".//h:entry", NS)}
    index = {e.get("id"): e for e in ET.parse(sources / "LexicalIndex.xml").findall(".//h:entry", NS)}
    augmented: dict[str, list[str]] = {}
    for word in ET.parse(sources / "AugIndex.xml").findall("h:w", NS):
        augmented.setdefault(text(word), []).append("H" + word.get("aug", ""))
    count = 0
    for key, item in index.items():
        xref = item.find("h:xref", NS)
        node = entries.get(xref.get("bdb")) if xref is not None else None
        if node is None:
            continue
        definition = "\n".join(compact(line) for line in xml_text(node).splitlines() if compact(line))
        strongs = list(augmented.get(key, []))
        if xref.get("strong"):
            strongs.append("H" + xref.get("strong"))
        senses = [{"definition": definition, "glosses": [text(item.find("h:def", NS))],
                   "domains": [], "references": list(dict.fromkeys(
                       r.get("r") for r in node.findall(".//h:ref", NS) if r.get("r"))),
                   "note": "", "code": node.get("id", "")}]
        add_entry(conn, "bdb", key, "Heb", text(item.find("h:w", NS)), strongs, senses)
        count += 1
    return count


def ubs_text(value: str, books: list[tuple] = ()) -> str:
    # UBS inline style markers, not markup to be rendered as HTML.
    value = re.sub(r"\{L:([^{}]+)\}", lambda m: re.sub(r"<[^>]*>", "", m[1]), value or "")
    value = re.sub(r"\{S:([^{}]+)\}", lambda m: '; '.join(dict.fromkeys(
        ubs_reference(code, books) for code in re.findall(r'\d{14}', m[1]))) or m[1], value)
    value = re.sub(r"\{D:([^{}]+)\}", r"semantic entry \1", value)
    value = re.sub(r"\{N:(\d+)\}", lambda m: f"[note {int(m[1])}]", value)
    value = re.sub(r"\{A:([^{}]+)\}", r"\1", value)
    return re.sub(r"\|i\*?", "", value).replace("|", "\n").strip()


def ubs_reference(value: str, books: list[tuple]) -> str:
    # BBBCCCVVVWWWWW: 3 digits each for book/chapter/verse; remainder is word offset.
    if not re.fullmatch(r"\d{14}", value):
        return value
    book, chapter, verse = int(value[:3]), int(value[3:6]), int(value[6:9])
    if not 1 <= book <= len(books):
        return value
    name = books[book - 1][2]
    return f"{name} {chapter}:{verse}" if chapter and verse else f"{name} (title)"


def load_ubs(conn: sqlite3.Connection, sources: Path, lang: str, books: list[tuple]) -> int:
    source = "ubs-hebrew" if lang == "Heb" else "ubs-greek"
    entries = json.loads((sources / f"{source}.json").read_text(encoding="utf-8-sig"))
    count = 0
    for entry in entries:
        senses = []
        notes = {str(int(n["Caller"])): n["Content"] for n in entry.get("Notes") or []
                 if n.get("LanguageCode") == "en" and str(n.get("Caller", "")).isdigit()}
        for base in entry.get("BaseForms") or []:
            for meaning in base.get("LEXMeanings") or []:
                for sense in meaning.get("LEXSenses") or []:
                    if sense.get("LanguageCode") != "en":
                        continue
                    raw_definition = sense.get("DefinitionLong") or sense.get("DefinitionShort", "")
                    raw_note = sense.get("Comments", "") or ""
                    definition = ubs_text(raw_definition, books)
                    if not definition:
                        continue
                    callers = list(dict.fromkeys(str(int(code)) for code in re.findall(r"\{N:(\d+)\}", raw_definition + raw_note)))
                    rendered_notes = [ubs_text(raw_note, books)] + [f"Note {code}: {ubs_text(notes[code], books)}" for code in callers if code in notes]
                    senses.append({"definition": definition, "glosses": sense.get("Glosses") or [],
                                   "domains": list(dict.fromkeys(
                                       d["Domain"] for d in (meaning.get("LEXDomains") or []) +
                                       (meaning.get("LEXSubDomains") or []) if d.get("Domain"))),
                                   "references": list(dict.fromkeys(
                                       ubs_reference(r, books) for r in meaning.get("LEXReferences") or [])),
                                   "note": "\n".join(n for n in rendered_notes if n),
                                   "code": meaning.get("LEXEntryCode") or meaning["LEXID"]})
        if senses:
            add_entry(conn, source, entry["MainId"], lang, entry["Lemma"], entry.get("StrongCodes") or [], senses)
            count += 1
    return count


def load_study(conn: sqlite3.Connection, books: list[tuple], sources: Path = SOURCES,
               lsj_loader=None) -> dict[str, int]:
    # Fail before publication if required files are missing instead of silently shipping partial data.
    for name in DOWNLOADS:
        if not (sources / name).exists():
            raise FileNotFoundError(f"Missing {name}; run python3 scripts/study_lexicons.py --download")
    conn.executescript(SCHEMA)
    counts = {"bdb": load_bdb(conn, sources), "ubs-greek": load_ubs(conn, sources, "Grk", books),
              "ubs-hebrew": load_ubs(conn, sources, "Heb", books)}
    if lsj_loader:
        temp = sqlite3.connect(":memory:")
        # Reuse the established STEP parser, keeping LSJ adaptations separate from UBS.
        from build_db import SCHEMA_LSJ
        temp.executescript(SCHEMA_LSJ)
        if not lsj_loader(temp):
            raise ValueError("No LSJ entries; supply data/TFLSJ.txt")
        for row in temp.execute("SELECT rowid,estrong,dstrong,ustrong,lemma,gloss,meaning_plain,meaning_json FROM lex_lsj"):
            ident, e, d, u, lemma, gloss, definition, structured = row
            add_entry(conn, "lsj", str(ident), "Grk", lemma, [e, d, u or ""],
                      [{"definition": definition, "glosses": [gloss], "domains": [],
                        "references": json.loads(structured).get("citations", []), "note": "", "code": e}])
        temp.close()
        counts["lsj"] = conn.execute("SELECT count(*) FROM study_entries WHERE source='lsj'").fetchone()[0]
    changes = "Converted XML/JSON or STEP TSV to SQLite; normalized lookup keys; rendered definitions as plain text. UBS style markers removed, internal links rendered as readable labels, footnotes retained, word offsets omitted from displayed references; semantic senses retained."
    metadata = [
        ("bdb", BDB_REV, "Open Scriptures Hebrew Bible Project. Brown, Driver, Briggs text is public domain.", "CC BY 4.0", "https://github.com/openscriptures/HebrewLexicon", changes),
        ("lsj", "local STEP TFLSJ files", "Data created by STEP Bible based on work at Tyndale House Cambridge.", "CC BY 4.0", "https://github.com/STEPBible/STEPBible-Data", changes),
        ("ubs-greek", UBS_REV, "UBS Dictionary of New Testament Greek © United Bible Societies 2023. Adapted from Semantic Dictionary of Biblical Greek, itself adapted from Louw and Nida © UBS 1988, 1989; Scripture references contributed by SIL.", "CC BY-SA 4.0", "https://github.com/ubsicap/ubs-open-license", changes),
        ("ubs-hebrew", UBS_REV, "UBS Dictionary of Biblical Hebrew © United Bible Societies 2023. Adapted from Semantic Dictionary of Biblical Hebrew © 2000–2023 United Bible Societies.", "CC BY-SA 4.0", "https://github.com/ubsicap/ubs-open-license", changes),
    ]
    conn.executemany("INSERT OR REPLACE INTO study_sources VALUES(?,?,?,?,?,?)", metadata)
    return counts


def download() -> None:
    SOURCES.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, url in DOWNLOADS.items():
        content = urllib.request.urlopen(url, timeout=90).read()
        (SOURCES / name).write_bytes(content)
        manifest[name] = {"url": url, "sha256": hashlib.sha256(content).hexdigest()}
        print(f"Downloaded {name}")
    (SOURCES / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", required=True)
    parser.parse_args()
    download()
