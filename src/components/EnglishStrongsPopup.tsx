import { useEffect, useRef, useState } from 'react';
import { dbClient } from '../lib/db';
import type { LexEntry } from '../lib/db';
import type { Source } from '../types';

interface Props {
  word: string;
  combineGreek: boolean;
  onClose: () => void;
  onSearch: (query: string, source: Source) => void;
}

export function EnglishStrongsPopup({ word, combineGreek, onClose, onSearch }: Props) {
  const [entries, setEntries] = useState<LexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [highlightWord, setHighlightWord] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const highlight = (text: string | null) => {
    if (!text || !highlightWord) return text;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, 'giu');
    return text.split(pattern).map((part, index) => index % 2 === 1 ? (
      <mark key={index} style={{ background: '#ffe58a', color: '#1a2744', borderRadius: 2 }}>{part}</mark>
    ) : part);
  };

  useEffect(() => {
    let cancelled = false;
    dbClient.searchDefinitions(word).then((matches) => {
      if (!cancelled) {
        setEntries(matches);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [word]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const search = (entry: LexEntry, source: Source) => {
    if (!entry.lemma) return;
    onSearch(entry.lemma, source);
    onClose();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 110, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--backdrop)' }} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="english-strongs-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
            if (!controls?.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        style={{ position: 'relative', width: '100%', maxHeight: '85%', overflowY: 'auto', padding: '20px 20px 32px', boxSizing: 'border-box', borderRadius: '20px 20px 0 0', background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-lg)', fontFamily: 'DM Sans' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 id="english-strongs-title" style={{ margin: 0, fontFamily: 'Playfair Display', fontSize: 'var(--fs-heading)' }}>Strong’s: {word}</h2>
          <button onClick={onClose} aria-label="Close Strong’s" style={{ padding: 8, border: 'none', borderRadius: 8, background: 'var(--surface-muted)', color: 'var(--ink)', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-mid)' }}>Hebrew and Greek definitions containing this English word. Select a term to search its lemma.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 'var(--fs-control)', cursor: 'pointer' }}>
          <input type="checkbox" checked={highlightWord} onChange={(e) => setHighlightWord(e.target.checked)} />
          Highlight “{word}” in definitions
        </label>
        <div role="status" style={{ fontSize: 'var(--fs-body)' }}>
          {loading ? 'Loading definitions…' : error ? 'Could not load definitions. Close and reopen to try again.' : entries.length === 0 ? 'No matching definitions.' : `${entries.length} matching definitions`}
        </div>
        {(['Heb', 'Grk'] as const).map((lang) => {
          const matches = entries.filter((entry) => entry.lang === lang);
          if (!matches.length) return null;
          const accent = lang === 'Heb' ? 'var(--amber)' : 'var(--indigo)';
          return (
            <section key={lang}>
              <h3 style={{ color: accent, fontSize: 'var(--fs-body)', margin: '20px 0 10px' }}>{lang === 'Heb' ? 'Hebrew' : 'Greek'} ({matches.length})</h3>
              {matches.map((entry) => (
                <article key={entry.dstrong} style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => search(entry, lang === 'Heb' ? 'Heb' : 'GNT')}
                    disabled={!entry.lemma}
                    aria-label={`Search ${entry.lemma ?? entry.estrong} in ${lang === 'Heb' ? 'Hebrew' : combineGreek ? 'LXX and GNT' : 'GNT'}`}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '4px 0', border: 'none', background: 'transparent', color: accent, cursor: entry.lemma ? 'pointer' : 'default', textAlign: 'start' }}
                  >
                    <span dir={lang === 'Heb' ? 'rtl' : 'ltr'} style={{ fontFamily: 'serif', fontSize: 'var(--fs-def-lemma)', fontWeight: 600 }}>{highlight(entry.lemma ?? entry.estrong)}</span>
                    <span style={{ fontSize: 'var(--fs-meta)' }}>{highlight(entry.dstrong)} · {highlight(entry.translit)}</span>
                    <span style={{ fontSize: 'var(--fs-meta)' }}>Search {lang === 'Heb' ? 'Heb' : combineGreek ? 'LXX + GNT' : 'GNT'} →</span>
                  </button>
                  {lang === 'Grk' && !combineGreek && entry.lemma && (
                    <button onClick={() => search(entry, 'LXX')} style={{ border: 'none', borderRadius: 6, padding: '4px 8px', background: 'var(--indigo-bg)', color: accent, cursor: 'pointer', fontSize: 'var(--fs-meta)' }}>Search LXX →</button>
                  )}
                  {entry.gloss && <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, marginTop: 6 }}>{highlight(entry.gloss)}</div>}
                  {entry.meaning && <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-def-row)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{highlight(entry.meaning)}</p>}
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
