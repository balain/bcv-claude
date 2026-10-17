import type { EnglishTranslation, Visibility } from './types';
export const RELATION_LABELS = { root: 'Roots', derivation: 'Derivations', synonym: 'Synonyms', antonym: 'Antonyms', related: 'Related entries' } as const;
export const ENGLISH: EnglishTranslation[] = ['NASB', 'KJV', 'ASV', 'LEB'];
export const DEFAULT_VISIBILITY: Visibility = { root: true, derivation: true, synonym: true, antonym: true, related: true };
export function readVisibility(): Visibility {
    try {
        const v = JSON.parse(localStorage.getItem('bcv-study-visibility') ?? '{}');
        return Object.fromEntries(Object.entries(DEFAULT_VISIBILITY).map(([k, d]) => [k, typeof v[k] === 'boolean' ? v[k] : d])) as Visibility;
    }
    catch {
        return { ...DEFAULT_VISIBILITY };
    }
}
export function saveVisibility(value: Visibility) { localStorage.setItem('bcv-study-visibility', JSON.stringify(value)); }
export function readEnglish(): EnglishTranslation {
    try {
        const t = localStorage.getItem('bcv-last-english');
        return ENGLISH.find(x => x === t) ?? 'NASB';
    }
    catch {
        return 'NASB';
    }
}
export function rememberEnglish(value: string) {
    if (ENGLISH.includes(value as EnglishTranslation)) {
        try {
            localStorage.setItem('bcv-last-english', value);
        }
        catch { /* Session still works without storage. */ }
    }
}
export function openWordStudy(query: string, corpus = '', form = '') {
    const p = new URLSearchParams({ q: query });
    if (corpus)
        p.set('corpus', corpus);
    if (form)
        p.set('originForm', form);
    location.hash = `/study?${p}`;
}
