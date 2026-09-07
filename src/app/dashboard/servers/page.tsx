'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, ClockIcon, LanguageIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import {
  getInstances,
  startInstance,
  stopInstance,
  getSchedule,
  updateSchedule,
  getTranslationSetting,
  setTranslationEnabled,
  getCost,
  type InfraInstance,
  type InfraSchedule,
  type InfraTranslation,
  type InfraCost,
} from '@/lib/api';

// Transitional states where start/stop should be disabled until they settle.
const TRANSITIONAL = new Set(['pending', 'stopping', 'shutting-down', 'rebooting']);

function stateBadge(state: string): string {
  switch (state) {
    case 'running':
      return 'bg-green-100 text-green-700';
    case 'stopped':
      return 'bg-gray-200 text-gray-700';
    case 'pending':
    case 'stopping':
    case 'rebooting':
      return 'bg-yellow-100 text-yellow-700';
    case 'terminated':
    case 'shutting-down':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function dateTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function hour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export default function ServersPage() {
  const [instances, setInstances] = useState<InfraInstance[]>([]);
  const [schedule, setSchedule] = useState<InfraSchedule | null>(null);
  const [translation, setTranslation] = useState<InfraTranslation | null>(null);
  const [cost, setCost] = useState<InfraCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [savingTranslation, setSavingTranslation] = useState(false);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);
  const [refreshingCost, setRefreshingCost] = useState(false);

  const loadInstances = useCallback(async () => {
    const { instances } = await getInstances();
    setInstances(instances);
  }, []);

  // Initial load — allSettled so a cost/IAM failure doesn't blank the instances.
  useEffect(() => {
    let active = true;
    (async () => {
      const [inst, sched, translate, c] = await Promise.allSettled([
        getInstances(),
        getSchedule(),
        getTranslationSetting(),
        getCost(),
      ]);
      if (!active) return;
      if (inst.status === 'fulfilled') setInstances(inst.value.instances);
      else setError(inst.reason instanceof Error ? inst.reason.message : 'Could not load instances');
      if (sched.status === 'fulfilled') {
        setSchedule(sched.value);
        setStartHour(sched.value.start_hour);
        setEndHour(sched.value.end_hour);
      }
      if (translate.status === 'fulfilled') setTranslation(translate.value);
      if (c.status === 'fulfilled') setCost(c.value);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Live refresh of instance state every 15s (cheap; cost is not polled).
  useEffect(() => {
    const id = setInterval(() => {
      getInstances()
        .then((r) => setInstances(r.instances))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, []);

  async function doAction(inst: InfraInstance, action: 'start' | 'stop') {
    const verb = action === 'start' ? 'Start' : 'Stop';
    if (!window.confirm(`${verb} ${inst.name || inst.instance_id}?`)) return;
    setActioningId(inst.instance_id);
    setError(null);
    try {
      if (action === 'start') await startInstance(inst.instance_id);
      else await stopInstance(inst.instance_id);
      await loadInstances();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActioningId(null);
    }
  }

  async function changeMode(mode: 'auto' | 'always_on') {
    if (schedule?.mode === mode || savingMode) return;
    setSavingMode(true);
    setError(null);
    try {
      const updated = await updateSchedule({ mode, start_hour: startHour, end_hour: endHour });
      setSchedule(updated);
      await loadInstances(); // always_on brings dev up immediately
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update schedule');
    } finally {
      setSavingMode(false);
    }
  }

  async function saveHours() {
    if (!schedule || savingHours || startHour >= endHour) return;
    setSavingHours(true);
    setError(null);
    try {
      const updated = await updateSchedule({ mode: schedule.mode, start_hour: startHour, end_hour: endHour });
      setSchedule(updated);
      await loadInstances();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update working hours');
    } finally {
      setSavingHours(false);
    }
  }

  async function changeTranslation(enabled: boolean) {
    if (!translation || savingTranslation || translation.enabled === enabled) return;
    if (enabled && !window.confirm('Enable Amazon Translate? New translations are billed per character by AWS.')) return;
    setSavingTranslation(true);
    setError(null);
    try {
      setTranslation(await setTranslationEnabled(enabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update Amazon Translate');
    } finally {
      setSavingTranslation(false);
    }
  }

  async function refreshCost() {
    setRefreshingCost(true);
    setError(null);
    try {
      setCost(await getCost(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load cost');
    } finally {
      setRefreshingCost(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Servers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor and control the Foody AWS instances. Only the dev server can be started or stopped here; production is view-only.
        </p>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      {/* Cost */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-600">AWS cost this month</h2>
          <button
            onClick={refreshCost}
            disabled={refreshingCost}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:text-brand-600 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshingCost ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {cost ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <p className="text-xs text-gray-500">Month to date</p>
              <p className="text-2xl font-bold text-gray-900">{money(cost.month_to_date, cost.currency)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {cost.period_start} to {cost.period_end}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Forecast (month end)</p>
              <p className="text-2xl font-bold text-gray-900">
                {cost.forecast > 0 ? money(cost.forecast, cost.currency) : 'n/a'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">By service</p>
              <div className="space-y-1">
                {cost.by_service.slice(0, 5).map((s) => (
                  <div key={s.service} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 truncate pr-2">{s.service}</span>
                    <span className="text-gray-900 font-medium whitespace-nowrap">{money(s.amount, cost.currency)}</span>
                  </div>
                ))}
                {cost.by_service.length === 0 && <span className="text-xs text-gray-400">No spend yet</span>}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Cost data unavailable. Grant <code className="text-gray-600">ce:GetCostAndUsage</code> to the API role and refresh.
          </p>
        )}
      </div>

      {/* Runtime cost controls */}
      {translation && (
        <div className={`bg-white rounded-xl border p-5 ${translation.enabled ? 'border-amber-300' : 'border-emerald-200'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${translation.enabled ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                <LanguageIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Amazon Translate</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {translation.enabled
                    ? 'Paid machine translation is active for menu and website content.'
                    : 'Paid translation calls are blocked. Existing saved translations remain available.'}
                </p>
                {!translation.available && (
                  <p className="text-xs text-red-600 mt-1">The AWS translation provider is not available on this server.</p>
                )}
              </div>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 shrink-0" role="group" aria-label="Amazon Translate status">
              {([false, true] as const).map((enabled) => (
                <button
                  key={String(enabled)}
                  onClick={() => changeTranslation(enabled)}
                  disabled={savingTranslation || (enabled && !translation.available)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition disabled:opacity-50 ${
                    translation.enabled === enabled
                      ? enabled ? 'bg-amber-100 text-amber-800 shadow-sm' : 'bg-emerald-100 text-emerald-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {enabled ? 'Enabled' : 'Disabled'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dev schedule */}
      {schedule && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <ClockIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Dev server schedule</h2>
                {schedule.mode === 'auto' ? (
                  <p className="text-sm text-gray-500 mt-1">
                    Dev turns off outside working hours to save cost. On {schedule.weekdays.toLowerCase()},{' '}
                    {hour(schedule.start_hour)} to {hour(schedule.end_hour)} ({schedule.timezone}). Right now it should be{' '}
                    <span className={schedule.should_be_on_now ? 'text-green-600 font-semibold' : 'text-gray-700 font-semibold'}>
                      {schedule.should_be_on_now ? 'ON' : 'OFF'}
                    </span>
                    {schedule.next_transition && <>, next change {dateTime(schedule.next_transition)}</>}.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    Dev stays on around the clock, including weekends. Switch back to Auto to save cost off-hours.
                  </p>
                )}
              </div>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 shrink-0">
              {(['auto', 'always_on'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  disabled={savingMode}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition disabled:opacity-50 ${
                    schedule.mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'auto' ? 'Auto' : 'Always on'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="text-xs font-medium text-gray-600">
              Starts
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="mt-1 block w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {Array.from({ length: 24 }, (_, h) => h).map((h) => <option key={h} value={h}>{hour(h)}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Ends
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="mt-1 block w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{hour(h)}</option>)}
              </select>
            </label>
            <button
              onClick={saveHours}
              disabled={savingHours || startHour >= endHour || (startHour === schedule.start_hour && endHour === schedule.end_hour)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingHours ? 'Saving…' : 'Save working hours'}
            </button>
            {startHour >= endHour && <p className="text-xs text-red-600 pb-2">End time must be after start time.</p>}
          </div>
        </div>
      )}

      {/* Instances */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-semibold">Server</th>
              <th className="px-4 py-3 font-semibold">State</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Public IP</th>
              <th className="px-4 py-3 font-semibold">Private IP</th>
              <th className="px-4 py-3 font-semibold">Zone</th>
              <th className="px-4 py-3 font-semibold">Launched</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {instances.map((inst) => {
              const busy = actioningId === inst.instance_id;
              const transitional = TRANSITIONAL.has(inst.state);
              return (
                <tr key={inst.instance_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{inst.name || inst.instance_id}</div>
                    <div className="text-xs text-gray-400">
                      {inst.instance_id}
                      {inst.is_dev && <span className="ml-1.5 text-brand-500 font-semibold">dev</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${stateBadge(inst.state)}`}>
                      {inst.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{inst.instance_type}</td>
                  <td className="px-4 py-3 text-gray-700">{inst.public_ip || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{inst.private_ip || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{inst.availability_zone || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{dateTime(inst.launched_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {!inst.controllable ? (
                      <span className="text-xs text-gray-400">View only</span>
                    ) : inst.state === 'running' ? (
                      <button
                        onClick={() => doAction(inst, 'stop')}
                        disabled={busy || transitional}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition disabled:opacity-50 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      >
                        <StopIcon className="w-3.5 h-3.5" />
                        {busy ? 'Stopping…' : 'Stop'}
                      </button>
                    ) : inst.state === 'stopped' ? (
                      <button
                        onClick={() => doAction(inst, 'start')}
                        disabled={busy || transitional}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition disabled:opacity-50 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                      >
                        <PlayIcon className="w-3.5 h-3.5" />
                        {busy ? 'Starting…' : 'Start'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{inst.state}…</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {instances.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  No instances found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
