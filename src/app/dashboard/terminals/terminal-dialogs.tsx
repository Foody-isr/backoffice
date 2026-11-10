'use client';

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import {
  authorizeTerminalFleetCST, cancelTerminalFleetChange, listRestaurants, listTerminalFleet, listTerminalFleetChanges,
  prepareTerminalFleetChange, registerFleetMini, reviewTerminalFleetCST, stageTerminalFleetVHQ, updateTerminalFleet,
  type Restaurant, type TerminalFleetChange, type TerminalFleetChangeInput, type TerminalFleetDeclaration,
  type TerminalFleetEntry, type TerminalFleetParameters,
} from '@/lib/api';

export const fleetLifecycles = {
  in_service: 'In service', repair: 'Under repair', returned: 'Returned', quarantine: 'Quarantined',
};

const changeKinds = { configure: 'Change bank configuration', replace: 'Replace hardware', reassign: 'Reassign to another restaurant' };
const closedChangeStates = { cancelled: 'Cancelled', verified_cst: 'Verified in CST', verified_unchanged: 'Verified unchanged' };
const commandStates = {
  authorized: 'Authorized · waiting for the POS', dispatching: 'Claimed · awaiting result',
  confirmed: 'Command acknowledged', not_started: 'Not sent', uncertain: 'Result to verify',
};
const bankFields = [
  ['did', 'DID', 80],
  ['shva_terminal_id', 'SHVA terminal number', 10],
  ['ashrait_terminal_id', 'Ashrait provisioning ID', 10],
  ['supplier_id', 'Supplier number', 80],
  ['acquirer', 'Acquirer', 80],
] as const;
const inputStyle = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-blue-600';
const action = 'rounded-full border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:outline-blue-600 disabled:opacity-40';
const primary = 'rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white focus-visible:outline-blue-600 disabled:opacity-40';
const identifierPattern = '[A-Za-z0-9_.:\\-]{1,80}';

function parametersFrom(metadata?: TerminalFleetEntry['metadata']): TerminalFleetParameters {
  return {
    did: metadata?.did ?? '',
    shva_terminal_id: metadata?.shva_terminal_id ?? '',
    ashrait_terminal_id: metadata?.ashrait_terminal_id ?? '',
    supplier_id: metadata?.supplier_id ?? '',
    acquirer: metadata?.acquirer ?? '',
  };
}

function Dialog({ title, busy, onClose, children }: {
  title: string; busy: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl bg-white text-gray-900 shadow-xl backdrop:bg-gray-900/50"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
        <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
        <button className={action} type="button" disabled={busy} onClick={onClose}>Close</button>
      </header>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </dialog>
  );
}

function ErrorText({ message }: { message: string }) {
  return message ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{message}</p> : null;
}

function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
    {label}<input className={inputStyle} {...props} />
  </label>;
}

function BankFields({ value, onChange, required = false, disabled = false }: {
  value: TerminalFleetParameters; onChange: (value: TerminalFleetParameters) => void; required?: boolean; disabled?: boolean;
}) {
  return <div className="grid gap-4 sm:grid-cols-2">
    {bankFields.map(([key, label, length]) => (
      <Field key={key} label={label} value={value[key]} maxLength={length} required={required} disabled={disabled}
        inputMode={length === 10 ? 'numeric' : 'text'}
        pattern={length === 10 ? '[0-9]{10}' : key === 'acquirer' ? undefined : identifierPattern}
        onChange={event => onChange({ ...value, [key]: event.target.value })} />
    ))}
  </div>;
}

