"""Regression checks for lexical identifiers, senses, and Scripture references."""
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from study_lexicons import SCHEMA, lemma_key, load_bdb, load_ubs, strong_key, ubs_reference, ubs_text
from build_db import BOOKS, lsj_to_json


class StudyLexiconsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.sources = Path(self.directory.name)
        self.conn = sqlite3.connect(":memory:")
        self.addCleanup(self.conn.close)
        self.conn.executescript(SCHEMA)

    def test_lookup_normalization_preserves_distinct_identifiers(self):
        self.assertEqual(lemma_key("ἀγάπη"), lemma_key("ἀγάπη"))
        self.assertEqual(lemma_key("אָב"), "אב")
        self.assertEqual(strong_key("A4"), "H0004")
        self.assertEqual(strong_key("H14a"), "H0014a")
        self.assertEqual(strong_key("G26"), "G0026")
        self.assertEqual(ubs_text('see {L:Egypt<SDBH:מִצְרַיִם>} and {S:04300301600004}', BOOKS), 'see Egypt and John 3:16')
        self.assertEqual(ubs_text('|In a number of languages'), 'In a number of languages')
        self.assertEqual(ubs_text('{S:04302101500046 04302101600032 04302101700014 04302101700034}', BOOKS), 'John 21:15; John 21:16; John 21:17')

    def test_lsj_preserves_bibliographic_hover_content(self):
        structured, plain = lsj_to_json('love [<a title="Plato, Symposium 180b">Refs 4th c.BC</a>]')
        self.assertIn('love', plain)
        self.assertEqual(json.loads(structured)['citations'], ['Plato, Symposium 180b'])

    def test_ubs_senses_and_reference_offsets(self):
        meanings = [
            {"LEXID": "1", "LEXEntryCode": "25.43", "LEXDomains": [{"Domain": "Love"}],
             "LEXSenses": [{"LanguageCode": "en", "DefinitionShort": "|iLove|i* for another", "Glosses": ["love"]}],
             "LEXReferences": ["04300301600004", "04300301600008"]},
            {"LEXID": "2", "LEXSenses": [{"LanguageCode": "en", "DefinitionShort": "A shared meal"}],
             "LEXReferences": ["06500101200005"]},
        ]
        entries = [{"MainId": "entry", "Lemma": "ἀγάπη", "StrongCodes": ["G26"],
                    "BaseForms": [{"LEXMeanings": meanings}]}]
        (self.sources / "ubs-greek.json").write_text(json.dumps(entries))
        self.assertEqual(load_ubs(self.conn, self.sources, "Grk", BOOKS), 1)
        senses = json.loads(self.conn.execute("SELECT senses FROM study_entries").fetchone()[0])
        self.assertEqual(len(senses), 2)
        self.assertEqual(senses[0]["definition"], "Love for another")
        self.assertEqual(senses[0]["references"], ["John 3:16"])
        self.assertEqual(senses[1]["references"], ["Jude 1:12"])
        self.assertEqual(senses[0]["domains"], ["Love"])
        self.assertEqual(ubs_reference("04600100000000", BOOKS), "1 Corinthians (title)")

    def test_bdb_augmented_numbers_and_transcription_status(self):
        namespace = 'xmlns="http://openscriptures.github.com/morphhb/namespace"'
        (self.sources / "BrownDriverBriggs.xml").write_text(f'<lexicon {namespace}><entry id="a"><w>אָב</w> <def>father</def><sense n="1">parent <ref r="Gen.2.24">Gn 2:24</ref></sense><status>done</status></entry></lexicon>')
        (self.sources / "LexicalIndex.xml").write_text(f'<index {namespace}><entry id="aaa"><w>אָב</w><xref bdb="a" strong="1"/></entry></index>')
        (self.sources / "AugIndex.xml").write_text(f'<index {namespace}><w aug="1a">aaa</w></index>')
        self.assertEqual(load_bdb(self.conn, self.sources), 1)
        keys = {row[0] for row in self.conn.execute("SELECT strong FROM study_strongs")}
        self.assertEqual(keys, {"H0001", "H0001a"})
        sense = json.loads(self.conn.execute("SELECT senses FROM study_entries").fetchone()[0])[0]
        self.assertNotIn("done", sense["definition"])
        self.assertIn("\n1. parent", sense["definition"])
        self.assertEqual(sense["references"], ["Gen.2.24"])


if __name__ == "__main__":
    unittest.main()
