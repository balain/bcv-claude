import { useEffect, useMemo, useRef, useState } from 'react';
import { dbClient } from '../lib/db';
import type { ChapterVerse, ChapterVerseOriginals } from '../lib/db';
import type { Lang, Source, WordToken } from '../types';
import { BOOK_BY_ABBR3 } from '../lib/books';
import { WordChip } from './WordChip';
import { DefinitionSheet } from './DefinitionSheet';

interface ChapterViewProps {
  abbr3: string;
  bookName: string;
  chapter: number;
  highlightVerse: number;
  testament: 'OT' | 'NT';
  onClose: () => void;
  onSearch: (query: string, source: Source) => void;
  /** When true, renders inline (no fixed overlay, no close button). Used in BcvBrowser. */
  standalone?: boolean;
  /** When provided, shows an "open in browse" button in the overlay header. */
  onOpenInBrowse?: (bookId: number, chapter: number, verse: number) => void;
  /** When provided, shows ☆/★ per verse for bookmarking. */
  onBookmark?: (bookId: number, chapter: number, verse: number, label: string) => void;
  /** When provided, checks if a verse is already bookmarked. */
  isBookmarked?: (bookId: number, chapter: number, verse: number) => boolean;
  /** Verse numbers that have associated class notes — shows a dot badge. */
  versesWithNotes?: Set<number>;
  /** Called when user taps a verse's notes badge. */
  onNotesBadgeClick?: (verse: number) => void;
}

const SECTION_LABEL: Record<string, string> = {
  WLC: 'Hebrew (MT)',
  LXX: 'Greek (LXX)',
  GNT: 'Greek (GNT)',
};

