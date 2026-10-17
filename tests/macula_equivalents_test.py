import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from macula_equivalents import load_macula, strong, text_key

class MaculaTests(unittest.TestCase):
    def fixture(self):
        conn=sqlite3.connect(':memory:')
        conn.executescript('''CREATE TABLE tokens(id INTEGER PRIMARY KEY,corpus,book_id,chapter,verse,word_num,surface,strong);
        INSERT INTO tokens VALUES(1,'WLC',1,1,1,1,'בְּרֵאשִׁית','H7225'),(2,'WLC',1,1,1,2,'בָּרָא','H1254'),(3,'WLC',1,1,1,3,'אֵת','H0853'),(4,'WLC',1,1,1,4,'אוֹר','H0216');
        INSERT INTO tokens VALUES(10,'LXX',1,1,1,1,'ἀρχῇ','G0746'),(11,'LXX',1,1,1,2,'ἐποίησεν','G4160'),(12,'LXX',1,1,1,3,'φῶς','G5457'),(13,'LXX',1,1,1,4,'φῶς','G5457');''')
        return conn

    def test_retains_equivalents_and_separates_validation_and_missingness(self):
        with tempfile.TemporaryDirectory() as tmp, self.fixture() as conn:
            path=Path(tmp)/'annotations.xml'
            path.write_text('''<annotations>
            <node morphId="010010010011" macula-text="בְּ" StrongNumberX="0871a" Greek="ἐν" GreekStrong="1722"/>
            <node morphId="010010010012" macula-text="רֵאשִׁית" StrongNumberX="7225" Greek="ἀρξῇ" GreekStrong="746"/>
            <node morphId="010010010021" macula-text="בָּרָא" StrongNumberX="1254" Greek="ἐποίησεν" GreekStrong="4160"/>
            <node morphId="010010010031" macula-text="אֵת" StrongNumberX="0853"/>
            <node morphId="010010010041" macula-text="אוֹר" StrongNumberX="0216" Greek="φῶς" GreekStrong="5457"/>
            </annotations>''',encoding='utf8')
            report=load_macula(conn,path,verify=False)
            self.assertEqual(report['counts']['excluded_private_or_nonlexical_ids'],1)
            rows=conn.execute('SELECT hebrew_strong,hebrew_status,greek_status,lxx_token_id FROM macula_equivalents ORDER BY morph_id').fetchall()
            self.assertEqual(rows,[('H7225','validated','unresolved',None),('H1254','validated','surface_and_identifier',11),('H0853','validated','not_provided',None),('H0216','validated','ambiguous',None)])
            self.assertEqual(conn.execute("SELECT greek_surface FROM macula_equivalents WHERE hebrew_strong='H7225'").fetchone()[0],'ἀρξῇ')
            self.assertEqual(load_macula(conn,path,verify=False)['counts'],report['counts'])

    def test_same_reference_and_identifier_without_surface_does_not_validate(self):
        with tempfile.TemporaryDirectory() as tmp, self.fixture() as conn:
            path=Path(tmp)/'annotations.xml';path.write_text('<annotations><node morphId="010010010021" macula-text="דבר" StrongNumberX="1254" Greek="ἐποίησεν" GreekStrong="4160"/></annotations>')
            load_macula(conn,path,verify=False)
            self.assertEqual(conn.execute('SELECT hebrew_token_id,lxx_token_id,hebrew_status FROM macula_equivalents').fetchone(),(None,None,'unmatched'))

    def test_duplicate_ids_roll_back_existing_records(self):
        with tempfile.TemporaryDirectory() as tmp, self.fixture() as conn:
            path=Path(tmp)/'annotations.xml';node='<node morphId="010010010021" macula-text="בָּרָא" StrongNumberX="1254"/>'
            path.write_text('<annotations>'+node+'</annotations>');load_macula(conn,path,verify=False)
            path.write_text('<annotations>'+node+node+'</annotations>')
            with self.assertRaisesRegex(ValueError,'duplicate'):load_macula(conn,path,verify=False)
            self.assertEqual(conn.execute('SELECT count(*) FROM macula_equivalents').fetchone()[0],1)

    def test_unverified_download_and_private_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp, self.fixture() as conn:
            path=Path(tmp)/'annotations.xml';path.write_text('<annotations/>')
            with self.assertRaisesRegex(ValueError,'changed MACULA'):load_macula(conn,path)
        self.assertIsNone(strong('0871a','H'));self.assertIsNone(strong('1722|1698','G'))
        self.assertEqual(strong('1254','H'),'H1254')
        self.assertEqual(text_key('ἐποίησεν'),text_key('ἐποίησεν'))
