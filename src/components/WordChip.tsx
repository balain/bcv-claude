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
  const hasDef = !!word.root;

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
        maxWidth: 90,
        userSelect: 'none',
      }}
    >
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
      <span
        style={{
          fontSize: 9,
          color: 'var(--ink-light)',
          marginTop: 1,
          fontFamily: 'DM Sans',
          letterSpacing: '0.01em',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: 80,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {word.gloss}
      </span>
      {word.root && (
        <span
          style={{
            fontSize: 9,
            color: hlColor,
            marginTop: 1,
            fontFamily: 'DM Sans',
            fontWeight: 500,
          }}
        >
          {word.root}
        </span>
      )}
    </div>
  );
}
