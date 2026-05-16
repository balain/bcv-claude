// ============================================================================
// dataAccess.ts — all SQL queries for class.db.
//
// Targets the DB facade in db.ts (compatible with @sqlite.org/sqlite-wasm).
// Row mapping converts snake_case columns to camelCase TypeScript fields.
// All inserts assign `external_id` UUIDs in JS so they're stable across
// devices and survive export/import unchanged.
// ============================================================================

import type { DB, Row } from './db.ts';
import { uuid } from './uuid.ts';
import { parseRefs } from './refParser.ts';
import type {
  Series, Session, ScriptureRef, Topic, FollowUp,
  FollowUpRef, FollowUpLex, Note, LexMark, SessionStatus, FollowUpStatus,
  FollowUpKind, Priority, TopicWeight, Lang, Corpus,
  SessionSummary, SessionTopicLink,
} from './types.ts';

// ----------------------------------------------------------------------------
// Row mappers
// ----------------------------------------------------------------------------

function rowToSeries(r: Row): Series {
  return {
    id: r.id as number,
    externalId: r.external_id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    startedOn: (r.started_on as string | null) ?? null,
    endedOn: (r.ended_on as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToSession(r: Row): Session {
  return {
    id: r.id as number,
    externalId: r.external_id as string,
    title: r.title as string,
    seriesId: (r.series_id as number | null) ?? null,
    taughtOn: r.taught_on as string,
    location: (r.location as string | null) ?? null,
    primaryText: (r.primary_text as string | null) ?? null,
    status: r.status as SessionStatus,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToRef(r: Row): ScriptureRef {
  return {
    id: r.id as number,
    externalId: r.external_id as string,
    sessionId: r.session_id as number,
    bookId: r.book_id as number,
    chapter: r.chapter as number,
    verseStart: (r.verse_start as number | null) ?? null,
    verseEnd: (r.verse_end as number | null) ?? null,
    rawInput: r.raw_input as string,
    contextNote: (r.context_note as string | null) ?? null,
    isAnchor: !!r.is_anchor,
    capturedAt: r.captured_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToTopic(r: Row): Topic {
  return {
    id: r.id as number,
    externalId: r.external_id as string,
    name: r.name as string,
    parentId: (r.parent_id as number | null) ?? null,
    description: (r.description as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToSessionTopicLink(r: Row): SessionTopicLink {
  return {
    ...rowToTopic(r),
    weight: r.weight as TopicWeight,
    note: (r.note as string | null) ?? null,
  };
}

function rowToNote(r: Row): Note {
  return {
    id: r.id as number,
    externalId: r.external_id as string,
    sessionId: r.session_id as number,
    body: r.body as string,
    refId: (r.ref_id as number | null) ?? null,
    topicId: (r.topic_id as number | null) ?? null,
    capturedAt: r.captured_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToLexMark(r: Row): LexMark {
  return {
    id: r.id as number,
    externalId: r.external_id as string,
    sessionId: r.session_id as number,
    refId: (r.ref_id as number | null) ?? null,
    bookId: r.book_id as number,
    chapter: r.chapter as number,
    verse: r.verse as number,
    wordNum: (r.word_num as number | null) ?? null,
    corpus: (r.corpus as Corpus | null) ?? null,
    surface: (r.surface as string | null) ?? null,
    lemma: (r.lemma as string | null) ?? null,
    strong: (r.strong as string | null) ?? null,
    bdagRef: (r.bdag_ref as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToFollowUpRef(r: Row): FollowUpRef {
  return {
    bookId: r.book_id as number,
    chapter: r.chapter as number,
    verseStart: (r.verse_start as number | null) ?? null,
    verseEnd: (r.verse_end as number | null) ?? null,
    rawInput: (r.raw_input as string | null) ?? null,
  };
}

function rowToFollowUpLex(r: Row): FollowUpLex {
  return {
    lang: r.lang as Lang,
    strong: (r.strong as string | null) ?? null,
    lemma: (r.lemma as string | null) ?? null,
    bdagRef: (r.bdag_ref as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  };
}

function rowToFollowUp(r: Row, refs: FollowUpRef[], lex: FollowUpLex[]): FollowUp {
  return {
    id: r.id as number,
    externalId: r.external_id as string,
    sessionId: (r.session_id as number | null) ?? null,
    kind: r.kind as FollowUpKind,
    description: r.description as string,
    priority: r.priority as Priority,
    status: r.status as FollowUpStatus,
    due: (r.due as string | null) ?? null,
    resolutionNote: (r.resolution_note as string | null) ?? null,
    resolvedAt: (r.resolved_at as string | null) ?? null,
    refs,
    lex,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ----------------------------------------------------------------------------
// Meta
// ----------------------------------------------------------------------------

export function getMeta(db: DB, key: string): string | null {
  const r = db.get<{ value: string }>('SELECT value FROM _meta WHERE key = ?', [key]);
  return r?.value ?? null;
}

export function setMeta(db: DB, key: string, value: string): void {
  db.run(
    'INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

// ----------------------------------------------------------------------------
// Series
// ----------------------------------------------------------------------------

export function listSeries(db: DB): Series[] {
  return db.all('SELECT * FROM v_series ORDER BY started_on DESC, title').map(rowToSeries);
}

export function upsertSeries(
  db: DB,
  input: { externalId?: string; title: string; description?: string; startedOn?: string; endedOn?: string }
): Series {
  const externalId = input.externalId ?? uuid();
  // ON CONFLICT UPDATE keeps idempotency for sync re-imports.
  db.run(
    `INSERT INTO series (external_id, title, description, started_on, ended_on)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(external_id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       started_on = excluded.started_on,
       ended_on = excluded.ended_on`,
    [externalId, input.title, input.description ?? null, input.startedOn ?? null, input.endedOn ?? null]
  );
  const row = db.get<Row>('SELECT * FROM series WHERE external_id = ?', [externalId])!;
  return rowToSeries(row);
}

// ----------------------------------------------------------------------------
// Sessions
// ----------------------------------------------------------------------------

export function createSession(
  db: DB,
  input: { title: string; taughtOn: string; seriesId?: number; primaryText?: string; location?: string }
): Session {
  const externalId = uuid();
  const result = db.run(
    `INSERT INTO sessions (external_id, title, taught_on, series_id, primary_text, location)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      externalId,
      input.title,
      input.taughtOn,
      input.seriesId ?? null,
      input.primaryText ?? null,
      input.location ?? null,
    ]
  );
  const row = db.get<Row>('SELECT * FROM sessions WHERE id = ?', [result.lastInsertRowid])!;
  return rowToSession(row);
}

export function listSessions(
  db: DB,
  filter: { status?: SessionStatus; seriesId?: number; limit?: number } = {}
): Session[] {
  const where: string[] = ['deleted_at IS NULL'];
  const bind: (string | number)[] = [];
  if (filter.status) {
    where.push('status = ?');
    bind.push(filter.status);
  }
  if (filter.seriesId !== undefined) {
    where.push('series_id = ?');
    bind.push(filter.seriesId);
  }
  let sql = `SELECT * FROM sessions WHERE ${where.join(' AND ')} ORDER BY taught_on DESC, id DESC`;
  if (filter.limit) {
    sql += ` LIMIT ${Math.max(1, Math.floor(filter.limit))}`;
  }
  return db.all(sql, bind).map(rowToSession);
}

export function getSession(db: DB, sessionId: number): Session | null {
  const r = db.get<Row>('SELECT * FROM v_sessions WHERE id = ?', [sessionId]);
  return r ? rowToSession(r) : null;
}

export function updateSession(
  db: DB,
  sessionId: number,
  patch: Partial<Pick<Session, 'title' | 'seriesId' | 'taughtOn' | 'location' | 'primaryText' | 'status'>>
): Session {
  const colMap: Record<string, string> = {
    title: 'title',
    seriesId: 'series_id',
    taughtOn: 'taught_on',
    location: 'location',
    primaryText: 'primary_text',
    status: 'status',
  };
  const sets: string[] = [];
  const bind: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = colMap[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    bind.push(v as string | number | null);
  }
  if (sets.length === 0) return getSession(db, sessionId)!;
  bind.push(sessionId);
  db.run(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`, bind);
  return getSession(db, sessionId)!;
}

/** Soft delete. Cascades to refs/topics/notes/lex_marks via FK; follow-ups go session_id = NULL. */
export function deleteSession(db: DB, sessionId: number): void {
  // We do a hard delete here so FK cascades fire. The schema's tombstones
  // are designed for sync semantics on imported rows; locally, the user
  // explicitly chose to delete, and FK cascade is the cleanest behaviour.
  // If you'd rather keep a tombstone, replace this with:
  //   UPDATE sessions SET deleted_at = strftime(...) WHERE id = ?
  // and update queries to filter v_sessions.
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

// ----------------------------------------------------------------------------
// Scripture refs
// ----------------------------------------------------------------------------

/**
 * Add one or more scripture refs by parsing a raw input string.
 * Returns all refs created (a single input may parse to multiple refs).
 */
export function addRefs(
  db: DB,
  sessionId: number,
  rawInput: string,
  options: { contextNote?: string; isAnchor?: boolean } = {}
): ScriptureRef[] {
  const parsed = parseRefs(rawInput);
  if (parsed.refs.length === 0) {
    throw new Error(parsed.errors[0] ?? `could not parse "${rawInput}"`);
  }
  const created: ScriptureRef[] = [];
  db.transaction(() => {
    for (const r of parsed.refs) {
      const externalId = uuid();
      const result = db.run(
        `INSERT INTO scripture_refs
           (external_id, session_id, book_id, chapter, verse_start, verse_end, raw_input, context_note, is_anchor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          externalId,
          sessionId,
          r.bookId,
          r.chapter,
          r.verseStart,
          r.verseEnd,
          r.rawInput,
          options.contextNote ?? null,
          options.isAnchor ? 1 : 0,
        ]
      );
      const row = db.get<Row>('SELECT * FROM scripture_refs WHERE id = ?', [result.lastInsertRowid])!;
      created.push(rowToRef(row));
    }
  });
  return created;
}

export function listRefs(db: DB, sessionId: number): ScriptureRef[] {
  return db
    .all<Row>(
      `SELECT * FROM v_scripture_refs WHERE session_id = ? ORDER BY captured_at, id`,
      [sessionId]
    )
    .map(rowToRef);
}

export function updateRef(
  db: DB,
  refId: number,
  patch: { contextNote?: string | null; isAnchor?: boolean }
): ScriptureRef {
  const sets: string[] = [];
  const bind: (string | number | null)[] = [];
  if ('contextNote' in patch) {
    sets.push('context_note = ?');
    bind.push(patch.contextNote ?? null);
  }
  if ('isAnchor' in patch) {
    sets.push('is_anchor = ?');
    bind.push(patch.isAnchor ? 1 : 0);
  }
  if (sets.length === 0) {
    return rowToRef(db.get<Row>('SELECT * FROM scripture_refs WHERE id = ?', [refId])!);
  }
  bind.push(refId);
  db.run(`UPDATE scripture_refs SET ${sets.join(', ')} WHERE id = ?`, bind);
  return rowToRef(db.get<Row>('SELECT * FROM scripture_refs WHERE id = ?', [refId])!);
}

export function deleteRef(db: DB, refId: number): void {
  db.run('DELETE FROM scripture_refs WHERE id = ?', [refId]);
}

// ----------------------------------------------------------------------------
// Topics & session_topics  (Phase 2 — exposed here for the import path only)
// ----------------------------------------------------------------------------

export function listTopics(db: DB): Topic[] {
  return db.all<Row>('SELECT * FROM v_topics ORDER BY name').map(rowToTopic);
}

export function listSessionTopics(db: DB, sessionId: number): SessionTopicLink[] {
  return db
    .all<Row>(
      `SELECT t.*, st.weight, st.note
       FROM session_topics st JOIN topics t ON t.id = st.topic_id
       WHERE st.session_id = ? AND st.deleted_at IS NULL AND t.deleted_at IS NULL
       ORDER BY t.name`,
      [sessionId]
    )
    .map(rowToSessionTopicLink);
}

// ----------------------------------------------------------------------------
// Notes (Phase 2 — listing helper for export)
// ----------------------------------------------------------------------------

export function listNotes(db: DB, sessionId: number): Note[] {
  return db
    .all<Row>('SELECT * FROM v_notes WHERE session_id = ? ORDER BY captured_at, id', [sessionId])
    .map(rowToNote);
}

// ----------------------------------------------------------------------------
// Lex marks (Phase 2 — listing helper for export)
// ----------------------------------------------------------------------------

export function listLexMarks(db: DB, sessionId: number): LexMark[] {
  return db
    .all<Row>('SELECT * FROM v_lex_marks WHERE session_id = ? ORDER BY created_at, id', [sessionId])
    .map(rowToLexMark);
}

// ----------------------------------------------------------------------------
// Follow-ups (Phase 2 — listing helper for export)
// ----------------------------------------------------------------------------

export function listFollowUps(
  db: DB,
  filter: { sessionId?: number; status?: FollowUpStatus } = {}
): FollowUp[] {
  const where: string[] = ['deleted_at IS NULL'];
  const bind: (string | number)[] = [];
  if (filter.sessionId !== undefined) {
    where.push('session_id = ?');
    bind.push(filter.sessionId);
  }
  if (filter.status) {
    where.push('status = ?');
    bind.push(filter.status);
  }
  const heads = db.all<Row>(
    `SELECT * FROM follow_ups WHERE ${where.join(' AND ')} ORDER BY priority, created_at`,
    bind
  );
  return heads.map((h) => {
    const refs = db
      .all<Row>('SELECT * FROM follow_up_refs WHERE follow_up_id = ?', [h.id as number])
      .map(rowToFollowUpRef);
    const lex = db
      .all<Row>('SELECT * FROM follow_up_lex WHERE follow_up_id = ?', [h.id as number])
      .map(rowToFollowUpLex);
    return rowToFollowUp(h, refs, lex);
  });
}

// ----------------------------------------------------------------------------
// Session summary (used by SessionView)
// ----------------------------------------------------------------------------

export function getSessionSummary(db: DB, sessionId: number): SessionSummary | null {
  const session = getSession(db, sessionId);
  if (!session) return null;

  const series = session.seriesId
    ? rowToSeries(db.get<Row>('SELECT * FROM v_series WHERE id = ?', [session.seriesId])!)
    : null;
  const refs = listRefs(db, sessionId);
  const topics = listSessionTopics(db, sessionId);
  const noteCount = (db.get<{ c: number }>(
    'SELECT count(*) AS c FROM v_notes WHERE session_id = ?',
    [sessionId]
  )?.c) ?? 0;
  const lexMarkCount = (db.get<{ c: number }>(
    'SELECT count(*) AS c FROM v_lex_marks WHERE session_id = ?',
    [sessionId]
  )?.c) ?? 0;

  // Follow-up counts per status (single grouped query)
  const counts: Record<FollowUpStatus, number> = { open: 0, in_progress: 0, done: 0, dropped: 0 };
  const rows = db.all<{ status: FollowUpStatus; c: number }>(
    `SELECT status, count(*) AS c FROM v_follow_ups
     WHERE session_id = ? GROUP BY status`,
    [sessionId]
  );
  for (const r of rows) counts[r.status] = r.c;

  return {
    session,
    series,
    refs,
    topics,
    noteCount,
    lexMarkCount,
    followUpCounts: counts,
  };
}
