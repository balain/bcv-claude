import { useEffect, useState } from 'react';

export type FontSizePref = 'small' | 'medium' | 'large' | 'extra-large';

const LS_KEY = 'bcv-font-size';

export function readFontSizePref(): FontSizePref {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'small' || v === 'medium' || v === 'large' || v === 'extra-large') return v;
  } catch {
    /* quota / private browsing */
  }
  return 'medium';
}

export function saveFontSizePref(pref: FontSizePref): void {
  try {
    localStorage.setItem(LS_KEY, pref);
  } catch {
    /* quota */
  }
}

export function applyFontSize(pref: FontSizePref): void {
  document.documentElement.setAttribute('data-font-size', pref);
}

export function useFontSize(): [FontSizePref, (pref: FontSizePref) => void] {
  const [fontSizePref, setFontSizePrefState] = useState<FontSizePref>(() => readFontSizePref());

  useEffect(() => {
    applyFontSize(fontSizePref);
  }, [fontSizePref]);

  const setFontSizePref = (pref: FontSizePref) => {
    saveFontSizePref(pref);
    setFontSizePrefState(pref);
  };

  return [fontSizePref, setFontSizePref];
}
