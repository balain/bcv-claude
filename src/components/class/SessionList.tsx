// ============================================================================
// SessionList.tsx — sessions index. Lists existing sessions; offers a small
// inline form to create a new one; supports importing a session JSON file.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { getClassClient } from '../../lib/class/client.ts';
import type { Session, SessionStatus, ImportReport } from '../../lib/class/types.ts';

interface Props {
  onOpen: (sessionId: number) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SessionList({ onOpen }: Props) {
  const client = getClassClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState<SessionStatus>('active');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // New-session form state
  const [title, setTitle] = useState('');
  const [taughtOn, setTaughtOn] = useState(todayIso());
  const [primaryText, setPrimaryText] = useState('');

  // Import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  const reload = async () => {
    setSessions(await client.session.list({ status: filter }));
  };

  useEffect(() => { reload(); }, [filter]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !taughtOn) return;
    setCreateError(null);
    try {
      const s = await client.session.create({
        title: title.trim(),
        taughtOn,
        primaryText: primaryText.trim() || undefined,
      });
      setTitle(''); setPrimaryText(''); setCreating(false);
      onOpen(s.id);
    } catch (err) {
      setCreateError((err as Error).message ?? String(err));
    }
  };

  const onImportClick = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportErr(null);
    setImportReport(null);
    try {
      const text = await f.text();
      const report = await client.importSession(text, 'lww');
      setImportReport(report);
      await reload();
    } catch (err) {
      setImportErr(String((err as Error).message));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="class-session-list">
      <header className="class-list-header">
        <h2>Class sessions</h2>
        <div className="class-list-actions">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SessionStatus)}
            aria-label="filter by status"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button onClick={() => { setCreating((v) => !v); setCreateError(null); }}>
            {creating ? 'Cancel' : '+ New'}
          </button>
          <button onClick={onImportClick} className="secondary">
            Import…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </div>
      </header>

      {creating && (
        <form className="class-new-form" onSubmit={submitCreate}>
          <label>
            <span>Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bearing His Image — Week 1"
              required
            />
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={taughtOn}
              onChange={(e) => setTaughtOn(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Primary text (optional)</span>
            <input
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              placeholder="Col 1:15-20"
            />
          </label>
          {createError && (
            <p style={{ color: 'var(--error, #c0392b)', fontSize: 'var(--fs-body)', margin: '0 0 4px' }}>
              {createError}
            </p>
          )}
          <button type="submit">Create</button>
        </form>
      )}

      {importReport && (
        <div className="class-import-report">
          <strong>Imported:</strong>{' '}
          {importReport.added} added, {importReport.updated} updated,{' '}
          {importReport.skipped} skipped, {importReport.deleted} deleted
          {importReport.conflicts.length > 0 && (
            <>
              {' '}— {importReport.conflicts.length} conflicts:
              <ul>
                {importReport.conflicts.map((c, i) => (
                  <li key={i}>
                    <code>{c.table}</code> · <code>{c.externalId}</code>: {c.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button onClick={() => setImportReport(null)} className="dismiss">
            Dismiss
          </button>
        </div>
      )}
      {importErr && (
        <div className="class-import-error">
          Import failed: {importErr}
          <button onClick={() => setImportErr(null)} className="dismiss">×</button>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="class-empty">No {filter} sessions yet.</p>
      ) : (
        <ul className="class-session-rows">
          {sessions.map((s) => (
            <li key={s.id}>
              <button className="class-session-row" onClick={() => onOpen(s.id)}>
                <span className="class-session-date">{s.taughtOn}</span>
                <span className="class-session-title">{s.title}</span>
                {s.primaryText && (
                  <span className="class-session-anchor">{s.primaryText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
