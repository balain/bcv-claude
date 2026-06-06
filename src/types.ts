export type Lang = 'Heb' | 'Grk';
export type Source = 'KJV' | 'ASV' | 'LEB' | 'NASB' | 'Heb' | 'LXX' | 'GNT';
export type Testament = 'OT' | 'NT';

export interface WordToken {
  surface: string;
  translit: string;
  gloss: string;
  root: string | null;
  strong?: string | null;
  lemma?: string | null;
  meaning?: string | null;
  form?: string | null;
  highlight?: boolean;
  corpus?: 'WLC' | 'GNT' | 'LXX';
}

export interface OriginalSection {
  corpus: 'WLC' | 'GNT' | 'LXX';
  lang: Lang;
  tokens: WordToken[];
}

export interface BibleResult {
  ref: string;
  book: string;
  bookAbbr: string;
  testament: Testament;
  chapter: number;
  verse: number;
  lang: Lang;
  source: Source;
  english: string;
  matchWord: string;
  originals: OriginalSection[];
}

export interface Bookmark {
  id: string;
  bookId: number;
  chapter: number;
  verse: number;
  label: string;
  createdAt: number;
}