function RestaurantSelect({ value, onChange, exclude, disabled }: {
  value: string; onChange: (value: string) => void; exclude?: number; disabled: boolean;
}) {
  const [restaurants, setRestaurants] = useState<Pick<Restaurant, 'id' | 'name'>[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  useEffect(() => {
    let current = true;
    listRestaurants().then(result => {
      if (!current) return;
      setRestaurants(result.restaurants.map(({ id, name }) => ({ id, name })));
      setStatus('loaded');
    }).catch(() => { if (current) setStatus('failed'); });
    return () => { current = false; };
  }, []);
  return <label className="flex flex-col gap-1 text-sm font-medium">
    {exclude ? 'Destination restaurant' : 'Restaurant'}
    <select className={inputStyle} required disabled={disabled || status !== 'loaded'} value={value}
      onChange={event => onChange(event.target.value)}>
      <option value="">{status === 'loading' ? 'Loading restaurants…' : 'Select a restaurant'}</option>
      {restaurants.filter(restaurant => restaurant.id !== exclude).map(restaurant => (
        <option key={restaurant.id} value={restaurant.id}>{restaurant.name} (#{restaurant.id})</option>
      ))}
    </select>
    {status === 'failed' && <span role="alert" className="text-red-800">Could not load restaurants. Close and reopen this form to retry.</span>}
  </label>;
}

/** Registers a Mini absent from Foody's payment-terminal inventory. */
export function RegisterMini({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [serial, setSerial] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (saving || !restaurant) return;
    setSaving(true);
    setError('');
    try {
      await registerFleetMini({ name: name.trim(), serial_number: serial.trim(), restaurant_id: Number(restaurant) });
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not register the Mini.');
    } finally {
      setSaving(false);
    }
  }

  return <Dialog title="Register a Mini" busy={saving} onClose={onClose}>
    <p className="max-w-prose text-sm text-gray-600">Use the serial printed on the device. This adds an unconfigured inventory entry. Pair the Mini from FoodyPOS when it is ready.</p>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <RestaurantSelect value={restaurant} onChange={setRestaurant} disabled={saving} />
      <Field label="Terminal name" value={name} maxLength={80} required disabled={saving} onChange={event => setName(event.target.value)} />
      <Field label="Physical serial number" value={serial} pattern={identifierPattern} maxLength={80} required disabled={saving}
        onChange={event => setSerial(event.target.value)} />
      <ErrorText message={error} />
      <button className={primary} disabled={saving || !restaurant} type="submit">{saving ? 'Registering…' : 'Register Mini'}</button>
    </form>
  </Dialog>;
}

/** Edits the declared identity and lifecycle of a registered terminal. */
export function EditDeclaration({ terminal, onSaved, onClose }: {
  terminal: TerminalFleetEntry; onSaved: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<TerminalFleetDeclaration>(() => ({
    ...parametersFrom(terminal.metadata),
    revision: terminal.metadata?.revision ?? 0,
    serial_number: terminal.metadata?.serial_number ?? '',
    vhq_device_uid: terminal.metadata?.vhq_device_uid ?? '',
    lifecycle: terminal.metadata?.lifecycle ?? 'in_service',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await updateTerminalFleet(terminal.device_id, draft);
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the inventory details.');
    } finally {
      setSaving(false);
    }
  }

  return <Dialog title={`Edit inventory for ${terminal.name}`} busy={saving} onClose={onClose}>
    <p className="max-w-prose text-sm text-gray-600">Save the identifiers declared for this terminal. Use Change requests to record a proposed bank or assignment change.</p>
    <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="grid gap-4 border-b border-gray-200 pb-5 sm:grid-cols-2">
        <Field label="Physical serial number" value={draft.serial_number} maxLength={80} pattern={identifierPattern}
          readOnly={terminal.serial_locked} disabled={saving}
          onChange={event => setDraft({ ...draft, serial_number: event.target.value })} />
        <Field label="VHQ deviceUid" value={draft.vhq_device_uid} maxLength={10} inputMode="numeric"
          pattern="[1-9][0-9]{0,9}" disabled={saving}
          onChange={event => setDraft({ ...draft, vhq_device_uid: event.target.value })} />
      </div>
      <BankFields value={draft} onChange={value => setDraft({ ...draft, ...value })} disabled={saving} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Declared lifecycle
        <select className={inputStyle} value={draft.lifecycle} disabled={saving}
          onChange={event => setDraft({ ...draft, lifecycle: event.target.value as TerminalFleetDeclaration['lifecycle'] })}>
          {Object.entries(fleetLifecycles).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <ErrorText message={error} />
      <button className={primary} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save declaration'}</button>
    </form>
  </Dialog>;
}

function ReplacementSelect({ terminal, value, onChange, disabled }: {
  terminal: TerminalFleetEntry; value: TerminalFleetEntry | null; onChange: (entry: TerminalFleetEntry | null) => void; disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ query: '' });
  const [candidates, setCandidates] = useState<TerminalFleetEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    let current = true;
    setStatus('loading');
    listTerminalFleet({ restaurant_id: String(terminal.restaurant_id), q: filter.query }).then(result => {
      if (!current) return;
      setCandidates(result.terminals.filter(candidate => candidate.device_id !== terminal.device_id &&
        !candidate.forgotten_at && !candidate.prepared_change_id && candidate.metadata?.serial_number &&
        candidate.metadata.lifecycle !== 'repair' && candidate.metadata.lifecycle !== 'returned' &&
        candidate.metadata.serial_number.toUpperCase() !== terminal.metadata?.serial_number.toUpperCase()));
      setStatus('loaded');
    }).catch(() => { if (current) setStatus('failed'); });
    return () => { current = false; };
  }, [terminal, filter]);

  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-44 flex-1">
        <Field label="Find a replacement by name or serial" value={search} disabled={disabled} maxLength={100}
          onChange={event => setSearch(event.target.value)} />
      </div>
      <button className={action} type="button" disabled={disabled}
        onClick={() => { onChange(null); setFilter({ query: search.trim() }); }}>Search</button>
    </div>
    <label className="flex flex-col gap-1 text-sm font-medium">
      Replacement terminal
      <select className={inputStyle} required value={value?.device_id ?? ''} disabled={disabled || status !== 'loaded'}
        onChange={event => onChange(candidates.find(candidate => candidate.device_id === event.target.value) ?? null)}>
        <option value="">{status === 'loading' ? 'Loading terminals…' : 'Select a replacement'}</option>
        {candidates.map(candidate => (
          <option key={candidate.device_id} value={candidate.device_id}>{candidate.name} ({candidate.metadata?.serial_number})</option>
        ))}
      </select>
    </label>
    {status === 'loaded' && candidates.length === 0 &&
      <p className="text-sm text-gray-600">No eligible replacement found. Register its serial in this restaurant and reopen the request.</p>}
    {status === 'failed' && <ErrorText message="Could not load replacement terminals." />}
  </div>;
}

function ChangeForm({ terminal, busy, onPrepare }: {
  terminal: TerminalFleetEntry; busy: boolean; onPrepare: (input: TerminalFleetChangeInput) => Promise<void>;
}) {
  const canConfigure = !terminal.forgotten_at && (terminal.metadata?.lifecycle === 'in_service' || terminal.metadata?.lifecycle === 'quarantine');
  const canReassign = terminal.metadata?.lifecycle === 'returned';
  const [kind, setKind] = useState<TerminalFleetChangeInput['kind']>(canConfigure ? 'configure' : canReassign ? 'reassign' : 'replace');
  const [requested, setRequested] = useState<TerminalFleetParameters>(() => parametersFrom(kind === 'configure' ? terminal.metadata : undefined));
  const [replacement, setReplacement] = useState<TerminalFleetEntry | null>(null);
  const [destination, setDestination] = useState('');
  const requestId = useRef<string | null>(null);
  const ready = kind === 'replace' ? Boolean(replacement?.metadata) : kind !== 'reassign' || Boolean(destination);

  function chooseKind(next: TerminalFleetChangeInput['kind']) {
    setKind(next);
    setRequested(parametersFrom(next === 'configure' ? terminal.metadata : undefined));
  }

  async function submit() {
    if (!terminal.metadata || !ready || busy) return;
    requestId.current ??= crypto.randomUUID();
    await onPrepare({
      request_id: requestId.current, source_revision: terminal.metadata.revision, kind, requested,
      ...(kind === 'replace' && replacement?.metadata ? {
        target_device_id: replacement.device_id, target_revision: replacement.metadata.revision,
      } : {}),
      ...(kind === 'reassign' ? { target_restaurant_id: Number(destination) } : {}),
    });
  }

  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <label className="flex flex-col gap-1 text-sm font-medium">
      Change type
      <select className={inputStyle} value={kind} disabled={busy}
        onChange={event => chooseKind(event.target.value as TerminalFleetChangeInput['kind'])}>
        <option value="configure" disabled={!canConfigure}>{changeKinds.configure}</option>
        <option value="replace">{changeKinds.replace}</option>
        <option value="reassign" disabled={!canReassign}>{changeKinds.reassign}</option>
      </select>
    </label>
    {!canReassign && <p className="text-sm text-gray-600">To plan a transfer, record the terminal as Returned in its inventory details.</p>}
    {kind === 'replace' && <ReplacementSelect terminal={terminal} value={replacement} onChange={setReplacement} disabled={busy} />}
    {kind === 'reassign' && <RestaurantSelect value={destination} onChange={setDestination} exclude={terminal.restaurant_id} disabled={busy} />}
    <fieldset className="space-y-3 border-t border-gray-200 pt-4">
      <legend className="pr-2 text-sm font-semibold">Requested identifiers</legend>
      <BankFields value={requested} onChange={setRequested} disabled={busy} required />
    </fieldset>
    <button className={primary} type="submit" disabled={busy || !ready}>{busy ? 'Saving…' : 'Prepare change'}</button>
  </form>;
}

function ChangeSummary({ change, restaurantName }: { change: TerminalFleetChange; restaurantName: string }) {
  return <div className="space-y-4 text-sm">
    <p className="text-gray-700">
      {change.source_serial_number} → {change.target_serial_number} in {
        change.restaurant_id === change.target_restaurant_id ? restaurantName : `restaurant #${change.target_restaurant_id}`
      }
      {change.target_vhq_device_uid && ` · VHQ deviceUid ${change.target_vhq_device_uid}`}
    </p>
    <dl className="grid grid-cols-2 gap-4 border-y border-gray-200 py-3">
      {([['Target declaration at preparation', change.target_before], ['Requested', change.requested]] as const).map(([heading, values]) => (
        <div key={heading} className="min-w-0 space-y-2">
          <dt className="font-semibold">{heading}</dt>
          <dd className="space-y-1 tabular-nums">
            {bankFields.map(([key, label]) => (
              <div key={key} className="break-words"><span className="text-gray-600">{label} </span>{values[key] || '—'}</div>
            ))}
          </dd>
        </div>
      ))}
    </dl>
    {change.kind === 'replace' && <details className="space-y-2">
      <summary className="cursor-pointer font-medium">Original terminal declaration</summary>
      <dl className="grid gap-2 sm:grid-cols-2">
        {bankFields.map(([key, label]) => <div key={key} className="break-words">
          <dt className="text-gray-600">{label}</dt>
          <dd className="tabular-nums">{change.source[key] || '—'}</dd>
        </div>)}
      </dl>
    </details>}
    <p className="break-all text-xs text-gray-600">Request {change.id}</p>
    <p className="text-xs text-gray-600">
      Prepared by #{change.created_by} · {new Date(change.created_at).toLocaleString()}
      {change.cancelled_at && ` · Cancelled by #${change.cancelled_by} · ${new Date(change.cancelled_at).toLocaleString()}`}
    </p>
    {change.attempts && change.attempts.length > 0 && <ul className="space-y-3">
      {change.attempts.map(attempt => (
        <li key={attempt.id} className="rounded-lg border border-gray-200 px-3 py-2">
          <p className="font-medium">{attempt.command === 'UpdateVHQSHVA' ? 'SHVA number in VHQ' : attempt.command}</p>
          <p className="text-gray-700">{attempt.state === 'authorized' && change.state !== 'prepared'
            ? 'Not sent · request closed'
            : attempt.command === 'UpdateVHQSHVA' && attempt.state === 'confirmed'
              ? 'Value confirmed in VHQ'
              : commandStates[attempt.state]}</p>
          {attempt.state === 'authorized' && change.state === 'prepared' && (
            attempt.remote
              ? <p className="text-sm text-gray-600">Keep FoodyPOS open on the connected terminal or iPad. Unclaimed commands expire after 15 minutes.</p>
              : <Field label="Authorization reference for FoodyPOS" value={attempt.id} readOnly onFocus={event => event.target.select()} />
          )}
          {attempt.reviewed_at && <p className="break-words text-gray-600">
            Verification {attempt.review_reference} · {new Date(attempt.reviewed_at).toLocaleString()}
          </p>}
        </li>
      ))}
    </ul>}
  </div>;
}

function CSTActions({ change, busy, save }: {
  change: TerminalFleetChange; busy: boolean; save: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [cstConfirmed, setCstConfirmed] = useState(false);
  const [remote, setRemote] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [observed, setObserved] = useState<TerminalFleetParameters>(() => parametersFrom());
  const [reference, setReference] = useState('');
  const attempts = change.attempts ?? [];
  const didReady = change.target_before.did === change.requested.did ||
    attempts.some(attempt => attempt.command === 'SetVhqDeviceId' && attempt.state === 'confirmed');
  const needsVHQ = change.target_before.shva_terminal_id !== change.requested.shva_terminal_id;
  const cloud = attempts.find(attempt => attempt.command === 'UpdateVHQSHVA');
  const shvaReady = !needsVHQ || cloud?.state === 'confirmed';
  const downloaded = attempts.some(attempt => attempt.command === 'DownloadAshraitParameters' && attempt.state === 'confirmed');
  const waiting = attempts.some(attempt => ['authorized', 'dispatching', 'uncertain'].includes(attempt.state));
  const needsReview = attempts.some(attempt => attempt.dispatched_at && attempt.state !== 'not_started' && !attempt.reviewed_at);
  const command = !didReady ? 'SetVhqDeviceId' : 'DownloadAshraitParameters';
  const stageVHQ = didReady && !shvaReady && !cloud;
  const canQueue = change.cst_execution_allowed && !waiting && !downloaded &&
    (!needsVHQ || change.cst_vhq_available);

  if (!change.cst_execution_allowed && !needsReview) return null;
  return <div className="space-y-4 border-t border-gray-200 pt-4">
    <h4 className="text-sm font-semibold">{change.target_before.did ? 'Verifone CST' : 'First DID enrollment · Verifone CST'}</h4>
    <p className="text-sm text-gray-700">
      Complete any pending transactions and closing first. Keep the correct FoodyPOS open with the CST terminal connected.
    </p>
    {needsVHQ && !change.cst_vhq_available &&
      <ErrorText message="The VHQ CST tenant or SHVA parameter for this model is unavailable. Configure the API before applying this request." />}
    {canQueue && <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      if (!cstConfirmed || busy) return;
      setCstConfirmed(false);
      void save(() => stageVHQ
        ? stageTerminalFleetVHQ(change.device_id, change.id, 'stage')
        : authorizeTerminalFleetCST(change.device_id, change.id, command, remote));
    }}>
      <p className="text-sm text-gray-700">{stageVHQ
        ? 'Save the reviewed SHVA number in VHQ. Once confirmed, ask FoodyPOS to download the parameters.'
        : command === 'SetVhqDeviceId'
          ? 'Send the reviewed DID to the selected terminal through FoodyPOS.'
          : 'Ask the selected terminal to download its Ashrait parameters.'}</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={cstConfirmed} disabled={busy}
          onChange={event => setCstConfirmed(event.target.checked)} />
        I verified the CST terminal and target identifiers, and any prior batch is closed.
      </label>
      {!stageVHQ && <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={remote} disabled={busy}
          onChange={event => setRemote(event.target.checked)} />
        Send to the connected FoodyPOS automatically
      </label>}
      <button className={primary} disabled={busy || !cstConfirmed} type="submit">{stageVHQ
        ? 'Save SHVA number in VHQ'
        : command === 'SetVhqDeviceId' ? 'Authorize DID assignment' : 'Authorize parameter download'}</button>
    </form>}
    {cloud && (cloud.state === 'uncertain' || cloud.state === 'dispatching') && <div className="space-y-2">
      <p className="text-sm text-gray-700">Check the value in VHQ before sending a parameter download.</p>
      <button className={action} disabled={busy || !change.cst_vhq_available} type="button"
        onClick={() => void save(() => stageTerminalFleetVHQ(change.device_id, change.id, 'verify'))}>Check VHQ status</button>
    </div>}
    {needsReview && <div className="space-y-3">
      <p className="text-sm text-gray-700">Verify the actual identifiers in Verifone before releasing this terminal. An acknowledgement confirms the command only.</p>
      {!verifying ? <button className={action} type="button" disabled={busy} onClick={() => setVerifying(true)}>
        Record observed identifiers
      </button> : <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        void save(() => reviewTerminalFleetCST(change.device_id, change.id, observed, reference.trim()));
      }}>
        <BankFields disabled={busy} value={observed} onChange={setObserved} />
        <Field label="Verification reference" value={reference} onChange={event => setReference(event.target.value)}
          required maxLength={80} pattern={identifierPattern} disabled={busy} />
        <button className={primary} disabled={busy} type="submit">Record verification</button>
      </form>}
    </div>}
  </div>;
}

