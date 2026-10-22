import type { StudyRequest, WordStudyData } from './wordStudy/types';
/**
 * Main-thread RPC client for db.worker.ts.
 * Exposes searchDB() and lookupStrong() as Promises.
 */

import type { BibleResult, Source } from '../types';
import { DEFAULT_SEARCH_SETTINGS, type SearchSettings } from './searchSettings';
import { parseReferenceQuery } from './referenceSearch';
import { BOOK_BY_ID } from './books';
import type { CitationMap } from './scriptureLinks';

type WorkerReply =
  | { id: string; ok: true; data: any }
  | { id: string; ok: false; error: string }
  | { type: 'ready' }
  | { type: 'progress'; message: string }
  | { type: 'error'; message: string };

export type DBStatus = 'initializing' | 'progress' | 'ready' | 'error';

type StatusListener = (status: DBStatus, message?: string) => void;

export interface SearchResponse {
  results: BibleResult[];
  totalHits: number;
  hitsByBook: Record<string, number>;
  errors?: string[];
}

class DBClient {
  private worker: Worker;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private seq = 0;
  private statusListeners: StatusListener[] = [];
  public status: DBStatus = 'initializing';
  public statusMessage = '';

  constructor() {
    this.worker = this.createWorker();
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('../workers/db.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', this.onMessage);
    worker.addEventListener('error', (e) => {
      this.setStatus('error', e.message);
    });
    return worker;
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.push(fn);
    return () => { this.statusListeners = this.statusListeners.filter((l) => l !== fn); };
  }

  private setStatus(status: DBStatus, message?: string) {
    this.status = status;
    this.statusMessage = message ?? '';
    for (const l of this.statusListeners) l(status, message);
  }

  private onMessage = (e: MessageEvent<WorkerReply>) => {
    const msg = e.data;
    if ('type' in msg) {
      if (msg.type === 'ready') this.setStatus('ready');
      else if (msg.type === 'progress') this.setStatus('progress', msg.message);
      else if (msg.type === 'error') this.setStatus('error', msg.message);
      return;
    }
    const handler = this.pending.get(msg.id);
    if (!handler) return;
    this.pending.delete(msg.id);
    if (msg.ok) handler.resolve(msg.data);
    else handler.reject(new Error(msg.error));
  };

