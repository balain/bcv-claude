import type { StudyRequest, StudyTarget, WordStudyData, StudyRelation } from './types.ts';
// Small database facade keeps the query engine usable in both the WASM worker and SQLite tests.
export type SqlValue = string | number | null;
export interface StudyDB {
    rows(sql: string, bind?: SqlValue[]): SqlValue[][];
}
export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export function strongKey(s: string) {
    const m = /^([HGA])0*(\d+)([a-z]*)$/i.exec(s.trim());
    return m ? `${m[1].toUpperCase() === 'G' ? 'G' : 'H'}${m[2].padStart(4, '0')}${m[3].toLowerCase()}` : '';
}
// Apostrophes stay inside words, typographic apostrophes normalize; hyphens delimit words.
export const englishWords = (s: string): string[] => s.toLowerCase().replace(/’/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];
const str = (v: SqlValue) => v == null ? '' : String(v);
const num = (v: SqlValue) => Number(v);
const PAGE = 40;
export function createWordStudyEngine(db: StudyDB) {
    const has = (name: string) => db.rows("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [name]).length > 0;
    let lexicon: StudyTarget[] | undefined;
    let tokenLemmas: {
        lemma: string;
        corpus: string;
    }[] | undefined;
    function lexemes() {
        if (lexicon)
            return lexicon;
        lexicon = db.rows('SELECT estrong,dstrong,lang,lemma,gloss,translit,morph FROM lex_brief ORDER BY lang,lemma,estrong').map(r => ({
            id: `${r[2]}:${r[0]}:${r[1]}:${r[3]}`, lemma: str(r[3]), strong: str(r[0] || r[1]), displayStrong: str(r[1]), lang: r[2] as 'Heb' | 'Grk',
            gloss: str(r[4]), translit: str(r[5]), language: r[2] === 'Grk' ? 'Greek' : /aramaic|chaldee/i.test(str(r[6])) ? 'Aramaic' : 'Hebrew / Aramaic (unspecified)', reason: '',
        }));
        if (has('word_languages')) {
            const languages = new Map<string, Set<string>>();
            for (const [strong, language] of db.rows('SELECT DISTINCT strong,language FROM word_languages')) {
                const key = str(strong);
                const set = languages.get(key) ?? new Set<string>();
                set.add(str(language));
                languages.set(key, set);
            }
            lexicon = lexicon.map(e => ({ ...e, language: languages.has(strongKey(e.strong)) ? [...languages.get(strongKey(e.strong))!].join(' / ') : e.language }));
        }
        return lexicon;
    }
    function resolve(request: StudyRequest): StudyTarget[] {
        const q = request.query.trim(), key = normalize(q), strong = strongKey(q);
        if (!key)
            return [];
        const allowed = (e: StudyTarget) => request.language === 'auto' || request.language === e.lang || (request.language === 'Arc' && e.language.includes('Aramaic') && !e.language.includes('unspecified'));
        let hits = lexemes().filter(allowed).map(e => {
            const rank = strong && (strongKey(e.strong) === strong || strongKey(e.displayStrong ?? '') === strong) ? 0 : e.lemma === q ? 1 : normalize(e.lemma) === key ? 2 : normalize(e.translit) === key ? 3 : 99;
            return { e, rank };
        }).filter(x => x.rank < 99);
        if (!hits.length && !strong) {
            // FTS provides candidate forms; normalized lemma spellings retain separate lexical candidates.
            const fts = `"${q.replace(/"/g, '""')}"`;
            const lemmas = new Set(db.rows('SELECT DISTINCT t.lemma FROM tokens t JOIN tokens_fts f ON f.rowid=t.id WHERE tokens_fts MATCH ? AND t.lemma IS NOT NULL', [fts]).map(r => normalize(str(r[0]))));
            hits = lexemes().filter(e => allowed(e) && lemmas.has(normalize(e.lemma))).map(e => ({ e, rank: 4 }));
            if (!hits.length && /[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]/.test(q)) {
                // FTS normalization differs between scripts: exact normalized surface fallback preserves all candidates.
                const rows = db.rows('SELECT DISTINCT surface,lemma FROM tokens WHERE corpus ' + (/[\u0590-\u05ff]/.test(q) ? "= 'WLC'" : "IN ('LXX','GNT')"));
                const keys = new Set(rows.filter(r => normalize(str(r[0])) === key).map(r => normalize(str(r[1]))));
                hits = lexemes().filter(e => allowed(e) && keys.has(normalize(e.lemma))).map(e => ({ e, rank: 4 }));
            }
        }
        let tokenCandidates: StudyTarget[] = [];
        if (!hits.length && !strong && request.language !== 'Eng' && /[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]/.test(q)) {
            const rows = db.rows('SELECT DISTINCT t.lemma,t.corpus,t.strong FROM tokens t JOIN tokens_fts f ON f.rowid=t.id WHERE tokens_fts MATCH ? AND t.lemma IS NOT NULL', [`"${q.replace(/"/g, '""')}"`]);
            tokenCandidates = rows.map(row => ({ id:`token:${row[1]}:${row[2]}:${row[0]}`, lemma:str(row[0]), strong:str(row[2]), lang:row[1]==='WLC'?'Heb' as const:'Grk' as const, language:row[1]==='WLC'?'Hebrew / Aramaic (unspecified)':'Greek', gloss:'No brief lexical entry installed', translit:'', reason:'Corpus annotation; lexical entry unavailable' })).filter(allowed);
        }
        const isEnglish = request.language === 'Eng' || (!strong && !/[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]/.test(q) && (request.language === 'auto'));
        const out = hits.sort((a, b) => a.rank - b.rank).map(({ e, rank }) => ({ ...e, reason: ['Strong’s identifier', 'Exact lemma', 'Normalized lemma', 'Transliteration', 'Surface form'][rank] }));
        if (isEnglish) {
            out.unshift({ id: `Eng:${key}`, lemma: q, strong: '', lang: 'Eng', language: 'English', translit: '', gloss: `Word usage in ${request.translation}`, reason: 'English word' });
        }
        return [...out, ...tokenCandidates];
    }
    function relationships(target: StudyTarget): StudyRelation[] {
        if (!has('word_relations') || target.lang === 'Eng') return [];
        return db.rows('SELECT kind,target_lemma,source,context FROM word_relations WHERE lemma_key=? AND lang=? ORDER BY kind,target_lemma', [normalize(target.lemma), target.lang])
            .map(x => ({ kind: str(x[0]) as StudyRelation['kind'], lemma: str(x[1]), source: str(x[2]), context: str(x[3]), lang: target.lang as 'Heb' | 'Grk' }));
    }
    function run(r: StudyRequest): WordStudyData {
        const candidates = resolve(r);
        // Never accept arbitrary identities from URLs/RPC without resolving them against the installed data.
        const target = r.target ? (lexemes().find(e => e.id === r.target?.id) ?? candidates.find(e => e.id === r.target?.id) ?? null) : candidates.length === 1 ? candidates[0] : candidates.find(e => e.lang === 'Eng') ?? null;
        const result: WordStudyData = { candidates, correspondences: [], target, entries: [], studies: [], frequencies: [], books: [], forms: [], passages: [], totalVerses: 0, relations: [], sources: [], warnings: [], relationsAvailable: has('word_relations') };
        if (!target) {
            if (r.target)
                result.warnings.push('The saved lexical identity is unavailable in this dataset. Choose a current candidate.');
            return result;
        }
        if (has('study_sources'))
            result.sources = db.rows('SELECT id,attribution,revision,license,url FROM study_sources').map(x => ({ id: str(x[0]), attribution: str(x[1]), revision: str(x[2]), license: str(x[3]), url: str(x[4]) }));
        result.warnings.push('No translation-specific word alignments are installed. Glosses and lexical matches are discovery aids, not verified translation equivalents.');
        if (target.lang === 'Eng')
            return english(r, result);
        const lang = target.lang;
        const glossWords = new Set(englishWords(target.gloss).filter(word => word.length > 2 && !['the', 'and', 'with', 'from', 'for', 'that', 'one'].includes(word)));
        result.correspondences = lexemes().filter(e => e.lang !== lang && englishWords(e.gloss).some(word => glossWords.has(word))).map(e => ({ ...e, reason: 'Shared English gloss; not a verified translation or synonym' }));
        if (lang === 'Grk')
            result.warnings.push('English text is displayed at the stored verse reference. LXX and English/MT verse numbering may differ; this is not a verified passage alignment.');
        result.entries = db.rows('SELECT estrong,dstrong,ustrong,lang,lemma,translit,morph,gloss,meaning_plain FROM lex_brief WHERE estrong=? OR (lemma=? AND lang=?)', [target.strong, target.lemma, lang]).map(x => ({ estrong: str(x[0]), dstrong: str(x[1]), ustrong: x[2] as string | null, lang: str(x[3]), lemma: str(x[4]), translit: str(x[5]), morph: str(x[6]), gloss: str(x[7]), meaning: x[3] === 'Heb' && !has('study_entries') ? '' : str(x[8]) }));
        if (has('study_entries')) {
            result.studies = db.rows(`SELECT DISTINCT e.id,e.source,e.lemma,e.senses FROM study_entries e LEFT JOIN study_strongs s ON s.entry_id=e.id WHERE e.lang=? AND (s.strong=? OR e.lemma_key=?)`, [lang, target.strong, normalize(target.lemma)]).map(x => ({ id: str(x[0]), source: str(x[1]) as 'bdb', lemma: str(x[2]), senses: JSON.parse(str(x[3])) }));
        }
        else
            result.warnings.push('Extended study lexicons are not installed in this database.');
        if (has('word_languages')) {
            const languages = db.rows('SELECT DISTINCT language FROM word_languages WHERE strong=?', [strongKey(target.strong)]).map(x => str(x[0]));
            if (languages.length)
                target.language = languages.join(' / ');
        }
        if (lang === 'Heb' && target.language.includes('unspecified'))
            result.warnings.push('Hebrew/Aramaic language classification is unavailable for this entry. Strong’s H numbering alone does not identify the language.');
        // Match normalized spelling aliases; ambiguous lexical keys require explicit token identifiers below.
        const sameKey = lexemes().filter(e => e.lang === lang && normalize(e.lemma) === normalize(target.lemma));
        tokenLemmas ??= db.rows('SELECT DISTINCT lemma,corpus FROM tokens WHERE lemma IS NOT NULL').map(x => ({ lemma: str(x[0]), corpus: str(x[1]) }));
        const aliases = [...new Set([target.lemma, ...tokenLemmas.filter(x => normalize(x.lemma) === normalize(target.lemma) && (lang === 'Heb' ? x.corpus === 'WLC' : x.corpus !== 'WLC')).map(x => x.lemma)])];
        const allowedCorpus = lang === 'Heb' ? ['WLC'] : ['LXX', 'GNT'];
        const selectedCorpus = allowedCorpus.includes(r.filters.corpus) ? [r.filters.corpus] : allowedCorpus;
        const bind: SqlValue[] = [...selectedCorpus, ...aliases];
        let where = `t.corpus IN (${selectedCorpus.map(() => '?').join(',')}) AND t.lemma IN (${aliases.map(() => '?').join(',')})`;
        if (new Set(sameKey.map(e => strongKey(e.strong))).size > 1 || (target.id.startsWith('token:') && target.strong)) {
            where += ' AND (t.strong=? OR t.strong=?)';
            bind.push(target.strong, target.displayStrong || target.strong);
            result.warnings.push('This lemma spelling belongs to multiple lexical identities. Counts are restricted to tokens explicitly tagged with the selected identifier; untagged tokens are excluded.');
        }
        if (r.filters.book > 0) {
            where += ' AND t.book_id=?';
            bind.push(r.filters.book);
        }
        if (r.filters.form) {
            where += ' AND t.surface=?';
            bind.push(r.filters.form);
        }
        const from = `FROM tokens t WHERE ${where}`;
        result.frequencies = selectedCorpus.map(corpus => {
            const counts = db.rows(`SELECT count(*),count(DISTINCT t.book_id||':'||t.chapter||':'||t.verse) ${from} AND t.corpus=?`, [...bind, corpus])[0];
            const denom = db.rows('SELECT count(*) FROM tokens WHERE corpus=?' + (r.filters.book > 0 ? ' AND book_id=?' : ''), r.filters.book > 0 ? [corpus, r.filters.book] : [corpus])[0][0];
            return { corpus, count: num(counts[0]), verses: num(counts[1]), denominator: num(denom) };
        });
        result.totalVerses = num(db.rows(`SELECT count(*) FROM (SELECT DISTINCT t.corpus,t.book_id,t.chapter,t.verse ${from})`, bind)[0][0]);
        result.books = db.rows(`SELECT t.book_id,b.name,count(*) FROM tokens t JOIN book_meta b ON b.id=t.book_id WHERE ${where} GROUP BY t.book_id ORDER BY t.book_id`, bind).map(x => ({ id: num(x[0]), name: str(x[1]), count: num(x[2]) }));
        result.forms = db.rows(`SELECT t.surface,t.morph,count(*) ${from} GROUP BY t.surface,t.morph ORDER BY count(*) DESC,t.surface`, bind).map(x => ({ surface: str(x[0]), morph: str(x[1]), count: num(x[2]) }));
        result.passages = db.rows(`SELECT t.book_id,b.name,b.abbr3,t.chapter,t.verse,coalesce(v.text,''),group_concat(t.surface,' · '),t.corpus FROM tokens t JOIN book_meta b ON b.id=t.book_id LEFT JOIN verses v ON v.book_id=t.book_id AND v.chapter=t.chapter AND v.verse=t.verse AND v.translation=? WHERE ${where} GROUP BY t.corpus,t.book_id,t.chapter,t.verse ORDER BY t.book_id,t.chapter,t.verse,t.corpus LIMIT ? OFFSET ?`, [r.translation, ...bind, PAGE, Math.max(0, r.page) * PAGE]).map(x => ({ bookId: num(x[0]), book: str(x[1]), abbr: str(x[2]), chapter: num(x[3]), verse: num(x[4]), text: str(x[5]), words: str(x[6]), corpus: str(x[7]) }));
        result.relations = relationships(target);
        result.warnings.push('Counts use stored lemma annotations, not every token sharing a Strong’s number. Source annotations and mapping coverage can differ. Morphology is shown in its source notation.');
        return result;
    }
    function english(r: StudyRequest, result: WordStudyData) {
        const query = englishWords(result.target!.lemma);
        if (query.length !== 1) {
            result.warnings.push('Enter one English word for exact frequency analysis.');
            return result;
        }
        const term = query[0];
        const verses = db.rows('SELECT v.book_id,b.name,b.abbr3,v.chapter,v.verse,v.text FROM verses v JOIN book_meta b ON b.id=v.book_id WHERE v.translation=?' + (r.filters.book > 0 ? ' AND v.book_id=?' : '') + ' ORDER BY v.book_id,v.chapter,v.verse', r.filters.book > 0 ? [r.translation, r.filters.book] : [r.translation]);
        if (!verses.length) result.warnings.push('No verse data is installed for this translation and book scope; zero counts do not establish absence of this word.');
        let count = 0, denominator = 0;
        const books = new Map<number, {
            id: number;
            name: string;
            count: number;
        }>();
        const hits = [];
        for (const row of verses) {
            const words = englishWords(str(row[5]));
            denominator += words.length;
            const n = words.filter(w => w === term).length;
            if (!n)
                continue;
            count += n;
            const id = num(row[0]);
            const b = books.get(id) ?? { id, name: str(row[1]), count: 0 };
            b.count += n;
            books.set(id, b);
            hits.push({ bookId: id, book: str(row[1]), abbr: str(row[2]), chapter: num(row[3]), verse: num(row[4]), text: str(row[5]), words: `${n} occurrence${n === 1 ? '' : 's'}`, corpus: r.translation });
        }
        result.frequencies = [{ corpus: r.translation, count, verses: hits.length, denominator }];
        result.books = [...books.values()];
        result.totalVerses = hits.length;
        result.passages = hits.slice(Math.max(0, r.page) * PAGE, (Math.max(0, r.page) + 1) * PAGE);
        const matches = lexemes().filter(e => englishWords(e.gloss).includes(term));
        result.candidates = [result.target!, ...matches.map(e => ({ ...e, reason: 'English gloss match (not an aligned rendering)' }))];
        // Relationships belong to the original-language candidates, not to the English gloss.
        // Display aliases may share a lemma; load that lemma's relationships only once.
        const seen = new Set<string>();
        for (const entry of matches) {
            const key = `${entry.lang}:${normalize(entry.lemma)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.relations.push(...relationships(entry).map(relation => ({ ...relation, origin: entry })));
        }

        return result;
    }
    return { run, resolve };
}
