import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import versification as V
from versification import Inventory, Ref

HEADER = '#DataStart(Expanded)\nSourceType\tSourceRef\tStandardRef\tAction\tNoteMarker\tRev\tVers\tAncient\tTests\n'
FOOTER = '#DataEnd(Expanded)\n'

def row(source_type, src, std, action, tests):
    return '\t'.join([source_type, src, std, action, '', '', '', '', tests]) + '\n'

FIXTURE = HEADER + ''.join([
    # Psalm 3: Hebrew numbers the title as v1; English folds it into v1.
    row('Hebrew+Latin+Greek', 'Psa.3:1', 'Psa.3:Title', 'Renumber title', 'Psa.3:1=Exist & Psa.3:9=Last & Psa.3:TextBeforeV1=NotExist'),
    row('Hebrew+Latin+Greek', 'Psa.3:2', 'Psa.3:1', 'Renumber verse', 'Psa.3:2=Exist & Psa.3:9=Last & Psa.3:TextBeforeV1=NotExist'),
    # LXX Psalm 22 is English 23.
    row('Eng-KJV+Hebrew', 'Psa.22:1', 'Psa.22:1', 'Keep verse', 'Psa.22:1=Exist & Psa.22:31=Last'),
    row('Greek', 'Psa.22:1', 'Psa.23:1', 'Renumber verse*', 'Psa.22:1=Exist & Psa.22:6=Last'),
    # Hebrew Malachi 3:19-24 is English 4:1-6.
    row('Hebrew', 'Mal.3:20', 'Mal.4:2', 'Renumber verse', 'Mal.3:24=Last'),
    # 3 John: NASB splits Standard 14 into 14-15.
    row('Eng-KJV', '3Jn.1:14', '3Jn.1:14', 'Keep verse', '3Jn.1:14=Exist & 3Jn.1:14=Last'),
    row('Greek', '3Jn.1:14', '3Jn.1:14!a', 'Renumber verse', '3Jn.1:14=Exist & 3Jn.1:15=Last'),
    row('Greek', '3Jn.1:15', '3Jn.1:14!b', 'DividedPrev verse', '3Jn.1:15=Exist & 3Jn.1:15=Last'),
    # Ps 151 has no English counterpart.
    row('Greek', 'Psa.151:1', 'Ps2.1:1', 'Keep verse', 'Psa.151:1=Exist'),
    # A verse whose tests fail for the edition: Greek and Greek2 disagree.
    row('Greek', 'Jer.32:15', 'Jer.25:29', 'Renumber verse*', 'Jer.32:15=Exist & Jer.25:19=Last'),
    row('Greek2', 'Jer.32:15', 'Jer.25:15', 'Renumber verse*', 'Jer.32:15=Exist & Jer.25:39=Last'),
    # Sub-verse source references.
    row('Greek2', 'Gen.3:1!a', 'Gen.2:25', 'MergedNext verse', 'Gen.3:1=Exist & Gen.2:24=Last'),
]) + FOOTER


def inventory(verses, titles=()):
    inv = Inventory(titles=set(titles))
    for key, words in verses.items():
        inv.add(*key, words)
    return inv


class VersificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / 'TVTMS.txt'
        path.write_text('header prose\n' + FIXTURE, encoding='utf-8')
        self.rows = V.load_rows(path, verify=False)

    def tearDown(self):
        self.tmp.cleanup()

    def test_parses_refs_titles_subverses_and_non_canonical_books(self):
        self.assertEqual(V.parse_ref('Psa.3:Title'), Ref(19, 3, 0))
        self.assertEqual(V.parse_ref('Exo.28:22!c'), Ref(2, 28, 22, 'c'))
        self.assertEqual(V.parse_ref('Gen.5:32; 6:1'), Ref(1, 5, 32))
        self.assertEqual(V.parse_ref('PSA.13:7'), Ref(19, 13, 7))
        self.assertIsNone(V.parse_ref('Ps2.1:1'))
        self.assertIsNone(V.parse_ref('Est.C:1'))
        self.assertEqual(self.rows[-1].src, Ref(1, 3, 1, 'a'))

    def test_evaluates_tvtms_tests(self):
        inv = inventory({(19, 3, 1): 5, (19, 3, 9): 4, (1, 6, 1): 10, (1, 6, 2): 4, (1, 6, 3): 3}, titles=[(19, 4)])
        inv.add(1, 6, 1, 3, subverse=1)
        self.assertIs(V.evaluate('Psa.3:9=Last', inv), True)
        self.assertIs(V.evaluate('Psa.3:8=Last', inv), False)
        self.assertIs(V.evaluate('Psa.3:10=NotExist', inv), True)
        self.assertIs(V.evaluate('Gen.6:1.1=Exist', inv), True)
        self.assertIs(V.evaluate('Gen.6:1.2=Exist', inv), False)
        self.assertIs(V.evaluate('Gen.6:1>Gen.6:2*3', inv), True)  # 13 words vs 12
        self.assertIs(V.evaluate('Gen.6:1<Gen.6:2*3', inv), False)
        self.assertIs(V.evaluate('Gen.6:1.0<Gen.6:2+Gen.6:3', inv), False)  # 10 vs 7
        self.assertIs(V.evaluate('Psa.4:TextBeforeV1=Exist', inv), True)
        self.assertIsNone(V.evaluate('1Es.1:15=Exist', inv))

    def test_hebrew_citations_map_to_english(self):
        nasb = inventory({(64, 1, 14): 9, (64, 1, 15): 10})
        heb = V.Mapper(V.tradition_map(self.rows, 'Hebrew'), V.standard_to_english(self.rows, nasb))
        self.assertEqual(heb.map(Ref(19, 3, 2)), Ref(19, 3, 1))
        self.assertEqual(heb.map(Ref(19, 3, 1)), Ref(19, 3, 1))  # title folds into v1
        self.assertEqual(heb.map(Ref(39, 3, 20)), Ref(39, 4, 2))
        self.assertEqual(heb.map(Ref(1, 1, 1)), Ref(1, 1, 1))

    def test_standard_to_english_keeps_first_part_of_a_split(self):
        nasb = inventory({(64, 1, 14): 9, (64, 1, 15): 10})
        s2n = V.standard_to_english(self.rows, nasb)
        self.assertEqual(s2n, {Ref(64, 1, 14, 'a'): Ref(64, 1, 14), Ref(64, 1, 14, 'b'): Ref(64, 1, 15)})
        # A source with the same split keeps verse 15 instead of collapsing into 14.
        gnt = inventory({(64, 1, 14): 9, (64, 1, 15): 10})
        mapper = V.Mapper(V.derive_map(self.rows, gnt), s2n)
        self.assertEqual(mapper.map(Ref(64, 1, 15)), Ref(64, 1, 15))
        self.assertEqual(V.Mapper({}, s2n).map(Ref(64, 1, 14)), Ref(64, 1, 14))

    def test_edition_tests_choose_the_row(self):
        lxx = inventory({(19, 22, 1): 8, (19, 22, 6): 9, (19, 151, 1): 7})
        mapper = V.Mapper(V.derive_map(self.rows, lxx), {})
        self.assertEqual(mapper.map(Ref(19, 22, 1)), Ref(19, 23, 1))
        self.assertIsNone(mapper.map(Ref(19, 151, 1)))

    def test_place_edition_uses_overrides_content_identity_and_drops_collisions(self):
        lxx = inventory({(24, 25, 20): 5, (24, 32, 15): 9, (19, 151, 1): 7, (20, 32, 1): 6, (20, 25, 1): 6, (1, 1, 1): 5})
        english = {(24, 25, 15), (24, 25, 29), (24, 32, 15), (20, 25, 1), (1, 1, 1)}
        similar = {((24, 32, 15), (24, 25, 15)): 0.4, ((20, 32, 1), (20, 25, 1)): 0.5}
        score = lambda s, t: similar.get((s, t), 0.0)
        placed = V.place_edition(self.rows, lxx, {}, english, score, {(20, 32, 1): (20, 25, 1)})
        self.assertEqual((placed[(24, 32, 15)].target, placed[(24, 32, 15)].how), ((24, 25, 15), 'content'))
        self.assertEqual((placed[(20, 32, 1)].target, placed[(20, 32, 1)].how), ((20, 25, 1), 'override'))
        self.assertEqual(placed[(20, 25, 1)].how, 'collision')  # identity lost to the content-backed override
        self.assertEqual((placed[(1, 1, 1)].target, placed[(1, 1, 1)].how), ((1, 1, 1), 'identity'))
        self.assertEqual(placed[(19, 151, 1)].how, 'none')

    def test_content_needs_a_margin_to_leave_identity(self):
        lxx = inventory({(24, 32, 15): 9})
        english = {(24, 25, 15), (24, 32, 15)}
        score = lambda s, t: {(24, 25, 15): 0.12, (24, 32, 15): 0.10}[t]
        placed = V.place_edition(self.rows, lxx, {}, english, score, {})
        self.assertEqual(placed[(24, 32, 15)].target, (24, 32, 15))

    def test_catss_overrides_cover_known_edition_quirks(self):
        o = V.CATSS_OVERRIDES
        self.assertEqual(o[(20, 32, 1)], (20, 25, 1))
        self.assertEqual(o[(39, 3, 24)], (39, 4, 4))
        self.assertEqual(o[(24, 30, 14)], (24, 49, 20))
        self.assertEqual(o[(24, 30, 29)], (24, 49, 23))
        self.assertIsNone(o[(25, 0, 1)])


if __name__ == '__main__':
    unittest.main()
