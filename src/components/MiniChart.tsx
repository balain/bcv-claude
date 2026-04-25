import { OT_COUNT } from '../lib/search';

interface Props {
  visible: boolean;
  bars: number[];
  totalHits: number;
}

export function MiniChart({ visible, bars, totalHits }: Props) {
  if (!visible) return null;
  const max = Math.max(...bars, 1);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: '6px 10px',
        marginBottom: 8,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: 'var(--ink-light)',
          marginBottom: 4,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        Distribution · {totalHits} hits
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 36, gap: '1px' }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max((h / max) * 100, h > 0 ? 10 : 2)}%`,
              background:
                h > 0
                  ? i >= OT_COUNT
                    ? 'var(--indigo)'
                    : 'var(--amber)'
                  : 'var(--parchment-dark)',
              borderRadius: 2,
              minHeight: 2,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9, color: 'var(--ink-light)' }}>OT</span>
        <span style={{ fontSize: 9, color: 'var(--ink-light)' }}>NT</span>
      </div>
    </div>
  );
}
