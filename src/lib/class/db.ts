// ============================================================================
// db.ts — minimal DB facade.
//
// All data-access code targets this interface so it works against both
// `@sqlite.org/sqlite-wasm`'s oo1 API (in the worker) and any test harness.
//
// The shape mirrors what `@sqlite.org/sqlite-wasm` already provides on
// `oo1.DB`. To use directly with a real sqlite-wasm DB, no adapter is
// needed — pass the DB instance through.
// ============================================================================

export interface DB {
  /** Execute one or more SQL statements. No return value. */
  exec(sql: string): void;

  /** Run a single statement with bind parameters. Returns insert/changes info. */
  run(sql: string, bind?: BindParams): RunResult;

  /** Select one row, returned as an object keyed by column name (or undefined). */
  get<T = Row>(sql: string, bind?: BindParams): T | undefined;

  /** Select all rows as an array of objects keyed by column name. */
  all<T = Row>(sql: string, bind?: BindParams): T[];

  /** Run all the work in `fn` inside a single transaction. */
  transaction<T>(fn: () => T): T;
}

export type BindParams = readonly (string | number | bigint | null | Uint8Array)[];

export type Row = Record<string, unknown>;

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

// ----------------------------------------------------------------------------
// Adapter for @sqlite.org/sqlite-wasm `oo1.DB`
// ----------------------------------------------------------------------------
// The wasm DB has slightly different method names (`selectObject`,
// `selectObjects`, `exec` with object form). This adapter normalizes them.

interface SqliteWasmDB {
  exec(opts: string | { sql: string; bind?: BindParams; returnValue?: string; rowMode?: string }): unknown;
  selectObject(sql: string, bind?: BindParams): Row | undefined;
  selectObjects(sql: string, bind?: BindParams): Row[];
  prepare(sql: string): unknown;
  changes(): number;
  // sqlite3_last_insert_rowid is on the parent module, not the DB; in oo1
  // you read it via `db.selectValue("SELECT last_insert_rowid()")`.
  selectValue<T = unknown>(sql: string, bind?: BindParams): T;
  transaction<T>(fn: (db: SqliteWasmDB) => T): T;
}

export function adaptSqliteWasm(wasmDb: SqliteWasmDB): DB {
  return {
    exec(sql) {
      wasmDb.exec(sql);
    },
    run(sql, bind) {
      wasmDb.exec({ sql, bind: bind as BindParams | undefined });
      const lastInsertRowid = Number(
        wasmDb.selectValue<number | bigint>('SELECT last_insert_rowid()')
      );
      const changes = wasmDb.changes();
      return { lastInsertRowid, changes };
    },
    get<T = Row>(sql: string, bind?: BindParams): T | undefined {
      return wasmDb.selectObject(sql, bind) as T | undefined;
    },
    all<T = Row>(sql: string, bind?: BindParams): T[] {
      return wasmDb.selectObjects(sql, bind) as T[];
    },
    transaction<T>(fn: () => T): T {
      return wasmDb.transaction(() => fn());
    },
  };
}
