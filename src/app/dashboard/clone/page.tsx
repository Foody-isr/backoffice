'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import {
  getCloneStatus,
  getCloneRestaurants,
  downloadCloneBundle,
  applyCloneBundle,
  type CloneCluster,
  type CloneReport,
  type CloneRestaurant,
  type CloneStatus,
} from '@/lib/api';

// Labels for the optional clusters. Core (cartes, orders, website config, menus,
// groups, variants, delivery, discounts) always travels and is not offered as a
// choice; payment data is never copyable and has no toggle at all.
const CLUSTER_LABELS: Record<CloneCluster, { title: string; detail: string }> = {
  stock: {
    title: 'Stock & prep',
    detail:
      'Inventory levels, transactions, suppliers, purchase orders, recipes. Turn this ON to reproduce a stock or oversell bug.',
  },
  users_roles: {
    title: 'Staff & roles',
    detail: 'Staff-to-restaurant roles and permissions. Off keeps the target’s own staff accounts.',
  },
  push_tokens: {
    title: 'Push tokens',
    detail: 'Device push registrations. Tied to a specific app install, so rarely useful here.',
  },
  integrations: {
    title: 'Integrations',
    detail: 'Twilio subaccounts, WhatsApp senders, social sync. These point at live external resources.',
  },
};

