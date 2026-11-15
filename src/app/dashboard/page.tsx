'use client';

import { useEffect, useState } from 'react';
import { getDashboard, listSubscriptions, DashboardStats, SubscriptionWithRestaurant } from '@/lib/api';
import { planColor, capitalize } from '@/lib/utils';
import {
  BuildingStorefrontIcon,
  UsersIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pastDue, setPastDue] = useState<SubscriptionWithRestaurant[]>([]);
  const [error, setError] = useState('');
  const [pastDueError, setPastDueError] = useState(false);

  async function loadStats() {
    setError('');
    try {
      setStats(await getDashboard());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Dashboard metrics could not be loaded.');
    }
  }

  async function loadPastDue() {
    setPastDueError(false);
    try {
      const { subscriptions } = await listSubscriptions('past_due');
      setPastDue(subscriptions ?? []);
    } catch {
      setPastDueError(true);
    }
  }

  useEffect(() => {
    void loadStats();
    void loadPastDue();
  }, []);

  if (!stats) {
    return (
      <section className="space-y-6">
        <h1 className="page-title">Dashboard</h1>
        {error ? (
          <div className="error-notice flex flex-wrap items-center justify-between gap-3">
            <p role="alert">{error}</p>
            <button type="button" className="btn-secondary" onClick={() => void loadStats()}>Retry</button>
          </div>
        ) : (
          <p role="status" className="text-sm text-[var(--fg-muted)]">Loading dashboard…</p>
        )}
      </section>
    );
  }

  const kpis = [
    {
      label: 'Total Restaurants',
      value: stats.total_restaurants,
      icon: BuildingStorefrontIcon,
    },
    {
      label: 'Active (7d)',
      value: stats.active_restaurants,
      icon: ChartBarIcon,
    },
    {
      label: 'Total Users',
      value: stats.total_users,
      icon: UsersIcon,
    },
    {
      label: 'Orders This Week',
      value: stats.orders_this_week,
      icon: ShoppingCartIcon,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Platform overview and health metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-[var(--line)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="grid size-9 place-items-center rounded-md bg-[var(--surface-2)]">
                <kpi.icon aria-hidden="true" className="size-5" />
              </div>
              <span className="text-sm text-gray-500">{kpi.label}</span>
            </div>
            <div className="text-3xl font-semibold tabular-nums">{kpi.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Past Due Alert */}
      {pastDueError && (
        <div className="error-notice mb-8 flex flex-wrap items-center justify-between gap-3">
          <p role="alert">Past-due subscriptions could not be loaded.</p>
          <button type="button" className="btn-secondary" onClick={() => void loadPastDue()}>Retry subscriptions</button>
        </div>
      )}
      {pastDue.length > 0 && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
            <h2 className="text-sm font-semibold text-yellow-800">
              {pastDue.length} restaurant{pastDue.length !== 1 ? 's' : ''} with past-due payment
            </h2>
          </div>
          <div className="space-y-2">
            {pastDue.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-yellow-900">{s.restaurant_name}</span>
                <a
                  href={`/dashboard/restaurants/${s.restaurant_id}`}
                  className="text-yellow-700 underline hover:text-yellow-900"
                >
                  Manage →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Breakdown + Total Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Distribution</h2>
          {stats.plan_breakdown && stats.plan_breakdown.length > 0 ? (
            <div className="space-y-3">
              {stats.plan_breakdown.map((pb) => (
                <div key={pb.plan_tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${planColor(pb.plan_tier)}`}>
                      {capitalize(pb.plan_tier)}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{pb.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No restaurants onboarded yet</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Total Orders (all time)</span>
              <span className="text-lg font-bold">{stats.total_orders.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Restaurants</span>
              <span className="text-lg font-bold">{stats.total_restaurants}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">Platform Users</span>
              <span className="text-lg font-bold">{stats.total_users}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
