import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { BookNav } from "./components/BookNav";
import type { BookNavItem } from "./components/BookNav";
import { MiniChart } from "./components/MiniChart";
import { GlossCard } from "./components/GlossCard";
import { ResultCard } from "./components/ResultCard";
import { DefinitionSheet } from "./components/DefinitionSheet";
import { ChapterView } from "./components/ChapterView";
import { BcvBrowser } from "./components/BcvBrowser";
import { SearchHistory } from "./components/SearchHistory";
import type { HistoryEntry } from "./components/SearchHistory";
import { computeDistribution } from "./lib/search";
import { dbClient } from "./lib/db";
import type { DBStatus, LexEntry } from "./lib/db";
import type { Lang, Source, WordToken, BibleResult, Bookmark } from "./types";
import { ClassMode } from "./components/class/ClassMode";
import { initClassClient } from "./lib/class/client";
import { BOOK_BY_ID } from "./lib/books";
import { loadBookmarks, saveBookmarks } from "./lib/bookmarks";

const ENG_SOURCES = new Set<Source>(["KJV", "ASV", "LEB", "NASB"]);

// Initialize the class worker at module load time so getClassClient() is always
// ready on first render — avoids the useEffect timing race when #/class is the
// initial URL.
initClassClient(
  new Worker(new URL("./workers/class.worker.ts", import.meta.url), { type: "module" }),
);

