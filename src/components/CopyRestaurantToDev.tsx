'use client';

import { useState } from 'react';
import { ArrowPathIcon, CircleStackIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  applyCloneBundle, fetchCloneBundle, getCloneRestaurants, getCloneStatus,
  getCurrentCloneSession, loginCloneEnvironment,
  type CloneEnvironment, type CloneReport, type CloneRestaurant, type CloneSession,
} from '@/lib/api';

type Sessions = Partial<Record<CloneEnvironment, CloneSession>>;
type RestaurantHint = Pick<CloneRestaurant, 'id' | 'name' | 'slug'>;
const environments: CloneEnvironment[] = ['production', 'development'];
const buttonClass = 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40';
const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

/** Opens an authenticated, previewed copy from production into development. */
export default function CopyRestaurantToDev({ restaurant }: { restaurant?: RestaurantHint }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        <CircleStackIcon className="h-4 w-4" /> Copy prod → dev
      </button>
      {open && <CopyDialog restaurant={restaurant} onClose={() => setOpen(false)} />}
    </>
  );
}

function CopyDialog({ restaurant, onClose }: { restaurant?: RestaurantHint; onClose: () => void }) {
  const [sessions, setSessions] = useState<Sessions>(() => {
    const current = getCurrentCloneSession();
    return current ? { [current.environment]: current } : {};
  });
  const [restaurants, setRestaurants] = useState<CloneRestaurant[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [stock, setStock] = useState(true);
  const [bundle, setBundle] = useState<File | null>(null);
  const [report, setReport] = useState<CloneReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  function invalidate() {
    setBundle(null);
    setReport(null);
    setConfirmed(false);
    setError('');
  }

  async function validateEnvironments() {
    if (!sessions.production || !sessions.development) throw new Error('Sign in to both environments first.');
    const [source, target] = await Promise.all([
      getCloneStatus(sessions.production), getCloneStatus(sessions.development),
    ]);
    if (source.env !== 'production' || source.is_clone_target ||
        target.env !== 'development' || !target.is_clone_target) {
      throw new Error('The APIs must identify themselves as production (source) and development (target).');
    }
    if (source.bundle_version !== target.bundle_version) throw new Error('The API bundle versions do not match.');
  }

  async function loadRestaurants() {
    setBusy(true);
    setError('');
    try {
      await validateEnvironments();
      const data = await getCloneRestaurants(sessions.production!);
      setRestaurants(data.restaurants);
      // Slugs identify the restaurant across independent environments.
      const match = restaurant?.slug
        ? data.restaurants.find((r) => r.slug === restaurant.slug)
        : undefined;
      setSelectedId(match ? String(match.id) : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to the environments.');
    } finally { setBusy(false); }
  }

  async function preview() {
    const source = restaurants?.find((r) => r.id === Number(selectedId));
    if (!source) return;
    invalidate();
    setBusy(true);
    try {
      await validateEnvironments();
      const targets = (await getCloneRestaurants(sessions.development!)).restaurants;
      const target = targets.find((r) => r.id === source.id);
      if ((target && (!source.slug || target.slug !== source.slug)) ||
          targets.some((r) => r.slug && r.slug === source.slug && r.id !== source.id)) {
        throw new Error('This restaurant has a different ID in dev. Copy stopped to protect the other restaurants.');
      }
      const snapshot = await fetchCloneBundle(sessions.production!, source.id, stock ? ['stock'] : []);
      const result = await applyCloneBundle(snapshot, false, sessions.development!);
      if (!result.dry_run || result.committed || result.restaurant_id !== source.id ||
          result.source_env !== 'production' || result.target_env !== 'development') {
        throw new Error('The preview did not match the requested restaurant and environments.');
      }
      setBundle(snapshot);
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed.');
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!bundle || !report?.dry_run || !confirmed || report.orphans?.some((o) => o.count > 0)) return;
    setBusy(true);
    setError('');
    try {
      await validateEnvironments();
      const result = await applyCloneBundle(bundle, true, sessions.development!);
      if (!result.committed) throw new Error('The API did not confirm that the copy was committed.');
      setReport(result);
      setBundle(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed.');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-8">
      <div role="dialog" aria-modal="true" aria-labelledby="copy-dev-title" className="mx-4 w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="copy-dev-title" className="text-lg font-bold text-gray-900">Copy production → development</h2>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-gray-500 disabled:opacity-40">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-gray-600">
            Copy a restaurant&apos;s menus, website, orders, catering and settings into dev.
            Payment credentials, staff accounts, push registrations and external integrations stay in their environment.
          </p>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {!restaurants && environments.map((environment) => (
            sessions[environment] ? (
              <div key={environment} className="flex items-center justify-between rounded-lg bg-green-50 p-3 text-sm text-green-800">
                <span>Connected to {environment}</span>
                <button type="button" disabled={busy} onClick={() => setSessions((prev) => ({ ...prev, [environment]: undefined }))} className="underline">Change login</button>
              </div>
            ) : (
              <EnvironmentLogin key={environment} environment={environment} disabled={busy} onLogin={(session) => {
                setSessions((prev) => ({ ...prev, [environment]: session }));
              }} />
            )
          ))}

          {!restaurants && (
            <button type="button" onClick={loadRestaurants} disabled={busy || !sessions.production || !sessions.development} className={buttonClass}>
              {busy && <ArrowPathIcon className="h-4 w-4 animate-spin" />} Choose production restaurant
            </button>
          )}

          {restaurants && !report?.committed && (
            <>
              <label className="block space-y-1 text-sm font-medium text-gray-700">
                <span>Production restaurant</span>
                <select value={selectedId} disabled={busy} onChange={(e) => { setSelectedId(e.target.value); invalidate(); }} className={inputClass}>
                  <option value="">Select a restaurant</option>
                  {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.slug} · #{r.id}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={stock} disabled={busy} onChange={(e) => { setStock(e.target.checked); invalidate(); }} />
                Include stock, recipes and suppliers
              </label>
              <button type="button" onClick={preview} disabled={busy || !selectedId} className={buttonClass}>
                {busy && <ArrowPathIcon className="h-4 w-4 animate-spin" />} Preview copy
              </button>
            </>
          )}

          {report && (
            <div className="space-y-3 border-t border-gray-200 pt-4" aria-live="polite">
              <p className={`rounded-lg p-3 text-sm ${report.committed ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-900'}`}>
                <strong>{report.committed ? 'Copy completed.' : 'Preview — no data replaced.'}</strong>{' '}
                {report.restaurant_name}: {report.total_inserted.toLocaleString()} rows {report.committed ? 'copied' : 'to copy'}, {report.total_deleted.toLocaleString()} dev rows {report.committed ? 'replaced' : 'to replace'}.
              </p>
              {!!report.warnings?.length && (
                <ul className="list-inside list-disc space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  {report.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
                </ul>
              )}
              {report.orphans?.some((o) => o.count > 0) ? (
                <p role="alert" className="text-sm text-red-700">Copy blocked: the preview found missing references.</p>
              ) : !report.committed && (
                <>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
                    I confirm replacing {report.restaurant_name}&apos;s current dev data with this production snapshot.
                  </label>
                  <button type="button" onClick={copy} disabled={busy || !confirmed || !bundle} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40">
                    {busy ? 'Copying…' : 'Replace restaurant data in dev'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EnvironmentLogin({ environment, disabled, onLogin }: {
  environment: CloneEnvironment; disabled: boolean; onLogin: (session: CloneSession) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form className="space-y-2 rounded-lg border border-gray-200 p-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError('');
      try { onLogin(await loginCloneEnvironment(environment, email, password)); }
      catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); }
      finally { setPassword(''); setBusy(false); }
    }}>
      <h3 className="text-sm font-medium text-gray-900">Superadmin login · {environment}</h3>
      <input aria-label={`${environment} email`} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy || disabled} placeholder="Email" className={inputClass} />
      <input aria-label={`${environment} password`} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || disabled} placeholder="Password" className={inputClass} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || disabled} className={buttonClass}>{busy ? 'Signing in…' : `Sign in to ${environment}`}</button>
    </form>
  );
}
