import type { ThemePref } from '../lib/theme';

interface Props {
  open: boolean;
  onClose: () => void;
  themePref: ThemePref;
  onThemeChange: (pref: ThemePref) => void;
}

const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'light',  label: 'Light',  icon: '☀' },
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
];

export function SettingsPanel({ open, onClose, themePref, onThemeChange }: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 300,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--backdrop)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Settings"
        style={{
          position: 'relative',
          width: '100%',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '0 0 40px',
          animation: 'sheetIn 0.28s cubic-bezier(0.34, 1.4, 0.64, 1)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '80%',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div
          style={{
            padding: '12px 20px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontFamily: 'Playfair Display',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Settings
          </span>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: 'none',
              background: 'var(--surface-muted)',
              color: 'var(--ink-light)',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Divider */}
        <div style={{ margin: '12px 20px 0', borderTop: '1px solid var(--border)' }} />

        {/* Theme section */}
        <div style={{ padding: '16px 20px 0' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-light)',
              marginBottom: 10,
              fontFamily: 'DM Sans',
            }}
          >
            Appearance
          </div>

          <div
            role="radiogroup"
            aria-label="Theme preference"
            style={{ display: 'flex', gap: 8 }}
          >
            {THEME_OPTIONS.map(({ value, label, icon }) => {
              const isActive = themePref === value;
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onThemeChange(value)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 8px',
                    borderRadius: 10,
                    border: isActive
                      ? '2px solid var(--indigo)'
                      : '2px solid var(--border)',
                    background: isActive ? 'var(--indigo-bg)' : 'var(--surface-muted)',
                    color: isActive ? 'var(--indigo)' : 'var(--ink-mid)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'DM Sans',
                    transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
