import { Fragment, useEffect, useState } from 'react';
import type { Source } from '../types';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  query: string;
  source: Source;
  onGo: (query: string, source: Source) => void;
}

const SOURCES: { id: Source; group: 'eng' | 'orig' }[] = [
  { id: 'KJV', group: 'eng' },
  { id: 'ASV', group: 'eng' },
  { id: 'LEB', group: 'eng' },
  { id: 'NASB', group: 'eng' },
  { id: 'Heb', group: 'orig' },
  { id: 'LXX', group: 'orig' },
  { id: 'GNT', group: 'orig' },
];

const isPhrase = (q: string) => q.length >= 2 && q.startsWith('"') && q.endsWith('"');

export function SearchBar({ collapsed, onToggle, query, source, onGo }: Props) {
  const [draft, setDraft] = useState(query);
  const [localSource, setLocalSource] = useState<Source>(source);

  useEffect(() => setDraft(query), [query]);
  useEffect(() => setLocalSource(source), [source]);

  const submit = () => onGo(draft, localSource);

  if (collapsed) {
    return (
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
          background: 'var(--parchment)',
        }}
      >
        <div
          onClick={onToggle}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            borderRadius: 10,
            padding: '7px 12px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-light)' }}>🔍</span>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--ink)', fontWeight: 500 }}>
            {query || '—'}
          </span>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-light)', marginLeft: 4 }}>
            · {source}
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--indigo)',
            fontSize: 'var(--fs-body)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'DM Sans',
            padding: '4px 0',
            whiteSpace: 'nowrap',
          }}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '7px 14px 8px',
        background: 'var(--parchment)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            borderRadius: 12,
            padding: '7px 11px',
            border: '1.5px solid var(--indigo)',
            boxShadow: 'var(--focus-ring)',
          }}
        >
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-light)' }}>🔍</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{
              flex: 1,
              fontSize: 'var(--fs-input)',
              color: 'var(--ink)',
              fontWeight: 500,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'DM Sans',
              minWidth: 0,
            }}
            placeholder="Search…"
          />
          {draft && (
            <span
              onClick={() => setDraft('')}
              style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-light)', cursor: 'pointer' }}
            >
              ✕
            </span>
          )}
        </div>
        <button
          onClick={submit}
          style={{
            background: 'var(--navy)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '7px 13px',
            fontSize: 'var(--fs-body)',
            fontWeight: 600,
            fontFamily: 'DM Sans',
            cursor: 'pointer',
          }}
        >
          Go
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {SOURCES.map(({ id, group }, i, arr) => {
          const isActive = localSource === id;
          const isOrig = group === 'orig';
          const prevGroup = i > 0 ? arr[i - 1].group : group;
          return (
            <Fragment key={id}>
              {group !== prevGroup && (
                <div
                  style={{
                    width: 1,
                    background: 'var(--border)',
                    alignSelf: 'stretch',
                    margin: '0 2px',
                  }}
                />
              )}
              <button
                onClick={() => {
                  setLocalSource(id);
                  onGo(draft, id);
                }}
                style={{
                  fontSize: 'var(--fs-control)',
                  fontWeight: 600,
                  fontFamily: 'DM Sans',
                  padding: '3px 9px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: isActive
                    ? isOrig
                      ? 'var(--amber)'
                      : 'var(--navy)'
                    : 'var(--border)',
                  background: isActive
                    ? isOrig
                      ? 'var(--amber-bg)'
                      : 'var(--navy)'
                    : 'var(--surface)',
                  color: isActive ? (isOrig ? 'var(--amber)' : '#fff') : 'var(--ink-light)',
                }}
              >
                {id}
              </button>
            </Fragment>
          );
        })}
      </div>

      {isPhrase(draft) && (
        <div style={{ marginTop: 4, marginBottom: 2 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 'var(--fs-control)',
              fontWeight: 600,
              fontFamily: 'DM Sans',
              color: 'var(--indigo)',
              background: 'var(--indigo-bg)',
              border: '1px solid var(--indigo)',
              borderRadius: 20,
              padding: '1px 8px',
              letterSpacing: '0.02em',
            }}
          >
            phrase
          </span>
        </div>
      )}

      <button
        onClick={onToggle}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--ink-light)',
          fontSize: 'var(--fs-meta)',
          cursor: 'pointer',
          fontFamily: 'DM Sans',
          marginTop: 6,
          padding: 0,
        }}
      >
        ▲ collapse
      </button>
    </div>
  );
}
