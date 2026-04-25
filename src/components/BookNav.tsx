import { Fragment } from 'react';
import type { Testament } from '../types';

export interface BookNavItem {
  name: string;
  t: Testament;
}

interface Props {
  books: BookNavItem[];
  active: string | null;
  onSelect: (name: string | null) => void;
}

export function BookNav({ books, active, onSelect }: Props) {
  if (books.length === 0) return null;

  return (
    <div
      className="no-scrollbar"
      style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        paddingBottom: 2,
        marginBottom: 7,
        alignItems: 'center',
      }}
    >
      <button
        onClick={() => onSelect(null)}
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'DM Sans',
          padding: '4px 9px',
          borderRadius: 20,
          cursor: 'pointer',
          border: '1.5px solid',
          borderColor: active === null ? 'var(--ink)' : 'var(--border)',
          background: active === null ? 'var(--ink)' : '#fff',
          color: active === null ? '#fff' : 'var(--ink-light)',
        }}
      >
        All
      </button>
      {books.map(({ name, t }, i) => {
        const isActive = active === name;
        const isNT = t === 'NT';
        const prevT = i > 0 ? books[i - 1].t : t;
        return (
          <Fragment key={name}>
            {t !== prevT && (
              <div
                style={{
                  width: 1,
                  height: 14,
                  background: 'var(--parchment-dark)',
                  flexShrink: 0,
                  margin: '0 2px',
                }}
              />
            )}
            <button
              onClick={() => onSelect(isActive ? null : name)}
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'DM Sans',
                padding: '4px 9px',
                borderRadius: 20,
                cursor: 'pointer',
                border: '1.5px solid',
                borderColor: isActive
                  ? isNT
                    ? 'var(--indigo)'
                    : 'var(--amber)'
                  : isNT
                    ? 'rgba(59,91,219,0.2)'
                    : 'rgba(194,133,10,0.2)',
                background: isActive
                  ? isNT
                    ? 'var(--indigo)'
                    : 'var(--amber)'
                  : isNT
                    ? 'var(--indigo-bg)'
                    : 'var(--amber-bg)',
                color: isActive ? '#fff' : isNT ? 'var(--indigo)' : 'var(--amber)',
              }}
            >
              {name}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
