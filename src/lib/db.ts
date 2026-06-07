/**
 * Main-thread RPC client for db.worker.ts.
 * Exposes searchDB() and lookupStrong() as Promises.
 */

import type { BibleResult, Source } from '../types';

type WorkerReply =
  | { id: string; ok: true; data: any }
  | { id: string; ok: false; error: string }
  | { type: 'ready' }
  | { type: 'progress'; message: string }
  | { type: 'error'; message: string };

export type DBStatus = 'initializing' | 'progress' | 'ready' | 'error';

type StatusListener = (status: DBStatus, message?: string) => void;

class DBClient {
  private worker: Worker;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private seq = 0;
  private statusListeners: StatusListener[] = [];
  public status: DBStatus = 'initializing';

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

  search(query: string, source: Source): Promise<BibleResult[]> {
    return this.call({ type: 'search', query, source });
  }

  lookup(strong: string): Promise<LexEntry | null> {
    return this.call({ type: 'lookup', strong });
  }

  lookupByLemma(lemma: string, lang: 'Heb' | 'Grk'): Promise<LexEntry | null> {
    return this.call({ type: 'lookup_lemma', lemma, lang });
  }

  fetchChapter(abbr3: string, chapter: number): Promise<ChapterFetchResult> {
    return this.call({ type: 'fetch_chapter', abbr3, chapter, translation: 'NASB' });
  }

  fetchChapterOriginals(abbr3: string, chapter: number, testament: 'OT' | 'NT'): Promise<ChapterVerseOriginals[]> {
    return this.call({ type: 'fetch_chapter_originals', abbr3, chapter, testament });
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
    tokens: {
      surface: string; translit: string; gloss: string;
      root: string | null; lemma: string | null; strong: string | null;
      form: string | null; corpus: 'WLC' | 'LXX' | 'GNT'; highlight: boolean;
    }[];
  }[];
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

// Singleton — created once the module is imported
export const dbClient = new DBClient();
