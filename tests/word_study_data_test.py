import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from word_study_data import load_word_study

class WordStudyDataTests(unittest.TestCase):
    def test_preserves_language_aliases_and_only_explicit_semantic_relations(self):
        with tempfile.TemporaryDirectory() as tmp, sqlite3.connect(':memory:') as conn:
            sources = Path(tmp)
            (sources / 'ubs-hebrew.json').write_text(json.dumps([
                {'Lemma': 'אב', 'StrongCodes': ['H0001', 'A0002'], 'BaseForms': [
                    {'RelatedLemmas': [{'Word': 'בן'}], 'LEXMeanings': [
                        {'LEXID': 'sense-1', 'LEXSynonyms': ['אבא'], 'LEXAntonyms': ['יתום']}
                    ]}
                ]}
            ]))
            (sources / 'ubs-greek.json').write_text('[]')
            (sources / 'BrownDriverBriggs.xml').write_text('<lexicon xmlns="http://openscriptures.github.com/morphhb/namespace"/>')
            self.assertEqual(load_word_study(conn, sources), 3)
            self.assertEqual(conn.execute("SELECT original_strong,language FROM word_languages WHERE strong='H0002'").fetchone(), ('A0002', 'Aramaic'))
            self.assertEqual(conn.execute('SELECT DISTINCT kind FROM word_relations ORDER BY kind').fetchall(), [('antonym',), ('related',), ('synonym',)])
            self.assertIn('sense-1', conn.execute("SELECT context FROM word_relations WHERE kind='synonym'").fetchone()[0])
            self.assertEqual(load_word_study(conn, sources), 3)  # Repeat imports are deterministic.

    def test_bdb_root_groups_keep_editorial_provenance(self):
        with tempfile.TemporaryDirectory() as tmp, sqlite3.connect(':memory:') as conn:
            sources = Path(tmp)
            for name in ['ubs-hebrew', 'ubs-greek']:
                (sources / (name+'.json')).write_text('[]')
            (sources / 'BrownDriverBriggs.xml').write_text('''<lexicon xmlns="http://openscriptures.github.com/morphhb/namespace"><section><entry id="root" type="root"><w>אב</w></entry><entry id="child"><w>אביב</w></entry></section></lexicon>''')
            self.assertEqual(load_word_study(conn, sources), 2)
            self.assertIn('not an independently verified etymology', conn.execute('SELECT context FROM word_relations LIMIT 1').fetchone()[0])
