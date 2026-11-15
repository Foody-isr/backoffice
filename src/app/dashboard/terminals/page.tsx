'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listTerminalFleet, type TerminalFleetEntry } from '@/lib/api';
import { ChangeRequests, EditDeclaration, RegisterMini, fleetLifecycles } from './terminal-dialogs';

type Panel = { kind: 'register' } | { kind: 'declaration' | 'changes'; terminal: TerminalFleetEntry };

const pageSize = 100;
const button = 'btn-secondary';
const statusLabels: Record<string, string> = {
  online: 'Online', offline: 'Offline', unknown: 'Unknown', attention: 'Needs attention', unconfigured: 'Unconfigured',
};

/** The global Verifone fleet and its provisioning requests. */
export default function TerminalFleetPage() {
  const [rows, setRows] = useState<TerminalFleetEntry[]>([]);
  const [search, setSearch] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [filters, setFilters] = useState({ q: '', restaurant_id: '' });
  const [includeForgotten, setIncludeForgotten] = useState(false);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await listTerminalFleet({ ...filters, offset, include_forgotten: includeForgotten });
      if (request !== generation.current) return;
      setRows(result.terminals);
      setMore(result.has_more);
    } catch {
      if (request === generation.current) setError('Could not load the terminal fleet. Try Refresh.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [filters, offset, includeForgotten]);

  useEffect(() => {
    const generationRef = generation;
    void load();
    return () => { generationRef.current++; };
  }, [load]);

  function completeEdit() {
    setPanel(null);
    void load();
  }

  return (
    <section className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Terminal fleet</h1>
          <p className="mt-2 max-w-prose text-sm text-gray-600">
            Find payment terminals across restaurants and prepare changes for Verifone provisioning.
          </p>
        </div>
        <button type="button" className="btn-primary"
          onClick={() => setPanel({ kind: 'register' })}>Register a Mini</button>
      </header>

      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        setOffset(0);
        setFilters({ q: search.trim(), restaurant_id: restaurant });
      }}>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
          Search by restaurant, terminal or identifier
          <input className="field" value={search} maxLength={100}
            onChange={event => setSearch(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Restaurant ID
          <input className="field w-36" inputMode="numeric"
            pattern="[1-9][0-9]*" maxLength={10} value={restaurant} onChange={event => setRestaurant(event.target.value)} />
        </label>
        <button className={button} type="submit">Search</button>
        <button className={button} type="button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </form>

      <label className="flex w-fit items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={includeForgotten} onChange={event => {
          setIncludeForgotten(event.target.checked);
          setOffset(0);
        }} />
        Show forgotten terminals
      </label>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <p role="status" className="text-sm text-gray-600">Loading terminals…</p> : !error && (
        <div className="table-scroll" role="region" aria-label="Terminal fleet table" tabIndex={0}>
          <table className="data-table [&_td]:align-top">
            <thead>
              <tr>
                {['Terminal', 'Restaurant', 'Fleet identifiers', 'Bank declaration', 'Status'].map(label => (
                  <th key={label} scope="col">{label}</th>
                ))}
                <th scope="col" className="text-end"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.device_id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    <div className="text-gray-600">{[row.manufacturer, row.model].filter(Boolean).join(' ')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.restaurant_name || 'Restaurant'}</div>
                    <div className="tabular-nums text-gray-600">#{row.restaurant_id}</div>
                  </td>
                  <td className="space-y-1 px-4 py-3 tabular-nums">
                    <div>Serial <span className="font-medium">{row.metadata?.serial_number || '—'}</span></div>
                    <div>DID / VHQ <span className="font-medium">{row.metadata?.did || '—'}</span></div>
                  </td>
                  <td className="space-y-1 px-4 py-3 tabular-nums">
                    <div>SHVA <span className="font-medium">{row.metadata?.shva_terminal_id || '—'}</span></div>
                    {row.metadata?.ashrait_terminal_id && row.metadata.ashrait_terminal_id !== row.metadata.shva_terminal_id &&
                      <div>Ashrait login <span className="font-medium">{row.metadata.ashrait_terminal_id}</span></div>}
                    <div>Supplier <span className="font-medium">{row.metadata?.supplier_id || '—'}</span></div>
                    {row.metadata?.acquirer && <div className="text-gray-600">{row.metadata.acquirer}</div>}
                  </td>
                  <td className="space-y-1 px-4 py-3">
                    <div>{row.forgotten_at ? 'Forgotten' : statusLabels[row.status] ?? 'Unknown'}</div>
                    {row.metadata && <div className="text-gray-600">{fleetLifecycles[row.metadata.lifecycle]}</div>}
                    {row.metadata?.configuration_state === 'verified_cst' && <div className="text-xs text-gray-600">Verified in CST</div>}
                    {row.prepared_change_id && <div className="inline-block rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950">Change prepared</div>}
                    {row.last_seen_at && <time className="block text-xs text-gray-600" dateTime={row.last_seen_at}>
                      {new Date(row.last_seen_at).toLocaleString()}
                    </time>}
                  </td>
                  <td className="space-y-2 px-4 py-3 text-right">
                    <button className="btn-secondary min-h-8 px-3 text-xs" type="button"
                      onClick={() => setPanel({ kind: 'changes', terminal: row })}>Change requests</button>
                    <button className="block w-full whitespace-nowrap rounded px-3 py-1 text-sm underline focus-visible:outline-blue-600"
                      type="button" onClick={() => setPanel({ kind: 'declaration', terminal: row })}>Edit inventory</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-600">No terminals match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Terminal pages" className="flex gap-3">
        <button className={button} type="button" disabled={loading || offset === 0}
          onClick={() => setOffset(value => Math.max(0, value - pageSize))}>Previous</button>
        <button className={button} type="button" disabled={loading || !more}
          onClick={() => setOffset(value => value + pageSize)}>Next</button>
      </nav>

      {panel?.kind === 'register' && <RegisterMini onSaved={completeEdit} onClose={() => setPanel(null)} />}
      {panel?.kind === 'declaration' && <EditDeclaration terminal={panel.terminal} onSaved={completeEdit} onClose={() => setPanel(null)} />}
      {panel?.kind === 'changes' && <ChangeRequests terminal={rows.find(row => row.device_id === panel.terminal.device_id) ?? panel.terminal} onChanged={() => void load()} onClose={() => setPanel(null)} />}
    </section>
  );
}
