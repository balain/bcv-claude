import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dbClient } from '../lib/db';
import type { VersePreview } from '../lib/db';
import { linkifyScripture } from '../lib/scriptureLinks';
import type { ScriptureDialect, ScriptureRef } from '../lib/scriptureLinks';
import { ScriptureLinkContext } from '../lib/scriptureLinkContext';

const SECTION_LABEL: Record<string, string> = {
  WLC: 'Hebrew (MT)',
  LXX: 'Greek (LXX)',
  GNT: 'Greek (GNT)',
};

const HOVER_DELAY = 300;
const LONG_PRESS = 450;
const GUTTER = 16;

/** Third-party lexicon text with its Scripture citations rendered as preview links. */
export function ScriptureText({ text, dialect }: { text: string; dialect?: ScriptureDialect }) {
  const segments = useMemo(() => linkifyScripture(text, dialect), [text, dialect]);
  return <>{segments.map((s, i) => s.ref ? <ScriptureRefLink key={i} scriptureRef={s.ref}>{s.text}</ScriptureRefLink> : s.text)}</>;
}

type PreviewState = { status: 'loading' } | { status: 'ready'; preview: VersePreview | null } | { status: 'error' };

export function ScriptureRefLink({ scriptureRef, children }: { scriptureRef: ScriptureRef; children: ReactNode }) {
  const openPassage = useContext(ScriptureLinkContext);
  const tooltipId = useId();
  const anchor = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const { bookId, chapter, verse } = scriptureRef;

  const show = () => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, window.innerWidth - GUTTER * 2);
    const left = Math.min(Math.max(GUTTER, rect.left), window.innerWidth - width - GUTTER);
    const below = window.innerHeight - rect.bottom > rect.top;
    setPosition(below ?
      { left, width, top: rect.bottom + 6, maxHeight: window.innerHeight - rect.bottom - GUTTER } :
      { left, width, bottom: window.innerHeight - rect.top + 6, maxHeight: rect.top - GUTTER });
    setState({ status: 'loading' });
    dbClient.fetchVersePreview(bookId, chapter, verse).then(
      (preview) => setState({ status: 'ready', preview }),
      () => setState({ status: 'error' }),
    );
  };
  const hide = () => { window.clearTimeout(timer.current); setPosition(null); };
  const showAfter = (delay: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(show, delay); };

  const open = position !== null;
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => { if (!anchor.current?.contains(e.target as Node)) hide(); };
    // Fixed positioning goes stale once anything scrolls.
    const onScroll = () => hide();
    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <a
        ref={anchor}
        href={`#/bcv/${bookId}/${chapter}?v=${verse}`}
        aria-describedby={open ? tooltipId : undefined}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') showAfter(HOVER_DELAY); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') hide(); }}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); hide(); } }}
        onTouchStart={() => { longPressed.current = false; timer.current = window.setTimeout(() => { longPressed.current = true; show(); }, LONG_PRESS); }}
        onTouchMove={() => window.clearTimeout(timer.current)}
        onTouchEnd={() => window.clearTimeout(timer.current)}
        onContextMenu={(e) => { if (longPressed.current) e.preventDefault(); }}
        onClick={(e) => {
          if (longPressed.current) { e.preventDefault(); longPressed.current = false; return; }
          if (!openPassage || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          hide();
          openPassage(scriptureRef);
        }}
        style={{ color: 'var(--indigo)', textDecoration: 'underline dotted', textUnderlineOffset: 3, cursor: 'pointer' }}
      >
        {children}
      </a>
      {position && createPortal(
        <div id={tooltipId} role="tooltip" style={{
          position: 'fixed', ...position, zIndex: 1000, boxSizing: 'border-box', overflowY: 'auto',
          background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: 'var(--shadow-lg)', padding: '12px 14px', fontFamily: 'DM Sans', fontSize: 'var(--fs-meta)',
          lineHeight: 1.5, animation: 'fadeIn 0.15s ease', pointerEvents: 'none',
        }}>
          <VersePreviewBody state={state} />
        </div>,
        document.body,
      )}
    </>
  );
}

function VersePreviewBody({ state }: { state: PreviewState }) {
  if (state.status === 'loading') return <p style={{ margin: 0, color: 'var(--ink-mid)' }}>Loading…</p>;
  if (state.status === 'error' || !state.preview) return <p style={{ margin: 0, color: 'var(--ink-mid)' }}>Verse not available.</p>;
  const { label, english, originals } = state.preview;
  const labelStyle: CSSProperties = { fontSize: 'var(--fs-control)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-light)' };
  return (
    <>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {english && <p style={{ margin: '0 0 8px' }}><span style={labelStyle}>NASB</span> {english}</p>}
      {originals.map((section) => (
        <div key={section.corpus} style={{ borderTop: '1px solid var(--border)', padding: '6px 0 2px' }}>
          <div style={labelStyle}>{SECTION_LABEL[section.corpus] ?? section.corpus}</div>
          <p
            dir={section.lang === 'Heb' ? 'rtl' : 'ltr'}
            style={{ margin: '2px 0 0', fontFamily: 'serif', fontSize: 'var(--fs-body)', color: section.lang === 'Heb' ? 'var(--amber)' : 'var(--indigo)' }}
          >
            {section.tokens.map((t) => t.surface).join(' ')}
          </p>
        </div>
      ))}
    </>
  );
}
