// ─── Theme preference model ───────────────────────────────────────────────────
// Preference: 'system' | 'light' | 'dark'
// Stored in localStorage under 'bcv-theme'.
// Resolved theme is applied as data-theme="light" | data-theme="dark" on <html>.
// When preference is 'system', we use matchMedia to follow the OS — NOT a CSS
// media query (per spec: all theming is driven by [data-theme] on the root).

export type ThemePref = 'system' | 'light' | 'dark';

const LS_KEY = 'bcv-theme';

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* quota / private browsing */
  }
  return 'system';
}

export function saveThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(LS_KEY, pref);
  } catch {
    /* quota */
  }
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return prefersDark() ? 'dark' : 'light';
}

export function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
}

let _mqlListener: (() => void) | null = null;
let _onChangeCallback: ((theme: 'light' | 'dark') => void) | null = null;

/**
 * Initialize theming at app startup. Reads stored preference, applies the
 * resolved theme, and sets up an OS-change listener when pref === 'system'.
 *
 * Returns a cleanup function to remove any OS-change listener.
 */
export function initTheme(
  pref: ThemePref,
  onChange: (theme: 'light' | 'dark') => void,
): () => void {
  _onChangeCallback = onChange;

  const resolved = resolveTheme(pref);
  applyTheme(resolved);
  onChange(resolved);

  // Remove any previous OS listener
  if (_mqlListener) {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .removeEventListener('change', _mqlListener);
    _mqlListener = null;
  }

  if (pref === 'system') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    _mqlListener = () => {
      const next = mql.matches ? 'dark' : 'light';
      applyTheme(next);
      _onChangeCallback?.(next);
    };
    mql.addEventListener('change', _mqlListener);
  }

  return () => {
    if (_mqlListener) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', _mqlListener);
      _mqlListener = null;
    }
    _onChangeCallback = null;
  };
}
