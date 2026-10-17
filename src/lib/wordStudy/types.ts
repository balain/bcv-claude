import type { LexEntry, StudyEntry } from '../db';
export type EnglishTranslation = 'NASB' | 'KJV' | 'ASV' | 'LEB';
export type RelationKind = 'root' | 'derivation' | 'synonym' | 'antonym' | 'related';
export type Visibility = Record<RelationKind, boolean>;
export interface StudyTarget {
    id: string;
    lemma: string;
    strong: string;
    displayStrong?: string;
    lang: 'Heb' | 'Grk' | 'Eng';
    gloss: string;
    translit: string;
    language: string;
    reason: string;
}
export interface StudyFilters {
    corpus: string;
    book: number;
    form: string;
}
export interface StudyRequest {
    query: string;
    translation: EnglishTranslation;
    language: string;
    target?: StudyTarget;
    filters: StudyFilters;
    page: number;
    equivalentPage?: number;
}
export interface Frequency {
    corpus: string;
    count: number;
    verses: number;
    denominator: number;
}
export interface StudyRelation {
    lang?: 'Heb' | 'Grk';
    origin?: StudyTarget;
    kind: RelationKind;
    lemma: string;
    source: string;
    context: string;
}
export interface StudyPassage {
    bookId: number;
    book: string;
    abbr: string;
    chapter: number;
    verse: number;
    text: string;
    words: string;
    corpus: string;
}
export interface WordStudyData {
    candidates: StudyTarget[];
    correspondences: StudyTarget[];
    equivalents: EquivalentReport;
    target: StudyTarget | null;
    entries: LexEntry[];
    studies: StudyEntry[];
    frequencies: Frequency[];
    books: {
        id: number;
        name: string;
        count: number;
    }[];
    forms: {
        surface: string;
        morph: string;
        count: number;
    }[];
    passages: StudyPassage[];
    totalVerses: number;
    relations: StudyRelation[];
    sources: {
        id: string;
        attribution: string;
        revision: string;
        license: string;
        url: string;
    }[];
    warnings: string[];
    relationsAvailable: boolean;
}

export interface EquivalentReport {
    available: boolean;
    applicable: boolean;
    revision: string;
    sourceRecords: number;
    hebrewValidated: number;
    greekProvided: number;
    greekChecked: number;
    globalExcluded: number;
    groups: { strong: string; surface: string; records: number; checked: number }[];
    evidence: { morphId: string; bookId: number; book: string; abbr: string; chapter: number; verse: number; hebrew: string; hebrewStrong: string; greek: string; greekStrong: string; hebrewStatus: string; greekStatus: string }[];
}
