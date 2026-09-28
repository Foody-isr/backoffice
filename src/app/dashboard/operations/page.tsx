'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

type ServiceState = 'operational' | 'degraded' | 'down';
type Environment = 'production' | 'development';

interface ServiceStatus {
  id: string;
  service: string;
  environment: Environment;
  url: string;
  state: ServiceState;
  latency_ms: number;
  http_status: number | null;
  detail: string | null;
}

interface StatusResponse {
  checked_at: string;
  release: string | null;
  services: ServiceStatus[];
}

const statePresentation: Record<ServiceState, { label: string; className: string }> = {
  operational: { label: 'Operational', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  degraded: { label: 'Slow', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  down: { label: 'Unavailable', className: 'bg-red-50 text-red-700 ring-red-600/20' },
};

const observabilityLinks = [
  {
    name: 'Sentry',
    description: 'Exceptions, traces, releases and email alerts',
    href: process.env.NEXT_PUBLIC_SENTRY_DASHBOARD_URL,
    env: 'NEXT_PUBLIC_SENTRY_DASHBOARD_URL',
  },
  {
    name: 'Grafana',
    description: 'Centralised API logs, metrics and infrastructure alerts',
    href: process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL,
    env: 'NEXT_PUBLIC_GRAFANA_DASHBOARD_URL',
  },
  {
    name: 'Deployments',
    description: 'Build, deployment and promotion history',
    href: process.env.NEXT_PUBLIC_GITHUB_ACTIONS_URL,
    env: 'NEXT_PUBLIC_GITHUB_ACTIONS_URL',
  },
];

function checkedAt(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

function StatusIcon({ state }: { state: ServiceState }) {
  if (state === 'operational') return <CheckCircleIcon className="h-5 w-5 text-emerald-600" />;
  if (state === 'degraded') return <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />;
  return <XCircleIcon className="h-5 w-5 text-red-600" />;
}

export default function OperationsPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/operations/status');
      if (!response.ok) throw new Error(`Status endpoint returned ${response.status}`);
      setData(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load service status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const summary = useMemo(() => {
    const services = data?.services ?? [];
    return {
      down: services.filter((service) => service.state === 'down').length,
      degraded: services.filter((service) => service.state === 'degraded').length,
    };
  }, [data]);

  const headline = summary.down > 0
    ? `${summary.down} service${summary.down === 1 ? '' : 's'} unavailable`
    : summary.degraded > 0
      ? `${summary.degraded} service${summary.degraded === 1 ? '' : 's'} responding slowly`
      : 'All public services are responding';

  return (
    <div className="space-y-7">
      <header className="overflow-hidden rounded-2xl bg-[#1a1a2e] text-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
          <div>
            <div className="flex items-center gap-3">
              <SignalIcon className="h-6 w-6 text-orange-400" />
              <h1 className="text-2xl font-bold">Operations</h1>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              One place to detect an outage, open the right evidence and keep customer data out of diagnostics.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-300 lg:items-end">
            <span className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              {data ? `Checked ${checkedAt(data.checked_at)}` : 'Waiting for first check'}
            </span>
            <span className="text-xs text-gray-500">
              Backoffice release {data?.release || 'not exposed'} · refreshes every 60 seconds
            </span>
          </div>
        </div>
        <div
          className={`flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8 ${
            summary.down > 0
              ? 'border-red-400/30 bg-red-500/15'
              : summary.degraded > 0
                ? 'border-amber-400/30 bg-amber-500/15'
                : 'border-emerald-400/20 bg-emerald-500/10'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <StatusIcon state={summary.down > 0 ? 'down' : summary.degraded > 0 ? 'degraded' : 'operational'} />
            {headline}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Check now
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Status checks could not run: {error}. Retry once, then open the deployment history.
        </div>
      )}

      <section aria-labelledby="service-status-heading" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="service-status-heading" className="font-semibold text-gray-900">Public service checks</h2>
            <p className="mt-1 text-xs text-gray-500">A slow response is over two seconds; timeout is five seconds.</p>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500">
            <ArrowPathIcon className="h-5 w-5 animate-spin text-brand-500" />
            Checking Foody services…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Environment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Latency</th>
                  <th className="px-5 py-3 text-right">HTTP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.services.map((service) => {
                  const presentation = statePresentation[service.state];
                  return (
                    <tr key={service.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-4">
                        <a
                          href={service.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 font-semibold text-gray-900 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        >
                          {service.service}
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-gray-400" />
                        </a>
                        {service.detail && <p className="mt-1 text-xs text-red-600">{service.detail}</p>}
                      </td>
                      <td className="px-5 py-4 text-gray-600">{service.environment}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${presentation.className}`}>
                          <StatusIcon state={service.state} />
                          {presentation.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-gray-700">{service.latency_ms} ms</td>
                      <td className="px-5 py-4 text-right text-gray-500">{service.http_status ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="investigation-heading" className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="investigation-heading" className="font-semibold text-gray-900">Investigation tools</h2>
          <p className="mt-1 text-sm text-gray-500">Open evidence in the system that owns it. Do not copy tokens or customer details into incident notes.</p>
          <div className="mt-5 divide-y divide-gray-100">
            {observabilityLinks.map((tool) => (
              <div key={tool.name} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{tool.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">{tool.description}</p>
                </div>
                {tool.href ? (
                  <a
                    href={tool.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    Open
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="font-mono text-[11px] text-amber-700">Set {tool.env}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border border-gray-200 bg-[#fffaf5] p-5">
          <h2 className="font-semibold text-gray-900">First ten minutes of an incident</h2>
          <ol className="mt-4 space-y-4 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">1</span>
              <span><strong>Confirm scope.</strong> Compare production and development, and record the first failing timestamp.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">2</span>
              <span><strong>Correlate.</strong> Find the Sentry event, request ID and deployed commit without exposing request bodies.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">3</span>
              <span><strong>Contain.</strong> Roll back or disable the smallest affected feature; never edit production data as a first response.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">4</span>
              <span><strong>Verify.</strong> Re-run checks and one safe customer journey before closing the incident.</span>
            </li>
          </ol>
        </aside>
      </section>
    </div>
  );
}
