import { RelationshipControls } from './wordStudy/RelationshipControls';
import { readVisibility, saveVisibility } from '../lib/wordStudy/settings';
import { useState } from 'react';
import { SourceCredits } from './SourceCredits';
import type { ThemePref } from '../lib/theme';
import type { FontSizePref } from '../lib/useFontSize';
import type { SearchSettings } from '../lib/searchSettings';

interface Props {
  open: boolean;
  onClose: () => void;
  themePref: ThemePref;
  onThemeChange: (pref: ThemePref) => void;
  fontSizePref: FontSizePref;
  onFontSizeChange: (pref: FontSizePref) => void;
  searchSettings: SearchSettings;
  onSearchSettingsChange: (settings: SearchSettings) => void;
}

const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'light',  label: 'Light',  icon: '☀' },
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
];

const FONT_SIZE_OPTIONS: { value: FontSizePref; label: string; icon: string }[] = [
  { value: 'small',       label: 'Small',   icon: 'A' },
  { value: 'medium',      label: 'Default', icon: 'A' },
  { value: 'large',       label: 'Large',   icon: 'A' },
  { value: 'extra-large', label: 'X-Large', icon: 'A' },
];

export function SettingsPanel({ open, onClose, themePref, onThemeChange, fontSizePref, onFontSizeChange, searchSettings, onSearchSettingsChange }: Props) {
  const [studyVisibility, setStudyVisibility] = useState(readVisibility);
  const [studySettingError, setStudySettingError] = useState('');
  const [showCredits, setShowCredits] = useState(false);
  const close = () => { setShowCredits(false); onClose(); };
  if (!open) return null;
  if (showCredits) return <SourceCredits onBack={() => setShowCredits(false)} onClose={close} />;

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
        onClick={close}
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
          height: '100%',
          padding: '0 0 40px',
          animation: 'sheetIn 0.28s cubic-bezier(0.34, 1.4, 0.64, 1)',
          boxShadow: 'var(--shadow-lg)',
          boxSizing: 'border-box',
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
              fontSize: 'var(--fs-gloss-lemma)',
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Settings
          </span>
          <button
            onClick={close}
            aria-label="Close settings"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: 'none',
              background: 'var(--surface-muted)',
              color: 'var(--ink-light)',
              fontSize: 'var(--fs-body)',
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

        <section style={{ padding:'20px' }}><h2>Word Study defaults</h2><p>Show these details in future studies on this device.</p><RelationshipControls value={studyVisibility} onChange={value => { setStudyVisibility(value); try { saveVisibility(value); setStudySettingError(''); } catch { setStudySettingError('Browser storage is unavailable; defaults were not saved.'); } }} />{studySettingError&&<p role="alert">{studySettingError}</p>}</section>
        {/* Theme section */}
        <section style={{ padding: '16px 20px', color: 'var(--ink)', fontFamily: 'DM Sans', fontSize: 'var(--fs-body)' }}>
          <h2 style={{ fontSize: 'var(--fs-control)', margin: '0 0 16px' }}>Search</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={searchSettings.combineGreek}
              onChange={(e) => onSearchSettingsChange({ ...searchSettings, combineGreek: e.target.checked })}
            />
            Search LXX and GNT together
          </label>
          <p style={{ color: 'var(--ink-mid)', fontSize: 'var(--fs-meta)' }}>
            Selecting either Greek source searches both Testaments, including searches from word definitions.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <input
              type="checkbox"
              checked={searchSettings.maxHits === null}
              onChange={(e) => onSearchSettingsChange({ ...searchSettings, maxHits: e.target.checked ? null : 200 })}
            />
            Unlimited hits
          </label>
          {searchSettings.maxHits !== null && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              Maximum hits
              <input
                type="number"
                min={1}
                step={1}
                required
                defaultValue={searchSettings.maxHits}
                onBlur={(e) => {
                  const maxHits = e.target.valueAsNumber;
                  if (Number.isSafeInteger(maxHits) && maxHits > 0) {
                    onSearchSettingsChange({ ...searchSettings, maxHits });
                  } else {
                    e.target.value = String(searchSettings.maxHits);
                  }
                }}
                style={{ width: 110, padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-muted)', color: 'var(--ink)', fontSize: 'inherit' }}
              />
            </label>
          )}
          <p style={{ color: 'var(--ink-mid)', fontSize: 'var(--fs-meta)' }}>
            Limits apply to all searches. Unlimited searches may take longer to display.
          </p>
        </section>

        <section style={{ padding:'20px' }}><h2>Word Study defaults</h2><p>Show these details in future studies on this device.</p><RelationshipControls value={studyVisibility} onChange={value => { setStudyVisibility(value); try { saveVisibility(value); setStudySettingError(''); } catch { setStudySettingError('Browser storage is unavailable; defaults were not saved.'); } }} />{studySettingError&&<p role="alert">{studySettingError}</p>}</section>
        {/* Theme section */}
        <div style={{ padding: '16px 20px 0' }}>
          <div
            style={{
              fontSize: 'var(--fs-control)',
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
                    fontSize: 'var(--fs-control)',
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'DM Sans',
                    transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-gloss-lemma)', lineHeight: 1 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ margin: '12px 20px 0', borderTop: '1px solid var(--border)' }} />

        {/* Font size section */}
        <div style={{ padding: '16px 20px 0' }}>
          <div
            style={{
              fontSize: 'var(--fs-control)',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-light)',
              marginBottom: 10,
              fontFamily: 'DM Sans',
            }}
          >
            Font Size
          </div>

          <div
            role="radiogroup"
            aria-label="Font size preference"
            style={{ display: 'flex', gap: 8 }}
          >
            {FONT_SIZE_OPTIONS.map(({ value, label, icon }, idx) => {
              const isActive = fontSizePref === value;
              const iconSizes = [13, 15, 18, 21];
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onFontSizeChange(value)}
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
                    fontSize: 'var(--fs-control)',
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'DM Sans',
                    transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                  }}
                >
                  <span style={{ fontSize: iconSizes[idx], lineHeight: 1, fontFamily: 'serif' }}>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <section style={{ padding: '24px 20px 0', fontFamily: 'DM Sans' }}>
          <button onClick={() => setShowCredits(true)} style={{ color: 'var(--indigo)', background: 'var(--surface-muted)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 'var(--fs-body)', width: '100%', textAlign: 'left' }}>
            Source material credits →
          </button>
        </section>
      </div>
    </div>
  );
}
