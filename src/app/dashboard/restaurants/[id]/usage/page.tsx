'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { externalApiLabels, getExternalApiUsage, updateExternalApiQuotas, type ExternalApiUsage } from '@/lib/api';

/** Explicit, audited allocation changes; usage cannot be reset from this screen. */
export default function RestaurantUsagePage() {
 const { id } = useParams();
 return <RestaurantUsageWorkspace key={String(id)} rid={Number(id)} />;
}
function RestaurantUsageWorkspace({ rid }: { rid: number }) {
 const [value, setValue] = useState<ExternalApiUsage | null>(null);
 const [limits, setLimits] = useState<Record<string, string>>({});
 const [reason, setReason] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
 const [busy, setBusy] = useState(true), [attempt, setAttempt] = useState(0);
 const lock = useRef(false), alive = useRef(true);
 const dirty = !!value && value.counters.some(c => limits[c.id] !== String(c.limit));
 const valid = !!value && value.counters.every(c => /^\d+$/.test(limits[c.id] ?? '') && Number(limits[c.id]) <= 1000000);
 useEffect(() => {
  let active = true; alive.current = true; setBusy(true); setError('');
  getExternalApiUsage(rid).then(data => { if (active) { setValue(data); setLimits(Object.fromEntries(data.counters.map(c => [c.id, String(c.limit)]))); setReason(''); } }).catch(() => { if (active) setError('Usage could not be loaded. Retry to view the current allocation.'); }).finally(() => { if (active) setBusy(false); });
  return () => { active = false; alive.current = false; };
 }, [rid, attempt]);
 useEffect(() => {
  if (!dirty) return;
  const leave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
  const navigate = (e: MouseEvent) => { const a = (e.target as Element).closest?.('a[href]'); if (a instanceof HTMLAnchorElement && a.target !== '_blank' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && a.href !== location.href && !confirm('Discard unsaved quota changes?')) { e.preventDefault(); e.stopPropagation(); } };
  window.addEventListener('beforeunload', leave); document.addEventListener('click', navigate, true);
  return () => { window.removeEventListener('beforeunload', leave); document.removeEventListener('click', navigate, true); };
 }, [dirty]);
 async function save() {
  if (!value || !valid || !dirty || reason.trim().length < 3 || lock.current) return;
  lock.current = true; setBusy(true); setError(''); setNotice('');
  try { const saved = await updateExternalApiQuotas(rid, value.revision, Object.fromEntries(Object.entries(limits).map(([key,n]) => [key, Number(n)])), reason.trim()); if (alive.current) { setValue(saved); setLimits(Object.fromEntries(saved.counters.map(c => [c.id, String(c.limit)]))); setReason(''); setNotice('Allocation saved. Usage is unchanged.'); } }
  catch { if (alive.current) setError('Save was not confirmed. Reload the current allocation before retrying; another operator may have changed it.'); }
  finally { lock.current = false; if (alive.current) setBusy(false); }
 }
 return <div className="mx-auto max-w-5xl pb-12">
  <Link className="text-sm underline" href={`/dashboard/restaurants/${rid}`}>Back to restaurant #{rid}</Link>
  <div className="my-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Usage and quotas</h1><p className="mt-2 text-sm text-gray-600">Monthly restaurant allowances, renewed in UTC. Zero pauses a service.</p></div><button className="rounded-full border border-gray-300 px-5 py-2 disabled:opacity-40" disabled={busy} onClick={() => { if (!dirty || confirm('Discard changes and reload the current allocation?')) setAttempt(n => n + 1); }}>Reload</button></div>
  {error && <p role="alert" className="mb-5 text-red-700">{error}</p>}{notice && <p role="status" className="mb-5">{notice}</p>}{!value && busy && <p role="status">Loading…</p>}
  {value && <form onSubmit={e => { e.preventDefault(); void save(); }}>
   <p className="mb-5 text-sm text-gray-600">Period: {value.month}. Renews {new Date(value.resets_at).toLocaleString()}.</p>
   <div className="divide-y rounded-2xl border border-gray-200 bg-white px-6">
    {value.counters.map(c => <div className="grid items-center gap-4 py-5 sm:grid-cols-[1fr_130px_170px]" key={c.id}>
     <div><label htmlFor={c.id} className="font-semibold">{externalApiLabels[c.id] || c.id}</label><p className="mt-1 text-sm text-gray-500">{c.unit === 'shipments' ? 'Deliveries submitted, including recalculations' : c.unit === 'estimated_credits' ? 'Quarter-credit precision; distance surcharges can exceed the estimate' : c.unit === 'tiles' ? 'Tiles, not map views' : 'Outbound requests'}</p></div>
     <p className="text-sm tabular-nums">{c.used.toLocaleString()} used<br /><span className="text-gray-500">{c.requests.toLocaleString()} requests</span></p>
     <input id={c.id} aria-label={`${externalApiLabels[c.id]} monthly limit`} type="number" min={0} max={1000000} step={1} value={limits[c.id] ?? ''} disabled={busy} className="w-full rounded-lg border border-gray-300 p-3" onChange={e => { setLimits(current => ({ ...current, [c.id]: e.target.value })); setNotice(''); }} />
    </div>)}
   </div>
   <p className="mt-5 text-sm text-gray-600">Tracking since {new Date(value.tracked_since).toLocaleString()}. Earlier calls are excluded. Failed/uncertain attempts remain counted. Shared provider safeguards still apply; changing an allowance does not purchase usage or enable a provider.</p>
   <label className="mt-6 block font-medium" htmlFor="quota-reason">Reason for this change</label><input id="quota-reason" maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 p-3" />
   <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className="rounded-full border border-gray-300 px-5 py-3" disabled={busy || !value} onClick={() => setLimits(Object.fromEntries(value.counters.map(c => [c.id, String(c.default_limit)])))}>Use default allowances</button><button type="submit" disabled={busy || !dirty || !valid || reason.trim().length < 3} className="rounded-full bg-black px-6 py-3 font-semibold text-white disabled:opacity-40">Save allocation</button></div>
  </form>}
 </div>;
}
