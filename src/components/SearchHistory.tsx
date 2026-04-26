import type { Source } from '../types';

export interface HistoryEntry {
  query: string;
  source: Source;
}

interface Props {
  history: HistoryEntry[];
  open: boolean;
  onToggle: () => void;
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}

const ORIG_SOURCES = new Set(['Heb', 'LXX', 'GNT']);

export function SearchHistory({ history, open, onToggle, onSelect, onClear }: Props) {
  if (history.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#fff',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* ── Header row — always visible ── */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          cursor: 'pointer',
          userSelect: 'none',
          background: open ? 'var(--parchment-mid)' : '#fff',
        }}
      >
        {/* Clock icon */}
        <span style={{ fontSize: 12, lineHeight: 1, color: 'var(--ink-light)', flexShrink: 0 }}>🕐</span>

        <span
          style={{
            fontFamily: 'DM Sans',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink-mid)',
            flex: 1,
          }}
        >
          Recent searches
        </span>

        {/* Count badge */}
        <span
          style={{
            fontFamily: 'DM Sans',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--ink-light)',
            background: 'var(--parchment-mid)',
            borderRadius: 10,
            padding: '1px 7px',
          }}
        >
          {history.length}
        </span>

        {/* Clear button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          aria-label="Clear search history"
          title="Clear history"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-light)',
            fontSize: 11,
            padding: '2px 5px',
            borderRadius: 4,
            lineHeight: 1,
            fontFamily: 'DM Sans',
          }}
        >
          ✕
        </button>

        {/* Chevron */}
        <span style={{ fontSize: 10, color: 'var(--ink-light)', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* ── Expanded list ── */}
      {open && (
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {history.map((entry, i) => {
            const isOrig = ORIG_SOURCES.has(entry.source);
            const badgeColor = isOrig ? 'var(--amber)' : 'var(--navy)';
            return (
              <div
                key={i}
                onClick={() => onSelect(entry)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderTop: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                // Inline hover via mouse events (no CSS modules needed)
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--parchment)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
              >
                <span
                  style={{
                    flex: 1,
                    fontFamily: entry.query.startsWith('"') ? 'DM Serif Display' : 'DM Serif Display',
                    fontSize: 13,
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.query}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#fff',
                    background: badgeColor,
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontFamily: 'DM Sans',
                  }}
                >
                  {entry.source}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
