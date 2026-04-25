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
    this.worker = new Worker(new URL('../workers/db.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.addEventListener('message', this.onMessage);
    this.worker.addEventListener('error', (e) => {
      this.setStatus('error', e.message);
    });
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
