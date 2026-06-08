import { useEffect, useRef, useState } from 'react';
import type { Lang, Source, WordToken } from '../types';
import { dbClient } from '../lib/db';
import type { LexEntry } from '../lib/db';

interface Props {
  word: WordToken;
  lang: Lang;
  onClose: () => void;
  onSearch: (query: string, source: Source) => void;
}

export function DefinitionSheet({ word, lang, onClose, onSearch }: Props) {
  const isHeb = lang === 'Heb';
  const accentColor = isHeb ? 'var(--amber)' : 'var(--indigo)';
  // Derive the search source from the token's own corpus so LXX words search LXX,
  // GNT words search GNT, and Hebrew words search Heb — regardless of which
  // translation the user was browsing when they tapped the word.
  const origSource: Source =
    word.corpus === 'WLC' ? 'Heb' :
    word.corpus === 'LXX' ? 'LXX' :
    'GNT';
  const [lex, setLex] = useState<LexEntry | null>(null);

  const dragStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStart.current !== null && e.changedTouches[0].clientY - dragStart.current > 60) {
      onClose();
    }
    dragStart.current = null;
  };

  // Fetch the lex_brief entry when this sheet opens (or when word changes).
  // Prefer Strong's lookup (fast, unambiguous); fall back to lemma when Strong's is absent
  // (GNT tokens currently store no Strong's — lemma lookup covers that gap).
  useEffect(() => {
    setLex(null);
    let cancelled = false;
    const lexLang = isHeb ? 'Heb' : 'Grk';

    (async () => {
      let entry: typeof lex = null;
      if (word.strong) {
        entry = await dbClient.lookup(word.strong);
      }
      if (!entry && word.lemma) {
        entry = await dbClient.lookupByLemma(word.lemma, lexLang);
      }
      if (!cancelled) setLex(entry);
    })();

    return () => { cancelled = true; };
  }, [word.strong, word.lemma, isHeb]);

  const meaning = lex?.meaning ?? word.meaning ?? null;
  const gloss = lex?.gloss ?? word.gloss ?? null;

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: 'Lemma', value: word.lemma },
    { label: "Strong's", value: word.strong },
    { label: 'Gloss', value: gloss },
    { label: 'Form', value: word.form },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--backdrop)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'relative',
          width: '100%',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '0 0 32px',
          animation: 'sheetIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '70%',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div
          style={{
            padding: '14px 20px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { if (word.lemma) { onSearch(word.lemma, origSource); onClose(); } }}
              disabled={!word.lemma}
              style={{
                fontSize: 'var(--fs-meta)',
                fontWeight: 600,
                color: accentColor,
                background: isHeb ? 'var(--amber-bg)' : 'var(--indigo-bg)',
                border: 'none',
                borderRadius: 20,
                padding: '5px 12px',
                fontFamily: 'DM Sans',
                cursor: word.lemma ? 'pointer' : 'default',
                opacity: word.lemma ? 1 : 0.4,
              }}
            >
              Search {word.lemma ?? 'lemma'} →
            </button>
            <button
              onClick={() => { if (word.surface) { onSearch(word.surface, origSource); onClose(); } }}
              disabled={!word.surface}
              style={{
                fontSize: 'var(--fs-meta)',
                fontWeight: 600,
                color: 'var(--ink-light)',
                background: 'var(--parchment-mid)',
                border: 'none',
                borderRadius: 20,
                padding: '5px 12px',
                fontFamily: 'DM Sans',
                cursor: word.surface ? 'pointer' : 'default',
                opacity: word.surface ? 1 : 0.4,
              }}
            >
              Search form →
            </button>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'var(--parchment-mid)',
              cursor: 'pointer',
              color: 'var(--ink-light)',
              fontSize: 14,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            margin: '16px 20px 0',
            padding: 16,
            background: isHeb ? 'var(--amber-bg)' : 'var(--indigo-bg)',
            borderRadius: 14,
            borderLeft: `4px solid ${accentColor}`,
          }}
        >
          <div
            style={{
              fontFamily: 'serif',
              fontSize: 'var(--fs-def-surface)',
              color: accentColor,
              fontWeight: 600,
              direction: isHeb ? 'rtl' : 'ltr',
              lineHeight: 1.2,
            }}
          >
            {word.surface}
          </div>
          <div
            style={{
              fontSize: 'var(--fs-meta)',
              color: 'var(--ink-mid)',
              marginTop: 4,
              fontFamily: 'DM Sans',
              fontStyle: 'italic',
            }}
          >
            {word.translit}
          </div>
          {meaning && (
            <div
              style={{
                fontSize: 'var(--fs-def-row)',
                color: 'var(--ink)',
                marginTop: 8,
                fontFamily: 'DM Sans',
                lineHeight: 1.5,
              }}
            >
              {meaning}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px 0' }}>
          {rows.map(
            ({ label, value }) =>
              value && (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    gap: 12,
                    paddingBottom: 12,
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 12,
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--fs-control)',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'var(--ink-light)',
                      textTransform: 'uppercase',
                      minWidth: 64,
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      color: 'var(--ink)',
                      fontFamily: label === 'Lemma' ? 'serif' : 'DM Sans',
                      fontSize: label === 'Lemma' ? 'var(--fs-def-lemma)' : 'var(--fs-def-row)',
                      direction: label === 'Lemma' && isHeb ? 'rtl' : 'ltr',
                    }}
                  >
                    {value}
                  </span>
                </div>
              ),
          )}
        </div>
      </div>
    </div>
  );
}
