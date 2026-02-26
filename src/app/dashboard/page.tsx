'use client';

import { useEffect, useState } from 'react';
import { getDashboard, DashboardStats } from '@/lib/api';
import { planColor, capitalize } from '@/lib/utils';
import {
  BuildingStorefrontIcon,
  UsersIcon,
  ShoppingCartIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Restaurants',
      value: stats.total_restaurants,
      icon: BuildingStorefrontIcon,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Active (7d)',
      value: stats.active_restaurants,
      icon: ChartBarIcon,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Total Users',
      value: stats.total_users,
      icon: UsersIcon,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Orders This Week',
      value: stats.orders_this_week,
      icon: ShoppingCartIcon,
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform overview and health metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-gray-500">{kpi.label}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{kpi.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

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
