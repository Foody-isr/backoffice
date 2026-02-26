'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getRestaurant,
  getFeatureCatalog,
  getRestaurantSubscription,
  adminActivateSubscription,
  adminDeactivateSubscription,
  toggleFeature,
  setRestaurantPlan,
  Restaurant,
  FeatureMeta,
  PlanDefinition,
  RestaurantFeature,
  FeatureKey,
  PlanTier,
  SubscriptionDetail,
} from '@/lib/api';
import { planColor, capitalize, formatDate, categoryInfo } from '@/lib/utils';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

type Tab = 'features' | 'billing';

const SUB_STATUS_COLOR: Record<string, string> = {
  trial: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-yellow-100 text-yellow-700',
  deactivated: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [tab, setTab] = useState<Tab>('features');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [catalog, setCatalog] = useState<FeatureMeta[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [features, setFeatures] = useState<RestaurantFeature[]>([]);
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subAction, setSubAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [restData, catalogData] = await Promise.all([
        getRestaurant(id),
        getFeatureCatalog(),
      ]);
      setRestaurant(restData.restaurant);
      setFeatures(restData.restaurant.features || []);
      setCatalog(catalogData.features);
      setPlans(catalogData.plans);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab !== 'billing' || sub !== null) return;
    setSubLoading(true);
    getRestaurantSubscription(id)
      .then((d) => setSub(d.subscription))
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, [tab, id, sub]);

  async function handleActivate() {
    if (!confirm('Manually activate this subscription?')) return;
    setSubAction(true);
    try {
      await adminActivateSubscription(id);
      const d = await getRestaurantSubscription(id);
      setSub(d.subscription);
    } finally {
      setSubAction(false);
    }
  }

  async function handleDeactivate() {
    if (!confirm('Deactivate this subscription? The restaurant will lose access.')) return;
    setSubAction(true);
    try {
      await adminDeactivateSubscription(id);
      const d = await getRestaurantSubscription(id);
      setSub(d.subscription);
    } finally {
      setSubAction(false);
    }
  }

  async function handleToggle(featureKey: FeatureKey, enabled: boolean) {
    setSaving(featureKey);
    try {
      const data = await toggleFeature(id, featureKey, enabled);
      setFeatures(data.features);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to toggle feature');
    } finally {
      setSaving(null);
    }
  }

  async function handlePlanChange(tier: PlanTier) {
    if (!confirm(`Change plan to ${capitalize(tier)}? This will reset all features to the plan defaults.`)) {
      return;
    }
    setSaving('plan');
    try {
      await setRestaurantPlan(id, tier);
      await loadData(); // reload everything
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to change plan');
    } finally {
      setSaving(null);
    }
  }

  function isFeatureEnabled(key: FeatureKey): boolean {
    const f = features.find((f) => f.feature_key === key);
    return f?.enabled ?? false;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !restaurant) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error || 'Not found'}</div>;
  }

  // Group features by category
  const grouped = catalog.reduce<Record<string, FeatureMeta[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const categoryOrder = ['core', 'ordering', 'operations', 'intelligence', 'notifications'];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              ID #{restaurant.id} · {restaurant.slug || 'no slug'} · Created {formatDate(restaurant.created_at)}
            </p>
          </div>
          {restaurant.plan && (
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${planColor(restaurant.plan.plan_tier)}`}>
              {capitalize(restaurant.plan.plan_tier)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['features', 'billing'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 -mb-px ${
              tab === t
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'billing' && (
        <div className="space-y-6">
          {subLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : sub ? (
            <>
              {/* Subscription status card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${SUB_STATUS_COLOR[sub.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {sub.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div>
                    <div className="text-gray-500">Plan</div>
                    <div className="font-semibold text-gray-900 capitalize">{sub.plan_tier}</div>
                  </div>
                  {sub.card_last_four && (
                    <div>
                      <div className="text-gray-500">Payment method</div>
                      <div className="font-semibold text-gray-900">{sub.card_brand} •••• {sub.card_last_four}</div>
                    </div>
                  )}
                  {sub.trial_ends_at && (
                    <div>
                      <div className="text-gray-500">Trial ends</div>
                      <div className="font-semibold text-gray-900">{new Date(sub.trial_ends_at).toLocaleDateString()}</div>
                    </div>
                  )}
                  {sub.current_period_end && (
                    <div>
                      <div className="text-gray-500">Next billing</div>
                      <div className="font-semibold text-gray-900">{new Date(sub.current_period_end).toLocaleDateString()}</div>
                    </div>
                  )}
                  {sub.grace_period_until && (
                    <div>
                      <div className="text-gray-500">Grace period until</div>
                      <div className="font-semibold text-red-600">{new Date(sub.grace_period_until).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  {sub.status !== 'active' && (
                    <button
                      onClick={handleActivate}
                      disabled={subAction}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {subAction ? 'Working…' : 'Activate'}
                    </button>
                  )}
                  {sub.status !== 'deactivated' && sub.status !== 'cancelled' && (
                    <button
                      onClick={handleDeactivate}
                      disabled={subAction}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {subAction ? 'Working…' : 'Deactivate'}
                    </button>
                  )}
                </div>
              </div>

              {/* Payment history */}
              {sub.events && sub.events.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
                  <div className="space-y-2">
                    {sub.events.map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          evt.event_type === 'payment_succeeded' ? 'bg-green-100 text-green-700'
                          : evt.event_type === 'payment_failed' ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {evt.event_type.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-4 text-gray-500">
                          {evt.amount != null && (
                            <span className="font-medium text-gray-900">₪{evt.amount.toFixed(0)}</span>
                          )}
                          <span>{new Date(evt.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No subscription found for this restaurant.</p>
          )}
        </div>
      )}

      {tab === 'features' && (
      <>{/* Restaurant Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Address</span>
              <span className="text-gray-900">{restaurant.address || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="text-gray-900">{restaurant.phone || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Timezone</span>
              <span className="text-gray-900">{restaurant.timezone || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pickup</span>
              <span className={restaurant.pickup_enabled ? 'text-green-600' : 'text-gray-400'}>
                {restaurant.pickup_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Delivery</span>
              <span className={restaurant.delivery_enabled ? 'text-green-600' : 'text-gray-400'}>
                {restaurant.delivery_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Owner</h3>
          {restaurant.owner ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="text-gray-900">{restaurant.owner.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-900 text-xs">{restaurant.owner.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="text-gray-900">{restaurant.owner.phone || '—'}</span>
              </div>
              <Link
                href={`/dashboard/users`}
                className="block mt-2 text-xs text-brand-500 hover:text-brand-600"
              >
                View user →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Owner not found</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Plan & Limits</h3>
          {restaurant.plan ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Plan</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${planColor(restaurant.plan.plan_tier)}`}>
                  {capitalize(restaurant.plan.plan_tier)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order Limit</span>
                <span className="text-gray-900">
                  {restaurant.plan.order_limit === 0 ? 'Unlimited' : `${restaurant.plan.order_limit}/mo`}
                </span>
              </div>
              <hr className="my-2" />
              <p className="text-xs text-gray-400 mb-2">Change plan:</p>
              <div className="flex gap-2">
                {plans.map((p) => (
                  <button
                    key={p.tier}
                    onClick={() => handlePlanChange(p.tier)}
                    disabled={saving === 'plan' || restaurant.plan?.plan_tier === p.tier}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      restaurant.plan?.plan_tier === p.tier
                        ? 'bg-brand-500 text-white cursor-default'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No plan assigned</p>
          )}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Feature Flags</h2>
        <p className="text-sm text-gray-500 mt-1">
          Toggle features for this restaurant. Dependencies are enforced automatically.
        </p>
      </div>

      <div className="space-y-6">
        {categoryOrder.map((cat) => {
          const items = grouped[cat];
          if (!items) return null;
          const info = categoryInfo(cat);
          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span>{info.icon}</span>
                  {info.label}
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map((fm) => {
                  const enabled = isFeatureEnabled(fm.key);
                  const isSaving = saving === fm.key;
                  const deps = fm.requires_all?.length
                    ? fm.requires_all.map((d) => catalog.find((c) => c.key === d)?.label || d).join(', ')
                    : null;
                  return (
                    <div key={fm.key} className="px-5 py-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{fm.label}</span>
                          {fm.always_on && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded">
                              ALWAYS ON
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{fm.description}</p>
                        {deps && (
                          <p className="text-xs text-amber-600 mt-0.5">Requires: {deps}</p>
                        )}
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {fm.always_on ? (
                          <div className="w-11 h-6 bg-brand-500 rounded-full relative opacity-60 cursor-not-allowed">
                            <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow" />
                          </div>
                        ) : (
                          <button
                            onClick={() => handleToggle(fm.key, !enabled)}
                            disabled={isSaving}
                            className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                              enabled ? 'bg-brand-500' : 'bg-gray-300'
                            } ${isSaving ? 'opacity-50' : ''}`}
                          >
                            <div
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                                enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}
