'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { getVerifoneDiagnostics, setVerifoneDiagnostics, type VerifoneDiagnosticStatus } from '@/lib/api';

const cloudWatchURL = 'https://eu-north-1.console.aws.amazon.com/cloudwatch/home?region=eu-north-1#logsV2:log-groups/log-group/$252Ffoody$252Fdev$252Fapi';

/** Superadmin control for filtered JSON diagnostics; never a raw log viewer. */
export default function VerifoneDiagnostics() {
  const [status, setStatus] = useState<VerifoneDiagnosticStatus | null>(null);
  const [reading, setReading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestVersion = useRef({ value: 0 });
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    const version = ++requestVersion.current.value;
    setReading(true);
    try {
      const result = await getVerifoneDiagnostics();
      if (version !== requestVersion.current.value) return;
      setStatus(result);
      setError(null);
      setNotice(null);
    } catch (cause) {
      if (version !== requestVersion.current.value) return;
      setStatus(null); // An unknown state must not offer an enable/disable action.
      setNotice(null);
      setError(cause instanceof Error ? cause.message : 'Could not read diagnostic settings');
    } finally {
      if (version === requestVersion.current.value) setReading(false);
    }
  }, []);

  useEffect(() => {
    const requests = requestVersion.current;
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      requests.value++;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  async function toggle() {
    if (!status?.available || busy.current || reading) return;
    busy.current = true;
    const version = ++requestVersion.current.value;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await setVerifoneDiagnostics(!status.enabled);
      if (version !== requestVersion.current.value) return;
      setStatus(result);
      setNotice(result.enabled ? 'JSON enabled for subsequent sandbox exchanges.' : 'JSON disabled. Exchange metadata will still be recorded.');
    } catch (cause) {
      if (version !== requestVersion.current.value) return;
      // A timeout might occur after persistence. Do not guess or retry a write.
      setStatus(null);
      setError(`${cause instanceof Error ? cause.message : 'Could not update diagnostic settings'}. Refresh status before trying again.`);
    } finally {
      busy.current = false;
      if (version === requestVersion.current.value) setSaving(false);
    }
  }

  const label = !status ? 'Status unknown' : !status.available ? 'Unavailable here' : status.enabled ? 'JSON enabled' : 'JSON disabled';

  return (
    <section aria-labelledby="verifone-diagnostics-heading" aria-busy={reading || saving} className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="verifone-diagnostics-heading" className="font-semibold text-gray-900">Verifone JSON diagnostics</h2>
            <span aria-live="polite" className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status?.available && status.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
              {reading && !status ? 'Loading status…' : label}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Record filtered request and response JSON in CloudWatch for Verifone sandbox tests.
            Applies to all sandbox restaurants on this API. Enabled until you turn it off; no restart or deployment needed.
          </p>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
            <ShieldCheckIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Card data, identity numbers, tokens and customer details remain hidden. Safe exchange metadata stays on.
          </p>
          {status && (
            <p className="mt-3 text-xs text-gray-500">
              API environment: <span className="font-medium text-gray-700">{status.environment}</span> · Sandbox only
              {status.updated_at && <> · Updated {new Date(status.updated_at).toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem' })} (Jerusalem)</>}
            </p>
          )}
          {status && !status.available && (
            <p className="mt-3 text-sm text-amber-800">Open the development Backoffice to change this setting. Production JSON logging cannot be enabled.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <button
            type="button"
            onClick={toggle}
            disabled={!status?.available || reading || saving}
            className={`inline-flex min-w-36 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${status?.enabled ? 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50' : 'bg-brand-500 text-white hover:bg-brand-600'}`}
          >
            {saving && <ArrowPathIcon aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
            {saving ? 'Saving…' : status?.enabled ? 'Disable JSON' : 'Enable JSON'}
          </button>
          <button type="button" onClick={refresh} disabled={reading || saving} className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50">
            <ArrowPathIcon aria-hidden="true" className={`h-3.5 w-3.5 ${reading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            Refresh status
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mx-5 mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mx-5 mb-5 text-sm text-emerald-700">{notice}</p>}
      <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Changes are audited. Turning JSON off does not delete earlier logs (14-day retention).</span>
        <a href={cloudWatchURL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded font-semibold text-brand-600 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300">
          Open dev CloudWatch <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}
