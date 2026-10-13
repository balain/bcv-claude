import type { Testament } from '../types';

interface Props {
  active: Testament | null;
  onSelect: (testament: Testament | null) => void;
}

export function TestamentFilter({ active, onSelect }: Props) {
  return (
    <div role="group" aria-label="Filter by Testament" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      {([null, 'OT', 'NT'] as const).map((testament) => {
        const selected = active === testament;
        return (
          <button
            key={testament ?? 'all'}
            aria-pressed={selected}
            onClick={() => onSelect(testament)}
            style={{
              fontSize: 'var(--fs-control)',
              fontWeight: 600,
              fontFamily: 'DM Sans',
              padding: '5px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              border: '1.5px solid',
              borderColor: selected ? 'var(--ink)' : 'var(--border)',
              background: selected ? 'var(--ink)' : 'var(--surface)',
              color: selected ? 'var(--surface)' : 'var(--ink-mid)',
            }}
          >
            {testament ?? 'All'}
          </button>
        );
      })}
    </div>
  );
}
