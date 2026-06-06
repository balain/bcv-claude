// ============================================================================
// schema.ts — class.db schema, embedded so Vite bundles it with the worker.
//
// Bumping schema_version: add migrations to MIGRATIONS below.
// Apply on init via `applySchema(db)`.
// ============================================================================

export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS _meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

INSERT OR IGNORE INTO _meta(key, value) VALUES
  ('schema_version', '2'),
  ('created_at',     strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('device_id',      lower(hex(randomblob(8))));

CREATE TABLE IF NOT EXISTS series (
  id            INTEGER PRIMARY KEY,
  external_id   TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  started_on    TEXT,
  ended_on      TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE TRIGGER IF NOT EXISTS series_updated_at AFTER UPDATE ON series
BEGIN
  UPDATE series SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY,
  external_id   TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  series_id     INTEGER REFERENCES series(id),
  taught_on     TEXT NOT NULL,
  location      TEXT,
  primary_text  TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS sessions_series_idx ON sessions(series_id);
CREATE INDEX IF NOT EXISTS sessions_taught_on_idx ON sessions(taught_on);

CREATE TRIGGER IF NOT EXISTS sessions_updated_at AFTER UPDATE ON sessions
BEGIN
  UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS scripture_refs (
  id             INTEGER PRIMARY KEY,
  external_id    TEXT NOT NULL UNIQUE,
  session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  book_id        INTEGER NOT NULL,
  chapter        INTEGER NOT NULL,
  verse_start    INTEGER,
  verse_end      INTEGER,
  raw_input      TEXT NOT NULL,
  context_note   TEXT,
  is_anchor      INTEGER NOT NULL DEFAULT 0
                 CHECK (is_anchor IN (0, 1)),
  captured_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT
);

CREATE INDEX IF NOT EXISTS scripture_refs_session_idx ON scripture_refs(session_id);
CREATE INDEX IF NOT EXISTS scripture_refs_canonical_idx ON scripture_refs(book_id, chapter, verse_start);

CREATE TRIGGER IF NOT EXISTS scripture_refs_updated_at AFTER UPDATE ON scripture_refs
BEGIN
  UPDATE scripture_refs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS topics (
  id            INTEGER PRIMARY KEY,
  external_id   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL UNIQUE,
  parent_id     INTEGER REFERENCES topics(id),
  description   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS topics_parent_idx ON topics(parent_id);

CREATE TRIGGER IF NOT EXISTS topics_updated_at AFTER UPDATE ON topics
BEGIN
  UPDATE topics SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS session_topics (
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  topic_id      INTEGER NOT NULL REFERENCES topics(id),
  weight        INTEGER NOT NULL DEFAULT 1
                CHECK (weight BETWEEN 1 AND 3),
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT,
  PRIMARY KEY (session_id, topic_id)
);

CREATE TRIGGER IF NOT EXISTS session_topics_updated_at AFTER UPDATE ON session_topics
BEGIN
  UPDATE session_topics SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE session_id = NEW.session_id AND topic_id = NEW.topic_id;
END;

CREATE TABLE IF NOT EXISTS follow_ups (
  id              INTEGER PRIMARY KEY,
  external_id     TEXT NOT NULL UNIQUE,
  session_id      INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL
                  CHECK (kind IN ('question', 'word_study', 'cross_ref', 'reading', 'other')),
  description     TEXT NOT NULL,
  priority        INTEGER NOT NULL DEFAULT 2
                  CHECK (priority BETWEEN 1 AND 3),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'done', 'dropped')),
  due             TEXT,
  resolution_note TEXT,
  resolved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);

CREATE INDEX IF NOT EXISTS follow_ups_session_idx ON follow_ups(session_id);
CREATE INDEX IF NOT EXISTS follow_ups_status_idx  ON follow_ups(status);
CREATE INDEX IF NOT EXISTS follow_ups_priority_idx ON follow_ups(priority);

CREATE TRIGGER IF NOT EXISTS follow_ups_updated_at AFTER UPDATE ON follow_ups
BEGIN
  UPDATE follow_ups SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS follow_up_refs (
  id             INTEGER PRIMARY KEY,
  follow_up_id   INTEGER NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  book_id        INTEGER NOT NULL,
  chapter        INTEGER NOT NULL,
  verse_start    INTEGER,
  verse_end      INTEGER,
  raw_input      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS follow_up_refs_uniq
  ON follow_up_refs(follow_up_id, book_id, chapter, IFNULL(verse_start, -1));
CREATE INDEX IF NOT EXISTS follow_up_refs_fu_idx ON follow_up_refs(follow_up_id);

CREATE TABLE IF NOT EXISTS follow_up_lex (
  id             INTEGER PRIMARY KEY,
  follow_up_id   INTEGER NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  lang           TEXT NOT NULL CHECK (lang IN ('Heb', 'Grk')),
  strong         TEXT,
  lemma          TEXT,
  bdag_ref       TEXT,
  note           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS follow_up_lex_uniq
  ON follow_up_lex(follow_up_id, lang, IFNULL(strong, ''), IFNULL(lemma, ''));
CREATE INDEX IF NOT EXISTS follow_up_lex_fu_idx ON follow_up_lex(follow_up_id);

CREATE TABLE IF NOT EXISTS notes (
  id            INTEGER PRIMARY KEY,
  external_id   TEXT NOT NULL UNIQUE,
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  ref_id        INTEGER REFERENCES scripture_refs(id),
  topic_id      INTEGER REFERENCES topics(id),
  captured_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS notes_session_idx ON notes(session_id);

CREATE TRIGGER IF NOT EXISTS notes_updated_at AFTER UPDATE ON notes
BEGIN
  UPDATE notes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS lex_marks (
  id            INTEGER PRIMARY KEY,
  external_id   TEXT NOT NULL UNIQUE,
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ref_id        INTEGER REFERENCES scripture_refs(id),
  book_id       INTEGER NOT NULL,
  chapter       INTEGER NOT NULL,
  verse         INTEGER NOT NULL,
  word_num      INTEGER,
  corpus        TEXT CHECK (corpus IN ('WLC', 'LXX', 'GNT')),
  surface       TEXT,
  lemma         TEXT,
  strong        TEXT,
  bdag_ref      TEXT,
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS lex_marks_session_idx ON lex_marks(session_id);
CREATE INDEX IF NOT EXISTS lex_marks_strong_idx  ON lex_marks(strong);
CREATE INDEX IF NOT EXISTS lex_marks_lemma_idx   ON lex_marks(lemma);

CREATE TRIGGER IF NOT EXISTS lex_marks_updated_at AFTER UPDATE ON lex_marks
BEGIN
  UPDATE lex_marks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS user_cross_refs (
  id                  INTEGER PRIMARY KEY,
  external_id         TEXT NOT NULL UNIQUE,
  session_id          INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  source_book_id      INTEGER NOT NULL,
  source_chapter      INTEGER NOT NULL,
  source_verse        INTEGER NOT NULL,
  target_book_id      INTEGER NOT NULL,
  target_chapter      INTEGER NOT NULL,
  target_verse_start  INTEGER NOT NULL,
  target_verse_end    INTEGER,
  note                TEXT,
  created_from        TEXT NOT NULL
                      CHECK (created_from IN ('search', 'browse', 'class')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at          TEXT
);

CREATE INDEX IF NOT EXISTS user_cross_refs_source_idx
  ON user_cross_refs(source_book_id, source_chapter, source_verse);
CREATE INDEX IF NOT EXISTS user_cross_refs_target_idx
  ON user_cross_refs(target_book_id, target_chapter, target_verse_start);
CREATE INDEX IF NOT EXISTS user_cross_refs_session_idx
  ON user_cross_refs(session_id);

CREATE TRIGGER IF NOT EXISTS user_cross_refs_updated_at AFTER UPDATE ON user_cross_refs
BEGIN
  UPDATE user_cross_refs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE VIEW IF NOT EXISTS v_series         AS SELECT * FROM series         WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_sessions       AS SELECT * FROM sessions       WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_scripture_refs AS SELECT * FROM scripture_refs WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_topics         AS SELECT * FROM topics         WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_session_topics AS SELECT * FROM session_topics WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_follow_ups     AS SELECT * FROM follow_ups     WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_notes          AS SELECT * FROM notes          WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_lex_marks      AS SELECT * FROM lex_marks      WHERE deleted_at IS NULL;
CREATE VIEW IF NOT EXISTS v_user_cross_refs AS SELECT * FROM user_cross_refs WHERE deleted_at IS NULL;
`.trim();

// Migrations to run on schema version upgrades.
// Key = target version; value = SQL to apply.
const MIGRATIONS: Record<number, string> = {
  2: `
    CREATE TABLE IF NOT EXISTS user_cross_refs (
      id                  INTEGER PRIMARY KEY,
      external_id         TEXT NOT NULL UNIQUE,
      session_id          INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      source_book_id      INTEGER NOT NULL,
      source_chapter      INTEGER NOT NULL,
      source_verse        INTEGER NOT NULL,
      target_book_id      INTEGER NOT NULL,
      target_chapter      INTEGER NOT NULL,
      target_verse_start  INTEGER NOT NULL,
      target_verse_end    INTEGER,
      note                TEXT,
      created_from        TEXT NOT NULL
                          CHECK (created_from IN ('search', 'browse', 'class')),
      created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      deleted_at          TEXT
    );
    CREATE INDEX IF NOT EXISTS user_cross_refs_source_idx
      ON user_cross_refs(source_book_id, source_chapter, source_verse);
    CREATE INDEX IF NOT EXISTS user_cross_refs_target_idx
      ON user_cross_refs(target_book_id, target_chapter, target_verse_start);
    CREATE INDEX IF NOT EXISTS user_cross_refs_session_idx
      ON user_cross_refs(session_id);
    CREATE TRIGGER IF NOT EXISTS user_cross_refs_updated_at AFTER UPDATE ON user_cross_refs
    BEGIN
      UPDATE user_cross_refs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
    END;
    CREATE VIEW IF NOT EXISTS v_user_cross_refs AS SELECT * FROM user_cross_refs WHERE deleted_at IS NULL;
    UPDATE _meta SET value = '2' WHERE key = 'schema_version';
  `.trim(),
};

export interface DBLike {
  exec(sql: string): void;
  /** Select a single row as a plain object (optional — used for migration version check). */
  get?<T = Record<string, unknown>>(sql: string, bind?: readonly unknown[]): T | undefined;
}

/**
 * Apply schema and any pending migrations. Idempotent.
 */
export function applySchema(db: DBLike): void {
  db.exec(SCHEMA_SQL);
  // Apply pending migrations on existing databases that were created at a lower version.
  const currentVersion = db.get
    ? Number(db.get<{ value: string }>('SELECT value FROM _meta WHERE key = ?', ['schema_version'])?.value ?? 1)
    : 1;
  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    const sql = MIGRATIONS[v];
    if (sql) db.exec(sql);
  }
}
