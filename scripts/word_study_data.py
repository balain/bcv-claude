"""Build sourced word-study metadata from already installed BDB/UBS files. No downloads."""
import json
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path
from study_lexicons import lemma_key, strong_key, NS, text

SCHEMA = """
CREATE TABLE IF NOT EXISTS word_languages (
 strong TEXT NOT NULL, original_strong TEXT NOT NULL, language TEXT NOT NULL,
 source TEXT NOT NULL, PRIMARY KEY(strong, original_strong, language, source)
);
CREATE TABLE IF NOT EXISTS word_relations (
 lemma_key TEXT NOT NULL, lang TEXT NOT NULL, kind TEXT NOT NULL,
 target_lemma TEXT NOT NULL, source TEXT NOT NULL, context TEXT NOT NULL,
 PRIMARY KEY(lemma_key,lang,kind,target_lemma,source,context)
);
CREATE INDEX IF NOT EXISTS word_relation_lookup ON word_relations(lemma_key,lang);
"""

def load_word_study(conn, sources):
    conn.executescript(SCHEMA)
    conn.execute('DELETE FROM word_relations')
    conn.execute('DELETE FROM word_languages')
    def relation(lemma, lang, kind, target, source, context):
        if target and lemma_key(lemma) != lemma_key(target):
            conn.execute('INSERT OR IGNORE INTO word_relations VALUES(?,?,?,?,?,?)',
                         (lemma_key(lemma), lang, kind, target, source, context))
    for source, lang in [('ubs-hebrew', 'Heb'), ('ubs-greek', 'Grk')]:
        for entry in json.loads((sources / (source + '.json')).read_text(encoding='utf-8-sig')):
            for strong in entry.get('StrongCodes') or []:
                if strong_key(strong):
                    language = 'Greek' if strong.startswith('G') else 'Aramaic' if strong.startswith('A') else 'Hebrew'
                    conn.execute('INSERT OR IGNORE INTO word_languages VALUES(?,?,?,?)',
                                 (strong_key(strong), strong, language, source))
            for base in entry.get('BaseForms') or []:
                for related in base.get('RelatedLemmas') or []:
                    relation(entry['Lemma'], lang, 'related', related.get('Word', ''), source,
                             'UBS related lemma; no root or derivation direction is asserted.')
                for meaning in base.get('LEXMeanings') or []:
                    context = str(meaning.get('LEXEntryCode') or meaning.get('LEXID', ''))
                    for key, kind in [('LEXSynonyms', 'synonym'), ('LEXAntonyms', 'antonym')]:
                        for target in meaning.get(key) or []:
                            if isinstance(target, str):
                                relation(entry['Lemma'], lang, kind, target, source,
                                         'UBS lexical sense ' + context + '; relation applies in this sense, not every passage.')
    # BDB explicitly groups entries into sections headed by an entry of type=root.
    # Preserve this editorial grouping, not an inferred spelling-based etymology.
    root = ET.parse(sources / 'BrownDriverBriggs.xml').getroot()
    for section in root.findall('.//h:section', NS):
        entries = section.findall('h:entry', NS)
        roots = [e for e in entries if e.get('type') == 'root']
        if len(roots) != 1:
            continue
        parent = text(roots[0].find('h:w', NS))
        for entry in entries:
            child = text(entry.find('h:w', NS))
            if child and child != parent:
                note = 'BDB root-section grouping (' + roots[0].get('id', '') + '); editorial organization, not an independently verified etymology.'
                relation(child, 'Heb', 'root', parent, 'bdb', note)
                relation(parent, 'Heb', 'derivation', child, 'bdb', note)
    # Include relationship adaptations in the existing reusable UBS download.
    # Source text and unrelated lexicons remain separate.
    if (sources.parent / 'ubs-study.json').exists():
        export_path = sources.parent / 'ubs-study.json'
        payload = json.loads(export_path.read_text())
        payload['relations'] = [dict(zip(('lemma_key', 'lang', 'kind', 'target_lemma', 'source', 'context'), row))
                                for row in conn.execute("SELECT * FROM word_relations WHERE source LIKE 'ubs-%'")]
        payload['languages'] = [dict(zip(('strong', 'original_strong', 'language', 'source'), row))
                                for row in conn.execute("SELECT * FROM word_languages WHERE source LIKE 'ubs-%'")]
        export_path.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    return conn.execute('SELECT count(*) FROM word_relations').fetchone()[0]

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default='data/bcv.db')
    parser.add_argument('--sources', default='data/study-sources')
    args = parser.parse_args()
    with sqlite3.connect(args.database) as conn:
        print('Word-study relationships:', load_word_study(conn, Path(args.sources)))
