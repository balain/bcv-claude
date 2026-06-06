// Static mirror of book_meta (id 1–66) — lets client code translate a
// numeric bookId from class.db refs into the abbr3/name/testament that
// ChapterView and the search layer need, without a DB round-trip.

export interface BookMeta {
  id: number;
  abbr3: string;
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
}

export const BOOK_META: BookMeta[] = [
  { id:  1, abbr3: 'Gen', name: 'Genesis',          testament: 'OT', chapters: 50  },
  { id:  2, abbr3: 'Exo', name: 'Exodus',           testament: 'OT', chapters: 40  },
  { id:  3, abbr3: 'Lev', name: 'Leviticus',        testament: 'OT', chapters: 27  },
  { id:  4, abbr3: 'Num', name: 'Numbers',           testament: 'OT', chapters: 36  },
  { id:  5, abbr3: 'Deu', name: 'Deuteronomy',      testament: 'OT', chapters: 34  },
  { id:  6, abbr3: 'Jos', name: 'Joshua',            testament: 'OT', chapters: 24  },
  { id:  7, abbr3: 'Jdg', name: 'Judges',            testament: 'OT', chapters: 21  },
  { id:  8, abbr3: 'Rut', name: 'Ruth',              testament: 'OT', chapters: 4   },
  { id:  9, abbr3: '1Sa', name: '1 Samuel',          testament: 'OT', chapters: 31  },
  { id: 10, abbr3: '2Sa', name: '2 Samuel',          testament: 'OT', chapters: 24  },
  { id: 11, abbr3: '1Ki', name: '1 Kings',           testament: 'OT', chapters: 22  },
  { id: 12, abbr3: '2Ki', name: '2 Kings',           testament: 'OT', chapters: 25  },
  { id: 13, abbr3: '1Ch', name: '1 Chronicles',      testament: 'OT', chapters: 29  },
  { id: 14, abbr3: '2Ch', name: '2 Chronicles',      testament: 'OT', chapters: 36  },
  { id: 15, abbr3: 'Ezr', name: 'Ezra',              testament: 'OT', chapters: 10  },
  { id: 16, abbr3: 'Neh', name: 'Nehemiah',          testament: 'OT', chapters: 13  },
  { id: 17, abbr3: 'Est', name: 'Esther',            testament: 'OT', chapters: 10  },
  { id: 18, abbr3: 'Job', name: 'Job',               testament: 'OT', chapters: 42  },
  { id: 19, abbr3: 'Psa', name: 'Psalms',            testament: 'OT', chapters: 150 },
  { id: 20, abbr3: 'Pro', name: 'Proverbs',          testament: 'OT', chapters: 31  },
  { id: 21, abbr3: 'Ecc', name: 'Ecclesiastes',      testament: 'OT', chapters: 12  },
  { id: 22, abbr3: 'Sng', name: 'Song of Solomon',   testament: 'OT', chapters: 8   },
  { id: 23, abbr3: 'Isa', name: 'Isaiah',            testament: 'OT', chapters: 66  },
  { id: 24, abbr3: 'Jer', name: 'Jeremiah',          testament: 'OT', chapters: 52  },
  { id: 25, abbr3: 'Lam', name: 'Lamentations',      testament: 'OT', chapters: 5   },
  { id: 26, abbr3: 'Eze', name: 'Ezekiel',           testament: 'OT', chapters: 48  },
  { id: 27, abbr3: 'Dan', name: 'Daniel',            testament: 'OT', chapters: 12  },
  { id: 28, abbr3: 'Hos', name: 'Hosea',             testament: 'OT', chapters: 14  },
  { id: 29, abbr3: 'Joe', name: 'Joel',              testament: 'OT', chapters: 3   },
  { id: 30, abbr3: 'Amo', name: 'Amos',              testament: 'OT', chapters: 9   },
  { id: 31, abbr3: 'Oba', name: 'Obadiah',           testament: 'OT', chapters: 1   },
  { id: 32, abbr3: 'Jon', name: 'Jonah',             testament: 'OT', chapters: 4   },
  { id: 33, abbr3: 'Mic', name: 'Micah',             testament: 'OT', chapters: 7   },
  { id: 34, abbr3: 'Nah', name: 'Nahum',             testament: 'OT', chapters: 3   },
  { id: 35, abbr3: 'Hab', name: 'Habakkuk',          testament: 'OT', chapters: 3   },
  { id: 36, abbr3: 'Zep', name: 'Zephaniah',         testament: 'OT', chapters: 3   },
  { id: 37, abbr3: 'Hag', name: 'Haggai',            testament: 'OT', chapters: 2   },
  { id: 38, abbr3: 'Zec', name: 'Zechariah',         testament: 'OT', chapters: 14  },
  { id: 39, abbr3: 'Mal', name: 'Malachi',           testament: 'OT', chapters: 4   },
  { id: 40, abbr3: 'Mat', name: 'Matthew',           testament: 'NT', chapters: 28  },
  { id: 41, abbr3: 'Mar', name: 'Mark',              testament: 'NT', chapters: 16  },
  { id: 42, abbr3: 'Luk', name: 'Luke',              testament: 'NT', chapters: 24  },
  { id: 43, abbr3: 'Jhn', name: 'John',              testament: 'NT', chapters: 21  },
  { id: 44, abbr3: 'Act', name: 'Acts',              testament: 'NT', chapters: 28  },
  { id: 45, abbr3: 'Rom', name: 'Romans',            testament: 'NT', chapters: 16  },
  { id: 46, abbr3: '1Co', name: '1 Corinthians',     testament: 'NT', chapters: 16  },
  { id: 47, abbr3: '2Co', name: '2 Corinthians',     testament: 'NT', chapters: 13  },
  { id: 48, abbr3: 'Gal', name: 'Galatians',         testament: 'NT', chapters: 6   },
  { id: 49, abbr3: 'Eph', name: 'Ephesians',         testament: 'NT', chapters: 6   },
  { id: 50, abbr3: 'Phl', name: 'Philippians',       testament: 'NT', chapters: 4   },
  { id: 51, abbr3: 'Col', name: 'Colossians',        testament: 'NT', chapters: 4   },
  { id: 52, abbr3: '1Th', name: '1 Thessalonians',   testament: 'NT', chapters: 5   },
  { id: 53, abbr3: '2Th', name: '2 Thessalonians',   testament: 'NT', chapters: 3   },
  { id: 54, abbr3: '1Ti', name: '1 Timothy',         testament: 'NT', chapters: 6   },
  { id: 55, abbr3: '2Ti', name: '2 Timothy',         testament: 'NT', chapters: 4   },
  { id: 56, abbr3: 'Tit', name: 'Titus',             testament: 'NT', chapters: 3   },
  { id: 57, abbr3: 'Phm', name: 'Philemon',          testament: 'NT', chapters: 1   },
  { id: 58, abbr3: 'Heb', name: 'Hebrews',           testament: 'NT', chapters: 13  },
  { id: 59, abbr3: 'Jas', name: 'James',             testament: 'NT', chapters: 5   },
  { id: 60, abbr3: '1Pe', name: '1 Peter',           testament: 'NT', chapters: 5   },
  { id: 61, abbr3: '2Pe', name: '2 Peter',           testament: 'NT', chapters: 3   },
  { id: 62, abbr3: '1Jn', name: '1 John',            testament: 'NT', chapters: 5   },
  { id: 63, abbr3: '2Jn', name: '2 John',            testament: 'NT', chapters: 1   },
  { id: 64, abbr3: '3Jn', name: '3 John',            testament: 'NT', chapters: 1   },
  { id: 65, abbr3: 'Jud', name: 'Jude',              testament: 'NT', chapters: 1   },
  { id: 66, abbr3: 'Rev', name: 'Revelation',        testament: 'NT', chapters: 22  },
];

// O(1) lookup by numeric bookId
export const BOOK_BY_ID = new Map<number, BookMeta>(
  BOOK_META.map((b) => [b.id, b]),
);

// O(1) lookup by 3-letter abbreviation
export const BOOK_BY_ABBR3 = new Map<string, BookMeta>(
  BOOK_META.map((b) => [b.abbr3, b]),
);
