// ============================================================================
// RefList.tsx — render a list of ScriptureRef rows.
//
// Anchor star toggles is_anchor. Body click navigates to the existing
// bcv-claude ChapterView via a hash route (no new code in ChapterView; the
// host App listens for `#/bcv/<bookId>/<chapter>?v=<verse>` and renders).
// If the host uses a different routing scheme, override `onOpenRef` from
// the parent (SessionView) and intercept there.
// ============================================================================

import { useState } from 'react';
import { getClassClient } from '../../lib/class/client.ts';
import type { ScriptureRef } from '../../lib/class/types.ts';

interface Props {
  refs: ScriptureRef[];
  onChanged: () => void;
  /** Override the click-through navigation. Default: hash-route to ChapterView. */
  onOpenRef?: (r: ScriptureRef) => void;
  onBookmark?: (r: ScriptureRef) => void;
  isBookmarked?: (bookId: number, chapter: number, verse: number) => boolean;
}

function formatRef(r: ScriptureRef): string {
  // Use rawInput if it's already canonical-looking; otherwise reconstruct.
  if (r.rawInput && /[A-Za-z]/.test(r.rawInput)) return r.rawInput;
  if (r.verseStart == null) return `book ${r.bookId} ${r.chapter}`;
  if (r.verseEnd == null)   return `book ${r.bookId} ${r.chapter}:${r.verseStart}`;
  return `book ${r.bookId} ${r.chapter}:${r.verseStart}-${r.verseEnd}`;
}

function defaultOpen(r: ScriptureRef) {
  const verseQ = r.verseStart != null ? `?v=${r.verseStart}` : '';
  window.location.hash = `#/bcv/${r.bookId}/${r.chapter}${verseQ}`;
}

export function RefList({ refs, onChanged, onOpenRef, onBookmark, isBookmarked }: Props) {
  const client = getClassClient();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft]     = useState('');
  const [busy, setBusy]       = useState<number | null>(null);

  if (refs.length === 0) {
    return <p className="class-empty">No references captured yet.</p>;
  }

  const open = onOpenRef ?? defaultOpen;

  async function toggleAnchor(r: ScriptureRef) {
    setBusy(r.id);
    try {
      await client.ref.update(r.id, { isAnchor: !r.isAnchor });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  function startEdit(r: ScriptureRef) {
    setEditing(r.id);
    setDraft(r.contextNote ?? '');
  }
  async function saveEdit(r: ScriptureRef) {
    setBusy(r.id);
    try {
      await client.ref.update(r.id, { contextNote: draft.trim() || null });
      setEditing(null);
      setDraft('');
      onChanged();
    } finally {
      setBusy(null);
    }
  }
  async function deleteRef(r: ScriptureRef) {
    if (!confirm(`Remove "${formatRef(r)}" from this session?`)) return;
    setBusy(r.id);
    try {
      await client.ref.delete(r.id);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="class-ref-list">
      {refs.map((r) => (
        <li
          key={r.id}
          className={'class-ref-row' + (r.isAnchor ? ' is-anchor' : '')}
        >
          <button
            className="class-ref-anchor"
            onClick={() => toggleAnchor(r)}
            disabled={busy === r.id}
            title={r.isAnchor ? 'unmark anchor' : 'mark as anchor'}
            aria-label={r.isAnchor ? 'unmark anchor' : 'mark as anchor'}
          >
            {r.isAnchor ? '★' : '☆'}
          </button>

          <button className="class-ref-body" onClick={() => open(r)}>
            <span className="class-ref-text">{formatRef(r)}</span>
            {editing !== r.id && r.contextNote && (
              <span className="class-ref-note">{r.contextNote}</span>
            )}
          </button>

          {editing === r.id ? (
            <div className="class-ref-edit">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="context note"
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(r); if (e.key === 'Escape') { setEditing(null); setDraft(''); } }}
              />
              <button onClick={() => saveEdit(r)} disabled={busy === r.id}>Save</button>
              <button onClick={() => { setEditing(null); setDraft(''); }} className="secondary">Cancel</button>
            </div>
          ) : (
            <div className="class-ref-controls">
              {onBookmark && (
                <button
                  className="icon"
                  onClick={() => onBookmark(r)}
                  title={isBookmarked?.(r.bookId, r.chapter, r.verseStart ?? 1) ? 'Bookmarked' : 'Add bookmark'}
                  aria-label={isBookmarked?.(r.bookId, r.chapter, r.verseStart ?? 1) ? 'Bookmarked' : 'Add bookmark'}
                  style={{ color: isBookmarked?.(r.bookId, r.chapter, r.verseStart ?? 1) ? 'var(--amber)' : undefined }}
                >
                  {isBookmarked?.(r.bookId, r.chapter, r.verseStart ?? 1) ? '★' : '☆'}
                </button>
              )}
              <button
                className="icon"
                onClick={() => startEdit(r)}
                title="add or edit context note"
                aria-label="edit note"
              >✎</button>
              <button
                className="icon danger"
                onClick={() => deleteRef(r)}
                title="remove this ref"
                aria-label="delete ref"
                disabled={busy === r.id}
              >×</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
