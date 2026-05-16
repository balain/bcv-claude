import type React from 'react';
import type { Lang, WordToken } from '../types';

interface Props {
  word: WordToken;
  lang: Lang;
  onTap: (word: WordToken) => void;
}

export function WordChip({ word, lang, onTap }: Props) {
  const isHeb = lang === 'Heb';
  const hlColor = isHeb ? 'var(--amber)' : 'var(--indigo)';
  const hlBg = isHeb ? 'var(--amber-bg)' : 'var(--indigo-bg)';
  // Chip is clickable whenever we have enough data for a useful popup
  const hasDef = !!(word.lemma ?? word.root ?? word.strong);

  const subStyle: React.CSSProperties = {
    fontFamily: 'DM Sans',
    textAlign: 'center',
    lineHeight: 1.25,
    maxWidth: 90,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  };

  return (
    <div
      onClick={hasDef ? (e) => { e.stopPropagation(); onTap(word); } : undefined}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3px 5px',
        margin: '2px',
        borderRadius: 8,
        background: word.highlight ? hlBg : 'transparent',
        border: word.highlight ? `1.5px solid ${hlColor}30` : '1.5px solid transparent',
        cursor: hasDef ? 'pointer' : 'default',
        transition: 'background 0.15s',
        minWidth: 44,
        maxWidth: 96,
        userSelect: 'none',
      }}
    >
      {/* ① Original-language surface form */}
      <span
        style={{
          fontFamily: 'serif',
          fontSize: isHeb ? 16 : 14,
          lineHeight: 1.2,
          color: word.highlight ? hlColor : 'var(--ink)',
          fontWeight: word.highlight ? 600 : 400,
          direction: isHeb ? 'rtl' : 'ltr',
        }}
      >
        {word.surface}
      </span>

      {/* ② Transliteration — helps with pronunciation, kept very small */}
      {word.translit && (
        <span
          style={{
            ...subStyle,
            fontSize: 9,
            color: 'var(--ink-light)',
            fontStyle: 'italic',
            marginTop: 1,
          }}
        >
          {word.translit}
        </span>
      )}

      {/* ③ English gloss — the main new row; slightly larger and darker so it's actually readable */}
      {word.gloss && (
        <span
          style={{
            ...subStyle,
            fontSize: 10,
            color: word.highlight ? hlColor : 'var(--ink-mid)',
            fontWeight: word.highlight ? 600 : 400,
            marginTop: 1,
          }}
        >
          {word.gloss}
        </span>
      )}
    </div>
  );
}