export function ChapterView({
  abbr3, bookName, chapter: initialChapter, highlightVerse,
  testament, onClose, onSearch,
  standalone, onOpenInBrowse, onBookmark, isBookmarked,
  versesWithNotes, onNotesBadgeClick,
}: ChapterViewProps) {
  const bookId = BOOK_BY_ABBR3.get(abbr3)?.id ?? 0;
  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [currentHighlight, setCurrentHighlight] = useState(highlightVerse);
  const [totalChapters, setTotalChapters] = useState<number | null>(null);
  const [verses, setVerses] = useState<ChapterVerse[]>([]);
  const [verseOriginals, setVerseOriginals] = useState<ChapterVerseOriginals[]>([]);
  const [loading, setLoading] = useState(true);
  const [originalsOpen, setOriginalsOpen] = useState(false);

  const [selectedWord, setSelectedWord] = useState<WordToken | null>(null);
  const [selectedLang, setSelectedLang] = useState<Lang | null>(null);

  const highlightRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const accentColor = testament === 'OT' ? 'var(--amber)' : 'var(--indigo)';
  const accentBg    = testament === 'OT' ? 'var(--amber-bg)' : 'var(--indigo-bg)';

  // Fetch chapter text + originals whenever abbr3 or currentChapter changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVerseOriginals([]);
    Promise.all([
      dbClient.fetchChapter(abbr3, currentChapter),
      dbClient.fetchChapterOriginals(abbr3, currentChapter, testament),
    ]).then(([chapterData, originals]) => {
      if (cancelled) return;
      setVerses(chapterData.verses);
      setTotalChapters(chapterData.totalChapters);
      setVerseOriginals(originals);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [abbr3, currentChapter, testament]);

  // Scroll to highlighted verse after data loads; otherwise scroll to top
  useEffect(() => {
    if (loading) return;
    if (currentHighlight > 0 && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [loading, currentHighlight]);

  const goTo = (chap: number) => {
    setCurrentChapter(chap);
    setCurrentHighlight(0);
  };

  // Build a verse → originals map for efficient lookup in render
  const originalsByVerse = useMemo(() => {
    const map = new Map<number, ChapterVerseOriginals['originals']>();
    for (const item of verseOriginals) map.set(item.verse, item.originals);
    return map;
  }, [verseOriginals]);

  const hasPrev = currentChapter > 1;
  const hasNext = totalChapters !== null && currentChapter < totalChapters;

  // Label for the originals toggle button
  const originalsLabel = testament === 'OT' ? 'Heb / LXX' : 'Greek';

  const btnStyle = (active: boolean) => ({
    background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.0)',
    border: 'none',
    borderRadius: 8,
    padding: '4px 9px',
    color: active ? '#fff' : 'rgba(255,255,255,0.25)',
    fontSize: 13,
    cursor: active ? 'pointer' as const : 'default' as const,
    fontFamily: 'DM Sans',
    flexShrink: 0,
    lineHeight: 1.4,
  });

  const header = (
    <div
      style={{
        background: 'var(--navy)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 8,
      }}
    >
      <button onClick={() => hasPrev && goTo(currentChapter - 1)} disabled={!hasPrev}
        style={btnStyle(hasPrev)} aria-label="Previous chapter">◀</button>

      <span style={{
        fontFamily: 'Playfair Display', fontSize: 16, fontWeight: 700,
        color: '#fff', letterSpacing: '-0.01em', flex: 1, textAlign: 'center',
      }}>
        {bookName} {currentChapter}
      </span>

      <button onClick={() => hasNext && goTo(currentChapter + 1)} disabled={!hasNext}
        style={btnStyle(hasNext)} aria-label="Next chapter">▶</button>

      {onOpenInBrowse && (
        <button
          onClick={() => onOpenInBrowse(bookId, currentChapter, currentHighlight || 1)}
          title="Open in Browse mode"
          aria-label="Open in Browse mode"
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.12)', cursor: 'pointer',
            color: '#fff', fontSize: 14, display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >⤢</button>
      )}

      <button onClick={onClose} aria-label="Close chapter view"
        style={{
          width: 28, height: 28, borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
          color: '#fff', fontSize: 14, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>✕</button>
    </div>
  );

  const subHeader = (
    <div style={{
      padding: '4px 14px', background: 'var(--navy-mid)',
      fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
      color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' as const,
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span>NASB</span>
      <button
        onClick={() => setOriginalsOpen((v) => !v)}
        style={{
          background: originalsOpen ? `${accentColor}30` : 'rgba(255,255,255,0.08)',
          border: 'none', borderRadius: 6, padding: '2px 8px',
          color: originalsOpen ? accentColor : 'rgba(255,255,255,0.5)',
          fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
          cursor: 'pointer', textTransform: 'uppercase' as const, fontFamily: 'DM Sans',
        }}
        aria-label={originalsOpen ? 'Hide original language' : 'Show original language'}
      >
        {originalsLabel} {originalsOpen ? '▼' : '▶'}
      </button>
    </div>
  );

  const verseList = (
    <div ref={scrollRef} className="no-scrollbar"
      style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 32px' }}>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)', fontFamily: 'DM Sans', fontSize: 13 }}>
          Loading…
        </div>
      ) : verses.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)', fontFamily: 'DM Sans', fontSize: 13 }}>
          No verses found.
        </div>
      ) : (
        verses.map((v) => {
          const isHighlight = v.verse === currentHighlight;
          const originals = originalsByVerse.get(v.verse) ?? [];
          const hasBothCorpora = originals.length > 1;
          const hasNote = versesWithNotes?.has(v.verse) ?? false;
          const bookmarked = isBookmarked?.(bookId, currentChapter, v.verse) ?? false;

          return (
            <div
              key={v.verse}
              ref={isHighlight ? highlightRef : null}
              style={{
                marginBottom: 10, borderRadius: 8,
                background: isHighlight ? accentBg : 'transparent',
                border: isHighlight ? `1px solid ${accentColor}30` : '1px solid transparent',
                overflow: 'hidden', transition: 'background 0.2s',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: isHighlight ? '6px 8px 4px' : '2px 8px 4px',
              }}>
                {/* Verse number + optional notes dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: 2 }}>
                  <span style={{
                    minWidth: 24, padding: '1px 6px', borderRadius: 20,
                    background: accentColor, color: '#fff', fontSize: 10,
                    fontWeight: 700, fontFamily: 'DM Sans', textAlign: 'center', marginTop: 3,
                  }}>
                    {v.verse}
                  </span>
                  {hasNote && (
                    <button
                      onClick={() => onNotesBadgeClick?.(v.verse)}
                      title="Has class notes — tap to view"
                      aria-label="View class notes for this verse"
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--indigo)', border: 'none',
                        cursor: 'pointer', padding: 0, flexShrink: 0,
                      }}
                    />
                  )}
                </div>

                <span style={{ fontFamily: 'DM Serif Display', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', flex: 1 }}>
                  {v.text}
                </span>

                {/* Bookmark button */}
                {onBookmark && (
                  <button
                    onClick={() => onBookmark(bookId, currentChapter, v.verse, `${bookName} ${currentChapter}:${v.verse}`)}
                    title={bookmarked ? 'Bookmarked' : 'Add bookmark'}
                    aria-label={bookmarked ? 'Bookmarked' : 'Add bookmark'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: bookmarked ? accentColor : 'var(--ink-light)',
                      fontSize: 14, padding: '2px 4px', flexShrink: 0, marginTop: 2,
                    }}
                  >
                    {bookmarked ? '★' : '☆'}
                  </button>
                )}
              </div>

              {originalsOpen && originals.length > 0 && originals.map((section) => (
                <div key={section.corpus} style={{
                  background: section.lang === 'Heb' ? '#fffdf8' : '#f8f9ff',
                  borderTop: '1px solid var(--border)', padding: '4px 8px 3px',
                }}>
                  {hasBothCorpora && (
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
                      <WordChip key={i} word={w as WordToken} lang={section.lang}
                        onTap={(word) => { setSelectedWord(word); setSelectedLang(section.lang); }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );

  const footerNav = (
    <div style={{
      display: 'flex', gap: 8, padding: '8px 14px 12px',
      borderTop: '1px solid var(--border)', background: 'var(--parchment)', flexShrink: 0,
    }}>
      <button onClick={() => hasPrev && goTo(currentChapter - 1)} disabled={!hasPrev}
        style={{
          flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
          background: hasPrev ? accentBg : 'var(--parchment-mid)',
          color: hasPrev ? accentColor : 'var(--ink-light)',
          fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600,
          cursor: hasPrev ? 'pointer' : 'default',
        }}>
        ◀ {bookName} {currentChapter - 1}
      </button>
      <button onClick={() => hasNext && goTo(currentChapter + 1)} disabled={!hasNext}
        style={{
          flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
          background: hasNext ? accentBg : 'var(--parchment-mid)',
          color: hasNext ? accentColor : 'var(--ink-light)',
          fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600,
          cursor: hasNext ? 'pointer' : 'default',
        }}>
        {bookName} {currentChapter + 1} ▶
      </button>
    </div>
  );

  const definitionSheet = selectedWord && selectedLang && (
    <DefinitionSheet
      word={selectedWord}
      lang={selectedLang}
      onClose={() => setSelectedWord(null)}
      onSearch={(q, s) => {
        onSearch(q, s);
        if (!standalone) onClose();
      }}
    />
  );

  const panel = (
    <div style={{
      background: 'var(--parchment)', display: 'flex', flexDirection: 'column',
      ...(standalone ? { flex: 1, minHeight: 0 } : {
        position: 'relative', width: '100%', height: '100%',
        animation: 'sheetIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        boxShadow: 'var(--shadow-lg)',
      }),
    }}>
      {header}
      {subHeader}
      {verseList}
      {footerNav}
    </div>
  );

  if (standalone) {
    return (
      <>
        {panel}
        {definitionSheet}
      </>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(15,17,30,0.55)', animation: 'fadeIn 0.2s ease',
      }} />
      {panel}
      {definitionSheet}
    </div>
  );
}
