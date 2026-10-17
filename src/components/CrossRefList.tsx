import { useEffect, useState } from 'react';
import { dbClient } from '../lib/db';
import type { CrossRef } from '../lib/db';

interface Props {
  refs: CrossRef[];
  accentColor: string;
  onNavigate?: (bookId: number, chapter: number, verse: number) => void;
  showVotes?: boolean;
}

/** Shared, scrollable cross-reference list for search results and chapter views. */
export function CrossRefList({ refs, accentColor, onNavigate, showVotes }: Props) {
  const [verseText, setVerseText] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const chapters = new Map<string, CrossRef>();
    for (const ref of refs) {
      chapters.set(`${ref.targetAbbr3}:${ref.targetChapter}`, ref);
    }
    // Fetch each target chapter once, and only while its reference list is open.
    for (const ref of chapters.values()) {
      dbClient.fetchChapter(ref.targetAbbr3, ref.targetChapter).then(({ verses }) => {
        if (cancelled) return;
        setVerseText((previous) => {
          const next = new Map(previous);
          for (const verse of verses) {
            next.set(`${ref.targetBookId}:${ref.targetChapter}:${verse.verse}`, verse.text);
          }
          // Missing verses still leave their references available for navigation.
          for (const target of refs) {
            if (target.targetBookId === ref.targetBookId && target.targetChapter === ref.targetChapter) {
              const key = `${target.targetBookId}:${target.targetChapter}:${target.targetVerseStart}`;
              if (!next.has(key)) next.set(key, '');
            }
          }
          return next;
        });
      }).catch(() => {
        if (cancelled) return;
        setVerseText((previous) => {
          const next = new Map(previous);
          for (const target of refs) {
            if (target.targetBookId === ref.targetBookId && target.targetChapter === ref.targetChapter) {
              next.set(`${target.targetBookId}:${target.targetChapter}:${target.targetVerseStart}`, '');
            }
          }
          return next;
        });
      });
    }
    return () => { cancelled = true; };
  }, [refs]);

  return (
    <div
      role="region"
      aria-label="Cross-references"
      tabIndex={0}
      style={{ maxHeight: 240, overflowY: 'auto', overscrollBehaviorY: 'contain', paddingRight: 6 }}
    >
      {refs.map((ref, index) => {
        const text = verseText.get(`${ref.targetBookId}:${ref.targetChapter}:${ref.targetVerseStart}`);
        const words = text?.trim().split(/\s+/) ?? [];
        const preview = text === undefined ? 'Loading…' : text
          ? `${words.slice(0, 8).join(' ')}${words.length > 8 ? '…' : ''}`
          : 'Verse text unavailable';
        return (
          <div key={index} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => onNavigate?.(ref.targetBookId, ref.targetChapter, ref.targetVerseStart)}
              disabled={!onNavigate}
              style={{
                background: 'none', border: 'none', padding: 0, textAlign: 'left',
                fontSize: 'var(--fs-meta)', color: accentColor, fontFamily: 'DM Sans', fontWeight: 500,
                cursor: onNavigate ? 'pointer' : 'default', textDecoration: 'underline', flexShrink: 0,
              }}
            >
              {ref.targetLabel}
              {ref.sourceDataset === 'user' && <span aria-label="User-added reference"> ★</span>}
            </button>
            <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontFamily: 'DM Sans', color: 'var(--ink-mid)' }}>
              <span style={{ fontSize: 'var(--fs-meta)' }}>{preview}</span>
              {ref.userNote && (
                <div style={{ fontSize: 'var(--fs-control)', fontStyle: 'italic' }}>{ref.userNote}</div>
              )}
            </div>
            {showVotes && ref.votes != null && (
              <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--ink-light)', flexShrink: 0 }}>{ref.votes}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
