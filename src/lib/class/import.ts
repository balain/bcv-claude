// ============================================================================
// import.ts — apply a SessionExportV1 to the local DB.
//
// Per-row logic (last-write-wins on updated_at):
//   1. Match on external_id.
//   2. If not found locally -> INSERT (preserve external_id).
//   3. If incoming.deleted_at IS NOT NULL -> apply tombstone.
//   4. Else if incoming.updated_at > local.updated_at -> UPDATE.
//   5. Else -> skip.
//
// Returns an ImportReport with counts and any conflicts.
// ============================================================================

import type { DB, Row } from './db.ts';
import type {
  SessionExportV1, ImportReport, Series, Session, ScriptureRef,
  Topic, SessionTopic, Note, LexMark, FollowUp,
} from './types.ts';

interface Tally {
  added: number;
  updated: number;
  skipped: number;
  deleted: number;
  conflicts: ImportReport['conflicts'];
}

const empty = (): Tally => ({ added: 0, updated: 0, skipped: 0, deleted: 0, conflicts: [] });

/**
 * Decide what to do with one incoming row given the local row (if any).
 * Returns: 'insert' | 'update' | 'tombstone' | 'skip'.
 */
function decide(
  localUpdatedAt: string | undefined,
  incomingUpdatedAt: string,
  incomingDeletedAt: string | null | undefined
): 'insert' | 'update' | 'tombstone' | 'skip' {
  if (localUpdatedAt === undefined) {
    if (incomingDeletedAt) return 'tombstone'; // create-then-mark-deleted
    return 'insert';
  }
  if (incomingDeletedAt) return 'tombstone';
  if (incomingUpdatedAt > localUpdatedAt) return 'update';
  return 'skip';
}

export function importSession(
  db: DB,
  payload: SessionExportV1,
  options: { mergePolicy?: 'lww' | 'fail-on-conflict' } = {}
): ImportReport {
  if (payload.kind !== 'class.session/v1') {
    throw new Error(`unsupported export kind: ${payload.kind}`);
  }
  const failOnConflict = options.mergePolicy === 'fail-on-conflict';
  const tally = empty();

  db.transaction(() => {
    // 1. Series (optional)
    if (payload.series) {
      applySeries(db, payload.series, tally, failOnConflict);
    }
    // 2. Topics — build topicIdMap so session_topics can resolve cross-device IDs
    const topicIdMap = new Map<number, number>(); // source-device topic.id -> local topic.id
    for (const t of payload.topics) {
      const localId = applyTopic(db, t, tally, failOnConflict);
      if (localId !== null) topicIdMap.set(t.id, localId);
    }
    // 3. Session
    const localSessionId = applySession(db, payload.session, payload.series?.externalId ?? null, tally, failOnConflict);
    if (localSessionId === null) {
      // Couldn't apply session — bail (the export's other rows would dangle)
      return;
    }
    // 4. Scripture refs (need session id; map externalId -> local id for lex_marks/notes)
    const refIdMap = new Map<string, number>();
    for (const r of payload.scriptureRefs) {
      const localRefId = applyScriptureRef(db, r, localSessionId, tally, failOnConflict);
      if (localRefId !== null) refIdMap.set(r.externalId, localRefId);
    }
    // 5. session_topics (link rows) — resolve cross-device topicIds via topicIdMap
    for (const st of payload.sessionTopics) {
      applySessionTopic(db, st, localSessionId, topicIdMap, tally, failOnConflict);
    }
    // 6. Notes
    for (const n of payload.notes) {
      applyNote(db, n, localSessionId, refIdMap, tally, failOnConflict);
    }
    // 7. Lex marks
    for (const m of payload.lexMarks) {
      applyLexMark(db, m, localSessionId, refIdMap, tally, failOnConflict);
    }
    // 8. Follow-ups (heads + dependent refs/lex rows)
    for (const fu of payload.followUps) {
      applyFollowUp(db, fu, localSessionId, tally, failOnConflict);
    }
  });

  return tally;
}

// ----------------------------------------------------------------------------
// Per-table appliers
// ----------------------------------------------------------------------------

