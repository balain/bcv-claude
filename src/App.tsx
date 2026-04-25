import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { BookNav } from './components/BookNav';
import type { BookNavItem } from './components/BookNav';
import { MiniChart } from './components/MiniChart';
import { GlossCard } from './components/GlossCard';
import { ResultCard } from './components/ResultCard';
import { DefinitionSheet } from './components/DefinitionSheet';
import { ChapterView } from './components/ChapterView';
import { computeDistribution } from './lib/search';
import { dbClient } from './lib/db';
import type { DBStatus, LexEntry } from './lib/db';
import type { Lang, Source, WordToken, BibleResult } from './types';

const ENG_SOURCES = new Set<Source>(['KJV', 'ASV', 'LEB', 'NASB']);

export default function App() {
  const [query, setQuery] = useState('loving');
  const [source, setSource] = useState<Source>('NASB');
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordToken | null>(null);
  const [selectedLang, setSelectedLang] = useState<Lang | null>(null);
  const [activeBook, setActiveBook] = useState<string | null>(null);

  const [results, setResults] = useState<BibleResult[]>([]);
  // Seed from current singleton status so we don't miss events that fired before mount
  const [dbStatus, setDbStatus] = useState<DBStatus>(dbClient.status);
  const [dbMessage, setDbMessage] = useState('');
  const searchAbort = useRef<AbortController | null>(null);

  const [chapterView, setChapterView] = useState<{
    abbr3: string; bookName: string; chapter: number; highlightVerse: number; testament: 'OT' | 'NT';
  } | null>(null);

  // Gloss card for original-language single-word searches.
  // glossCardOpen is intentionally NOT reset on query change — the user's
  // preference for collapsed/expanded persists across searches.
  const [glossEntry, setGlossEntry] = useState<LexEntry | null>(null);
  const [glossCardOpen, setGlossCardOpen] = useState(true);

  // Subscribe to worker status updates
  useEffect(() => {
    // Re-sync in case status changed between useState init and effect run
    setDbStatus(dbClient.status);
    return dbClient.onStatus((status, message) => {
      setDbStatus(status);
      if (message) setDbMessage(message);
    });
  }, []);

  // Run search whenever query/source/dbStatus changes
  const runSearch = useCallback(
    async (q: string, s: Source) => {
      if (dbStatus !== 'ready') return;
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      try {
        const r = await dbClient.search(q, s);
        if (!ctrl.signal.aborted) setResults(r);
      } catch (e) {
        if (!ctrl.signal.aborted) console.error('Search error', e);
      }
    },
    [dbStatus],
  );

  useEffect(() => {
    if (dbStatus === 'ready') runSearch(query, source);
  }, [dbStatus, query, source, runSearch]);

  // Derive the gloss card entry from the first highlighted token in the results —
  // the same token data the word-tap popup uses, no separate query needed.
  useEffect(() => {
    const isOrigLang = source === 'Heb' || source === 'LXX' || source === 'GNT';
    const isPhrase = (q: string) => q.length >= 2 && q.startsWith('"') && q.endsWith('"');
    const isSingleWord = query.trim().length > 0 && !query.includes(' ') && !isPhrase(query);
    if (!isOrigLang || !isSingleWord || results.length === 0) {
      setGlossEntry(null);
      return;
    }

    const targetCorpus = source === 'Heb' ? 'WLC' : source === 'LXX' ? 'LXX' : 'GNT';
    let token: WordToken | undefined;
    for (const r of results) {
      const section = r.originals.find((s) => s.corpus === targetCorpus);
      if (section) { token = section.tokens.find((t) => t.highlight); if (token) break; }
    }
    if (!token) { setGlossEntry(null); return; }

    let cancelled = false;
    (async () => {
      let entry: LexEntry | null = null;
      if (token!.strong) entry = await dbClient.lookup(token!.strong);
      if (!entry && token!.lemma) {
        entry = await dbClient.lookupByLemma(token!.lemma, source === 'Heb' ? 'Heb' : 'Grk');
      }
      if (!cancelled) setGlossEntry(entry);
    })();
    return () => { cancelled = true; };
  }, [source, query, results]);

  const filtered = useMemo(
    () => (activeBook ? results.filter((r) => r.bookAbbr === activeBook) : results),
    [results, activeBook],
  );

  const books = useMemo<BookNavItem[]>(() => {
    const seen = new Set<string>();
    const out: BookNavItem[] = [];
    const ot = results.filter((r) => r.testament === 'OT');
    const nt = results.filter((r) => r.testament === 'NT');
    for (const r of [...ot, ...nt]) {
      if (!seen.has(r.bookAbbr)) {
        seen.add(r.bookAbbr);
        out.push({ name: r.bookAbbr, t: r.testament });
      }
    }
    return out;
  }, [results]);

  const distribution = useMemo(() => computeDistribution(results), [results]);

  const onGo = (q: string, s: Source) => {
    setQuery(q);
    setSource(s);
    setActiveBook(null);
  };

  const isLoading = dbStatus === 'initializing' || dbStatus === 'progress';

  return (
    <div className="device-frame">
      {/* App header */}
      <div
        style={{
          background: 'var(--navy)',
          padding: '5px 14px 7px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'Playfair Display',
            fontSize: 17,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.02em',
          }}
        >
          ✞ BibleSearch
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowChart((v) => !v)}
            style={{
              background: showChart ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 8,
              padding: '5px 8px',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
            aria-label="Toggle distribution chart"
          >
            📊
          </button>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>☀</span>
        </div>
      </div>

      <SearchBar
        collapsed={searchCollapsed}
        onToggle={() => setSearchCollapsed((v) => !v)}
        query={query}
        source={source}
        onGo={onGo}
      />

      <div
        className="no-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px 16px',
          background: 'var(--parchment)',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'Playfair Display',
              fontSize: 19,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {query || '—'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-light)', fontFamily: 'DM Sans' }}>
            {isLoading
              ? dbMessage || 'Loading…'
              : `${filtered.length} hits · ${source}`}
          </span>
          {!isLoading && results.length >= 200 && (
            <span style={{ fontSize: 12, color: 'var(--amber)', fontFamily: 'DM Sans', fontWeight: 600 }}>
              ⚠ capped at 200
            </span>
          )}
        </div>

        {isLoading ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--ink-light)',
              fontFamily: 'DM Sans',
              fontSize: 13,
            }}
          >
            {dbMessage || 'Initializing database…'}
          </div>
        ) : (
          <>
            <BookNav books={books} active={activeBook} onSelect={setActiveBook} />
            <MiniChart visible={showChart} bars={distribution} totalHits={results.length} />

            {glossEntry && (
              <GlossCard
                entry={glossEntry}
                lang={source === 'Heb' ? 'Heb' : 'Grk'}
                open={glossCardOpen}
                onToggle={() => setGlossCardOpen((v) => !v)}
              />
            )}

            {filtered.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--ink-light)',
                  fontFamily: 'DM Sans',
                  fontSize: 13,
                }}
              >
                No results.
              </div>
            ) : (
              filtered.map((r, i) => (
                <ResultCard
                  key={`${r.ref}-${i}`}
                  result={r}
                  onWordTap={(w, lang) => {
                    setSelectedWord(w);
                    setSelectedLang(lang);
                  }}
                  onEngWordClick={(word) => onGo(word, ENG_SOURCES.has(source) ? source : 'NASB')}
                  onRefClick={(r) => setChapterView({
                    abbr3: r.bookAbbr,
                    bookName: r.book,
                    chapter: r.chapter,
                    highlightVerse: r.verse,
                    testament: r.testament,
                  })}
                />
              ))
            )}
          </>
        )}

        <div style={{ height: 20 }} />
      </div>

      {selectedWord && selectedLang && (
        <DefinitionSheet
          word={selectedWord}
          lang={selectedLang}
          onClose={() => setSelectedWord(null)}
          onSearch={(q, s) => { onGo(q, s); setSelectedWord(null); }}
        />
      )}

      {chapterView && (
        <ChapterView
          abbr3={chapterView.abbr3}
          bookName={chapterView.bookName}
          chapter={chapterView.chapter}
          highlightVerse={chapterView.highlightVerse}
          testament={chapterView.testament}
          onClose={() => setChapterView(null)}
          onSearch={(q, s) => { onGo(q, s); setChapterView(null); }}
        />
      )}
    </div>
  );
}
