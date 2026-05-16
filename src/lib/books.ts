// Static mirror of book_meta (id 1–66) — lets client code translate a
// numeric bookId from class.db refs into the abbr3/name/testament that
// ChapterView and the search layer need, without a DB round-trip.

export interface BookMeta {
  id: number;
  abbr3: string;
  name: string;
  testament: 'OT' | 'NT';
}

export const BOOK_META: BookMeta[] = [
  { id:  1, abbr3: 'Gen', name: 'Genesis',          testament: 'OT' },
  { id:  2, abbr3: 'Exo', name: 'Exodus',           testament: 'OT' },
  { id:  3, abbr3: 'Lev', name: 'Leviticus',        testament: 'OT' },
  { id:  4, abbr3: 'Num', name: 'Numbers',           testament: 'OT' },
  { id:  5, abbr3: 'Deu', name: 'Deuteronomy',      testament: 'OT' },
  { id:  6, abbr3: 'Jos', name: 'Joshua',            testament: 'OT' },
  { id:  7, abbr3: 'Jdg', name: 'Judges',            testament: 'OT' },
  { id:  8, abbr3: 'Rut', name: 'Ruth',              testament: 'OT' },
  { id:  9, abbr3: '1Sa', name: '1 Samuel',          testament: 'OT' },
  { id: 10, abbr3: '2Sa', name: '2 Samuel',          testament: 'OT' },
  { id: 11, abbr3: '1Ki', name: '1 Kings',           testament: 'OT' },
  { id: 12, abbr3: '2Ki', name: '2 Kings',           testament: 'OT' },
  { id: 13, abbr3: '1Ch', name: '1 Chronicles',      testament: 'OT' },
  { id: 14, abbr3: '2Ch', name: '2 Chronicles',      testament: 'OT' },
  { id: 15, abbr3: 'Ezr', name: 'Ezra',              testament: 'OT' },
  { id: 16, abbr3: 'Neh', name: 'Nehemiah',          testament: 'OT' },
  { id: 17, abbr3: 'Est', name: 'Esther',            testament: 'OT' },
  { id: 18, abbr3: 'Job', name: 'Job',               testament: 'OT' },
  { id: 19, abbr3: 'Psa', name: 'Psalms',            testament: 'OT' },
  { id: 20, abbr3: 'Pro', name: 'Proverbs',          testament: 'OT' },
  { id: 21, abbr3: 'Ecc', name: 'Ecclesiastes',      testament: 'OT' },
  { id: 22, abbr3: 'Sng', name: 'Song of Solomon',   testament: 'OT' },
  { id: 23, abbr3: 'Isa', name: 'Isaiah',            testament: 'OT' },
  { id: 24, abbr3: 'Jer', name: 'Jeremiah',          testament: 'OT' },
  { id: 25, abbr3: 'Lam', name: 'Lamentations',      testament: 'OT' },
  { id: 26, abbr3: 'Eze', name: 'Ezekiel',           testament: 'OT' },
  { id: 27, abbr3: 'Dan', name: 'Daniel',            testament: 'OT' },
  { id: 28, abbr3: 'Hos', name: 'Hosea',             testament: 'OT' },
  { id: 29, abbr3: 'Joe', name: 'Joel',              testament: 'OT' },
  { id: 30, abbr3: 'Amo', name: 'Amos',              testament: 'OT' },
  { id: 31, abbr3: 'Oba', name: 'Obadiah',           testament: 'OT' },
  { id: 32, abbr3: 'Jon', name: 'Jonah',             testament: 'OT' },
  { id: 33, abbr3: 'Mic', name: 'Micah',             testament: 'OT' },
  { id: 34, abbr3: 'Nah', name: 'Nahum',             testament: 'OT' },
  { id: 35, abbr3: 'Hab', name: 'Habakkuk',          testament: 'OT' },
  { id: 36, abbr3: 'Zep', name: 'Zephaniah',         testament: 'OT' },
  { id: 37, abbr3: 'Hag', name: 'Haggai',            testament: 'OT' },
  { id: 38, abbr3: 'Zec', name: 'Zechariah',         testament: 'OT' },
  { id: 39, abbr3: 'Mal', name: 'Malachi',           testament: 'OT' },
  { id: 40, abbr3: 'Mat', name: 'Matthew',           testament: 'NT' },
  { id: 41, abbr3: 'Mar', name: 'Mark',              testament: 'NT' },
  { id: 42, abbr3: 'Luk', name: 'Luke',              testament: 'NT' },
  { id: 43, abbr3: 'Jhn', name: 'John',              testament: 'NT' },
  { id: 44, abbr3: 'Act', name: 'Acts',              testament: 'NT' },
  { id: 45, abbr3: 'Rom', name: 'Romans',            testament: 'NT' },
  { id: 46, abbr3: '1Co', name: '1 Corinthians',     testament: 'NT' },
  { id: 47, abbr3: '2Co', name: '2 Corinthians',     testament: 'NT' },
  { id: 48, abbr3: 'Gal', name: 'Galatians',         testament: 'NT' },
  { id: 49, abbr3: 'Eph', name: 'Ephesians',         testament: 'NT' },
  { id: 50, abbr3: 'Phl', name: 'Philippians',       testament: 'NT' },
  { id: 51, abbr3: 'Col', name: 'Colossians',        testament: 'NT' },
  { id: 52, abbr3: '1Th', name: '1 Thessalonians',   testament: 'NT' },
  { id: 53, abbr3: '2Th', name: '2 Thessalonians',   testament: 'NT' },
  { id: 54, abbr3: '1Ti', name: '1 Timothy',         testament: 'NT' },
  { id: 55, abbr3: '2Ti', name: '2 Timothy',         testament: 'NT' },
  { id: 56, abbr3: 'Tit', name: 'Titus',             testament: 'NT' },
  { id: 57, abbr3: 'Phm', name: 'Philemon',          testament: 'NT' },
  { id: 58, abbr3: 'Heb', name: 'Hebrews',           testament: 'NT' },
  { id: 59, abbr3: 'Jas', name: 'James',             testament: 'NT' },
  { id: 60, abbr3: '1Pe', name: '1 Peter',           testament: 'NT' },
  { id: 61, abbr3: '2Pe', name: '2 Peter',           testament: 'NT' },
  { id: 62, abbr3: '1Jn', name: '1 John',            testament: 'NT' },
  { id: 63, abbr3: '2Jn', name: '2 John',            testament: 'NT' },
  { id: 64, abbr3: '3Jn', name: '3 John',            testament: 'NT' },
  { id: 65, abbr3: 'Jud', name: 'Jude',              testament: 'NT' },
  { id: 66, abbr3: 'Rev', name: 'Revelation',        testament: 'NT' },
];

// O(1) lookup by numeric bookId
export const BOOK_BY_ID = new Map<number, BookMeta>(
  BOOK_META.map((b) => [b.id, b]),
);