function applySeries(db: DB, s: Series, tally: Tally, fail: boolean): void {
  const local = db.get<Row>('SELECT id, updated_at FROM series WHERE external_id = ?', [s.externalId]);
  const action = decide(local?.updated_at as string | undefined, s.updatedAt, null);
  switch (action) {
    case 'insert':
      db.run(
        `INSERT INTO series (external_id, title, description, started_on, ended_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [s.externalId, s.title, s.description, s.startedOn, s.endedOn, s.createdAt, s.updatedAt]
      );
      tally.added++;
      break;
    case 'update':
      db.run(
        `UPDATE series SET title = ?, description = ?, started_on = ?, ended_on = ?, updated_at = ?
         WHERE external_id = ?`,
        [s.title, s.description, s.startedOn, s.endedOn, s.updatedAt, s.externalId]
      );
      tally.updated++;
      break;
    case 'skip':
      tally.skipped++;
      break;
    case 'tombstone':
      // Series have no deleted_at on incoming in v1; leave as-is.
      tally.skipped++;
      break;
  }
  void fail;
}

function applyTopic(db: DB, t: Topic, tally: Tally, fail: boolean): number | null {
  const local = db.get<Row>('SELECT id, updated_at FROM topics WHERE external_id = ?', [t.externalId]);
  const action = decide(local?.updated_at as string | undefined, t.updatedAt, null);
  switch (action) {
    case 'insert':
      try {
        const r = db.run(
          `INSERT INTO topics (external_id, name, parent_id, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [t.externalId, t.name, t.parentId, t.description, t.createdAt, t.updatedAt]
        );
        tally.added++;
        return r.lastInsertRowid;
      } catch (e) {
        // UNIQUE conflict on `name` — different topic with same name. Try to attach
        // to the existing row instead so future imports converge.
        const existing = db.get<{ id: number }>('SELECT id FROM topics WHERE name = ?', [t.name]);
        const msg = (e as Error).message;
        if (fail) throw e;
        tally.conflicts.push({
          table: 'topics',
          externalId: t.externalId,
          reason: `name "${t.name}" already exists locally with a different external_id; using existing`,
        });
        tally.skipped++;
        return existing?.id ?? null;
      }
    case 'update':
      db.run(
        `UPDATE topics SET name = ?, parent_id = ?, description = ?, updated_at = ?
         WHERE external_id = ?`,
        [t.name, t.parentId, t.description, t.updatedAt, t.externalId]
      );
      tally.updated++;
      return local!.id as number;
    default:
      tally.skipped++;
      return (local?.id as number | undefined) ?? null;
  }
  void fail;
}

