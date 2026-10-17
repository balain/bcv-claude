"""Import pinned MACULA Hebrew–LXX equivalents. Downloads are explicit; no inferred links."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import itertools
import json
from pathlib import Path
import re
import shutil
import sqlite3
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET

REVISION = '47db250bd55d0d8577f2a94fba114ef16c35b23c'
SOURCE_URL = f'https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/{REVISION}/sources/Clear/annotations/annotations.xml'
LICENSE_URL = f'https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/{REVISION}/LICENSE.md'
CHECKSUMS = {'annotations.xml': 'cccfac948b0ad14070d151dd2158c8a2b79c9e5666e9d44555fe4b553839292e',
             'LICENSE.md': 'df45ba3224e7d6f9dba3ec8fd2d0b3f1d2febb2620147c889667886fccd4d8e1'}
ATTRIBUTION = 'MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/; © 2022–2024 Biblica, Inc.; CC BY 4.0.'
SCHEMA = '''
CREATE TABLE IF NOT EXISTS macula_equivalents (
 morph_id TEXT PRIMARY KEY, book_id INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
 word_num INTEGER NOT NULL, hebrew_surface TEXT NOT NULL, hebrew_strong TEXT NOT NULL,
 greek_surface TEXT NOT NULL, greek_strong TEXT, greek_key TEXT NOT NULL,
 hebrew_token_id INTEGER, lxx_token_id INTEGER,
 hebrew_status TEXT NOT NULL, greek_status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS macula_hebrew ON macula_equivalents(hebrew_strong,book_id,chapter,verse);
CREATE INDEX IF NOT EXISTS macula_greek ON macula_equivalents(greek_strong,book_id,chapter,verse);
CREATE TABLE IF NOT EXISTS macula_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
'''

def text_key(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c).startswith('L')).casefold()

def strong(value, prefix):
    # MACULA's suffixed numbers include private grammatical IDs that collide with real Strong's.
    # Do not remove suffixes and silently turn a prefix/pronoun into a lexical dictionary entry.
    if not re.fullmatch(r'\d+', value or ''):
        return None
    n = int(value)
    return f'{prefix}{n:04}' if 0 < n <= (8674 if prefix == 'H' else 5624) else None

def checksum(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def download(directory):
    directory.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, url in [('annotations.xml', SOURCE_URL), ('LICENSE.md', LICENSE_URL)]:
        path = directory / name
        if not path.exists() or checksum(path) != CHECKSUMS[name]:
            temp = path.with_suffix(path.suffix + '.part')
            with urllib.request.urlopen(url, timeout=90) as source, temp.open('wb') as out:
                shutil.copyfileobj(source, out)
            if checksum(temp) != CHECKSUMS[name]:
                temp.unlink()
                raise ValueError(f'Checksum mismatch: {name}')
            temp.replace(path)
        manifest[name] = {'url': url, 'revision': REVISION, 'sha256': CHECKSUMS[name]}
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

def annotations(path):
    for _, node in ET.iterparse(path, events=('end',)):
        if node.tag == 'node':
            yield dict(node.attrib)
        node.clear()

def load_macula(conn, path, verify=True):
    if verify:
        for name in CHECKSUMS:
            file = path.parent / name
            if not file.exists() or checksum(file) != CHECKSUMS[name]:
                raise ValueError(f'Missing or changed MACULA source: {name}; run --download')
    conn.executescript(SCHEMA)
    counts = Counter()
    seen = set()
    with conn:
        conn.execute('DELETE FROM macula_equivalents')
        for ref, verse_nodes in itertools.groupby(annotations(path), lambda a: a.get('morphId', '')[:8]):
            if not re.fullmatch(r'\d{8}', ref):
                raise ValueError('Invalid MACULA reference: ' + ref)
            book, chapter, verse = int(ref[:2]), int(ref[2:5]), int(ref[5:8])
            nodes = list(verse_nodes)
            words = defaultdict(list)
            for a in nodes:
                ident = a['morphId']
                if not re.fullmatch(r'\d{12}', ident) or ident in seen:
                    raise ValueError('Invalid or duplicate MACULA morph ID: ' + ident)
                seen.add(ident)
                words[int(ident[8:11])].append(a)
            hebrew = conn.execute("SELECT id,word_num,surface,strong FROM tokens WHERE corpus='WLC' AND book_id=? AND chapter=? AND verse=? ORDER BY word_num", (book,chapter,verse)).fetchall()
            greek = conn.execute("SELECT id,surface,strong FROM tokens WHERE corpus='LXX' AND book_id=? AND chapter=? AND verse=? ORDER BY word_num", (book,chapter,verse)).fetchall()
            pending = []
            for a in nodes:
                counts['source_morphemes'] += 1
                hs = strong(a.get('StrongNumberX', ''), 'H')
                if not hs:
                    counts['excluded_private_or_nonlexical_ids'] += 1
                    continue
                ident = a['morphId']; word_num = int(ident[8:11])
                whole_word = ''.join(x.get('macula-text', x.get('Unicode','')) for x in words[word_num])
                surface = a.get('macula-text', a.get('Unicode',''))
                # Surface AND identifier evidence is required. Position alone never proves a match.
                hc = [t for t in hebrew if t[3] == hs and text_key(t[2] or '') == text_key(whole_word)]
                position = [t for t in hc if t[1] == word_num]
                if len(position) == 1: hc = position
                hi = hc[0][0] if len(hc) == 1 else None
                hstatus = 'validated' if hi else 'ambiguous' if hc else 'unmatched'
                gs = strong(a.get('GreekStrong',''), 'G')
                gsurface = a.get('Greek','')
                gc = [t for t in greek if gs and strong(re.sub(r'^G','',t[2] or ''), 'G') == gs and text_key(t[1] or '') == text_key(gsurface)]
                # Source equivalent is retained even when the loaded Greek edition cannot corroborate it.
                # Same-reference matching does not establish versification equivalence.
                gi = gc[0][0] if hi and len(gc) == 1 else None
                gstatus = 'not_provided' if not gsurface else 'surface_and_identifier' if gi else 'ambiguous' if len(gc)>1 else 'unresolved'
                counts[hstatus + '_hebrew'] += 1; counts[gstatus + '_greek'] += 1
                pending.append((ident,book,chapter,verse,word_num,surface,hs,gsurface,gs,text_key(gsurface),hi,gi,hstatus,gstatus))
            conn.executemany('INSERT INTO macula_equivalents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', pending)
        metadata = {'revision': REVISION, 'source_url': SOURCE_URL, 'license_url': LICENSE_URL,
                    'attribution': ATTRIBUTION, 'license': 'CC BY 4.0', 'counts': dict(counts),
                    'changes': 'Extracted lexical Hebrew morphemes and recorded Greek equivalents; excluded private/suffixed grammatical identifiers; validated Hebrew surfaces and identifiers against installed tokens; checked Greek surface/identifier candidates at the stored reference without asserting cross-edition versification alignment.'}
        conn.executemany('INSERT OR REPLACE INTO macula_metadata VALUES(?,?)', [(k,json.dumps(v) if isinstance(v,dict) else v) for k,v in metadata.items()])
        if conn.execute("SELECT 1 FROM sqlite_master WHERE name='study_sources'").fetchone():
            conn.execute('INSERT OR REPLACE INTO study_sources VALUES(?,?,?,?,?,?)', ('macula-lxx',REVISION,ATTRIBUTION,'CC BY 4.0','https://github.com/Clear-Bible/macula-hebrew',metadata['changes']))
    return metadata

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--database', type=Path)
    parser.add_argument('--sources', type=Path, default=Path('data/macula'))
    args = parser.parse_args()
    if args.download: download(args.sources)
    if args.database:
        if not args.database.is_file():
            raise FileNotFoundError(f'Bible database not found: {args.database}')
        # Publish an entire completed update; failures leave the user's existing Bible DB intact.
        building = args.database.with_suffix('.macula-building.db')
        try:
            with sqlite3.connect(args.database) as src, sqlite3.connect(building) as out:
                src.backup(out)
                report = load_macula(out, args.sources/'annotations.xml')
            building.replace(args.database)
        finally:
            if building.exists(): building.unlink()
        print(json.dumps(report,ensure_ascii=False,indent=2))
    if not args.download and not args.database: parser.error('Specify --download and/or --database')

if __name__ == '__main__': main()
