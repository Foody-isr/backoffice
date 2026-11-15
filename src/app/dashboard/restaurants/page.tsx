'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listRestaurants, listSubscriptions, deleteRestaurant, Restaurant, SubscriptionWithRestaurant, SubscriptionStatus } from '@/lib/api';
import { planColor, capitalize, formatShortDate } from '@/lib/utils';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';

const SUB_STATUS_COLOR: Record<SubscriptionStatus, string> = {
  trial: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-yellow-100 text-yellow-700',
  deactivated: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [subMap, setSubMap] = useState<Map<number, SubscriptionWithRestaurant>>(new Map());
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscriptionError, setSubscriptionError] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    void loadRestaurants();
    void loadSubscriptions();
  }, []);

  async function loadRestaurants(query = '') {
    setAppliedSearch(query);
    setError('');
    setLoading(true);
    try {
      const data = await listRestaurants(query);
      setRestaurants(data.restaurants || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscriptions() {
    setSubscriptionError(false);
    try {
      const { subscriptions } = await listSubscriptions();
      setSubMap(new Map((subscriptions ?? []).map(s => [s.restaurant_id, s])));
    } catch {
      setSubscriptionError(true);
    }
  }

  async function handleDelete(r: Restaurant) {
    const confirmed = window.confirm(
      `⚠️ PERMANENT DELETE\n\nAre you sure you want to permanently delete "${r.name}" (#${r.id})?\n\nThis will delete ALL data: orders, menu, stock, tables, sessions, subscriptions, etc.\n\nThis action CANNOT be undone.`
    );
    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      `Last chance! Type OK to confirm deletion of "${r.name}" and ALL its data.`
    );
    if (!doubleConfirm) return;

    setDeletingId(r.id);
    try {
      await deleteRestaurant(r.id);
      setRestaurants((prev) => prev.filter((rest) => rest.id !== r.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to delete restaurant');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Restaurants</h1>
          {!loading && !error && (
            <p className="mt-1 text-sm text-[var(--fg-muted)]" role="status">
              {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''}{appliedSearch ? ' found' : ' registered'}
            </p>
          )}
        </div>
        <Link href="/dashboard/onboard" className="btn-primary">
          <PlusIcon aria-hidden="true" className="size-4" />
          Onboard New
        </Link>
      </header>

      <form
        role="search"
        aria-label="Search restaurants"
        className="flex flex-wrap gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (!loading) void loadRestaurants(search.trim());
        }}
      >
        <div className="relative w-full sm:max-w-sm">
          <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            aria-label="Restaurant name or slug"
            type="search"
            placeholder="Search by name or slug"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="field w-full pl-9"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-secondary">Search</button>
        {(search || appliedSearch) && (
          <button type="button" disabled={loading} className="min-h-11 rounded-md px-3 text-sm underline disabled:opacity-50" onClick={() => {
            setSearch('');
            void loadRestaurants();
          }}>
            Clear search
          </button>
        )}
      </form>

      {subscriptionError && (
        <div className="error-notice flex flex-wrap items-center justify-between gap-3">
          <p role="alert">Subscription statuses could not be loaded.</p>
          <button type="button" className="btn-secondary" onClick={() => void loadSubscriptions()}>Retry subscriptions</button>
        </div>
      )}
      {loading ? (
        <p role="status" className="py-12 text-center text-sm text-[var(--fg-muted)]">Loading restaurants…</p>
      ) : error ? (
        <div className="error-notice flex flex-wrap items-center justify-between gap-3">
          <p role="alert">{error}</p>
          <button type="button" className="btn-secondary" onClick={() => void loadRestaurants(appliedSearch)}>Retry</button>
        </div>
      ) : (
        <div className="table-scroll" role="region" aria-label="Restaurants table" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Owner</th>
                <th scope="col">Plan</th>
                <th scope="col">Subscription</th>
                <th scope="col">Created</th>
                <th scope="col" className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => {
                const subscription = subMap.get(r.id);
                return (
                  <tr key={r.id}>
                    <td className="tabular-nums text-gray-600">#{r.id}</td>
                    <th scope="row" className="min-w-36 font-semibold">{r.name}</th>
                    <td className="text-xs text-gray-600">{r.slug || '—'}</td>
                    <td className="min-w-32 text-gray-600">{r.owner?.full_name || `User #${r.owner_id}`}</td>
                    <td>
                      {r.plan ? (
                        <span className={`table-badge ${planColor(r.plan.plan_tier)}`}>
                          {capitalize(r.plan.plan_tier)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">No plan</span>
                      )}
                    </td>
                    <td>
                      {subscription ? (
                        <span className={`table-badge ${SUB_STATUS_COLOR[subscription.status]}`}>
                          {capitalize(subscription.status.replace('_', ' '))}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs tabular-nums text-gray-600">{formatShortDate(r.created_at)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/restaurants/${r.id}`} className="btn-secondary min-h-8 px-3 text-xs">
                          Manage
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.id}
                          className="min-h-8 whitespace-nowrap rounded-full px-3 text-xs font-medium text-[var(--danger-500)] hover:bg-[var(--danger-50)] disabled:opacity-50"
                        >
                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {restaurants.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--fg-muted)]">
                    {appliedSearch ? 'No restaurants match this search.' : 'No restaurants have been onboarded yet.'}
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