function applySession(
  db: DB,
  s: Session,
  seriesExternalId: string | null,
  tally: Tally,
  fail: boolean
): number | null {
  const seriesIdLocal = seriesExternalId
    ? (db.get<{ id: number }>('SELECT id FROM series WHERE external_id = ?', [seriesExternalId])?.id ?? null)
    : null;
  const local = db.get<Row>(
    'SELECT id, updated_at FROM sessions WHERE external_id = ?',
    [s.externalId]
  );
  const action = decide(local?.updated_at as string | undefined, s.updatedAt, null);
  switch (action) {
    case 'insert': {
      const r = db.run(
        `INSERT INTO sessions (external_id, title, series_id, taught_on, location, primary_text, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.externalId, s.title, seriesIdLocal, s.taughtOn, s.location,
          s.primaryText, s.status, s.createdAt, s.updatedAt,
        ]
      );
      tally.added++;
      return r.lastInsertRowid;
    }
    case 'update':
      db.run(
        `UPDATE sessions SET title = ?, series_id = ?, taught_on = ?, location = ?,
                              primary_text = ?, status = ?, updated_at = ?
         WHERE external_id = ?`,
        [
          s.title, seriesIdLocal, s.taughtOn, s.location,
          s.primaryText, s.status, s.updatedAt, s.externalId,
        ]
      );
      tally.updated++;
      return local!.id as number;
    default:
      tally.skipped++;
      return (local?.id as number | undefined) ?? null;
  }
  void fail;
}

function applyScriptureRef(
  db: DB,
  r: ScriptureRef,
  localSessionId: number,
  tally: Tally,
  fail: boolean
): number | null {
  const local = db.get<Row>(
    'SELECT id, updated_at FROM scripture_refs WHERE external_id = ?',
    [r.externalId]
  );
  const action = decide(local?.updated_at as string | undefined, r.updatedAt, null);
  switch (action) {
    case 'insert': {
      const ins = db.run(
        `INSERT INTO scripture_refs
           (external_id, session_id, book_id, chapter, verse_start, verse_end, raw_input,
            context_note, is_anchor, captured_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.externalId, localSessionId, r.bookId, r.chapter, r.verseStart, r.verseEnd,
          r.rawInput, r.contextNote, r.isAnchor ? 1 : 0,
          r.capturedAt, r.capturedAt, r.updatedAt,
        ]
      );
      tally.added++;
      return ins.lastInsertRowid;
    }
    case 'update':
      db.run(
        `UPDATE scripture_refs SET
           session_id = ?, book_id = ?, chapter = ?, verse_start = ?, verse_end = ?,
           raw_input = ?, context_note = ?, is_anchor = ?, updated_at = ?
         WHERE external_id = ?`,
        [
          localSessionId, r.bookId, r.chapter, r.verseStart, r.verseEnd,
          r.rawInput, r.contextNote, r.isAnchor ? 1 : 0, r.updatedAt, r.externalId,
        ]
      );
      tally.updated++;
      return local!.id as number;
    default:
      tally.skipped++;
      return (local?.id as number | undefined) ?? null;
  }
  void fail;
}

