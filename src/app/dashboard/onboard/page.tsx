'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  onboardRestaurant,
  getFeatureCatalog,
  listUsers,
  OnboardInput,
  PlanDefinition,
  PlanTier,
  User,
} from '@/lib/api';
import { planColor, capitalize } from '@/lib/utils';

export default function OnboardPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [restaurantName, setRestaurantName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jerusalem');
  const [planTier, setPlanTier] = useState<PlanTier>('starter');

  // Owner mode: 'new' or 'existing'
  const [ownerMode, setOwnerMode] = useState<'new' | 'existing'>('new');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | undefined>();

  useEffect(() => {
    Promise.all([
      getFeatureCatalog(),
      listUsers({ role: 'owner' }),
    ]).then(([catalogData, usersData]) => {
      setPlans(catalogData.plans);
      setExistingUsers(usersData.users || []);
    });
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    setSlug(
      restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
    );
  }, [restaurantName]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const input: OnboardInput = {
      restaurant_name: restaurantName,
      slug,
      address,
      phone,
      timezone,
      plan_tier: planTier,
    };

    if (ownerMode === 'existing' && selectedOwnerId) {
      input.owner_id = selectedOwnerId;
    } else {
      input.owner_name = ownerName;
      input.owner_email = ownerEmail;
      input.owner_phone = ownerPhone;
      input.owner_password = ownerPassword;
    }

    try {
      const data = await onboardRestaurant(input);
      router.push(`/dashboard/restaurants/${data.restaurant.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = plans.find((p) => p.tier === planTier);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Onboard New Restaurant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a restaurant with owner account, plan, and default feature flags
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Restaurant Info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Restaurant Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Joe's Pizza"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="joes-pizza"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="123 Main St, Tel Aviv"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="+972-..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="Asia/Jerusalem">Asia/Jerusalem (Israel)</option>
                <option value="Europe/Paris">Europe/Paris (France)</option>
                <option value="America/New_York">America/New York</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </section>

        {/* Owner */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Restaurant Owner</h2>

          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={() => setOwnerMode('new')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                ownerMode === 'new' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Create New Owner
            </button>
            <button
              type="button"
              onClick={() => setOwnerMode('existing')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                ownerMode === 'existing' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Link Existing User
            </button>
          </div>

          {ownerMode === 'new' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required={ownerMode === 'new'}
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required={ownerMode === 'new'}
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="owner@restaurant.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="+972-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  required={ownerMode === 'new'}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="Min 8 characters"
                  minLength={8}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select existing owner</label>
              <select
                required={ownerMode === 'existing'}
                value={selectedOwnerId || ''}
                onChange={(e) => setSelectedOwnerId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="">Choose an owner...</option>
                {existingUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
              {existingUsers.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No owners found. Create a new one instead.</p>
              )}
            </div>
          )}
        </section>

        {/* Plan Selection */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Subscription Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p) => (
              <button
                key={p.tier}
                type="button"
                onClick={() => setPlanTier(p.tier)}
                className={`p-4 rounded-xl border-2 text-left transition ${
                  planTier === p.tier
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${planColor(p.tier)}`}>
                    {capitalize(p.tier)}
                  </span>
                  {planTier === p.tier && (
                    <span className="text-brand-500 text-xs font-bold">Selected</span>
                  )}
                </div>
                <div className="text-lg font-bold text-gray-900">{p.price} <span className="text-sm text-gray-500 font-normal">{p.period}</span></div>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {p.order_limit === 0 ? 'Unlimited orders' : `Up to ${p.order_limit} orders/mo`}
                  {' · '}
                  {p.features.length} features
                </p>
              </button>
            ))}
          </div>

          {/* Show included features for selected plan */}
          {selectedPlan && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Included features ({selectedPlan.features.length}):
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedPlan.features.map((f) => (
                  <span key={f} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
                    {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition"
          >
            {loading ? 'Creating...' : 'Create Restaurant'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
