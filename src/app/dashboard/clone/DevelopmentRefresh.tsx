'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, CircleStackIcon } from '@heroicons/react/24/outline';
import {
  getDevelopmentRefresh,
  requestDevelopmentRefresh,
  type DevelopmentRefreshStatus,
} from '@/lib/api';

const confirmationText = 'REPLACE DEVELOPMENT DATA';

/** Shows the reviewed production snapshot and controls its restore on development. */
export default function DevelopmentRefresh() {
  const [status, setStatus] = useState<DevelopmentRefreshStatus | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const job = status?.job;
  const active = job?.state === 'queued' || job?.state === 'running';

  const reload = useCallback(async () => {
    try {
      setStatus(await getDevelopmentRefresh());
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not read refresh status.');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    setConfirmation('');
  }, [status?.snapshot?.id]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { void reload(); }, 4000);
    return () => window.clearInterval(timer);
  }, [active, reload]);

  async function restore() {
    if (!status?.snapshot || active || submitting || confirmation !== confirmationText) return;
    setSubmitting(true);
    setError('');
    try {
      const nextJob = await requestDevelopmentRefresh(status.snapshot.id, confirmation);
      setStatus((current) => current && { ...current, job: nextJob });
      setConfirmation('');
    } catch (failure) {
      await reload();
      setError(failure instanceof Error ? failure.message : 'Could not queue the refresh.');
    } finally {
      setSubmitting(false);
    }
  }

  const snapshot = status?.snapshot;
  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-gray-900">Refresh all development data</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Restore a reviewed production snapshot with all restaurants, orders, payment history,
            websites and settings. Expect a brief interruption on development.
          </p>
        </div>
        <button type="button" onClick={reload} disabled={active || submitting}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:opacity-40">
          <ArrowPathIcon className="h-4 w-4" /> Refresh status
        </button>
      </div>

      {job && (
        <p role="status" className={`rounded-lg p-3 text-sm ${job.state === 'failed' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-900'}`}>
          {job.state === 'queued' && 'Restore queued on the development host.'}
          {job.state === 'running' && 'Restoring and checking the development API.'}
          {job.state === 'succeeded' && 'Development data restored. The API passed its health check.'}
          {job.state === 'failed' && (job.reason || 'The restore failed. Check the development host.')}
        </p>
      )}
      {error && !active && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {status && !status.available && <p className="text-sm text-gray-600">The development restore worker is disabled.</p>}
      {status?.available && !snapshot && !active && (
        <p className="text-sm text-gray-600">No reviewed production snapshot is ready.</p>
      )}

      {snapshot && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-700">
            Production snapshot from <time dateTime={snapshot.captured_at}>{new Date(snapshot.captured_at).toLocaleString()}</time>
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Restaurants', snapshot.restaurants],
              ['Orders', snapshot.orders],
              ['Payments', snapshot.transactions],
              ['Websites', snapshot.websites],
            ].map(([label, count]) => (
              <div key={label}>
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{count.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          {!active && (
            <>
              <label className="block max-w-md space-y-1 text-sm font-medium text-gray-700">
                <span>Type {confirmationText} to replace the current development database.</span>
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
                  disabled={submitting} autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <button type="button" onClick={restore} disabled={submitting || confirmation !== confirmationText}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                <CircleStackIcon className="h-4 w-4" /> {submitting ? 'Queuing…' : 'Replace development database'}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
