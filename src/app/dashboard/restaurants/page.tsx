'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listRestaurants, Restaurant } from '@/lib/api';
import { planColor, capitalize, formatShortDate } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRestaurants();
  }, []);

  async function loadRestaurants(q?: string) {
    setLoading(true);
    try {
      const data = await listRestaurants(q);
      setRestaurants(data.restaurants || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    loadRestaurants(search);
  }

  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurants</h1>
          <p className="text-sm text-gray-500 mt-1">
            {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <Link
          href="/dashboard/onboard"
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
        >
          + Onboard New
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg transition"
        >
          Search
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">ID</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Slug</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Owner</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Plan</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Created</th>
                <th className="px-4 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {restaurants.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">#{r.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.slug || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.owner?.full_name || `User #${r.owner_id}`}</td>
                  <td className="px-4 py-3">
                    {r.plan ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${planColor(r.plan.plan_tier)}`}>
                        {capitalize(r.plan.plan_tier)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">No plan</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/restaurants/${r.id}`}
                      className="text-brand-500 hover:text-brand-600 text-xs font-semibold"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
              {restaurants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No restaurants found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
