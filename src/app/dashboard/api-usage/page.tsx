'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { externalApiLabels, listExternalApiUsage } from '@/lib/api';

/** Shows restaurant allowances for one provider service at a time. */
export default function PlatformUsagePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listExternalApiUsage>> | null>(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [service, setService] = useState('google_optimization_single');

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(false);
    setData(null);
    listExternalApiUsage(page)
      .then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [page, attempt]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="page-title">Usage and quotas</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Restaurant allowances across the current environment. Provider-wide protection remains additional.
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Service
          <select className="field font-normal" value={service} onChange={event => setService(event.target.value)}>
            {Object.entries(externalApiLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAttempt(n => n + 1)}>Reload</button>
      </div>

      {error && (
        <div className="error-notice flex flex-wrap items-center justify-between gap-3">
          <p role="alert">Usage could not be loaded.</p>
          <button type="button" className="btn-secondary" onClick={() => setAttempt(n => n + 1)}>Retry</button>
        </div>
      )}
      {busy && <p role="status" className="text-sm text-[var(--fg-muted)]">Loading usage…</p>}

      {data && (
        <>
          <div className="table-scroll" role="region" aria-label="Usage and quotas table" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Restaurant</th>
                  <th scope="col" className="text-end">Used</th>
                  <th scope="col" className="text-end">Monthly limit</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.restaurants.map(row => {
                  const counter = row.usage.counters.find(entry => entry.id === service);
                  return (
                    <tr key={row.id}>
                      <th scope="row" className="font-semibold">
                        {row.name}
                        <span className="block text-xs font-normal text-[var(--fg-muted)]">#{row.id} · {row.usage.month}</span>
                      </th>
                      <td className="text-end tabular-nums">{counter?.used.toLocaleString() ?? '—'}</td>
                      <td className="text-end tabular-nums">{counter?.limit.toLocaleString() ?? '—'}</td>
                      <td className="whitespace-nowrap">
                        {!counter ? '—' : counter.status === 'exhausted' ? 'Limit reached' : counter.status === 'warning' ? 'Over 80%' : 'Available'}
                      </td>
                      <td className="text-end">
                        <Link className="btn-secondary min-h-8 px-3 text-xs" href={`/dashboard/restaurants/${row.id}/usage`}>Review allocation</Link>
                      </td>
                    </tr>
                  );
                })}
                {data.restaurants.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-[var(--fg-muted)]">No restaurants.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <nav aria-label="Usage pages" className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" disabled={busy || page === 1} className="btn-secondary" onClick={() => setPage(n => n - 1)}>Previous</button>
            <p className="text-sm text-[var(--fg-muted)]">Page {page} · {data.total} restaurants</p>
            <button type="button" disabled={busy || page * data.page_size >= data.total} className="btn-secondary" onClick={() => setPage(n => n + 1)}>Next</button>
          </nav>
        </>
      )}
    </section>
  );
}
