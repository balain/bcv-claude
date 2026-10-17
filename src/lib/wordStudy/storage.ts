import type { StudyRequest, Visibility } from './types';
export interface SavedWordStudy {
    id: string;
    title: string;
    notes: string;
    request: StudyRequest;
    visibility: Visibility;
    view?: 'overview' | 'map';
    sessionId: number | null;
    updatedAt: string;
}
export function validateSavedStudy(value: unknown): asserts value is SavedWordStudy {
    const s = value as SavedWordStudy;
    if (!s || typeof s.id !== 'string' || s.id.length > 100 || typeof s.title !== 'string' || typeof s.notes !== 'string' ||
        !s.request || typeof s.request.query !== 'string' || !['NASB', 'KJV', 'ASV', 'LEB'].includes(s.request.translation) ||
        !['auto', 'Eng', 'Grk', 'Heb', 'Arc'].includes(s.request.language) ||
        (s.request.target !== undefined && (!s.request.target || typeof s.request.target.id !== 'string')) ||
        (s.view !== undefined && !['overview', 'map'].includes(s.view)) ||
        !s.request.filters || typeof s.request.filters.corpus !== 'string' || !Number.isSafeInteger(s.request.filters.book) ||
        typeof s.request.filters.form !== 'string' || !Number.isSafeInteger(s.request.page) || s.request.page < 0 ||
        !s.visibility || !['root', 'derivation', 'synonym', 'antonym', 'related'].every(k => typeof s.visibility[k as keyof Visibility] === 'boolean') ||
        (s.request.equivalentPage !== undefined && (!Number.isSafeInteger(s.request.equivalentPage) || s.request.equivalentPage < 0)) ||
        typeof s.updatedAt !== 'string' || !Number.isFinite(Date.parse(s.updatedAt)) ||
        (s.sessionId !== null && (!Number.isSafeInteger(s.sessionId) || s.sessionId < 1)))
        throw new Error('Invalid saved word study.');
}
