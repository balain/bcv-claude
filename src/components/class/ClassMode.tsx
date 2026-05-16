// ============================================================================
// ClassMode.tsx — top-level mode shell.
//
// Renders SessionList by default; renders SessionView when a session is open.
// Hash-routed: #/class lists; #/class/<id> opens a session.
// ============================================================================

import { useEffect, useState } from 'react';
import { SessionList } from './SessionList.tsx';
import { SessionView } from './SessionView.tsx';
import { BackupBanner } from './BackupBanner.tsx';

function readActiveIdFromHash(): number | null {
  const m = /^#\/class\/(\d+)/.exec(window.location.hash);
  return m ? Number(m[1]) : null;
}

function setActiveIdInHash(id: number | null): void {
  const next = id === null ? '#/class' : `#/class/${id}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

interface Props {
  onOpenRef: (bookId: number, chapter: number, verse: number) => void;
}

export function ClassMode({ onOpenRef }: Props) {
  const [activeId, setActiveId] = useState<number | null>(readActiveIdFromHash);

  useEffect(() => {
    const onHash = () => setActiveId(readActiveIdFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openSession = (id: number) => {
    setActiveIdInHash(id);
    setActiveId(id);
  };
  const closeSession = () => {
    setActiveIdInHash(null);
    setActiveId(null);
  };

  return (
    <div className="class-mode">
      <BackupBanner />
      {activeId === null ? (
        <SessionList onOpen={openSession} />
      ) : (
        <SessionView sessionId={activeId} onBack={closeSession} onOpenRef={onOpenRef} />
      )}
    </div>
  );
}