  private call<T>(msg: object): Promise<T> {
    const id = String(++this.seq);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...msg, id });
    });
  }

  search(query: string, source: Source, settings: SearchSettings = DEFAULT_SEARCH_SETTINGS): Promise<SearchResponse> {
    if (parseReferenceQuery(query)) return this.call({ type: 'search_references', query });
    return this.call({ type: 'search', query, source, ...settings });
  }

  lookup(strong: string): Promise<LexEntry | null> {
    return this.call({ type: 'lookup', strong });
  }

  lookupByLemma(lemma: string, lang: 'Heb' | 'Grk'): Promise<LexEntry | null> {
    return this.call({ type: 'lookup_lemma', lemma, lang });
  }

  studyLookup(strong: string | null | undefined, lemma: string | null | undefined, lang: 'Heb' | 'Grk'): Promise<StudyEntry[]> {
    return this.call({ type: 'study_lookup', strong, lemma, lang });
  }

  wordStudy(request: StudyRequest): Promise<WordStudyData> {
    return this.call({ type: 'word_study', request });
  }

  searchDefinitions(word: string): Promise<LexEntry[]> {
    return this.call({ type: 'search_definitions', word });
  }

  fetchChapter(abbr3: string, chapter: number): Promise<ChapterFetchResult> {
    return this.call({ type: 'fetch_chapter', abbr3, chapter, translation: 'NASB' });
  }

  fetchChapterOriginals(abbr3: string, chapter: number, testament: 'OT' | 'NT'): Promise<ChapterVerseOriginals[]> {
    return this.call({ type: 'fetch_chapter_originals', abbr3, chapter, testament });
  }

  private citationMapPromise: Promise<CitationMap> | null = null;

  /** Hebrew (BHS) → English verse numbers for lexicon citations; loaded once per session. */
  citationMap(): Promise<CitationMap> {
    this.citationMapPromise ??= this.call<[number, number, number, number | null, number | null, number | null][]>({ type: 'citation_map' })
      .then((rows) => new Map(rows.map(([b, c, v, tb, tc, tv]) => [
        `${b}:${c}:${v}`, tb === null ? null : { bookId: tb, chapter: tc!, verse: tv! },
      ])));
    this.citationMapPromise.catch(() => { this.citationMapPromise = null; });
    return this.citationMapPromise;
  }

  private previewChapters = new Map<string, Promise<[ChapterFetchResult, ChapterVerseOriginals[]]>>();

  /** NASB text plus original-language tokens for one verse; chapters are cached for repeated previews. */
  async fetchVersePreview(bookId: number, chapter: number, verse: number): Promise<VersePreview | null> {
    const book = BOOK_BY_ID.get(bookId);
    if (!book) return null;
    const key = `${book.abbr3}:${chapter}`;
    let pending = this.previewChapters.get(key);
    if (!pending) {
      pending = Promise.all([this.fetchChapter(book.abbr3, chapter), this.fetchChapterOriginals(book.abbr3, chapter, book.testament)]);
      pending.catch(() => this.previewChapters.delete(key));
      this.previewChapters.set(key, pending);
    }
    const [text, originals] = await pending;
    const english = text.verses.find((v) => v.verse === verse)?.text ?? null;
    const sections = originals.find((v) => v.verse === verse)?.originals ?? [];
    if (english === null && !sections.length) return null;
    return { label: `${book.name} ${chapter}:${verse}`, english, originals: sections };
  }

  /** Clear the OPFS cache and re-download the DB from the server. */
  async forceRefresh(): Promise<void> {
    this.setStatus('progress', 'Clearing cache…');
    await this.call({ type: 'force_refresh' });
    this.setStatus('progress', 'Reloading app…');
    globalThis.location?.reload();
  }

  fetchCrossRefs(bookId: number, chapter: number, verse: number): Promise<CrossRef[]> {
    return this.call({ type: 'fetch_cross_refs', bookId, chapter, verse });
  }

  fetchCrossRefsBulk(verses: Array<{ bookId: number; chapter: number; verse: number }>): Promise<Map<string, CrossRef[]>> {
    return this.call<Array<{ key: string; refs: CrossRef[] }>>({ type: 'fetch_cross_refs_bulk', verses })
      .then((items) => {
        const map = new Map<string, CrossRef[]>();
        for (const item of items) map.set(item.key, item.refs);
        return map;
      });
  }

}

export interface ChapterVerse {
  verse: number;
  text: string;
}

export interface ChapterFetchResult {
  verses: ChapterVerse[];
  totalChapters: number;
}

export interface ChapterVerseOriginals {
  verse: number;
  originals: {
    corpus: 'WLC' | 'LXX' | 'GNT';
    lang: 'Heb' | 'Grk';
    /** The edition's own verse label when it differs from the English verse (e.g. LXX "22:1"). */
    sourceRef?: string;
    tokens: {
      surface: string; translit: string; gloss: string;
      root: string | null; lemma: string | null; strong: string | null;
      form: string | null; corpus: 'WLC' | 'LXX' | 'GNT'; highlight: boolean;
    }[];
  }[];
}

export interface VersePreview {
  label: string;
  english: string | null;
  originals: ChapterVerseOriginals['originals'];
}

export interface CrossRef {
  sourceBookId: number;
  sourceChapter: number;
  sourceVerse: number;
  targetBookId: number;
  targetChapter: number;
  targetVerseStart: number;
  targetVerseEnd: number | null;
  /** Human-readable label, e.g. "John 3:16" */
  targetLabel: string;
  targetAbbr3: string;
  votes: number | null;
  sourceDataset: 'openbible' | 'user';
  /** Only present on user-added refs */
  userRefId?: number;
  userNote?: string | null;
  createdFrom?: 'search' | 'browse' | 'class';
}

export interface LexEntry {
  estrong: string;
  dstrong: string;
  ustrong: string | null;
  lang: string;
  lemma: string | null;
  translit: string | null;
  morph: string | null;
  gloss: string | null;
  meaning: string | null;
}

export interface StudySense {
  definition: string;
  glosses: string[];
  domains: string[];
  references: string[];
  note: string;
  code: string;
}

export interface StudyEntry {
  id: string;
  source: 'bdb' | 'lsj' | 'ubs-greek' | 'ubs-hebrew';
  lemma: string;
  senses: StudySense[];
}

// Singleton — created once the module is imported
export const dbClient = new DBClient();
