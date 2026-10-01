import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './config';
import type { CrowdEstimate, CrowdLevel } from '../../shared/crowd';
export default function Crowd({ placeId }: { placeId: string }) {
  const [estimate, setEstimate] = useState<CrowdEstimate | null>(null);
  const [message, setMessage] = useState('Loading crowd history…'); const [busy, setBusy] = useState(false);
  const reportAbort = useRef<AbortController | null>(null);
  useEffect(() => () => reportAbort.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await Promise.resolve(); if (controller.signal.aborted) return;
      try {
        const response = await fetch(`${API_BASE_URL}/crowd?${new URLSearchParams({ placeId })}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setEstimate(data); setMessage(''); }
      } catch { if (!controller.signal.aborted) setMessage('Crowd history unavailable. Try reopening this spot.'); }
    }
    void load(); return () => controller.abort();
  }, [placeId]);
  async function report(level: CrowdLevel) {
    if (busy) return; const controller = new AbortController(); reportAbort.current = controller;
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/crowd`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placeId, level }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted) { setEstimate(data); setMessage('Report saved. Thanks for the crowd check!'); }
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Report not sent.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section aria-label="Crowd prediction"><h3>Crowd check</h3>
    {estimate && <p>{estimate.percentage === null ? 'Not enough data yet.' : `${estimate.percentage}% estimated chance of a busy visit now.`} {estimate.samples} matching reports across {estimate.dates} dates.</p>}
    <p className="location-note">Based on voluntary reports from the past 90 days, same weekday and nearby hours (IST). Needs 15 reports across 3 dates. This is a historical busy rate, not live occupancy; crowds can change.</p>
    <details><summary>Here now? Share a crowd report</summary><p className="location-note">Only report what you see. Reports are public in aggregate. A daily network hash limits duplicates; records expire after 90 days. Shared networks may share the daily limit.</p>
      {(['quiet', 'moderate', 'busy'] as const).map(level => <button key={level} disabled={busy} onClick={() => void report(level)}>{level[0].toUpperCase() + level.slice(1)}</button>)}
    </details><p role="status">{message}</p>
  </section>;
}
