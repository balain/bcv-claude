// ============================================================================
// export.ts — serialize a session and all its dependents to SessionExportV1.
// ============================================================================

import type { DB, Row } from './db.ts';
import type { SessionExportV1 } from './types.ts';
import {
  getSession, listRefs, listSessionTopics, listNotes, listLexMarks,
  listFollowUps, listTopics, getMeta,
} from './dataAccess.ts';

export function exportSession(db: DB, sessionId: number): SessionExportV1 {
  const session = getSession(db, sessionId);
  if (!session) {
    throw new Error(`session ${sessionId} not found`);
  }

  // Series, if any
  let series: SessionExportV1['series'] = null;
  if (session.seriesId !== null) {
    const sr = db.get<Row>('SELECT * FROM v_series WHERE id = ?', [session.seriesId]);
    if (sr) {
      series = {
        id: sr.id as number,
        externalId: sr.external_id as string,
        title: sr.title as string,
        description: (sr.description as string | null) ?? null,
        startedOn: (sr.started_on as string | null) ?? null,
        endedOn: (sr.ended_on as string | null) ?? null,
        createdAt: sr.created_at as string,
        updatedAt: sr.updated_at as string,
      };
    }
  }

  const scriptureRefs = listRefs(db, sessionId);
  const sessionTopicLinks = listSessionTopics(db, sessionId);
  const notes = listNotes(db, sessionId);
  const lexMarks = listLexMarks(db, sessionId);
  const followUps = listFollowUps(db, { sessionId });

  // Topics referenced by this session (de-duplicated by id) — exported as
  // standalone rows so the import side can create them if missing.
  const topicIds = new Set(sessionTopicLinks.map((t) => t.id));
  const allTopics = listTopics(db);
  const topics = allTopics.filter((t) => topicIds.has(t.id));

  // session_topics as flat rows (the link table)
  const sessionTopics = sessionTopicLinks.map((t) => ({
    sessionId: session.id,
    topicId: t.id,
    weight: t.weight,
    note: t.note,
    updatedAt: t.updatedAt, // best-effort; if you want the link's own updated_at, query session_topics directly
  }));

  const deviceId = getMeta(db, 'device_id') ?? 'unknown';

  return {
    kind: 'class.session/v1',
    exportedAt: new Date().toISOString(),
    deviceId,
    session,
    series,
    scriptureRefs,
    topics,
    sessionTopics,
    notes,
    lexMarks,
    followUps,
  };
}
