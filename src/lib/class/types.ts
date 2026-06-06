// ============================================================================
// types.ts — Class Mode TypeScript types.
//
// Drop into `src/lib/class/types.ts` in bcv-claude. Domain entities mirror
// class.db schema; field names are camelCase (mapped from snake_case in SQL
// by dataAccess.ts).
// ============================================================================

// ----------------------------------------------------------------------------
// Domain entities
// ----------------------------------------------------------------------------

export type SessionStatus = 'active' | 'archived';
export type FollowUpKind   = 'question' | 'word_study' | 'cross_ref' | 'reading' | 'other';
export type FollowUpStatus = 'open' | 'in_progress' | 'done' | 'dropped';
export type TopicWeight    = 1 | 2 | 3;     // 1 touched, 2 discussed, 3 central
export type Priority       = 1 | 2 | 3;     // 1 high, 2 normal, 3 someday
export type Lang           = 'Heb' | 'Grk';
export type Corpus         = 'WLC' | 'LXX' | 'GNT';

export interface Series {
  id: number;
  externalId: string;
  title: string;
  description: string | null;
  startedOn: string | null;
  endedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: number;
  externalId: string;
  title: string;
  seriesId: number | null;
  taughtOn: string;
  location: string | null;
  primaryText: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptureRef {
  id: number;
  externalId: string;
  sessionId: number;
  bookId: number;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  rawInput: string;
  contextNote: string | null;
  isAnchor: boolean;
  capturedAt: string;
  updatedAt: string;
}

export interface Topic {
  id: number;
  externalId: string;
  name: string;
  parentId: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionTopic {
  sessionId: number;
  topicId: number;
  weight: TopicWeight;
  note: string | null;
  updatedAt: string;
}

export interface FollowUpRef {
  bookId: number;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  rawInput: string | null;
}

export interface FollowUpLex {
  lang: Lang;
  strong: string | null;
  lemma: string | null;
  bdagRef: string | null;
  note: string | null;
}

export interface FollowUp {
  id: number;
  externalId: string;
  sessionId: number | null;
  kind: FollowUpKind;
  description: string;
  priority: Priority;
  status: FollowUpStatus;
  due: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  refs: FollowUpRef[];
  lex: FollowUpLex[];
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: number;
  externalId: string;
  sessionId: number;
  body: string;
  refId: number | null;
  topicId: number | null;
  capturedAt: string;
  updatedAt: string;
}

export interface UserCrossRef {
  id: number;
  externalId: string;
  sessionId: number | null;
  sourceBookId: number;
  sourceChapter: number;
  sourceVerse: number;
  targetBookId: number;
  targetChapter: number;
  targetVerseStart: number;
  targetVerseEnd: number | null;
  note: string | null;
  createdFrom: 'search' | 'browse' | 'class';
  createdAt: string;
  updatedAt: string;
}

export interface LexMark {
  id: number;
  externalId: string;
  sessionId: number;
  refId: number | null;
  bookId: number;
  chapter: number;
  verse: number;
  wordNum: number | null;
  corpus: Corpus | null;
  surface: string | null;
  lemma: string | null;
  strong: string | null;
  bdagRef: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Aggregates
// ----------------------------------------------------------------------------

export interface SessionTopicLink extends Topic {
  weight: TopicWeight;
  note: string | null;
}

export interface SessionSummary {
  session: Session;
  series: Series | null;
  refs: ScriptureRef[];
  topics: SessionTopicLink[];
  noteCount: number;
  lexMarkCount: number;
  followUpCounts: Record<FollowUpStatus, number>;
}

// ----------------------------------------------------------------------------
// Worker RPC (request types)
// ----------------------------------------------------------------------------

// Each request type maps 1:1 to a function in workerHandlers.ts.
// All class-mode messages share `db: 'class'` so the worker dispatcher can
// route correctly alongside existing `db: 'bcv'` messages.

export interface RpcEnvelope<T extends string = string, D = unknown> {
  id: number;
  db: 'class';
  type: T;
  data: D;
}

export type ClassRequest =
  // Sessions
  | RpcEnvelope<'class_session_create', { title: string; taughtOn: string; seriesId?: number; primaryText?: string; location?: string }>
  | RpcEnvelope<'class_session_list',   { status?: SessionStatus; seriesId?: number; limit?: number }>
  | RpcEnvelope<'class_session_get',    { sessionId: number }>
  | RpcEnvelope<'class_session_update', { sessionId: number; patch: Partial<Pick<Session, 'title' | 'seriesId' | 'taughtOn' | 'location' | 'primaryText' | 'status'>> }>
  | RpcEnvelope<'class_session_delete', { sessionId: number }>
  | RpcEnvelope<'class_session_summary', { sessionId: number }>

  // Series
  | RpcEnvelope<'class_series_upsert', { externalId?: string; title: string; description?: string; startedOn?: string; endedOn?: string }>
  | RpcEnvelope<'class_series_list',   {}>

  // Refs
  | RpcEnvelope<'class_ref_add',          { sessionId: number; rawInput: string; contextNote?: string; isAnchor?: boolean }>
  | RpcEnvelope<'class_ref_list',         { sessionId: number }>
  | RpcEnvelope<'class_ref_update',       { refId: number; patch: { contextNote?: string | null; isAnchor?: boolean } }>
  | RpcEnvelope<'class_ref_delete',       { refId: number }>
  | RpcEnvelope<'class_ref_by_chapter',   { bookId: number; chapter: number }>

  // Export / import (Phase 1)
  | RpcEnvelope<'class_export_session', { sessionId: number }>
  | RpcEnvelope<'class_import_session', { json: string; mergePolicy?: 'lww' | 'fail-on-conflict' }>

  // User cross-refs
  | RpcEnvelope<'class_cross_ref_add', {
      sourceBookId: number; sourceChapter: number; sourceVerse: number;
      targetRawInput: string;
      sessionId?: number; note?: string; createdFrom: 'search' | 'browse' | 'class';
    }>
  | RpcEnvelope<'class_cross_ref_update', {
      id: number; patch: { note?: string | null }
    }>
  | RpcEnvelope<'class_cross_ref_delete', { id: number }>
  | RpcEnvelope<'class_cross_ref_list_by_source', {
      sourceBookId: number; sourceChapter: number; sourceVerse: number
    }>
  | RpcEnvelope<'class_cross_ref_list_by_chapter', {
      sourceBookId: number; sourceChapter: number
    }>

  // Meta
  | RpcEnvelope<'class_meta_get', { key: string }>
  | RpcEnvelope<'class_meta_set', { key: string; value: string }>;

// ----------------------------------------------------------------------------
// Response envelope
// ----------------------------------------------------------------------------

export type RpcResponse<T = unknown> =
  | { id: number; ok: true;  data: T }
  | { id: number; ok: false; error: string };

// ----------------------------------------------------------------------------
// Import diff (returned by class_import_session)
// ----------------------------------------------------------------------------

export interface ImportReport {
  added: number;
  updated: number;
  skipped: number;
  deleted: number;
  conflicts: Array<{ table: string; externalId: string; reason: string }>;
}

// ----------------------------------------------------------------------------
// Session export envelope
// ----------------------------------------------------------------------------

export interface SessionExportV1 {
  kind: 'class.session/v1';
  exportedAt: string;
  deviceId: string;
  session: Session;
  series: Series | null;
  scriptureRefs: ScriptureRef[];
  topics: Topic[];
  sessionTopics: SessionTopic[];
  notes: Note[];
  lexMarks: LexMark[];
  followUps: FollowUp[];
}
