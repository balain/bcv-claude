import { useEffect, useRef, useState } from 'react';
import type { Lang, Source, WordToken } from '../types';
import { dbClient } from '../lib/db';
import type { LexEntry, StudyEntry } from '../lib/db';
import { STUDY_SOURCES } from '../lib/sourceCredits';

interface Props {
  word: WordToken;
  lang: Lang;
  onClose: () => void;
  onSearch: (query: string, source: Source) => void;
}

export function DefinitionSheet(props: Props) {
  return <DefinitionSheetContent key={`${props.lang}:${props.word.strong}:${props.word.lemma}:${props.word.surface}`} {...props} />;
}

function DefinitionSheetContent({ word, lang, onClose, onSearch }: Props) {
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
  const [studyEntries, setStudyEntries] = useState<StudyEntry[]>([]);
  const [studyLoading, setStudyLoading] = useState(true);
  const [studyError, setStudyError] = useState('');
  const [selectedSource, setSelectedSource] = useState('');

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
    let cancelled = false;
    const lexLang = isHeb ? 'Heb' : 'Grk';

    (async () => {
      try {
        let entry: LexEntry | null = null;
        if (word.strong) entry = await dbClient.lookup(word.strong);
        if (!entry && word.lemma) entry = await dbClient.lookupByLemma(word.lemma, lexLang);
        if (!cancelled) setLex(entry);
        const studies = await dbClient.studyLookup(word.strong ?? entry?.estrong, word.lemma ?? entry?.lemma, lexLang);
        if (!cancelled) setStudyEntries(studies);
      } catch (error) {
        if (!cancelled) setStudyError(error instanceof Error ? error.message : 'Study sources could not load.');
      } finally {
        if (!cancelled) setStudyLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [word.strong, word.lemma, isHeb]);

  const meaning = isHeb && studyEntries.some((entry) => entry.source === 'bdb') ? null : lex?.meaning ?? word.meaning ?? null;
  const gloss = lex?.gloss ?? word.gloss ?? null;
  const sources = [...new Set(studyEntries.map((entry) => entry.source))];
  const activeSource = sources.find((source) => source === selectedSource) ?? sources[0];
  const activeEntries = studyEntries.filter((entry) => entry.source === activeSource);

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
              fontSize: 'var(--fs-body)',
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
              <details open={!studyEntries.length}>
                <summary style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, cursor: 'pointer' }}>{isHeb ? 'BDB · Open Scriptures' : 'Brief Greek definition · STEP Bible'}</summary>
                <p style={{ whiteSpace: 'pre-line', margin: '8px 0 0' }}>{meaning}</p>
              </details>
            </div>
          )}
        </div>

        <section aria-label="Study lexicons" style={{ padding: '16px 20px 0', fontFamily: 'DM Sans', color: 'var(--ink)', fontSize: 'var(--fs-def-row)' }}>
          <h2 style={{ fontSize: 'var(--fs-control)', margin: '0 0 12px' }}>Study lexicons</h2>
          {studyLoading && <p role="status">Loading study sources…</p>}
          {studyError && <p role="status" style={{ color: 'var(--ink-mid)' }}>{studyError}</p>}
          {!studyLoading && !studyError && !sources.length && <p>No study entry is available for this word.</p>}
          <div role="group" aria-label="Lexicon source" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sources.map((source) => (
              <button key={source} onClick={() => setSelectedSource(source)} aria-pressed={activeSource === source}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: activeSource === source ? 'var(--indigo-bg)' : 'var(--surface-muted)', color: activeSource === source ? 'var(--indigo)' : 'var(--ink)', cursor: 'pointer', fontSize: 'var(--fs-control)' }}>
                {source === 'bdb' ? 'BDB' : source === 'lsj' ? 'LSJ' : 'UBS'}
              </button>
            ))}
          </div>
          {activeSource && (
            <div style={{ marginTop: 12, lineHeight: 1.6 }}>
              <a href={STUDY_SOURCES[activeSource].url} target="_blank" rel="noreferrer" style={{ color: 'var(--indigo)', fontSize: 'var(--fs-meta)' }}>{STUDY_SOURCES[activeSource].name} · {STUDY_SOURCES[activeSource].license}</a>
              {activeEntries.length > 1 && <p style={{ color: 'var(--ink-mid)', fontSize: 'var(--fs-meta)' }}>This lookup matches several dictionary entries. Choose the meaning that fits the passage.</p>}
              {activeEntries.map((entry, entryIndex) => (
                <article key={entry.id}>
                  <h3 style={{ fontFamily: 'serif', fontSize: 'var(--fs-def-lemma)', margin: '12px 0' }} dir={isHeb ? 'rtl' : 'ltr'}>{entry.lemma}</h3>
                  {activeEntries.length > 1 && <div style={{ fontWeight: 600 }}>Entry {entryIndex + 1}{entry.senses[0]?.glosses.filter(Boolean).length ? ` · ${entry.senses[0].glosses.filter(Boolean).join(', ')}` : ''}</div>}
                  {entry.senses.map((sense, index) => (
                    <div key={`${sense.code}:${index}`} style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
                      {entry.senses.length > 1 && <div style={{ fontWeight: 600 }}>Meaning {index + 1}{sense.glosses.length ? ` · ${sense.glosses.join(', ')}` : ''}</div>}
                      <p style={{ whiteSpace: 'pre-line', margin: '6px 0', overflowWrap: 'anywhere' }}>{sense.definition}</p>
                      {sense.domains.length > 0 && <p style={{ margin: '6px 0', color: 'var(--ink-mid)' }}>Semantic domain: {sense.domains.join(' · ')}</p>}
                      {sense.note && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--indigo)' }}>Usage notes</summary>
                          <p style={{ margin: '8px 0', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{sense.note}</p>
                        </details>
                      )}
                      {sense.references.length > 0 && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--indigo)' }}>{entry.source === 'lsj' ? 'Literary references' : 'Scripture references'} ({sense.references.length})</summary>
                          <p style={{ margin: '8px 0', color: 'var(--ink-mid)' }}>{sense.references.join('; ')}</p>
                        </details>
                      )}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </section>

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