export default function App() {
  const [query, setQuery] = useState("loving");
  const [source, setSource] = useState<Source>("NASB");
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordToken | null>(null);
  const [selectedLang, setSelectedLang] = useState<Lang | null>(null);
  const [activeBook, setActiveBook] = useState<string | null>(null);

  const [results, setResults] = useState<BibleResult[]>([]);
  // Seed from current singleton status so we don't miss events that fired before mount
  const [dbStatus, setDbStatus] = useState<DBStatus>(dbClient.status);
  const [dbMessage, setDbMessage] = useState("");
  const searchAbort = useRef<AbortController | null>(null);

  // Search history — persisted to localStorage
  const [searchHistory, setSearchHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("bcv-history") ?? "[]");
    } catch {
      return [];
    }
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  // Scroll-to-top button
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const handleScroll = useCallback(() => {
    setShowTopBtn((scrollRef.current?.scrollTop ?? 0) > 200);
  }, []);
  const scrollToTop = () =>
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const [chapterView, setChapterView] = useState<{
    abbr3: string;
    bookName: string;
    chapter: number;
    highlightVerse: number;
    testament: "OT" | "NT";
  } | null>(null);

  // ─── Mode & routing ──────────────────────────────────────────────────────

  function parseBrowsePos(hash: string): { bookId: number; chapter: number; verse: number } | null {
    const m = /^#\/bcv\/(\d+)\/(\d+)/.exec(hash);
    if (!m) return null;
    const vMatch = /[?&]v=(\d+)/.exec(hash);
    return { bookId: Number(m[1]), chapter: Number(m[2]), verse: vMatch ? Number(vMatch[1]) : 1 };
  }

  function modeFromHash(hash: string): "search" | "browse" | "class" {
    if (hash.startsWith("#/class")) return "class";
    if (hash.startsWith("#/bcv") || hash.startsWith("#/browse")) return "browse";
    return "search";
  }

  const [mode, setMode] = useState<"search" | "browse" | "class">(() => modeFromHash(location.hash));
  const [browsePos, setBrowsePos] = useState<{ bookId: number; chapter: number; verse: number } | null>(
    () => parseBrowsePos(location.hash),
  );
  // When navigating to browse from class mode, remember the class hash so the
  // user can return to their specific session with one tap.
  const [browseReturnUrl, setBrowseReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash;
      setMode(modeFromHash(h));
      setBrowsePos(parseBrowsePos(h));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const handleBrowseNavigate = useCallback((bookId: number, chapter: number, verse: number) => {
    const verseQ = verse > 0 ? `?v=${verse}` : "";
    location.hash = `#/bcv/${bookId}/${chapter}${verseQ}`;
  }, []);

  // Called by ClassMode when a ref is tapped — opens ChapterView as an overlay
  // without touching the hash or leaving class mode.
  const handleClassRefOpen = useCallback((bookId: number, chapter: number, verse: number) => {
    const book = BOOK_BY_ID.get(bookId);
    if (book) {
      setChapterView({ abbr3: book.abbr3, bookName: book.name, chapter, highlightVerse: verse, testament: book.testament });
    }
  }, []);

  // ─── Bookmarks ───────────────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());

  const addBookmark = useCallback((bookId: number, chapter: number, verse: number, label: string) => {
    setBookmarks((prev) => {
      // Toggle: remove if already bookmarked, otherwise prepend
      const exists = prev.findIndex((b) => b.bookId === bookId && b.chapter === chapter && b.verse === verse);
      const next = exists >= 0
        ? prev.filter((_, i) => i !== exists)
        : [{ id: crypto.randomUUID(), bookId, chapter, verse, label, createdAt: Date.now() }, ...prev];
      saveBookmarks(next);
      return next;
    });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((bookId: number, chapter: number, verse: number) =>
    bookmarks.some((b) => b.bookId === bookId && b.chapter === chapter && b.verse === verse),
  [bookmarks]);

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
      if (dbStatus !== "ready") return;
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      try {
        const r = await dbClient.search(q, s);
        if (!ctrl.signal.aborted) setResults(r);
      } catch (e) {
        if (!ctrl.signal.aborted) console.error("Search error", e);
      }
    },
    [dbStatus],
  );

  useEffect(() => {
    if (dbStatus === "ready") runSearch(query, source);
  }, [dbStatus, query, source, runSearch]);

  const [refreshing, setRefreshing] = useState(false);
  const handleForceRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await dbClient.forceRefresh();
      runSearch(query, source);
    } catch (e) {
      console.error("DB refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, query, source, runSearch]);

  // Derive the gloss card entry from the first highlighted token in the results —
  // the same token data the word-tap popup uses, no separate query needed.
  useEffect(() => {
    const isOrigLang = source === "Heb" || source === "LXX" || source === "GNT";
    const isPhrase = (q: string) =>
      q.length >= 2 && q.startsWith('"') && q.endsWith('"');
    const isSingleWord =
      query.trim().length > 0 && !query.includes(" ") && !isPhrase(query);
    if (!isOrigLang || !isSingleWord || results.length === 0) {
      setGlossEntry(null);
      return;
    }

    const targetCorpus =
      source === "Heb" ? "WLC" : source === "LXX" ? "LXX" : "GNT";
    let token: WordToken | undefined;
    for (const r of results) {
      const section = r.originals.find((s) => s.corpus === targetCorpus);
      if (section) {
        token = section.tokens.find((t) => t.highlight);
        if (token) break;
      }
    }
    if (!token) {
      setGlossEntry(null);
      return;
    }

    let cancelled = false;
    (async () => {
      let entry: LexEntry | null = null;
      if (token!.strong) entry = await dbClient.lookup(token!.strong);
      if (!entry && token!.lemma) {
        entry = await dbClient.lookupByLemma(
          token!.lemma,
          source === "Heb" ? "Heb" : "Grk",
        );
      }
      if (!cancelled) setGlossEntry(entry);
    })();
    return () => {
      cancelled = true;
    };
  }, [source, query, results]);

  const filtered = useMemo(
    () =>
      activeBook ? results.filter((r) => r.bookAbbr === activeBook) : results,
    [results, activeBook],
  );

  const books = useMemo<BookNavItem[]>(() => {
    const seen = new Set<string>();
    const out: BookNavItem[] = [];
    const ot = results.filter((r) => r.testament === "OT");
    const nt = results.filter((r) => r.testament === "NT");
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
    // Record in history — deduplicate (remove prior occurrence of same query+source),
    // prepend, and cap at 30 entries.
    setSearchHistory((prev) => {
      const next = [
        { query: q, source: s },
        ...prev.filter((e) => !(e.query === q && e.source === s)),
      ].slice(0, 30);
      try {
        localStorage.setItem("bcv-history", JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  };

  const isLoading = dbStatus === "initializing" || dbStatus === "progress";

  return (
    <div className="device-frame">
      {/* App header */}
      <div
        style={{
          background: "var(--navy)",
          padding: "5px 14px 7px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "Playfair Display",
            fontSize: 17,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
          }}
        >
          ✞ BibleSearch
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Distribution chart (search mode only) */}
          {mode === "search" && (
            <button
              onClick={() => setShowChart((v) => !v)}
              style={{
                background: showChart ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                border: "none", borderRadius: 8, padding: "5px 8px",
                color: "#fff", fontSize: 14, cursor: "pointer",
              }}
              aria-label="Toggle distribution chart"
            >📊</button>
          )}

          {/* Mode nav: Search | Browse | Class */}
          {(["search", "browse", "class"] as const).map((m) => {
            const label = m === "search" ? "🔍" : m === "browse" ? "📖" : "📚";
            const title = m === "search" ? "Search" : m === "browse" ? "Browse" : "Class";
            return (
              <button
                key={m}
                onClick={() => {
                  if (m === "search") location.hash = "";
                  else if (m === "browse") {
                    if (browsePos) {
                      const vQ = browsePos.verse > 0 ? `?v=${browsePos.verse}` : "";
                      location.hash = `#/bcv/${browsePos.bookId}/${browsePos.chapter}${vQ}`;
                    } else {
                      location.hash = "#/browse";
                    }
                  } else {
                    location.hash = "#/class";
                  }
                }}
                title={title}
                aria-label={title}
                style={{
                  background: mode === m ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                  border: "none", borderRadius: 8, padding: "5px 8px",
                  color: "#fff", fontSize: 14, cursor: "pointer",
                  fontWeight: mode === m ? 700 : 400,
                }}
              >
                {label}
              </button>
            );
          })}

          <button
            onClick={handleForceRefresh}
            disabled={refreshing}
            title="Re-download database"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none", borderRadius: 8, padding: "5px 8px",
              color: refreshing ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)",
              fontSize: 14, cursor: refreshing ? "default" : "pointer",
              transition: "color 0.2s", display: "inline-flex",
              alignItems: "center", justifyContent: "center",
            }}
            aria-label="Re-download database"
          >
            <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span>
          </button>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>☀</span>
        </div>
      </div>

      {mode === "class" ? (
        <ClassMode
          onOpenRef={handleClassRefOpen}
          onBookmark={addBookmark}
          isBookmarked={isBookmarked}
        />
      ) : mode === "browse" ? (
        <BcvBrowser
          browsePos={browsePos}
          onNavigate={handleBrowseNavigate}
          bookmarks={bookmarks}
          onBookmark={addBookmark}
          onRemoveBookmark={removeBookmark}
          isBookmarked={isBookmarked}
          onOpenClass={() => {
            location.hash = "#/class";
          }}
          returnUrl={browseReturnUrl}
          onReturn={() => {
            if (browseReturnUrl) {
              location.hash = browseReturnUrl;
              setBrowseReturnUrl(null);
            }
          }}
        />
      ) : (
        <>
          <SearchBar
            collapsed={searchCollapsed}
            onToggle={() => setSearchCollapsed((v) => !v)}
            query={query}
            source={source}
            onGo={onGo}
          />

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="no-scrollbar"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px 10px 16px",
              background: "var(--parchment)",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "Playfair Display",
                  fontSize: 19,
                  fontWeight: 700,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                }}
              >
                {query || "—"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--ink-light)",
                  fontFamily: "DM Sans",
                }}
              >
                {isLoading
                  ? dbMessage || "Loading…"
                  : `${filtered.length} hits · ${source}`}
              </span>
              {!isLoading && results.length >= 200 && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--amber)",
                    fontFamily: "DM Sans",
                    fontWeight: 600,
                  }}
                >
                  ⚠ capped at 200
                </span>
              )}
            </div>

            {isLoading ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "var(--ink-light)",
                  fontFamily: "DM Sans",
                  fontSize: 13,
                }}
              >
                {dbMessage || "Initializing database…"}
              </div>
            ) : (
              <>
                <SearchHistory
                  history={searchHistory}
                  open={historyOpen}
                  onToggle={() => setHistoryOpen((v) => !v)}
                  onSelect={({ query: q, source: s }) => onGo(q, s)}
                  onClear={() => {
                    setSearchHistory([]);
                    try {
                      localStorage.removeItem("bcv-history");
                    } catch {
                      /* quota */
                    }
                  }}
                />
                <BookNav
                  books={books}
                  active={activeBook}
                  onSelect={setActiveBook}
                />
                <MiniChart
                  visible={showChart}
                  bars={distribution}
                  totalHits={results.length}
                />

                {glossEntry && (
                  <GlossCard
                    entry={glossEntry}
                    lang={source === "Heb" ? "Heb" : "Grk"}
                    open={glossCardOpen}
                    onToggle={() => setGlossCardOpen((v) => !v)}
                  />
                )}

                {filtered.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "var(--ink-light)",
                      fontFamily: "DM Sans",
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
                      onEngWordClick={(word) =>
                        onGo(word, ENG_SOURCES.has(source) ? source : "NASB")
                      }
                      onRefClick={(r) =>
                        setChapterView({
                          abbr3: r.bookAbbr,
                          bookName: r.book,
                          chapter: r.chapter,
                          highlightVerse: r.verse,
                          testament: r.testament,
                        })
                      }
                      onBookmark={addBookmark}
                      isBookmarked={isBookmarked}
                    />
                  ))
                )}
              </>
            )}

            <div style={{ height: 20 }} />
          </div>
        </>
      )}

      {/* Floating scroll-to-top button */}
      {showTopBtn && mode === "search" && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          style={{
            position: "fixed",
            bottom: 24,
            right: 20,
            zIndex: 50,
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--navy)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            boxShadow: "0 4px 14px rgba(0,0,0,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
        >
          ↑
        </button>
      )}

      {selectedWord && selectedLang && (
        <DefinitionSheet
          word={selectedWord}
          lang={selectedLang}
          onClose={() => setSelectedWord(null)}
          onSearch={(q, s) => {
            onGo(q, s);
            setSelectedWord(null);
          }}
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
          onSearch={(q, s) => {
            onGo(q, s);
            setChapterView(null);
          }}
          onOpenInBrowse={(bookId, chapter, verse) => {
            // Remember the class session URL so the user can return with one tap.
            if (mode === "class") setBrowseReturnUrl(location.hash);
            setChapterView(null);
            handleBrowseNavigate(bookId, chapter, verse);
          }}
          onBookmark={addBookmark}
          isBookmarked={isBookmarked}
        />
      )}
    </div>
  );
}
