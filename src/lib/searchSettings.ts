export interface SearchSettings {
  combineGreek: boolean;
  maxHits: number | null;
}

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = { combineGreek: true, maxHits: 200 };

export function readSearchSettings(): SearchSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('bcv-search-settings') ?? '{}');
    return {
      combineGreek: typeof saved.combineGreek === 'boolean' ? saved.combineGreek : true,
      maxHits: saved.maxHits === null ? null :
        Number.isSafeInteger(saved.maxHits) && saved.maxHits > 0 ? saved.maxHits : 200,
    };
  } catch {
    return { ...DEFAULT_SEARCH_SETTINGS };
  }
}
