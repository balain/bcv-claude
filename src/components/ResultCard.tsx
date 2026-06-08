import { useState } from 'react';
import type { BibleResult, Lang, OriginalSection, WordToken } from '../types';
import type { CrossRef } from '../lib/db';
import { BOOK_BY_ABBR3 } from '../lib/books';
import { WordChip } from './WordChip';

interface Props {
  result: BibleResult;
  onWordTap: (word: WordToken, lang: Lang) => void;
  onEngWordClick: (word: string) => void;
  onRefClick: (result: BibleResult) => void;
  onBookmark?: (bookId: number, chapter: number, verse: number, label: string) => void;
  isBookmarked?: (bookId: number, chapter: number, verse: number) => boolean;
  crossRefs?: CrossRef[];
  onCrossRefClick?: (bookId: number, chapter: number, verse: number) => void;
  onAddCrossRef?: (bookId: number, chapter: number, verse: number, rawTarget: string) => void;
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

const MAX_CROSS_REFS_VISIBLE = 5;

export function ResultCard({
  result, onWordTap, onEngWordClick, onRefClick, onBookmark, isBookmarked,
  crossRefs, onCrossRefClick, onAddCrossRef,
}: Props) {
  const bookId = BOOK_BY_ABBR3.get(result.bookAbbr)?.id ?? 0;
  const bookmarked = isBookmarked?.(bookId, result.chapter, result.verse) ?? false;
  const [expanded, setExpanded] = useState(true);
  const [crossRefsOpen, setCrossRefsOpen] = useState(false);
  const [addingCrossRef, setAddingCrossRef] = useState(false);
  const [crossRefInput, setCrossRefInput] = useState('');
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
    section.lang === 'Heb' ? 'var(--orig-heb-bg)' : 'var(--orig-grk-bg)';

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
        background: 'var(--surface)',
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

        {onBookmark && (
          <button
            onClick={(e) => { e.stopPropagation(); onBookmark(bookId, result.chapter, result.verse, result.ref); }}
            title={bookmarked ? 'Bookmarked' : 'Add bookmark'}
            aria-label={bookmarked ? 'Bookmarked' : 'Add bookmark'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: bookmarked ? accentColor : 'var(--ink-light)',
              fontSize: 16, padding: '0 2px', flexShrink: 0,
            }}
          >
            {bookmarked ? '★' : '☆'}
          </button>
        )}
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

          {/* Cross-references section */}
          {(crossRefs && crossRefs.length > 0 || onAddCrossRef) && (
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--parchment)' }}>
              <div
                onClick={() => setCrossRefsOpen((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--ink-light)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, flex: 1 }}>
                  Cross-refs {crossRefs && crossRefs.length > 0 ? `(${crossRefs.length})` : ''}
                </span>
                {onAddCrossRef && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingCrossRef((v) => !v); }}
                    title="Add cross-reference"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: accentColor, fontSize: 13, padding: '0 2px' }}
                  >+</button>
                )}
                {crossRefs && crossRefs.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--ink-light)' }}>{crossRefsOpen ? '▼' : '▶'}</span>
                )}
              </div>

              {addingCrossRef && onAddCrossRef && (
                <div style={{ padding: '0 10px 6px', display: 'flex', gap: 6 }}>
                  <input
                    autoFocus
                    placeholder="Target reference (e.g. John 3:16)"
                    value={crossRefInput}
                    onChange={(e) => setCrossRefInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && crossRefInput.trim()) {
                        onAddCrossRef(bookId, result.chapter, result.verse, crossRefInput.trim());
                        setCrossRefInput('');
                        setAddingCrossRef(false);
                      } else if (e.key === 'Escape') {
                        setAddingCrossRef(false);
                      }
                    }}
                    style={{
                      flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 6,
                      border: `1px solid ${accentColor}`, outline: 'none',
                      fontFamily: 'DM Sans',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (crossRefInput.trim()) {
                        onAddCrossRef(bookId, result.chapter, result.verse, crossRefInput.trim());
                        setCrossRefInput('');
                        setAddingCrossRef(false);
                      }
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: accentColor, color: '#fff', fontSize: 12,
                      cursor: 'pointer', fontFamily: 'DM Sans',
                    }}
                  >Add</button>
                </div>
              )}

              {crossRefsOpen && crossRefs && crossRefs.length > 0 && (
                <div style={{ padding: '2px 10px 6px' }}>
                  {crossRefs.slice(0, MAX_CROSS_REFS_VISIBLE).map((cr, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span
                        onClick={() => onCrossRefClick?.(cr.targetBookId, cr.targetChapter, cr.targetVerseStart)}
                        style={{
                          fontSize: 12, color: accentColor, cursor: onCrossRefClick ? 'pointer' : 'default',
                          fontFamily: 'DM Sans', fontWeight: 500, textDecoration: 'underline',
                        }}
                      >
                        {cr.targetLabel}
                      </span>
                      {cr.sourceDataset === 'user' && (
                        <span style={{ fontSize: 10, color: 'var(--indigo)', fontWeight: 600 }}>★</span>
                      )}
                      {cr.userNote && (
                        <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cr.userNote}
                        </span>
                      )}
                      {cr.votes != null && (
                        <span style={{ fontSize: 10, color: 'var(--ink-light)', marginLeft: 'auto', flexShrink: 0 }}>
                          {cr.votes}
                        </span>
                      )}
                    </div>
                  ))}
                  {crossRefs.length > MAX_CROSS_REFS_VISIBLE && (
                    <div style={{ fontSize: 11, color: 'var(--ink-light)', paddingTop: 2 }}>
                      +{crossRefs.length - MAX_CROSS_REFS_VISIBLE} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