function num(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export default function ClonePage() {
  const [status, setStatus] = useState<CloneStatus | null>(null);
  const [restaurants, setRestaurants] = useState<CloneRestaurant[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clusters, setClusters] = useState<CloneCluster[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'preview' | 'apply' | null>(null);
  const [report, setReport] = useState<CloneReport | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, r] = await Promise.all([getCloneStatus(), getCloneRestaurants()]);
        if (!active) return;
        setStatus(s);
        setRestaurants(r.restaurants);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load clone status');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => restaurants.find((r) => r.id === selectedId) ?? null,
    [restaurants, selectedId],
  );

  function toggleCluster(c: CloneCluster) {
    setClusters((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  // A different file invalidates the preview: the report on screen must always
  // describe the bundle the Replace button would apply.
  function pickFile(next: File | null) {
    setFile(next);
    setReport(null);
    setError(null);
  }

  async function doExport() {
    if (!selectedId) return;
    setBusy('export');
    setError(null);
    try {
      await downloadCloneBundle(selectedId, clusters);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    if (!file) return;
    setBusy('preview');
    setError(null);
    try {
      setReport(await applyCloneBundle(file, false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
      setReport(null);
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!file || !status || !report) return;
    const name = report.restaurant_name || `restaurant ${report.restaurant_id}`;
    const confirmed = window.confirm(
      `Replace ${name} on ${status.env} with the copy from ${report.source_env}?\n\n` +
        `This permanently deletes ${status.env}'s current data for this restaurant. ` +
        `Export it first if you might want it back.`,
    );
    if (!confirmed) return;

    setBusy('apply');
    setError(null);
    try {
      setReport(await applyCloneBundle(file, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clone failed');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-gray-500">
        <ArrowPathIcon className="h-5 w-5 animate-spin" />
        Loading clone status...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Clone environment data</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Moves one restaurant&apos;s entire dataset between environments, so a production bug can be reproduced with
          the real data. Export a bundle from one environment, then upload it to the other. This backoffice is pointed
          at <span className="font-medium text-gray-700">{status?.env || 'an unknown environment'}</span>.
        </p>
      </header>

      {error && (
        <Banner tone="danger" icon={<ExclamationTriangleIcon className="h-5 w-5 shrink-0" />}>
          {error}
        </Banner>
      )}

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-medium text-gray-900">Export from {status?.env}</h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only. Cartes, orders, website config, menus, groups, variants, floor plans, delivery and discounts are
            always included. Payment credentials are never exported.
          </p>
        </div>

        <div className="max-h-72 overflow-y-auto border-b border-gray-200">
          {restaurants.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500">This environment has no restaurants.</p>
          )}
          {restaurants.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={`flex w-full items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50 ${
                selectedId === r.id ? 'bg-blue-50' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">
                  {r.name || <span className="italic text-gray-400">(no name)</span>}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  id {r.id}
                  {r.slug ? ` · ${r.slug}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-gray-500">
                {num(r.orders)} orders
                <br />
                {num(r.items)} items
              </span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-gray-100">
          {(status?.optional_clusters ?? []).map((c) => (
            <label key={c} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={clusters.includes(c)}
                onChange={() => toggleCluster(c)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{CLUSTER_LABELS[c]?.title ?? c}</span>
                <span className="block text-xs text-gray-500">{CLUSTER_LABELS[c]?.detail}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={doExport}
            disabled={!selectedId || busy !== null}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy === 'export' ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownTrayIcon className="h-4 w-4" />
            )}
            Download bundle{selected ? ` for ${selected.name || `restaurant ${selected.id}`}` : ''}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-medium text-gray-900">Apply a bundle to {status?.env}</h2>
          <p className="mt-1 text-xs text-gray-500">
            Upload a bundle exported from another environment. Previewing changes nothing.
          </p>
        </div>

        {status && !status.is_clone_target ? (
          <div className="px-4 py-4">
            <Banner tone="danger" icon={<ShieldExclamationIcon className="h-5 w-5 shrink-0" />}>
              <strong>This API is production and can never be written to by this feature.</strong> Export above works
              here; to apply a bundle, point this backoffice at the dev API (<code>NEXT_PUBLIC_API_URL</code>) and sign
              in there.
            </Banner>
          </div>
        ) : (
          <>
            <div className="px-4 py-4">
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
              {file && (
                <p className="mt-2 text-xs text-gray-500">
                  {file.name} · {(file.size / 1_048_576).toFixed(1)} MB
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={preview}
                disabled={!file || busy !== null}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {busy === 'preview' ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpTrayIcon className="h-4 w-4" />
                )}
                Preview
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={!file || busy !== null || !report?.dry_run}
                title={!report?.dry_run ? 'Preview first' : undefined}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {busy === 'apply' && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Replace data on {status?.env}
              </button>
            </div>
          </>
        )}
      </section>

      {report && <ReportView report={report} />}
    </div>
  );
}

function ReportView({ report }: { report: CloneReport }) {
  const nonEmpty = report.tables.filter((t) => t.source > 0 || t.deleted > 0);
  const skipped = Object.entries(report.skipped ?? {});

  return (
    <section className="space-y-4">
      <Banner
        tone={report.committed ? 'success' : 'info'}
        icon={
          report.committed ? (
            <CheckCircleIcon className="h-5 w-5 shrink-0" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          )
        }
      >
        {report.committed ? (
          <>
            <strong>Done.</strong> {report.restaurant_name || `Restaurant ${report.restaurant_id}`} was replaced on{' '}
            {report.target_env} from {report.source_env}: {num(report.total_inserted)} rows written,{' '}
            {num(report.total_deleted)} removed.
          </>
        ) : (
          <>
            <strong>Preview only, nothing was changed.</strong> A real run would delete {num(report.total_deleted)} rows
            and write {num(report.total_inserted)} for{' '}
            {report.restaurant_name || `restaurant ${report.restaurant_id}`}, from {report.source_env} into{' '}
            {report.target_env}.
          </>
        )}
      </Banner>

      {(report.warnings ?? []).length > 0 && (
        <Banner tone="warning" icon={<ExclamationTriangleIcon className="h-5 w-5 shrink-0" />}>
          <ul className="list-inside list-disc space-y-1">
            {report.warnings!.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Table</th>
              <th className="px-4 py-2 font-medium">Cluster</th>
              <th className="px-4 py-2 text-right font-medium">In bundle</th>
              <th className="px-4 py-2 text-right font-medium">Written</th>
              <th className="px-4 py-2 text-right font-medium">Removed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {nonEmpty.map((t) => (
              <tr key={t.name} className={t.source !== t.inserted ? 'bg-amber-50' : undefined}>
                <td className="px-4 py-2 font-mono text-xs text-gray-900">{t.name}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{t.cluster}</td>
                <td className="px-4 py-2 text-right tabular-nums">{num(t.source)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{num(t.inserted)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-500">{num(t.deleted)}</td>
              </tr>
            ))}
            {nonEmpty.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  This restaurant has no rows in any included table.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {skipped.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
            {skipped.length} table(s) deliberately not copied
          </summary>
          <ul className="divide-y divide-gray-100 border-t border-gray-200">
            {skipped.map(([table, why]) => (
              <li key={table} className="px-4 py-2 text-xs">
                <span className="font-mono text-gray-900">{table}</span>
                <span className="text-gray-500"> &mdash; {why}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'info' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-green-200 bg-green-50 text-green-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  } as const;

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
