'use client';

import { useState } from 'react';
import { MFASettings } from '@/components/MFASettings';
import { getConnectionJournal, type ConnectionJournalEntry } from '@/lib/api';

/** Platform-only connection history; dates and actor metadata stay in memory. */
export default function SecurityPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entries, setEntries] = useState<ConnectionJournalEntry[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Account security</h1>
    <MFASettings />
    <section className="space-y-4 rounded-xl border bg-white p-5" data-sentry-mask data-private>
      <h2 className="text-lg font-semibold">Connection journal</h2>
      <p>After activation, encrypted records are retained for at least 12 months. Reading this journal is recorded. Select up to 31 days and narrow the interval if it exceeds 1,000 entries.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={async event => {
        event.preventDefault(); if (busy) return; setBusy(true); setError(''); setEntries(null);
        try { const result = await getConnectionJournal(new Date(from).toISOString(), new Date(to).toISOString()); setEntries(result.entries); }
        catch { setError('Journal unavailable. Check your second-factor sign-in and choose a smaller interval.'); }
        finally { setBusy(false); }
      }}>
        <label>From (local time)<input required type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} className="block rounded border p-2" /></label>
        <label>Until (excluded)<input required type="datetime-local" value={to} onChange={e => setTo(e.target.value)} className="block rounded border p-2" /></label>
        <button disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Reading…' : 'Read journal'}</button>
      </form>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      {entries?.length === 0 ? <p>No records in this interval.</p> : null}
      {entries && entries.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Time', 'Action', 'Outcome', 'Account', 'Address', 'Retained until'].map(label => <th className="p-2 text-left" key={label}>{label}</th>)}</tr></thead><tbody>
        {entries.map(entry => <tr className="border-t" key={entry.id}><td className="p-2">{new Date(entry.occurred_at).toLocaleString()}</td><td>{entry.action}</td><td>{entry.outcome}</td><td>{entry.user_id ?? '—'}</td><td>{entry.address ?? '—'}</td><td>{new Date(entry.retain_until).toLocaleString()}</td></tr>)}
      </tbody></table></div> : null}
    </section>
  </div>;
}
