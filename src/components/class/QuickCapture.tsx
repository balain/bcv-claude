// ============================================================================
// QuickCapture.tsx — single-bar input that routes by prefix.
//
// Prefixes (matching the design plan):
//   ??text  → opens a follow-up prefilled with text   (Phase 2; for now stored as note with marker)
//   #tag    → tags the session with topic              (Phase 2; for now stored as note with marker)
//   !text   → free-form note                           (Phase 2; for now stored as note with marker)
//   <ref>   → parses as a scripture ref → ScriptureRef
//
// In Phase 1, only the ref path is fully wired; the others surface as a
// pending-feature toast so capture during class still feels responsive.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { getClassClient } from '../../lib/class/client.ts';
import { parseRefs, type ParseContext } from '../../lib/class/refParser.ts';

interface Props {
  sessionId: number;
  /** Called whenever a successful capture lands; parent triggers a reload. */
  onCaptured: () => void;
}

export function QuickCapture({ sessionId, onCaptured }: Props) {
  const client = getClassClient();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const ctxRef = useRef<ParseContext>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on mount and after each capture
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit() {
    const raw = value.trim();
    if (!raw) return;
    setBusy(true); setErr(null); setHint(null);

    try {
      if (raw.startsWith('??')) {
        setHint('Follow-ups land in Phase 2. Stash this in a note for now?');
        return;
      }
      if (raw.startsWith('#')) {
        setHint('Topic tagging lands in Phase 2.');
        return;
      }
      if (raw.startsWith('!')) {
        setHint('Free-form notes land in Phase 2.');
        return;
      }

      // Try parsing as a ref; preview only (so we can update context after the worker insert)
      const preview = parseRefs(raw, ctxRef.current);
      if (preview.refs.length === 0) {
        setErr(preview.errors[0] ?? `couldn't parse "${raw}"`);
        return;
      }

      // Worker-side parsing repeats — but worker doesn't have running context.
      // For Phase 1 we send rawInput and let the worker re-parse without context;
      // a continuation like "30" needs to be resolved client-side to a complete
      // ref string before sending. Compose canonical text from the preview:
      const canonical = preview.refs
        .map((r) => {
          if (r.verseStart == null) return `${r.bookName} ${r.chapter}`;
          if (r.verseEnd == null) return `${r.bookName} ${r.chapter}:${r.verseStart}`;
          return `${r.bookName} ${r.chapter}:${r.verseStart}-${r.verseEnd}`;
        })
        .join('; ');

      await client.ref.add(sessionId, canonical);
      ctxRef.current = preview.context;
      setValue('');
      onCaptured();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="class-capture">
      <input
        ref={inputRef}
        className="class-capture-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Rom 8:28 / Phil 2:5-8 / Heb 4:12; Jn 1:1"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="send"
        disabled={busy}
        aria-label="quick capture"
      />
      <button
        className="class-capture-go"
        onClick={submit}
        disabled={busy || !value.trim()}
      >
        Add
      </button>
      {err && <div className="class-capture-err">{err}</div>}
      {hint && <div className="class-capture-hint">{hint}</div>}
    </div>
  );
}
