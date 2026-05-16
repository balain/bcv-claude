// ============================================================================
// BackupBanner.tsx — reminder to export when class.db hasn't been backed up
// recently. Sized against iOS Safari's ~30-day PWA storage eviction window:
//   - banner appears at 14 days idle (gives 16 days of slack)
//   - "soon" warning escalates at 21 days idle
//
// Reads `last_export_at` from _meta. The SessionView export flow stamps that
// key after every successful export. Dismiss does NOT update the timestamp;
// it sets a separate `backup_banner_dismissed_until` key, so the banner
// re-appears at the next escalation threshold.
// ============================================================================

import { useEffect, useState } from 'react';
import { getClassClient } from '../../lib/class/client.ts';

const DAYS = 24 * 60 * 60 * 1000;
const REMIND_THRESHOLD_DAYS = 14;
const URGENT_THRESHOLD_DAYS = 21;
// iOS Safari PWA storage eviction window after which OPFS may be cleared.
const EVICTION_WINDOW_DAYS  = 30;

type Severity = 'none' | 'remind' | 'urgent';

function severity(daysSinceExport: number, daysSinceDismiss: number): Severity {
  if (daysSinceExport < REMIND_THRESHOLD_DAYS) return 'none';
  if (daysSinceExport < URGENT_THRESHOLD_DAYS) {
    // Honor a fresh dismiss only at the lower severity tier.
    return daysSinceDismiss < 3 ? 'none' : 'remind';
  }
  // Urgent tier: dismiss only suppresses for 1 day.
  return daysSinceDismiss < 1 ? 'remind' : 'urgent';
}

function daysBetween(now: Date, isoDate: string | null): number {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - t) / DAYS);
}

export function BackupBanner() {
  const client = getClassClient();
  const [sev, setSev] = useState<Severity>('none');
  const [daysIdle, setDaysIdle] = useState<number>(0);

  async function refresh() {
    try {
      const lastExport = await client.meta.get('last_export_at');
      const lastDismiss = await client.meta.get('backup_banner_dismissed_at');
      const now = new Date();
      const dExport  = daysBetween(now, lastExport);
      const dDismiss = daysBetween(now, lastDismiss);
      setDaysIdle(Number.isFinite(dExport) ? dExport : EVICTION_WINDOW_DAYS);
      setSev(severity(dExport, dDismiss));
    } catch {
      // class.db not initialized yet (first load) — stay silent
      setSev('none');
    }
  }

  useEffect(() => {
    refresh();
    // Re-check when the window regains focus (you came back to the laptop)
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function dismiss() {
    await client.meta.set('backup_banner_dismissed_at', new Date().toISOString());
    setSev('none');
  }

  if (sev === 'none') return null;

  const idleLabel = Number.isFinite(daysIdle)
    ? `${daysIdle} days since your last export`
    : 'no exports on record';

  return (
    <div className={`class-backup-banner sev-${sev}`} role="status">
      <div className="class-backup-banner-text">
        {sev === 'urgent' ? (
          <>
            <strong>Back up class.db now.</strong>{' '}
            iOS Safari may clear PWA storage after ~{EVICTION_WINDOW_DAYS} days
            of inactivity. {idleLabel}.
          </>
        ) : (
          <>
            <strong>Time to back up.</strong>{' '}
            {idleLabel}. Open any session and tap <em>Export</em> to save a JSON file.
          </>
        )}
      </div>
      <button onClick={dismiss} className="class-backup-banner-dismiss" aria-label="dismiss">
        ×
      </button>
    </div>
  );
}
