import { EquivalentPanel } from './EquivalentPanel';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { dbClient } from '../../lib/db';
import type { DBStatus } from '../../lib/db';
import { ENGLISH, readEnglish, readVisibility, rememberEnglish, saveVisibility, RELATION_LABELS } from '../../lib/wordStudy/settings';
import type { StudyRequest, StudyTarget, WordStudyData, Visibility, StudyPassage } from '../../lib/wordStudy/types';
import { validateSavedStudy } from '../../lib/wordStudy/storage';
import type { SavedWordStudy } from '../../lib/wordStudy/storage';
import { getClassClient } from '../../lib/class/client';
import type { Session } from '../../lib/class/types';
import { STUDY_SOURCES } from '../../lib/sourceCredits';
import { RelationshipControls } from './RelationshipControls';
import '../../styles/wordStudy.css';
const subscribe = (fn: () => void) => { addEventListener('hashchange', fn); return () => removeEventListener('hashchange', fn); };
const snapshot = () => location.hash;
const routeInteger = (value:string|null) => { const n=Number(value); return Number.isSafeInteger(n)&&n>=0?n:0; };
function download(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function WordStudyMode({ status, onOpenPassage }: {
    status: DBStatus;
    onOpenPassage: (p: StudyPassage) => void;
}) {
    const hash = useSyncExternalStore(subscribe, snapshot);
    const requestParams = new URLSearchParams(hash.split('?')[1] ?? '');
    ['view', 'hidden', 'saved', 'originForm'].forEach(key => requestParams.delete(key));
    const requestKey = requestParams.toString();
    const request = useMemo<StudyRequest>(() => {
        const p = new URLSearchParams(requestKey);
        const target = p.get('target');
        const translation = ENGLISH.find(x => x === p.get('translation')) ?? readEnglish();
        return { query: p.get('q') ?? '', translation, language: p.get('language') ?? 'auto',
            target: target ? { id: target } as StudyTarget : undefined,
            filters: { corpus: p.get('corpus') ?? '', book: Math.max(0, Number(p.get('book')) || 0), form: p.get('form') ?? '' },
            equivalentPage: routeInteger(p.get('equivalentPage')), page: routeInteger(p.get('page')) };
    }, [requestKey]);
    const params = new URLSearchParams(hash.split('?')[1] ?? '');
    const savedParam = params.get('saved');
    const map = params.get('view') === 'map';
    const originForm = params.get('originForm') ?? '';
    const visibility = useMemo<Visibility>(() => {
        const p = new URLSearchParams(hash.split('?')[1] ?? '');
        const hidden = p.get('hidden');
        return hidden === null ? readVisibility() : Object.fromEntries(Object.keys(RELATION_LABELS).map(k => [k, !hidden.split(',').includes(k)])) as Visibility;
    }, [hash]);
    const [draftInput, setDraftInput] = useState<{
        key: string;
        value: string;
    } | null>(null);
    const draft = draftInput?.key === request.query ? draftInput.value : request.query;
    const setDraft = (value: string) => setDraftInput({ key: request.query, value });
    const [languageInput, setLanguageInput] = useState<{
        key: string;
        value: string;
    } | null>(null);
    const language = languageInput?.key === request.language ? languageInput.value : request.language;
    const setLanguage = (value: string) => setLanguageInput({ key: request.language, value });
    const [response, setResponse] = useState<{
        key: string;
        data: WordStudyData | null;
        error: string;
    } | null>(null);
    const [retry, setRetry] = useState(0);
    const [notice, setNotice] = useState('');
    const [saved, setSaved] = useState<SavedWordStudy[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [savedId, setSavedId] = useState('');
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [pins, setPins] = useState<{
        target: string;
        scope: string;
        count: number;
        rate: string;
    }[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const loadKey = `${requestKey}:${retry}:${status}`;
    const loading = Boolean(request.query && status === 'ready' && response?.key !== loadKey);
    const data = response?.key === loadKey ? response.data : null;
    const error = response?.key === loadKey ? response.error : '';
    const update = (changes: Record<string, string | null>, resetPage = true) => {
        const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
        if (resetPage)
            { p.delete('page'); p.delete('equivalentPage'); }
        for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '')
                p.delete(key);
            else
                p.set(key, value);
        }
        location.assign(`#/study?${p}`);
    };
    // A blank hidden parameter explicitly represents all visible, independently of global defaults.
    const applyVisibility = (v: Visibility) => {
        const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
        p.set('hidden', Object.entries(v).filter(([, visible]) => !visible).map(([key]) => key).join(','));
        location.assign(`#/study?${p}`);
    };
    useEffect(() => {
        let cancelled = false;
        if (!request.query || status !== 'ready')
            return;
        dbClient.wordStudy(request).then(value => {
            if (!cancelled)
                setResponse({ key: loadKey, data: value, error: '' });
        }).catch(err => {
            if (!cancelled)
                setResponse({ key: loadKey, data: null, error: String(err.message ?? err) });
        });
        return () => { cancelled = true; };
    }, [request, status, loadKey]);
    const refreshSaved = () => getClassClient().wordStudies.list().then(setSaved);
    useEffect(() => {
        let cancelled = false;
        getClassClient().wordStudies.list().then(rows => {
            if (cancelled)
                return;
            setSaved(rows);
            const id = savedParam;
            const s = rows.find(value => value.id === id);
            if (s) {
                setSavedId(s.id);
                setTitle(s.title);
                setNotes(s.notes);
                setSessionId(s.sessionId);
            }
        }).catch(e => { if (!cancelled)
            setNotice(`Saved studies: ${e.message}`); });
        return () => { cancelled = true; };
    }, [savedParam]);
    useEffect(() => { getClassClient().session.list().then(setSessions).catch(() => { }); }, []);
    const target = data?.target;
    const select = (e: StudyTarget) => {
        setSavedId('');
        setTitle('');
        setNotes('');
        setSessionId(null);
        update({ target: e.id, corpus: null, book: null, form: null, hidden: null, saved: null });
    };
    const studyWord = (word: string, language = target?.lang ?? 'auto') => {
        setSavedId('');
        setTitle('');
        setNotes('');
        update({ q: word, target: null, language, corpus: null, form: null, book: null, hidden: null, saved: null });
    };
    const currentStudy = (): SavedWordStudy => ({ id: savedId || crypto.randomUUID(), title: title.trim() || target?.lemma || request.query, notes, request, visibility, view: map ? 'map' : 'overview', sessionId, updatedAt: new Date().toISOString() });
    const save = async () => {
        try {
            const s = currentStudy();
            await getClassClient().wordStudies.save(s);
            setSavedId(s.id);
            await refreshSaved();
            setNotice('Study saved on this device.');
        }
        catch (e) {
            setNotice(`Could not save: ${String(e)}`);
        }
    };
    const restore = (s: SavedWordStudy) => {
        setSavedId(s.id);
        setTitle(s.title);
        setNotes(s.notes);
        setSessionId(s.sessionId);
        const p = new URLSearchParams({ q: s.request.query, translation: s.request.translation, language: s.request.language, view: s.view ?? 'overview', page: String(s.request.page), equivalentPage:String(s.request.equivalentPage??0), saved: s.id, corpus: s.request.filters.corpus, book: String(s.request.filters.book), form: s.request.filters.form, hidden: Object.entries(s.visibility).filter(([, v]) => !v).map(([k]) => k).join(',') });
        if (s.request.target)
            p.set('target', s.request.target.id);
        location.assign(`#/study?${p}`);
    };
    const activeData = !loading ? data : null;
    const relations = activeData?.relations.filter(r => visibility[r.kind]) ?? [];
    const entries = <>
    {activeData?.entries.map(e => <article className="ws-entry" key={`${e.lang}:${e.estrong}`}><h3>{e.lemma} <small>{e.estrong}{e.dstrong !== e.estrong ? ` / ${e.dstrong}` : ''}</small></h3><p>{e.translit} · {e.gloss}</p>{e.morph && <p>Source morphology: {e.morph}</p>}{e.meaning && <p className="ws-definition">{e.meaning}</p>}<small>STEP brief lexicon</small></article>)}
    {activeData?.studies.map(e => <details key={e.id} className="ws-entry"><summary>{STUDY_SOURCES[e.source]?.name ?? e.source} — {e.lemma}</summary>{e.senses.map((sense, i) => <article key={i}><h4>Sense {i + 1}{sense.code ? ` · ${sense.code}` : ''}</h4><p className="ws-definition">{sense.definition}</p>{sense.glosses.length > 0 && <p>Glosses: {sense.glosses.join(', ')}</p>}{sense.domains.length > 0 && <p>Domains: {sense.domains.join(', ')}</p>}{sense.note && <p className="ws-definition">{sense.note}</p>}{sense.references.length > 0 && <p>References: {sense.references.join('; ')}</p>}</article>)}</details>)}
    {target?.lang !== 'Eng' && !activeData?.entries.length && !activeData?.studies.length && <p>No lexical entries installed for this target.</p>}
  </>;
    const forms = <>{activeData?.forms.length ? <div className="ws-table-wrap"><table><caption>Source forms and morphology (codes retained as supplied)</caption><thead><tr><th>Form</th><th>Source parsing</th><th>Occurrences</th></tr></thead><tbody>{activeData.forms.map((f, i) => <tr key={i}><td><button dir="auto" onClick={() => update({ form: f.surface })}>{f.surface}</button></td><td>{f.morph || 'Unavailable'}</td><td>{f.count.toLocaleString()}</td></tr>)}</tbody></table></div> : <p>No original-language forms in this selection.</p>}</>;
    const relationContent = <>
    {target?.lang === 'Eng' && <p>These relationships belong to Hebrew and Greek entries whose glosses match “{target.lemma}”. They are not claims about the English word or verified translation equivalents. Each result identifies its source word; select that word for a focused study.</p>}
    <RelationshipControls value={visibility} onChange={applyVisibility}/>
    <button onClick={() => { try {
        saveVisibility(visibility);
        setNotice('Relationship defaults saved for future studies.');
    }
    catch {
        setNotice('Browser storage is unavailable; defaults were not saved.');
    } }}>Use these defaults for future studies</button>
    {!Object.values(visibility).some(Boolean) && <p>Related details hidden. Use Show all to restore them.</p>}
    {Object.entries(RELATION_LABELS).filter(([k]) => visibility[k as keyof Visibility]).map(([kind, label]) => <details key={kind} open className="ws-relation-group"><summary>{label} ({relations.filter(r => r.kind === kind).length})</summary>{relations.filter(r => r.kind === kind).map((r, i) => <div className="ws-relation" key={i}><button dir="auto" onClick={() => studyWord(r.lemma, r.lang)}>{r.lemma} →</button>{r.origin && <span>Related to <button dir="auto" onClick={() => select(r.origin!)}>{r.origin.lemma} · {r.origin.displayStrong || r.origin.strong}</button> ({r.origin.language})</span>}<small>{STUDY_SOURCES[r.source as keyof typeof STUDY_SOURCES]?.name ?? r.source} · {r.context}</small></div>)}{!relations.some(r => r.kind === kind) && <p>{activeData?.relationsAvailable ? 'No sourced relationship found in the installed data.' : 'Relationship data is not installed. Refresh the Bible database after updating its data.'}</p>}</details>)}
  </>;
    const candidates = activeData?.candidates.filter(e => e.id !== target?.id) ?? [];
    return <main className="word-study">
    <header className="ws-header"><div><p className="ws-eyebrow">WORD STUDY</p><h1>Follow a word through Scripture</h1><p>Explore meanings, forms, related words, and every occurrence.</p></div></header>
    <form className="ws-search" onSubmit={e => { e.preventDefault(); setSavedId(''); setNotes(''); setTitle(''); setSessionId(null); update({ q: draft.trim(), target: null, language, book: null, form: null, corpus: null, hidden: null, saved: null }); inputRef.current?.blur(); }}>
      <label>Word, lemma, variant, or Strong’s number<input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="love · λόγος · אֱלֹהִים · G26" required/></label>
      <label>Input language<select value={language} onChange={e => setLanguage(e.target.value)}><option value="auto">Detect language</option><option value="Eng">English</option><option value="Grk">Greek</option><option value="Heb">Hebrew</option><option value="Arc">Aramaic</option></select></label>
      <label>English translation<select value={request.translation} onChange={e => { rememberEnglish(e.target.value); update({ translation: e.target.value }); }}>{ENGLISH.map(t => <option key={t}>{t}</option>)}</select></label>
      <button className="ws-primary" disabled={status !== 'ready'}>Study word</button>
    </form>
    <div role="status" aria-live="polite">{status !== 'ready' && <p>Word Study is waiting for the Bible database. {status === 'error' ? 'Use the database refresh control to retry.' : ''}</p>}{loading && <p>Analyzing the complete corpus…</p>}{notice && <p>{notice}</p>}</div>
    {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
    {!request.query && <section className="ws-panel"><h2>Start with a word</h2><p>Enter English or original script, a transliteration, an inflected form, or a Strong’s identifier. Ambiguous input offers a choice of lexical entries.</p><p>Studies use installed offline sources. A shared English gloss does not establish that two words are synonyms.</p></section>}
    {activeData && !target && <>{activeData.warnings.map(w => <p role="status" key={w}>{w}</p>)}</>}
    {activeData && !target && <section className="ws-panel"><h2>{activeData.candidates.length ? 'Choose a lexical entry' : 'No matching entry found'}</h2><p>{activeData.candidates.length ? 'This input can refer to more than one entry. Select the intended word.' : 'Try a lemma, original script, transliteration, or Strong’s identifier. Missing data does not establish that a word is absent from Scripture.'}</p></section>}
    {activeData && candidates.length > 0 && <details className="ws-panel" open={!target || target.lang === 'Eng'}><summary>{target?.lang === 'Eng' ? 'Lexical discovery — English gloss matches' : 'Other matching entries'} ({candidates.length})</summary><p>These candidates are lexical matches, not verified translation equivalents.</p><div className="ws-candidates">{candidates.map(e => <button key={e.id} onClick={() => select(e)}><strong dir="auto">{e.lemma}</strong><span>{e.translit} · {e.displayStrong || e.strong}</span><span>{e.gloss}</span><small>{e.language} · {e.reason}</small></button>)}</div></details>}
    {activeData && target && <>
      <section className="ws-panel ws-identity"><div><p className="ws-eyebrow">{target.language}</p><h2 dir="auto">{target.lemma}</h2><p>{target.translit} {target.strong && `· ${target.strong}`}</p><p>{target.gloss}</p></div><div className="ws-view" role="group" aria-label="Study view"><button aria-pressed={!map} onClick={() => update({ view: null }, false)}>Overview</button><button aria-pressed={map} onClick={() => update({ view: 'map' }, false)}>Word map</button></div></section>
      <nav className="ws-section-nav" aria-label="Study sections">{['usage', 'entries', 'relations', 'forms', 'equivalents', 'passages', 'workspace', 'sources'].map(s => <button key={s} onClick={() => document.getElementById(`ws-${s}`)?.scrollIntoView({ block: 'start' })}>{s[0].toUpperCase() + s.slice(1)}</button>)}</nav>
      <section className="ws-panel" id="ws-usage"><h2>Usage and frequency</h2><div className="ws-filters">
        {target.lang !== 'Eng' && <label>Corpus<select value={request.filters.corpus} onChange={e => update({ corpus: e.target.value, form: null, book: null })}><option value="">All available corpora</option>{(target.lang === 'Heb' ? ['WLC'] : ['LXX', 'GNT']).map(c => <option key={c}>{c}</option>)}</select></label>}
        <label>Book<select value={request.filters.book} onChange={e => update({ book: e.target.value })}><option value={0}>All books</option>{activeData.books.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
        {request.filters.form && <span>Form: <b dir="auto">{request.filters.form}</b> <button onClick={() => update({ form: null })}>Clear form</button></span>}
        {originForm && target.lang !== 'Eng' && <button onClick={() => update({ form: originForm })}>This form only: <span dir="auto">{originForm}</span></button>}
        <button onClick={() => update({ corpus: null, book: null, form: null })}>Clear filters</button>
      </div><div className="ws-table-wrap"><table><caption>Complete counts, independent of Search’s hit limit</caption><thead><tr><th>Corpus / translation</th><th>Occurrences</th><th>Distinct verses</th><th>Per 1,000 words</th></tr></thead><tbody>{activeData.frequencies.map(f => <tr key={f.corpus}><th>{f.corpus}</th><td>{f.count.toLocaleString()}</td><td>{f.verses.toLocaleString()}</td><td>{f.denominator ? (f.count / f.denominator * 1000).toFixed(3) : 'Unavailable'}</td></tr>)}</tbody></table></div><p className="ws-muted">Denominator: all tokens in the selected corpus and book, including forms other than the selected form. Verse totals are separate per corpus. English is case-insensitive, retains internal apostrophes, and splits hyphenated words.</p>
      <details><summary>Book distribution — select a book to filter</summary><div className="ws-chart">{activeData.books.map(b => <button key={b.id} onClick={() => update({ book: String(b.id) })}><span>{b.name}</span><span className="ws-bar" style={{ width: `${Math.max(1, b.count / Math.max(...activeData.books.map(x => x.count)) * 100)}%` }}/><b>{b.count}</b></button>)}</div></details></section>
      <div className={map ? 'ws-map' : 'ws-overview'} aria-label={map ? 'Expandable word map' : 'Study overview'}>
        {map && <div className="ws-map-center"><strong dir="auto">{target.lemma}</strong><span>{target.strong || request.translation}</span><small>Expand a branch below. Select a related word to open its study; use browser Back to return.</small></div>}
        {map && <div className="ws-map-connector" aria-hidden="true"/>}
        <section className="ws-panel" id="ws-entries"><h2>Meanings and entries</h2>{map ? <details><summary>Entries ({activeData.entries.length + activeData.studies.length})</summary>{entries}</details> : entries}</section>
        <section className="ws-panel" id="ws-relations"><h2>Related words</h2>{map ? <details open><summary>Relationship branches</summary>{relationContent}</details> : relationContent}</section>
        <section className="ws-panel" id="ws-forms"><h2>Forms and grammar</h2>{map ? <details><summary>Forms ({activeData.forms.length})</summary>{forms}</details> : forms}</section>
        <section className="ws-panel" id="ws-equivalents"><h2>Hebrew–LXX equivalents</h2><EquivalentPanel report={activeData.equivalents} target={target} request={request} onStudy={studyWord} onPage={page=>update({equivalentPage:String(page)},false)} onPassage={onOpenPassage} />{activeData.correspondences.length > 0 && <details><summary>Other-language lexical discovery ({activeData.correspondences.length})</summary><p>These entries share an English gloss. This is not evidence of synonymy or translation equivalence.</p><div className="ws-candidates">{activeData.correspondences.map(e => <button key={e.id} onClick={() => { update({ q: e.strong, target: e.id, language: e.lang, corpus: null, book: null, form: null, hidden: null, saved: null }); }}><strong dir="auto">{e.lemma}</strong><span>{e.language} · {e.displayStrong || e.strong}</span><small>{e.gloss} · STEP brief lexicon</small></button>)}</div></details>}{activeData.studies.flatMap(e => e.senses.flatMap(s => s.glosses)).length > 0 && <p>Source glosses: {[...new Set(activeData.studies.flatMap(e => e.senses.flatMap(s => s.glosses)))].join(', ')}</p>}</section>
      </div>
      <section className="ws-panel" id="ws-passages"><h2>Passages <small>({activeData.totalVerses.toLocaleString()} corpus–verse records)</small></h2><p>{request.translation} · {request.filters.corpus || 'All selected corpora'} · {request.filters.book ? 'Selected book' : 'All books'}</p>{!activeData.passages.length && <p>No occurrences in this selection. Try clearing filters.</p>}{activeData.passages.map(p => <article className="ws-passage" key={`${p.corpus}:${p.bookId}:${p.chapter}:${p.verse}`}><button onClick={() => onOpenPassage(p)}>{p.book} {p.chapter}:{p.verse} →</button><small>{p.corpus}</small><p>{p.text || `Text unavailable in ${request.translation}.`}</p><p dir="auto" className="ws-matched">{p.words}</p></article>)}<div className="ws-pagination"><button disabled={request.page === 0} onClick={() => update({ page: String(request.page - 1) }, false)}>Previous</button><span>Page {request.page + 1} of {Math.max(1, Math.ceil(activeData.totalVerses / 40))}</span><button disabled={(request.page + 1) * 40 >= activeData.totalVerses} onClick={() => update({ page: String(request.page + 1) }, false)}>Next</button></div></section>
      <section className="ws-panel" id="ws-workspace"><h2>Study workspace</h2><label>Study title<input value={title} onChange={e => setTitle(e.target.value)} placeholder={target.lemma}/></label><label>Notes<textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}/></label><label>Attach to Class session<select value={sessionId ?? ''} onChange={e => setSessionId(e.target.value ? Number(e.target.value) : null)}><option value="">No session</option>{sessions.map(s => <option value={s.id} key={s.id}>{s.title} · {s.taughtOn}</option>)}</select></label><div className="ws-actions"><button onClick={save}>Save study</button><button onClick={() => download('word-study.json', JSON.stringify({ kind: 'bcv.word-studies/v1', studies: [currentStudy()] }, null, 2), 'application/json')}>Export study JSON</button><button onClick={() => download('word-study.md', `# ${title || target.lemma}\n\n${notes}\n\nTranslation: ${request.translation}\n\n${activeData.frequencies.map(f => `${f.corpus}: ${f.count} occurrences, ${f.verses} verses; denominator ${f.denominator} tokens.`).join('\n\n')}\n\n## Entries\n\n${activeData.studies.map(e => `${e.source}: ${e.lemma}\n\n${e.senses.map(s => s.definition).join('\n\n')}`).join('\n\n')}\n\n## Hebrew–LXX equivalents\n\n${activeData.equivalents.groups.map(g=>`${g.strong || g.surface}: ${g.records} source records; ${g.checked} Greek checks at stored reference.`).join('\n\n')}\n\nMACULA recorded equivalents are source annotations; Greek surface/identifier checks do not establish cross-edition verse alignment.\n\n## Coverage\n\n${activeData.warnings.join('\n\n')}\n\n## Sources\n\n${activeData.sources.map(s => `${s.attribution} ${s.license}; revision ${s.revision}; ${s.url}`).join('\n\n')}`, 'text/markdown')}>Export readable study</button><button onClick={() => setPins(p => [...p, ...activeData.frequencies.map(f => ({ target: target.lemma, scope: `${f.corpus} · ${request.filters.book || 'all books'} · ${request.filters.form || 'all forms'}`, count: f.count, rate: f.denominator ? (f.count / f.denominator * 1000).toFixed(3) : 'Unavailable' }))])}>Add to comparison</button></div></section>
    </>}
    <section className="ws-panel"><h2>Saved studies</h2><p>Stored in the local Class database. Export a backup to transfer to another device.</p>{saved.map(s => <div className="ws-saved" key={s.id}><button onClick={() => restore(s)}>{s.title}</button>{s.sessionId && <a href={`#/class/${s.sessionId}`}>Class session →</a>}<button aria-label={`Delete saved study ${s.title}`} onClick={async () => { try {
        await getClassClient().wordStudies.delete(s.id);
        await refreshSaved();
    }
    catch (e) {
        setNotice(String(e));
    } }}>Delete</button></div>)}<div className="ws-actions"><button disabled={!saved.length} onClick={() => download('word-studies-backup.json', JSON.stringify({ kind: 'bcv.word-studies/v1', studies: saved }, null, 2), 'application/json')}>Back up all studies</button><label className="ws-import">Import backup<input type="file" accept=".json" onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
        return; try {
        const payload = JSON.parse(await file.text());
        if (payload.kind !== 'bcv.word-studies/v1' || !Array.isArray(payload.studies))
            throw new Error('Unsupported backup format');
        payload.studies.forEach(validateSavedStudy);
        for (const s of payload.studies) {
            await getClassClient().wordStudies.save({ ...s, sessionId: null });
        }
        await refreshSaved();
        setNotice('Studies imported. Class attachments are cleared when transferring standalone backups.');
    }
    catch (err) {
        setNotice(`Import failed: ${String(err)}`);
    }
    finally {
        e.target.value = '';
    } }}/></label></div></section>
    {pins.length > 0 && <section className="ws-panel"><h2>Comparison</h2><p>Compare rates only with compatible corpus and filter scopes.</p><div className="ws-table-wrap"><table><thead><tr><th>Word</th><th>Scope</th><th>Occurrences</th><th>Per 1,000</th></tr></thead><tbody>{pins.map((p, i) => <tr key={i}><td dir="auto">{p.target}</td><td>{p.scope}</td><td>{p.count}</td><td>{p.rate}</td></tr>)}</tbody></table></div><button onClick={() => setPins([])}>Clear comparison</button></section>}
    {activeData?.target && <section className="ws-panel" id="ws-sources"><h2>Sources and coverage</h2>{activeData.warnings.map(w => <p key={w}>{w}</p>)}{activeData.sources.map(s => <details key={s.id}><summary>{s.id} · {s.license}</summary><p>{s.attribution}</p><p>Revision: {s.revision}</p><a href={s.url} target="_blank" rel="noreferrer">Source</a></details>)}</section>}
  </main>;
}
