import { useEffect, useRef, useState } from 'react';
import { BOOK_META, BOOK_BY_ID } from '../lib/books';
import { parseRefs } from '../lib/class/refParser';
import { getClassClient } from '../lib/class/client';
import type { Bookmark } from '../types';
import { ChapterView } from './ChapterView';

interface Props {
  browsePos: { bookId: number; chapter: number; verse: number } | null;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
  bookmarks: Bookmark[];
  onBookmark: (bookId: number, chapter: number, verse: number, label: string) => void;
  onRemoveBookmark: (id: string) => void;
  isBookmarked: (bookId: number, chapter: number, verse: number) => boolean;
  onOpenClass: () => void;
  returnUrl?: string | null;
  onReturn?: () => void;
}

const OT = BOOK_META.filter((b) => b.testament === 'OT');
const NT = BOOK_META.filter((b) => b.testament === 'NT');

function formatPos(bookId: number, chapter: number, verse: number): string {
  const book = BOOK_BY_ID.get(bookId);
  if (!book) return '';
  return verse > 0 ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
}

export function BcvBrowser({
  browsePos, onNavigate, bookmarks, onBookmark, onRemoveBookmark, isBookmarked, onOpenClass,
  returnUrl, onReturn,
}: Props) {
  const [passageInput, setPassageInput] = useState('');
  const [parseError, setParseError]     = useState('');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(browsePos?.bookId ?? null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [versesWithNotes, setVersesWithNotes] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync passage input when browsePos changes from outside (e.g. hash navigation)
  useEffect(() => {
    if (browsePos) {
      setPassageInput(formatPos(browsePos.bookId, browsePos.chapter, browsePos.verse));
      setSelectedBookId(browsePos.bookId);
    }
  }, [browsePos]);

  // Load notes badge data whenever chapter changes
  useEffect(() => {
    if (!browsePos) return;
    let cancelled = false;
    try {
      getClassClient()
        .ref.listByChapter(browsePos.bookId, browsePos.chapter)
        .then((refs) => {
          if (cancelled) return;
          const verses = new Set<number>();
          for (const r of refs) {
            if (r.verseStart != null) verses.add(r.verseStart);
            if (r.verseEnd != null) verses.add(r.verseEnd);
          }
          setVersesWithNotes(verses);
        })
        .catch(() => { /* class db may not be ready yet */ });
    } catch {
      // class worker not yet initialized (parent effect runs after child effects on mount)
    }
    return () => { cancelled = true; };
  }, [browsePos?.bookId, browsePos?.chapter]);

  function submitPassage(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    let result = parseRefs(trimmed);
    // Bare book name with no chapter — retry with " 1" to default to chapter 1
    if (result.refs.length === 0 && result.errors[0]?.includes('without a chapter')) {
      result = parseRefs(trimmed + ' 1');
    }
    if (result.refs.length === 0) {
      setParseError(result.errors[0] ?? 'Could not parse reference');
      return;
    }
    setParseError('');
    const r = result.refs[0];
    onNavigate(r.bookId, r.chapter, r.verseStart ?? 1);
  }

  function selectBook(bookId: number) {
    setSelectedBookId(bookId);
    setParseError('');
    // Navigate directly to chapter 1 so the chapter view opens immediately.
    // The browsePos effect will sync passageInput + selectedBookId on the next render.
    onNavigate(bookId, 1, 1);
  }

  function selectChapter(chapter: number) {
    if (!selectedBookId) return;
    onNavigate(selectedBookId, chapter, 1);
  }

  const currentBook = browsePos ? BOOK_BY_ID.get(browsePos.bookId) : null;
  // Only show chapter view when the active browse position matches the selected book.
  // This prevents a stale chapter from a previous book showing while the new book loads.
  const showChapter = !!browsePos && !!currentBook && selectedBookId === browsePos.bookId;
  // Compact book picker as soon as any book is selected (not just when a chapter is loaded).
  const compact = showChapter || selectedBookId !== null;

  const accentOT = 'var(--amber)';
  const accentNT = 'var(--indigo)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--parchment)' }}>

      {/* ── Back to notes banner ── */}
      {returnUrl && onReturn && (
        <button
          onClick={onReturn}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: 'var(--indigo-bg)',
            border: 'none', borderBottom: '1px solid var(--border)',
            color: 'var(--indigo)', fontSize: 13, fontFamily: 'DM Sans',
            fontWeight: 600, cursor: 'pointer', flexShrink: 0, textAlign: 'left',
          }}
        >
          ← Back to notes
        </button>
      )}

      {/* ── Passage input bar ── */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--parchment)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={passageInput}
          onChange={(e) => { setPassageInput(e.target.value); setParseError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submitPassage(passageInput); }}
          placeholder="e.g. John 3:16 or Romans 8"
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 8,
            border: `1px solid ${parseError ? 'var(--amber)' : 'var(--border)'}`,
            background: '#fff', fontSize: 14, fontFamily: 'DM Sans',
            color: 'var(--ink)', outline: 'none',
          }}
          aria-label="Passage reference"
        />
        <button
          onClick={() => submitPassage(passageInput)}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: 'var(--navy)', color: '#fff',
            fontSize: 13, fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer',
          }}
        >Go</button>
        <button
          onClick={() => setBookmarksOpen((v) => !v)}
          title="Bookmarks"
          aria-label="Toggle bookmarks"
          style={{
            padding: '7px 10px', borderRadius: 8, border: 'none',
            background: bookmarksOpen ? 'var(--navy)' : 'var(--parchment-mid)',
            color: bookmarksOpen ? '#fff' : 'var(--ink-light)',
            fontSize: 14, cursor: 'pointer',
          }}
        >
          {bookmarks.length > 0 ? '★' : '☆'}
          {bookmarks.length > 0 && (
            <span style={{ fontSize: 10, marginLeft: 3 }}>{bookmarks.length}</span>
          )}
        </button>
      </div>

      {parseError && (
        <div style={{
          padding: '4px 12px', fontSize: 12, color: 'var(--amber)',
          fontFamily: 'DM Sans', background: 'var(--parchment)', flexShrink: 0,
        }}>
          {parseError}
        </div>
      )}

      {/* ── Bookmark panel ── */}
      {bookmarksOpen && (
        <div style={{
          background: '#fff', borderBottom: '1px solid var(--border)',
          padding: '8px 12px', flexShrink: 0, maxHeight: 180, overflowY: 'auto',
        }}>
          {bookmarks.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-light)', fontFamily: 'DM Sans', margin: 0 }}>
              No bookmarks yet. Use ☆ on any verse to save one.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {bookmarks.map((bm) => (
                <li key={bm.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <button
                    onClick={() => { onNavigate(bm.bookId, bm.chapter, bm.verse); setBookmarksOpen(false); }}
                    style={{
                      flex: 1, textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans',
                      color: 'var(--ink)', padding: '2px 0',
                    }}
                  >
                    {bm.label}
                  </button>
                  <button
                    onClick={() => onRemoveBookmark(bm.id)}
                    aria-label={`Remove bookmark ${bm.label}`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--ink-light)', fontSize: 14, padding: '2px 4px',
                    }}
                  >×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Scrollable content: book picker + chapter grid OR chapter reader ── */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* Book picker — always shown above chapter view; compact when any book is selected */}
        <div style={{
          padding: compact ? '6px 10px' : '10px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--parchment)',
        }}>
          {!compact && (
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              color: 'var(--ink-light)', textTransform: 'uppercase',
              fontFamily: 'DM Sans', margin: '0 0 6px',
            }}>Old Testament</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: compact ? 0 : 8 }}>
            {OT.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBook(b.id)}
                style={{
                  padding: compact ? '2px 6px' : '4px 8px',
                  borderRadius: 6, border: 'none',
                  background: selectedBookId === b.id ? accentOT : 'var(--amber-bg)',
                  color: selectedBookId === b.id ? '#fff' : 'var(--ink)',
                  fontSize: compact ? 10 : 12, fontFamily: 'DM Sans',
                  fontWeight: selectedBookId === b.id ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {compact ? b.abbr3 : b.name}
              </button>
            ))}
          </div>
          {!compact && (
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              color: 'var(--ink-light)', textTransform: 'uppercase',
              fontFamily: 'DM Sans', margin: '8px 0 6px',
            }}>New Testament</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {NT.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBook(b.id)}
                style={{
                  padding: compact ? '2px 6px' : '4px 8px',
                  borderRadius: 6, border: 'none',
                  background: selectedBookId === b.id ? accentNT : 'var(--indigo-bg)',
                  color: selectedBookId === b.id ? '#fff' : 'var(--ink)',
                  fontSize: compact ? 10 : 12, fontFamily: 'DM Sans',
                  fontWeight: selectedBookId === b.id ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {compact ? b.abbr3 : b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chapter grid — shown when book is selected but no chapter yet loaded */}
        {selectedBookId && !showChapter && (() => {
          const book = BOOK_BY_ID.get(selectedBookId)!;
          const accent = book.testament === 'OT' ? accentOT : accentNT;
          const accentBg = book.testament === 'OT' ? 'var(--amber-bg)' : 'var(--indigo-bg)';
          return (
            <div style={{ padding: '10px 12px' }}>
              <p style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                color: 'var(--ink-light)', textTransform: 'uppercase',
                fontFamily: 'DM Sans', margin: '0 0 8px',
              }}>
                {book.name} — {book.chapters} chapter{book.chapters !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => selectChapter(ch)}
                    style={{
                      width: 36, height: 36, borderRadius: 8, border: 'none',
                      background: accentBg, color: accent,
                      fontSize: 13, fontFamily: 'DM Sans', fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Chapter view — embedded inline when chapter is loaded */}
        {showChapter && currentBook && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ChapterView
              standalone
              abbr3={currentBook.abbr3}
              bookName={currentBook.name}
              chapter={browsePos!.chapter}
              highlightVerse={browsePos!.verse}
              testament={currentBook.testament}
              onClose={() => setSelectedBookId(null)}
              onSearch={() => {}}
              onBookmark={onBookmark}
              isBookmarked={isBookmarked}
              versesWithNotes={versesWithNotes}
              onNotesBadgeClick={() => onOpenClass()}
              onCrossRefClick={onNavigate}
              onAddCrossRef={(bookId, chapter, verse, raw) => {
                try {
                  getClassClient().crossRef.add({
                    sourceBookId: bookId, sourceChapter: chapter, sourceVerse: verse,
                    targetRawInput: raw, createdFrom: 'browse',
                  });
                } catch { /* class client not ready */ }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
