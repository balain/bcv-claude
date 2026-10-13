import { useEffect, useRef } from 'react';
import type { BookMeta } from '../lib/books';

interface Props {
  book: BookMeta;
  chapter: number;
  onSelect: (chapter: number) => void;
}

export function ChapterNavigation({ book, chapter, onSelect }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = book.testament === 'OT' ? 'var(--amber)' : 'var(--indigo)';
  const accentBg = book.testament === 'OT' ? 'var(--amber-bg)' : 'var(--indigo-bg)';

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = String(chapter);
    const row = rowRef.current;
    const active = activeRef.current;
    if (!row || !active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth;
  }, [book.id, chapter]);

  return (
    <nav aria-label={`${book.name} chapters`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--parchment)' }}>
      <div ref={rowRef} className="no-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', minWidth: 0, flex: 1, position: 'relative' }}>
        {Array.from({ length: book.chapters }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            ref={number === chapter ? activeRef : undefined}
            aria-label={`${book.name} chapter ${number}`}
            aria-current={number === chapter ? 'page' : undefined}
            onClick={() => onSelect(number)}
            style={{ minWidth: 32, height: 32, padding: '0 6px', flex: '1 0 32px', boxSizing: 'border-box', borderRadius: 6, border: 'none', background: number === chapter ? accent : accentBg, color: number === chapter ? '#fff' : accent, fontSize: 'var(--fs-control)', fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer' }}
          >{number}</button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const number = inputRef.current?.valueAsNumber;
          if (number !== undefined && Number.isInteger(number) && number >= 1 && number <= book.chapters) onSelect(number);
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-mid)', fontSize: 'var(--fs-control)', fontFamily: 'DM Sans' }}>
          Chapter
          <input
            ref={inputRef}
            type="number"
            aria-label={`Go to chapter in ${book.name}`}
            defaultValue={chapter}
            min={1}
            max={book.chapters}
            step={1}
            required
            title={`Enter a chapter from 1 to ${book.chapters}`}
            style={{ width: 54, boxSizing: 'border-box', height: 32, border: '1px solid var(--border)', borderRadius: 6, padding: '0 5px', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--fs-control)' }}
          />
        </label>
        <button type="submit" style={{ height: 32, border: 'none', borderRadius: 6, padding: '0 8px', background: accentBg, color: accent, fontSize: 'var(--fs-control)', fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer' }}>Go</button>
      </form>
    </nav>
  );
}