/** Prepares changes and shows the recorded plans for one terminal. */
export function ChangeRequests({ terminal, onChanged, onClose }: {
  terminal: TerminalFleetEntry; onChanged: () => void; onClose: () => void;
}) {
  const [changes, setChanges] = useState<TerminalFleetChange[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = changes?.find(change => change.state === 'prepared');
  useEffect(() => {
    let current = true;
    listTerminalFleetChanges(terminal.device_id).then(result => {
      if (current) setChanges(result.changes);
    }).catch(() => { if (current) setError('Could not load change requests. Reopen the panel to retry.'); });
    return () => { current = false; };
  }, [terminal.device_id]);

  async function save(action?: () => Promise<unknown>) {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (action) {
        await action();
        onChanged();
      }
      setChanges((await listTerminalFleetChanges(terminal.device_id)).changes);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the request.');
    } finally {
      setBusy(false);
    }
  }

  return <Dialog title={`Change requests for ${terminal.name}`} busy={busy} onClose={onClose}>
    <p className="max-w-prose text-sm text-gray-600">
      A prepared request records the proposed change for Verifone. The identifiers applied to the terminal still require verification.
    </p>
    <ErrorText message={error} />
    <button className={action} disabled={busy} type="button" onClick={() => void save()}>Refresh requests</button>
    {changes === null && !error && <p role="status" className="text-sm">Loading change requests…</p>}
    {active && (
      <section className="space-y-4 border-l-4 border-amber-300 pl-4">
        <div>
          <p className="text-sm font-medium text-amber-950">Prepared for Verifone</p>
          <h3 className="mt-1 font-semibold">{changeKinds[active.kind]}</h3>
        </div>
        <ChangeSummary change={active} restaurantName={terminal.restaurant_name} />
        {active.device_id === terminal.device_id && <CSTActions key={active.id} change={active} busy={busy} save={save} />}
        {active.device_id === terminal.device_id ?
          <button className={action} disabled={busy || active.attempts?.some(attempt => attempt.dispatched_at && attempt.state !== 'not_started')} type="button"
            onClick={() => void save(() => cancelTerminalFleetChange(terminal.device_id, active.id))}>Cancel request</button> :
          <p className="text-sm text-gray-600">Manage this request from the original terminal’s history.</p>}
      </section>
    )}
    {changes !== null && !active && (terminal.metadata?.serial_number ?
      <ChangeForm terminal={terminal} busy={busy} onPrepare={input => save(() => prepareTerminalFleetChange(terminal.device_id, input))} /> :
      <p className="text-sm text-gray-600">Save the physical serial number in Edit inventory to prepare a change.</p>)}
    {changes?.filter(change => change.state !== 'prepared').map(change => (
      <details key={change.id} className="space-y-3 border-t border-gray-200 pt-3 text-sm">
        <summary className="cursor-pointer font-medium">{closedChangeStates[change.state as keyof typeof closedChangeStates]} · {changeKinds[change.kind]}</summary>
        <ChangeSummary change={change} restaurantName={terminal.restaurant_name} />
      </details>
    ))}
  </Dialog>;
}
