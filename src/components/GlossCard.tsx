import type { Lang } from '../types';
import type { LexEntry } from '../lib/db';

interface Props {
  entry: LexEntry;
  lang: Lang;
  open: boolean;
  onToggle: () => void;
}

export function GlossCard({ entry, lang, open, onToggle }: Props) {
  const isHeb = lang === 'Heb';
  const accent   = isHeb ? 'var(--amber)'    : 'var(--indigo)';
  const accentBg = isHeb ? 'var(--amber-bg)' : 'var(--indigo-bg)';

  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 10,
        overflow: 'hidden',
        border: `1.5px solid ${accent}30`,
        background: accentBg,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* header row — always visible, click to toggle */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: 3,
            height: 22,
            borderRadius: 2,
            background: accent,
            flexShrink: 0,
          }}
        />

        {/* lemma */}
        <span
          style={{
            fontFamily: 'serif',
            fontSize: 18,
            color: accent,
            fontWeight: 600,
            direction: isHeb ? 'rtl' : 'ltr',
            lineHeight: 1,
          }}
        >
          {entry.lemma ?? entry.estrong}
        </span>

        {/* transliteration */}
        {entry.translit && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--ink-mid)',
              fontStyle: 'italic',
              fontFamily: 'DM Sans',
            }}
          >
            {entry.translit}
          </span>
        )}

        {/* gloss pill */}
        {entry.gloss && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: accent,
              background: `${accent}18`,
              borderRadius: 20,
              padding: '2px 9px',
              fontFamily: 'DM Sans',
            }}
          >
            {entry.gloss}
          </span>
        )}

        {/* spacer + chevron */}
        <span style={{ flex: 1 }} />
        <button
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: 'none',
            background: `${accent}18`,
            cursor: 'pointer',
            fontSize: 10,
            color: accent,
            flexShrink: 0,
          }}
          aria-label={open ? 'Collapse gloss' : 'Expand gloss'}
        >
          {open ? '▲' : '▼'}
        </button>
      </div>

      {/* expanded body — full meaning */}
      {open && entry.meaning && (
        <div
          style={{
            padding: '0 14px 10px 23px',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--ink)',
            fontFamily: 'DM Sans',
            borderTop: `1px solid ${accent}20`,
            paddingTop: 8,
          }}
        >
          {entry.meaning}
        </div>
      )}
    </div>
  );
}
