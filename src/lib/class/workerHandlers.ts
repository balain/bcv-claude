// ============================================================================
// workerHandlers.ts — RPC dispatcher for class_* requests.
//
// Wire from db.worker.ts:
//
//   import { handleClassRequest } from './class/workerHandlers.ts';
//   import { applySchema } from './class/schema.ts';
//
//   const classDb: DB = ...;          // sqlite-wasm oo1.DB wrapped via adaptSqliteWasm
//   applySchema(classDb);
//
//   self.onmessage = (e) => {
//     const msg = e.data;
//     if (msg.db === 'class') {
//       handleClassRequest(classDb, msg).then(
//         (data) => postMessage({ id: msg.id, ok: true, data }),
//         (err)  => postMessage({ id: msg.id, ok: false, error: String(err.message ?? err) })
//       );
//       return;
//     }
//     // existing bcv-claude routing here
//   };
// ============================================================================

import type { DB } from './db.ts';
import type { ClassRequest } from './types.ts';
import * as da from './dataAccess.ts';
import { exportSession } from './export.ts';
import { importSession } from './import.ts';
import type { SessionExportV1 } from './types.ts';

/** Returns the data payload (not the full envelope). Throws on error. */
export async function handleClassRequest(
  db: DB,
  msg: ClassRequest
): Promise<unknown> {
  switch (msg.type) {
    // ---- Sessions ----
    case 'class_session_create':
      return da.createSession(db, msg.data);

    case 'class_session_list':
      return da.listSessions(db, msg.data);

    case 'class_session_get':
      return da.getSession(db, msg.data.sessionId);

    case 'class_session_update':
      return da.updateSession(db, msg.data.sessionId, msg.data.patch);

    case 'class_session_delete':
      da.deleteSession(db, msg.data.sessionId);
      return { ok: true };

    case 'class_session_summary':
      return da.getSessionSummary(db, msg.data.sessionId);

    // ---- Series ----
    case 'class_series_upsert':
      return da.upsertSeries(db, msg.data);

    case 'class_series_list':
      return da.listSeries(db);

    // ---- Refs ----
    case 'class_ref_add':
      return da.addRefs(db, msg.data.sessionId, msg.data.rawInput, {
        contextNote: msg.data.contextNote,
        isAnchor: msg.data.isAnchor,
      });

    case 'class_ref_list':
      return da.listRefs(db, msg.data.sessionId);

    case 'class_ref_update':
      return da.updateRef(db, msg.data.refId, msg.data.patch);

    case 'class_ref_delete':
      da.deleteRef(db, msg.data.refId);
      return { ok: true };

    case 'class_ref_by_chapter':
      return da.listRefsByChapter(db, msg.data.bookId, msg.data.chapter);

    // ---- User cross-refs ----
    case 'class_cross_ref_add':
      return da.addUserCrossRef(db, msg.data);

    case 'class_cross_ref_update':
      return da.updateUserCrossRef(db, msg.data.id, msg.data.patch);

    case 'class_cross_ref_delete':
      da.deleteUserCrossRef(db, msg.data.id);
      return { ok: true };

    case 'class_cross_ref_list_by_source':
      return da.listUserCrossRefsBySource(
        db, msg.data.sourceBookId, msg.data.sourceChapter, msg.data.sourceVerse
      );

    case 'class_cross_ref_list_by_chapter':
      return da.listUserCrossRefsByChapter(
        db, msg.data.sourceBookId, msg.data.sourceChapter
      );

    // ---- Export / import ----
    case 'class_export_session':
      return exportSession(db, msg.data.sessionId);

    case 'class_import_session': {
      const payload = JSON.parse(msg.data.json) as SessionExportV1;
      return importSession(db, payload, { mergePolicy: msg.data.mergePolicy });
    }

    // ---- Meta ----
    case 'class_meta_get':
      return da.getMeta(db, msg.data.key);

    case 'class_meta_set':
      da.setMeta(db, msg.data.key, msg.data.value);
      return { ok: true };

    default: {
      // Exhaustiveness guard — if a new request type is added to ClassRequest
      // without a case here, TypeScript will complain on this line.
      const _exhaustive: never = msg;
      throw new Error(`unhandled class request: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
