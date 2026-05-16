// ============================================================================
// SessionView.tsx — active session UI.
//
// Shows: header (title, date, anchor), QuickCapture, recent-refs chip strip,
// full RefList, footer placeholder buttons (+Topic / +Follow-up / +Note all
// disabled in Phase 1), Export button, Back button.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getClassClient } from '../../lib/class/client.ts';
import type { SessionSummary, ScriptureRef } from '../../lib/class/types.ts';
import { QuickCapture } from './QuickCapture.tsx';
import { RefList } from './RefList.tsx';

interface Props {
  sessionId: number;
  onBack: () => void;
  onOpenRef: (bookId: number, chapter: number, verse: number) => void;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatChip(r: ScriptureRef): string {
  if (r.rawInput && /[A-Za-z]/.test(r.rawInput)) return r.rawInput;
  if (r.verseStart == null) return `book ${r.bookId} ${r.chapter}`;
  if (r.verseEnd == null)   return `book ${r.bookId} ${r.chapter}:${r.verseStart}`;
  return `book ${r.bookId} ${r.chapter}:${r.verseStart}-${r.verseEnd}`;
}

export function SessionView({ sessionId, onBack, onOpenRef }: Props) {
  const client = getClassClient();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const s = await client.session.summary(sessionId);
      setSummary(s);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, sessionId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const recentChips = useMemo<ScriptureRef[]>(() => {
    if (!summary) return [];
    // Last 6 refs by capturedAt (already ordered ascending in summary.refs)
    return summary.refs.slice(-6).reverse();
  }, [summary]);

  async function onExport() {
    setExporting(true);
    try {
      const payload = await client.exportSession(sessionId);
      const safeTitle = (summary?.session.title ?? 'session').replace(/[^a-z0-9-]+/gi, '-');
      const date = summary?.session.taughtOn ?? 'export';
      downloadJson(`${date}_${safeTitle}.classsession.json`, payload);
      // Stamp the export time in _meta so BackupBanner stays quiet
      await client.meta.set('last_export_at', new Date().toISOString());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  if (loading)        return <div className="class-loading">Loading…</div>;
  if (err)            return <div className="class-error">Error: {err}</div>;
  if (!summary)       return <div className="class-error">Session not found.</div>;

  const { session, series, refs } = summary;
  const anchor = refs.find((r) => r.isAnchor);

  return (
    <div className="class-session-view">
      <header className="class-session-header">
        <button className="class-back" onClick={onBack} aria-label="back to sessions">‹ Sessions</button>
        <div className="class-session-meta">
          <h2>{session.title}</h2>
          <div className="class-session-sub">
            <span>{session.taughtOn}</span>
            {series && <span> · {series.title}</span>}
            {session.location && <span> · {session.location}</span>}
          </div>
          {(anchor || session.primaryText) && (
            <div className="class-session-anchor">
              <span className="anchor-label">Anchor:</span>{' '}
              <span className="anchor-text">
                {anchor ? formatChip(anchor) : session.primaryText}
              </span>
            </div>
          )}
        </div>
        <button
          className="class-export"
          onClick={onExport}
          disabled={exporting}
          aria-label="export session as JSON"
        >
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </header>

      <QuickCapture sessionId={sessionId} onCaptured={reload} />

      {recentChips.length > 0 && (
        <div className="class-recent-chips" aria-label="recent captures">
          {recentChips.map((r) => (
            <span className="class-recent-chip" key={r.id}>{formatChip(r)}</span>
          ))}
        </div>
      )}

      <section className="class-refs-section">
        <h3>References ({refs.length})</h3>
        <RefList refs={refs} onChanged={reload} onOpenRef={(r) => onOpenRef(r.bookId, r.chapter, r.verseStart ?? 1)} />
      </section>

      <footer className="class-session-footer">
        <button disabled title="Topics — Phase 2">+ Topic</button>
        <button disabled title="Follow-ups — Phase 2">+ Follow-up</button>
        <button disabled title="Notes — Phase 2">+ Note</button>
        <span className="phase2-hint">More capture types land in Phase 2</span>
      </footer>
    </div>
  );
}
