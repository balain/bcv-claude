// ============================================================================
// client.ts — main-thread RPC client for class_* messages.
//
// Sits alongside bcv-claude's existing `lib/db.ts` DBClient. Uses the same
// id+Promise pattern: each request gets a monotonically increasing id, the
// pending Promise resolves when the worker replies with that id.
//
// Usage from a component:
//   import { classClient } from './lib/class/client';
//   const session = await classClient.session.create({ title, taughtOn });
// ============================================================================

import type {
  ClassRequest, RpcResponse, Session, SessionStatus, ScriptureRef,
  Series, SessionSummary, SessionExportV1, ImportReport, UserCrossRef,
} from './types.ts';

interface PendingResolver {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
}

class ClassClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, PendingResolver>();

  constructor(worker: Worker) {
    this.worker = worker;
    // Note: this client INTENTIONALLY adds its own listener. If the existing
    // bcv-claude DBClient already has one, both listeners coexist; each filters
    // by message id ownership. Alternative: route through the existing client's
    // message handler. See INTEGRATION.md.
    this.worker.addEventListener('message', this.onMessage);
  }

  private onMessage = (e: MessageEvent): void => {
    const msg = e.data as RpcResponse | { type: string };
    if (typeof msg !== 'object' || msg === null) return;
    if (!('id' in msg)) return;
    const resolver = this.pending.get(msg.id);
    if (!resolver) return; // not ours
    this.pending.delete(msg.id);
    if (msg.ok) resolver.resolve(msg.data);
    else resolver.reject(new Error(msg.error));
  };

  private call<T>(type: ClassRequest['type'], data: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (d) => resolve(d as T),
        reject,
      });
      const env = { id, db: 'class', type, data };
      this.worker.postMessage(env);
    });
  }

  // ---- Sessions ----
  session = {
    create: (input: { title: string; taughtOn: string; seriesId?: number; primaryText?: string; location?: string }) =>
      this.call<Session>('class_session_create', input),
    list: (filter: { status?: SessionStatus; seriesId?: number; limit?: number } = {}) =>
      this.call<Session[]>('class_session_list', filter),
    get: (sessionId: number) => this.call<Session | null>('class_session_get', { sessionId }),
    update: (sessionId: number, patch: Partial<Session>) =>
      this.call<Session>('class_session_update', { sessionId, patch }),
    delete: (sessionId: number) => this.call<{ ok: true }>('class_session_delete', { sessionId }),
    summary: (sessionId: number) =>
      this.call<SessionSummary | null>('class_session_summary', { sessionId }),
  };

  // ---- Series ----
  series = {
    upsert: (input: { externalId?: string; title: string; description?: string; startedOn?: string; endedOn?: string }) =>
      this.call<Series>('class_series_upsert', input),
    list: () => this.call<Series[]>('class_series_list', {}),
  };

  // ---- Refs ----
  ref = {
    add: (sessionId: number, rawInput: string, options: { contextNote?: string; isAnchor?: boolean } = {}) =>
      this.call<ScriptureRef[]>('class_ref_add', { sessionId, rawInput, ...options }),
    list: (sessionId: number) => this.call<ScriptureRef[]>('class_ref_list', { sessionId }),
    update: (refId: number, patch: { contextNote?: string | null; isAnchor?: boolean }) =>
      this.call<ScriptureRef>('class_ref_update', { refId, patch }),
    delete: (refId: number) => this.call<{ ok: true }>('class_ref_delete', { refId }),
    listByChapter: (bookId: number, chapter: number) =>
      this.call<ScriptureRef[]>('class_ref_by_chapter', { bookId, chapter }),
  };

  // ---- User cross-refs ----
  crossRef = {
    add: (input: {
      sourceBookId: number; sourceChapter: number; sourceVerse: number;
      targetRawInput: string; sessionId?: number; note?: string;
      createdFrom: 'search' | 'browse' | 'class';
    }) => this.call<UserCrossRef[]>('class_cross_ref_add', input),

    update: (id: number, patch: { note?: string | null }) =>
      this.call<UserCrossRef>('class_cross_ref_update', { id, patch }),

    delete: (id: number) => this.call<{ ok: true }>('class_cross_ref_delete', { id }),

    listBySource: (sourceBookId: number, sourceChapter: number, sourceVerse: number) =>
      this.call<UserCrossRef[]>('class_cross_ref_list_by_source', { sourceBookId, sourceChapter, sourceVerse }),

    listByChapter: (sourceBookId: number, sourceChapter: number) =>
      this.call<UserCrossRef[]>('class_cross_ref_list_by_chapter', { sourceBookId, sourceChapter }),
  };

  // ---- Export / import ----
  exportSession = (sessionId: number) =>
    this.call<SessionExportV1>('class_export_session', { sessionId });

  importSession = (json: string, mergePolicy: 'lww' | 'fail-on-conflict' = 'lww') =>
    this.call<ImportReport>('class_import_session', { json, mergePolicy });

  // ---- Meta ----
  meta = {
    get: (key: string) => this.call<string | null>('class_meta_get', { key }),
    set: (key: string, value: string) => this.call<{ ok: true }>('class_meta_set', { key, value }),
  };
}

// Singleton, lazy. The caller passes the shared worker on first use.
let _client: ClassClient | null = null;
export function initClassClient(worker: Worker): ClassClient {
  if (!_client) _client = new ClassClient(worker);
  return _client;
}
export function getClassClient(): ClassClient {
  if (!_client) throw new Error('class client not initialized; call initClassClient(worker) first');
  return _client;
}
