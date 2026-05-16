import { useState } from 'react';
import type { BibleResult, Lang, OriginalSection, WordToken } from '../types';
import { WordChip } from './WordChip';

interface Props {
  result: BibleResult;
  onWordTap: (word: WordToken, lang: Lang) => void;
  onEngWordClick: (word: string) => void;
  onRefClick: (result: BibleResult) => void;
}

/** Strip leading/trailing punctuation to get a clean search term. */
function cleanWord(s: string): string {
  return s.replace(/^[^\w]+/, '').replace(/[^\w]+$/, '');
}

const SECTION_LABEL: Record<string, string> = {
  WLC: 'Hebrew (MT)',
  LXX: 'Greek (LXX)',
  GNT: 'Greek (GNT)',
};

export function ResultCard({ result, onWordTap, onEngWordClick, onRefClick }: Props) {
  const [expanded, setExpanded] = useState(true);
  // Start collapsed for English sources — the interlinear is supplementary there.
  const isOrigLang = result.source === 'Heb' || result.source === 'LXX' || result.source === 'GNT';
  const [interlinearOpen, setInterlinearOpen] = useState(isOrigLang);

  const hasWLC = result.originals.some((s) => s.corpus === 'WLC');
  const hasLXX = result.originals.some((s) => s.corpus === 'LXX');
  const hasBoth = hasWLC && hasLXX;

  const badgeText  = hasBoth ? 'Heb/LXX' : hasLXX && !hasWLC ? 'LXX' : result.lang === 'Heb' ? 'Heb' : 'Grk';
  const badgeColor = result.lang === 'Heb' ? 'var(--amber)' : 'var(--indigo)';
  const accentColor = badgeColor;

  const sectionBg = (section: OriginalSection) =>
    section.lang === 'Heb' ? '#fffdf8' : '#f8f9ff';

  /** Render English verse text as individually-clickable words. */
  const renderEngText = (text: string, matchWord: string) =>
    text.split(/(\s+)/).map((chunk, i) => {
      if (/^\s+$/.test(chunk)) return <span key={i}>{chunk}</span>;
      const clean = cleanWord(chunk);
      const isMatch = clean.length > 0 && clean.toLowerCase() === matchWord.toLowerCase();
      return (
        <span
          key={i}
          onClick={() => clean && onEngWordClick(clean)}
          style={{
            cursor: 'pointer',
            color: isMatch ? accentColor : 'inherit',
            fontWeight: isMatch ? 700 : 'inherit',
          }}
        >
          {chunk}
        </span>
      );
    });

  const renderSection = (section: OriginalSection) => (
    <div
      key={section.corpus}
      style={{
        background: sectionBg(section),
        borderTop: '1px solid var(--border)',
        padding: '4px 8px 2px',
      }}
    >
      {hasBoth && (
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: 'var(--ink-light)', paddingLeft: 4, marginBottom: 2,
          textTransform: 'uppercase' as const,
        }}>
          {SECTION_LABEL[section.corpus]}
        </div>
      )}
      <div style={{
        display: 'flex', flexWrap: 'wrap' as const,
        flexDirection: (section.lang === 'Heb' ? 'row-reverse' : 'row') as 'row-reverse' | 'row',
        gap: 0,
      }}>
        {section.tokens.map((w, i) => (
          <WordChip key={i} word={w} lang={section.lang} onTap={(word) => onWordTap(word, section.lang)} />
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        marginBottom: 8,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)',
      }}
    >
      {/* ── card header ── */}
      <div
        style={{
          padding: '7px 10px 5px',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ width: 3, height: 24, borderRadius: 2, background: accentColor, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              onClick={(e) => { e.stopPropagation(); onRefClick(result); }}
              style={{
                fontSize: 13, fontWeight: 600, color: accentColor,
                fontFamily: 'DM Sans', letterSpacing: '-0.01em',
                cursor: 'pointer',
              }}
            >
              {result.ref}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
              color: '#fff', background: badgeColor,
              borderRadius: 4, padding: '1px 5px',
            }}>
              {badgeText}
            </span>
          </div>
          {!expanded && (
            <div style={{
              fontSize: 12, color: 'var(--ink-mid)', marginTop: 1,
              fontFamily: 'DM Serif Display', lineHeight: 1.3, fontStyle: 'italic',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {renderEngText(result.english, result.matchWord)}
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: 22, height: 22, borderRadius: 6, border: 'none',
            background: 'var(--parchment-mid)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: 'var(--ink-light)', flexShrink: 0,
          }}
          aria-label={expanded ? 'Collapse result' : 'Expand result'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* ── expanded body ── */}
      {expanded && (
        <>
          {/* English verse text */}
          <div style={{ padding: '6px 10px 4px' }}>
            <p style={{ fontFamily: 'DM Serif Display', fontSize: 13, lineHeight: 1.55, color: 'var(--ink)' }}>
              {renderEngText(result.english, result.matchWord)}
            </p>
          </div>

          {/* Interlinear sections — click background to collapse/expand */}
          {result.originals.length > 0 && (
            <div
              onClick={() => setInterlinearOpen((v) => !v)}
              style={{ cursor: 'pointer' }}
            >
              {interlinearOpen ? (
                result.originals.map(renderSection)
              ) : (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '5px 12px',
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                  color: 'var(--ink-light)', textTransform: 'uppercase' as const,
                  background: 'var(--parchment-mid)',
                }}>
                  {result.originals.map((s) => SECTION_LABEL[s.corpus]).join(' · ')} ▶
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
