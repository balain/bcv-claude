import { useEffect, useRef } from 'react';
import { SOURCE_CREDITS } from '../lib/sourceCredits';

export function SourceCredits({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="source-credits-title" tabIndex={-1} ref={panel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onBack(); }
        if (event.key === 'Tab') {
          const elements = panel.current?.querySelectorAll<HTMLElement>('button, a[href]');
          const first = elements?.[0];
          const last = elements?.[elements.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }
      }}
      style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'var(--surface)', overflowY: 'auto', overflowWrap: 'anywhere', color: 'var(--ink)', padding: '20px 20px 40px', fontFamily: 'DM Sans', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button onClick={onBack} style={{ color: 'var(--indigo)', background: 'var(--surface-muted)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>← Settings</button>
        <button onClick={onClose} aria-label="Close source credits" style={{ color: 'var(--ink)', background: 'var(--surface-muted)', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>✕</button>
      </div>
      <h1 id="source-credits-title" style={{ fontFamily: 'Playfair Display', fontSize: 'var(--fs-gloss-lemma)' }}>Source material credits</h1>
      <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6 }}>Bible texts, lexicons, and annotations retain their respective licenses. The application code is MIT licensed.</p>
      {SOURCE_CREDITS.map((source) => (
        <section key={source.name} style={{ borderTop: '1px solid var(--border)', padding: '16px 0', fontSize: 'var(--fs-body)', lineHeight: 1.6 }}>
          <h2 style={{ fontSize: 'var(--fs-control)', margin: '0 0 8px' }}><a href={source.url} target="_blank" rel="noreferrer" style={{ color: 'var(--indigo)' }}>{source.name}</a></h2>
          <p style={{ margin: '0 0 8px' }}>{source.credit}</p>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{source.license}</p>
          <p style={{ margin: 0, color: 'var(--ink-mid)' }}>{source.note}</p>
        </section>
      ))}
      <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6 }}>
        License terms: <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.
        {' '}<a href={`${import.meta.env.BASE_URL}db/ubs-study.json`} download>Download adapted UBS data and credits</a>.
      </p>
    </div>
  );
}
