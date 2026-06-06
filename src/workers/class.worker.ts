/**
 * Class Mode worker: owns class.db (user data — sessions, refs, etc.).
 *
 * This is a SECOND worker, completely independent of db.worker.ts which
 * owns bcv.db (read-only reference data). Two workers means two SQLite
 * WASM instances — about 5 MB extra in memory — but failure isolation
 * and zero changes to the existing bcv worker.
 *
 * Storage: tries the OPFS SAH-pool VFS first (most reliable on iOS Safari),
 * falls back to OpfsDb, finally falls back to in-memory with a warning.
 *
 * Message protocol (matches src/lib/class/client.ts):
 *   → { id, db: 'class', type: 'class_<op>', data }
 *   ← { id, ok: true, data } | { id, ok: false, error }
 *   ← { type: 'ready' }
 *   ← { type: 'error', message }
 *
 * Messages received before the DB is ready are queued and drained on init.
 */

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite resolves this to the correct URL at both dev and build time
import sqlite3WasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";
import { applySchema } from "../lib/class/schema";
import { handleClassRequest } from "../lib/class/workerHandlers";
import { adaptSqliteWasm } from "../lib/class/db";
import type { DB } from "../lib/class/db";
import type { ClassRequest } from "../lib/class/types";

declare const self: typeof globalThis & {
  postMessage(msg: unknown): void;
  addEventListener(type: string, fn: (e: MessageEvent) => void): void;
};

let dbFacade: DB | null = null;
const queuedMessages: ClassRequest[] = [];

function post(msg: object) {
  self.postMessage(msg);
}

async function processMessage(msg: ClassRequest): Promise<void> {
  if (!dbFacade) return;
  try {
    const data = await handleClassRequest(dbFacade, msg);
    post({ id: msg.id, ok: true, data });
  } catch (err) {
    post({
      id: msg.id,
      ok: false,
      error: String((err as Error)?.message ?? err),
    });
  }
}

self.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as ClassRequest | undefined;
  if (!msg || msg.db !== "class") return; // not for us
  if (!dbFacade) {
    queuedMessages.push(msg);
    return;
  }
  processMessage(msg);
});

(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sqlite3: any = await (sqlite3InitModule as any)({
      printErr: console.error,
      locateFile: (p: string) => p === 'sqlite3.wasm' ? sqlite3WasmUrl : p,
    });

    // Try SAH-pool first (most stable on iOS Safari), then OpfsDb, then memory.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawDb: any = null;
    let storageMode = "memory";

    if (sqlite3.installOpfsSAHPoolVfs) {
      try {
        const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
          name: "bcv-class-pool",
        });
        rawDb = new poolUtil.OpfsSAHPoolDb("/class.db");
        storageMode = "opfs-sah-pool";
      } catch (e) {
        console.warn("[class.worker] SAH pool VFS unavailable:", e);
      }
    }

    if (!rawDb && sqlite3.oo1?.OpfsDb) {
      try {
        rawDb = new sqlite3.oo1.OpfsDb("/class.db", "c");
        storageMode = "opfs";
      } catch (e) {
        console.warn("[class.worker] OpfsDb unavailable:", e);
      }
    }

    if (!rawDb) {
      console.warn(
        "[class.worker] No OPFS available — class.db is in-memory only; data WILL be lost on reload",
      );
      rawDb = new sqlite3.oo1.DB(":memory:", "c");
    }

    rawDb.exec("PRAGMA foreign_keys = ON");
    dbFacade = adaptSqliteWasm(rawDb);
    applySchema(dbFacade);

    post({ type: "ready", storageMode });

    // Drain anything queued before init finished
    while (queuedMessages.length > 0) {
      const m = queuedMessages.shift()!;
      processMessage(m);
    }
  } catch (err) {
    post({ type: "error", message: String((err as Error)?.message ?? err) });
  }
})();