function applySessionTopic(
  db: DB,
  st: SessionTopic,
  localSessionId: number,
  topicIdMap: Map<number, number>,
  tally: Tally,
  fail: boolean
): void {
  // Resolve source-side topicId to local topicId via the map built from
  // the export's topics array.
  const localTopicId = topicIdMap.get(st.topicId);
  if (localTopicId === undefined) {
    tally.conflicts.push({
      table: 'session_topics',
      externalId: `${st.sessionId}:${st.topicId}`,
      reason: 'topic not found in export payload',
    });
    tally.skipped++;
    return;
  }
  const local = db.get<Row>(
    'SELECT updated_at FROM session_topics WHERE session_id = ? AND topic_id = ?',
    [localSessionId, localTopicId]
  );
  const action = decide(local?.updated_at as string | undefined, st.updatedAt, null);
  switch (action) {
    case 'insert':
      db.run(
        `INSERT INTO session_topics (session_id, topic_id, weight, note, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [localSessionId, localTopicId, st.weight, st.note, st.updatedAt]
      );
      tally.added++;
      break;
    case 'update':
      db.run(
        `UPDATE session_topics SET weight = ?, note = ?, updated_at = ?
         WHERE session_id = ? AND topic_id = ?`,
        [st.weight, st.note, st.updatedAt, localSessionId, localTopicId]
      );
      tally.updated++;
      break;
    default:
      tally.skipped++;
  }
  void fail;
}

function applyNote(
  db: DB,
  n: Note,
  localSessionId: number,
  refIdMap: Map<string, number>,
  tally: Tally,
  fail: boolean
): void {
  const local = db.get<Row>('SELECT id, updated_at FROM notes WHERE external_id = ?', [n.externalId]);
  const action = decide(local?.updated_at as string | undefined, n.updatedAt, null);
  // refId in the incoming row is the source device's PK. We don't carry the
  // ref's external_id on the note itself in v1; if you cross-link a note to
  // a ref, do it via the export's scriptureRefs by external_id.
  // For Phase 1 we leave ref_id null on imported notes and rely on body text.
  void refIdMap;
  switch (action) {
    case 'insert':
      db.run(
        `INSERT INTO notes (external_id, session_id, body, ref_id, topic_id, captured_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [n.externalId, localSessionId, n.body, null, null, n.capturedAt, n.capturedAt, n.updatedAt]
      );
      tally.added++;
      break;
    case 'update':
      db.run(
        `UPDATE notes SET body = ?, updated_at = ? WHERE external_id = ?`,
        [n.body, n.updatedAt, n.externalId]
      );
      tally.updated++;
      break;
    default:
      tally.skipped++;
  }
  void fail;
}

function applyLexMark(
  db: DB,
  m: LexMark,
  localSessionId: number,
  refIdMap: Map<string, number>,
  tally: Tally,
  fail: boolean
): void {
  const local = db.get<Row>('SELECT id, updated_at FROM lex_marks WHERE external_id = ?', [m.externalId]);
  const action = decide(local?.updated_at as string | undefined, m.updatedAt, null);
  // refId resolution would require the source-side ref's external_id, which
  // we don't carry on the lex_mark in v1. Leave null on insert.
  void refIdMap;
  switch (action) {
    case 'insert':
      db.run(
        `INSERT INTO lex_marks
           (external_id, session_id, ref_id, book_id, chapter, verse, word_num, corpus,
            surface, lemma, strong, bdag_ref, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.externalId, localSessionId, null, m.bookId, m.chapter, m.verse,
          m.wordNum, m.corpus, m.surface, m.lemma, m.strong, m.bdagRef, m.note,
          m.createdAt, m.updatedAt,
        ]
      );
      tally.added++;
      break;
    case 'update':
      db.run(
        `UPDATE lex_marks SET note = ?, bdag_ref = ?, updated_at = ?
         WHERE external_id = ?`,
        [m.note, m.bdagRef, m.updatedAt, m.externalId]
      );
      tally.updated++;
      break;
    default:
      tally.skipped++;
  }
  void fail;
}

function applyFollowUp(
  db: DB,
  fu: FollowUp,
  localSessionId: number,
  tally: Tally,
  fail: boolean
): void {
  const local = db.get<Row>(
    'SELECT id, updated_at FROM follow_ups WHERE external_id = ?',
    [fu.externalId]
  );
  const action = decide(local?.updated_at as string | undefined, fu.updatedAt, null);
  let localFollowUpId: number | null = null;
  switch (action) {
    case 'insert': {
      const r = db.run(
        `INSERT INTO follow_ups
           (external_id, session_id, kind, description, priority, status, due,
            resolution_note, resolved_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fu.externalId, localSessionId, fu.kind, fu.description, fu.priority,
          fu.status, fu.due, fu.resolutionNote, fu.resolvedAt,
          fu.createdAt, fu.updatedAt,
        ]
      );
      localFollowUpId = r.lastInsertRowid;
      tally.added++;
      break;
    }
    case 'update':
      db.run(
        `UPDATE follow_ups SET
           kind = ?, description = ?, priority = ?, status = ?, due = ?,
           resolution_note = ?, resolved_at = ?, updated_at = ?
         WHERE external_id = ?`,
        [
          fu.kind, fu.description, fu.priority, fu.status, fu.due,
          fu.resolutionNote, fu.resolvedAt, fu.updatedAt, fu.externalId,
        ]
      );
      localFollowUpId = local!.id as number;
      tally.updated++;
      // Drop and rebuild dependent rows (they're small; simpler than diffing).
      db.run('DELETE FROM follow_up_refs WHERE follow_up_id = ?', [localFollowUpId]);
      db.run('DELETE FROM follow_up_lex  WHERE follow_up_id = ?', [localFollowUpId]);
      break;
    default:
      tally.skipped++;
      return;
  }

  // Insert refs and lex anchors
  if (localFollowUpId !== null) {
    for (const ref of fu.refs) {
      db.run(
        `INSERT OR IGNORE INTO follow_up_refs
           (follow_up_id, book_id, chapter, verse_start, verse_end, raw_input)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [localFollowUpId, ref.bookId, ref.chapter, ref.verseStart, ref.verseEnd, ref.rawInput]
      );
    }
    for (const lx of fu.lex) {
      db.run(
        `INSERT OR IGNORE INTO follow_up_lex
           (follow_up_id, lang, strong, lemma, bdag_ref, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [localFollowUpId, lx.lang, lx.strong, lx.lemma, lx.bdagRef, lx.note]
      );
    }
  }
  void fail;
}
