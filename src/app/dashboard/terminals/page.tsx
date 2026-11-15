'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listHardware, listTerminalFleet, type TerminalFleetEntry } from '@/lib/api';
import { ChangeRequests, EditDeclaration, ForgetDevice, RegisterMini, fleetLifecycles } from './terminal-dialogs';

type Panel = { kind: 'register' } | { kind: 'declaration' | 'changes' | 'forget'; terminal: TerminalFleetEntry };

const pageSize = 100;
const button = 'btn-secondary';
const statusLabels: Record<string, string> = {
  online: 'Online', offline: 'Offline', unknown: 'Unknown', attention: 'Needs attention', unconfigured: 'Unconfigured',
};
const deviceKinds: Record<string, string> = {
  payment_terminal: 'Payment terminal', printer: 'Printer', tablet: 'Tablet',
  phone: 'Phone', computer: 'Computer', display: 'Display',
};

/** The global device inventory and Verifone provisioning requests. */
export default function TerminalFleetPage() {
  const [rows, setRows] = useState<TerminalFleetEntry[]>([]);
  const [search, setSearch] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [filters, setFilters] = useState({ q: '', restaurant_id: '' });
  const [includeForgotten, setIncludeForgotten] = useState(false);
  const [allDevices, setAllDevices] = useState(false);
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
      const params = { ...filters, offset, include_forgotten: includeForgotten };
      const result = allDevices
        ? await listHardware(params)
        : await listTerminalFleet(params);
      if (request !== generation.current) return;
      setRows('devices' in result ? result.devices : result.terminals);
      setMore(result.has_more);
    } catch {
      if (request === generation.current) setError('Could not load the inventory. Try Refresh.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [filters, offset, includeForgotten, allDevices]);

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
            Find hardware across restaurants and manage Verifone provisioning.
          </p>
        </div>
        {!allDevices && <button type="button" className="btn-primary"
          onClick={() => setPanel({ kind: 'register' })}>Register a Mini</button>}
      </header>

      <div role="group" aria-label="Inventory view" className="flex flex-wrap gap-2">
        {[false, true].map(all => <button key={String(all)} type="button" aria-pressed={allDevices === all}
          className={`${button} aria-pressed:border-gray-900 aria-pressed:bg-gray-900 aria-pressed:text-white`}
          onClick={() => { setAllDevices(all); setOffset(0); }}>
          {all ? 'All devices' : 'Payment terminals'}
        </button>)}
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        setOffset(0);
        setFilters({ q: search.trim(), restaurant_id: restaurant });
      }}>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
          Search by restaurant, device or identifier
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
        {allDevices ? 'Show forgotten devices' : 'Show forgotten terminals'}
      </label>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <p role="status" className="text-sm text-gray-600">Loading inventory…</p> : !error && (
        <div className="table-scroll" role="region" aria-label="Terminal fleet table" tabIndex={0}>
          <table className="data-table [&_td]:align-top">
            <thead>
              <tr>
                {(allDevices ? ['Device', 'Restaurant', 'Type', 'Status'] : ['Terminal', 'Restaurant', 'Fleet identifiers', 'Bank declaration', 'Status']).map(label => (
                  <th key={label} scope="col">{label}</th>
                ))}
                <th scope="col" className="text-end"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.device_id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{row.name || row.model || 'Unnamed device'}</div>
                    <div className="text-gray-600">{[row.manufacturer, row.model].filter(Boolean).join(' ')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.restaurant_name || 'Restaurant'}</div>
                    <div className="tabular-nums text-gray-600">#{row.restaurant_id}</div>
                  </td>
                  {allDevices ? <td className="px-4 py-3">{deviceKinds[row.kind ?? ''] ?? 'Other device'}</td> : <>
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
                  </>}
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
                    {!allDevices && <button className="btn-secondary min-h-8 px-3 text-xs" type="button"
                      onClick={() => setPanel({ kind: 'changes', terminal: row })}>{row.forgotten_at ? 'Change history' : 'Change requests'}</button>}
                    {!allDevices && !row.forgotten_at && <button className="block w-full whitespace-nowrap rounded px-3 py-1 text-sm underline focus-visible:outline-blue-600"
                      type="button" onClick={() => setPanel({ kind: 'declaration', terminal: row })}>Edit inventory</button>}
                    {!row.forgotten_at && <button className="block w-full whitespace-nowrap rounded px-3 py-1 text-sm text-red-700 underline focus-visible:outline-blue-600"
                      type="button" onClick={() => setPanel({ kind: 'forget', terminal: row })}>Forget device</button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={allDevices ? 5 : 6} className="p-6 text-center text-gray-600">No devices match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Inventory pages" className="flex gap-3">
        <button className={button} type="button" disabled={loading || offset === 0}
          onClick={() => setOffset(value => Math.max(0, value - pageSize))}>Previous</button>
        <button className={button} type="button" disabled={loading || !more}
          onClick={() => setOffset(value => value + pageSize)}>Next</button>
      </nav>

      {panel?.kind === 'register' && <RegisterMini onSaved={completeEdit} onClose={() => setPanel(null)} />}
      {panel?.kind === 'declaration' && <EditDeclaration terminal={panel.terminal} onSaved={completeEdit} onClose={() => setPanel(null)} />}
      {panel?.kind === 'changes' && <ChangeRequests terminal={rows.find(row => row.device_id === panel.terminal.device_id) ?? panel.terminal} onChanged={() => void load()} onClose={() => setPanel(null)} />}
      {panel?.kind === 'forget' && <ForgetDevice device={panel.terminal} onForgotten={completeEdit} onClose={() => setPanel(null)} />}
    </section>
  );
}
