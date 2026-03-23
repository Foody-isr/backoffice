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
  updateUserEmail,
  toggleFeature,
  setRestaurantPlan,
  getPaymentConfig,
  updatePaymentConfig,
  getCustomDomain,
  updateCustomDomain,
  Restaurant,
  FeatureMeta,
  PlanDefinition,
  RestaurantFeature,
  FeatureKey,
  PlanTier,
  SubscriptionDetail,
  PaymentConfigResponse,
  UpdatePaymentConfigInput,
} from '@/lib/api';
import { planColor, capitalize, formatDate, categoryInfo } from '@/lib/utils';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

type Tab = 'features' | 'billing' | 'payment' | 'domain';

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
  const [ownerEmailDraft, setOwnerEmailDraft] = useState('');
  const [ownerEmailSaving, setOwnerEmailSaving] = useState(false);
  const [error, setError] = useState('');

  // Payment config state
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigResponse | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'payplus' | 'sumit'>('payplus');
  const [paymentCreds, setPaymentCreds] = useState<UpdatePaymentConfigInput>({ provider: 'payplus' });

  // Custom domain state
  const [customDomain, setCustomDomain] = useState('');
  const [customDomainDraft, setCustomDomainDraft] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainLoaded, setDomainLoaded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [restData, catalogData] = await Promise.all([
        getRestaurant(id),
        getFeatureCatalog(),
      ]);
      setRestaurant(restData.restaurant);
      setOwnerEmailDraft(restData.restaurant.owner?.email || '');
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

  useEffect(() => {
    if (tab !== 'payment' || paymentConfig !== null) return;
    setPaymentLoading(true);
    getPaymentConfig(id)
      .then((cfg) => {
        setPaymentConfig(cfg);
        setPaymentProvider(cfg.provider);
        setPaymentCreds({ provider: cfg.provider });
      })
      .catch(() => {})
      .finally(() => setPaymentLoading(false));
  }, [tab, id, paymentConfig]);

  useEffect(() => {
    if (tab !== 'domain' || domainLoaded) return;
    setDomainLoading(true);
    getCustomDomain(id)
      .then((data) => {
        setCustomDomain(data.custom_domain || '');
        setCustomDomainDraft(data.custom_domain || '');
        setDomainLoaded(true);
      })
      .catch(() => {})
      .finally(() => setDomainLoading(false));
  }, [tab, id, domainLoaded]);

  async function handleDomainSave() {
    setDomainSaving(true);
    try {
      await updateCustomDomain(id, customDomainDraft.trim());
      setCustomDomain(customDomainDraft.trim());
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update custom domain');
    } finally {
      setDomainSaving(false);
    }
  }

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

  async function handleOwnerEmailUpdate() {
    if (!restaurant?.owner) return;
    const nextEmail = ownerEmailDraft.trim();
    if (!nextEmail) {
      alert('Email is required');
      return;
    }
    if (nextEmail === restaurant.owner.email) {
      return;
    }

    setOwnerEmailSaving(true);
    try {
      await updateUserEmail(restaurant.owner.id, nextEmail);
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update owner email');
    } finally {
      setOwnerEmailSaving(false);
    }
  }

  async function handlePaymentSave() {
    setPaymentSaving(true);
    try {
      const input: UpdatePaymentConfigInput = { provider: paymentProvider };
      if (paymentProvider === 'sumit') {
        input.sumit_company_id = paymentCreds.sumit_company_id;
        input.sumit_api_key = paymentCreds.sumit_api_key;
        input.sumit_public_key = paymentCreds.sumit_public_key;
      } else if (paymentCreds.payplus_api_key) {
        input.payplus_api_key = paymentCreds.payplus_api_key;
        input.payplus_secret_key = paymentCreds.payplus_secret_key;
        input.payplus_payment_page_uid = paymentCreds.payplus_payment_page_uid;
      }
      await updatePaymentConfig(id, input);
      // Reload config to see masked values
      setPaymentConfig(null); // triggers reload via useEffect
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save payment config');
    } finally {
      setPaymentSaving(false);
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
          {restaurant.plan ? (
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${planColor(restaurant.plan.plan_tier)}`}>
              {capitalize(restaurant.plan.plan_tier)}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700">
              No Plan
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['features', 'billing', 'payment', 'domain'] as Tab[]).map((t) => (
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

      {tab === 'payment' && (
        <div className="space-y-6">
          {paymentLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Payment Provider</h2>
              <p className="text-sm text-gray-500 mb-6">
                Choose which payment gateway this restaurant uses for online payments.
              </p>

              {/* Current status */}
              {paymentConfig && (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-500">Current: </span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    paymentConfig.provider === 'sumit'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {paymentConfig.provider === 'sumit' ? 'Summit' : 'PayPlus'}
                  </span>
                  {paymentConfig.has_custom_credentials && (
                    <span className="text-gray-500 ml-2">
                      (Custom credentials{paymentConfig.masked_api_key ? `: ${paymentConfig.masked_api_key}` : ''})
                    </span>
                  )}
                  {!paymentConfig.has_custom_credentials && paymentConfig.provider === 'payplus' && (
                    <span className="text-gray-400 ml-2">(Using global defaults)</span>
                  )}
                </div>
              )}

              {/* Provider selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                <select
                  value={paymentProvider}
                  onChange={(e) => {
                    const v = e.target.value as 'payplus' | 'sumit';
                    setPaymentProvider(v);
                    setPaymentCreds({ provider: v });
                  }}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="payplus">PayPlus (Global Default)</option>
                  <option value="sumit">Summit</option>
                </select>
              </div>

              {/* Summit credentials */}
              {paymentProvider === 'sumit' && (
                <div className="space-y-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700">Summit Credentials</h3>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Company ID</label>
                    <input
                      type="number"
                      placeholder="e.g. 12345678"
                      value={paymentCreds.sumit_company_id || ''}
                      onChange={(e) => setPaymentCreds({ ...paymentCreds, sumit_company_id: Number(e.target.value) || undefined })}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                    <input
                      type="password"
                      placeholder={paymentConfig?.masked_api_key || 'Enter API key'}
                      value={paymentCreds.sumit_api_key || ''}
                      onChange={(e) => setPaymentCreds({ ...paymentCreds, sumit_api_key: e.target.value || undefined })}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Public Key <span className="text-gray-400">(optional)</span></label>
                    <input
                      type="password"
                      placeholder={paymentConfig?.masked_public_key || 'Enter public key'}
                      value={paymentCreds.sumit_public_key || ''}
                      onChange={(e) => setPaymentCreds({ ...paymentCreds, sumit_public_key: e.target.value || undefined })}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              {/* PayPlus custom credentials (optional) */}
              {paymentProvider === 'payplus' && (
                <div className="space-y-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700">PayPlus Credentials <span className="text-gray-400 font-normal">(leave empty to use global defaults)</span></h3>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                    <input
                      type="password"
                      placeholder={paymentConfig?.masked_api_key || 'Global default'}
                      value={paymentCreds.payplus_api_key || ''}
                      onChange={(e) => setPaymentCreds({ ...paymentCreds, payplus_api_key: e.target.value || undefined })}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Secret Key</label>
                    <input
                      type="password"
                      placeholder={paymentConfig?.masked_secret_key || 'Global default'}
                      value={paymentCreds.payplus_secret_key || ''}
                      onChange={(e) => setPaymentCreds({ ...paymentCreds, payplus_secret_key: e.target.value || undefined })}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Payment Page UID</label>
                    <input
                      type="password"
                      placeholder={paymentConfig?.masked_payment_page_uid || 'Global default'}
                      value={paymentCreds.payplus_payment_page_uid || ''}
                      onChange={(e) => setPaymentCreds({ ...paymentCreds, payplus_payment_page_uid: e.target.value || undefined })}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handlePaymentSave}
                disabled={paymentSaving}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
              >
                {paymentSaving ? 'Saving...' : 'Save Payment Config'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'domain' && (
        <div className="space-y-6">
          {domainLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Custom Domain</h2>
              <p className="text-sm text-gray-500 mb-6">
                Allow this restaurant to use their own domain instead of a Foody subdomain.
              </p>

              {/* Current status */}
              {customDomain && (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-500">Current: </span>
                  <span className="font-semibold text-gray-900">{customDomain}</span>
                </div>
              )}
              {!customDomain && domainLoaded && (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-400">
                  No custom domain configured
                </div>
              )}

              {/* Domain input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
                <input
                  type="text"
                  placeholder="e.g. mamietlv.co.il"
                  value={customDomainDraft}
                  onChange={(e) => setCustomDomainDraft(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty to remove the custom domain.</p>
              </div>

              {/* DNS Setup Guide */}
              <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">Setup Guide</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Follow these steps to connect a custom domain</p>
                </div>
                <div className="divide-y divide-gray-100">

                  {/* Step 1 */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Customer purchases a domain</p>
                        <p className="text-xs text-gray-500 mt-1">
                          The customer needs to own a domain (e.g. <span className="font-mono bg-gray-100 px-1 rounded">mamietlv.co.il</span>). They can purchase one from any registrar such as Namecheap, GoDaddy, Google Domains, or a local Israeli registrar.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Add a CNAME record in the DNS settings</p>
                        <p className="text-xs text-gray-500 mt-1 mb-2">
                          The customer (or you) should go to the domain&apos;s DNS management panel and add the following record:
                        </p>
                        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-100 text-gray-600">
                                <th className="px-3 py-2 text-left font-medium">Type</th>
                                <th className="px-3 py-2 text-left font-medium">Name / Host</th>
                                <th className="px-3 py-2 text-left font-medium">Value / Points to</th>
                                <th className="px-3 py-2 text-left font-medium">TTL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="text-gray-900">
                                <td className="px-3 py-2 font-mono font-semibold">CNAME</td>
                                <td className="px-3 py-2 font-mono">@ <span className="text-gray-400 font-sans">(or root)</span></td>
                                <td className="px-3 py-2 font-mono text-brand-600 font-semibold">app.foody-pos.co.il</td>
                                <td className="px-3 py-2 font-mono">Auto <span className="text-gray-400 font-sans">(or 3600)</span></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          If the registrar doesn&apos;t support CNAME on the root domain (@), use an <span className="font-semibold">A record</span> pointing to <span className="font-mono bg-gray-100 px-1 rounded">16.16.253.163</span> instead.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Remove conflicting records</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Make sure there are no existing <span className="font-mono bg-gray-100 px-1 rounded">A</span> or <span className="font-mono bg-gray-100 px-1 rounded">AAAA</span> records for the root domain that might conflict with the new CNAME. Delete them if they exist (common with default &quot;parked&quot; pages from the registrar).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Wait for DNS propagation</p>
                        <p className="text-xs text-gray-500 mt-1">
                          DNS changes can take up to 24-48 hours to propagate worldwide, but usually take effect within a few minutes. You can verify the setup by running:
                        </p>
                        <div className="mt-2 bg-gray-900 rounded-lg px-3 py-2 text-xs font-mono text-green-400">
                          dig {customDomainDraft || 'example.com'} CNAME +short
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Expected result: <span className="font-mono">app.foody-pos.co.il.</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">5</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">SSL / HTTPS configuration</p>
                        <p className="text-xs text-gray-500 mt-1">
                          If the customer uses <span className="font-semibold">Cloudflare</span> as their DNS provider (recommended), SSL is handled automatically &mdash; just make sure the proxy is enabled (orange cloud icon).
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          If they use another DNS provider, you&apos;ll need to configure an SSL certificate on our server (Nginx) for their domain using Let&apos;s Encrypt or a manual certificate.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 6 */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">6</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Save the domain above and add Nginx config</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Enter the domain in the field above and click Save. Then add a server block in Nginx on the production server:
                        </p>
                        <div className="mt-2 bg-gray-900 rounded-lg px-3 py-2 text-xs font-mono text-green-400 whitespace-pre leading-relaxed">{`server {
    listen 443 ssl;
    server_name ${customDomainDraft || 'example.com'};

    # SSL cert (Cloudflare origin or Let's Encrypt)
    ssl_certificate     /etc/ssl/${customDomainDraft || 'example.com'}/cert.pem;
    ssl_certificate_key /etc/ssl/${customDomainDraft || 'example.com'}/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`}</div>
                        <p className="text-xs text-gray-400 mt-2">
                          Then reload Nginx: <span className="font-mono bg-gray-100 px-1 rounded text-gray-600">sudo nginx -t && sudo systemctl reload nginx</span>
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleDomainSave}
                disabled={domainSaving || customDomainDraft === customDomain}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
              >
                {domainSaving ? 'Saving...' : 'Save Domain'}
              </button>
            </div>
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
              <div className="pt-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Update email (after demo)</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={ownerEmailDraft}
                    onChange={(e) => setOwnerEmailDraft(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="owner@restaurant.com"
                  />
                  <button
                    type="button"
                    onClick={handleOwnerEmailUpdate}
                    disabled={ownerEmailSaving || ownerEmailDraft.trim() === restaurant.owner.email}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    {ownerEmailSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span className="text-sm font-medium">No plan assigned</span>
              </div>
              <p className="text-xs text-gray-400">Assign a plan to enable feature gating for this restaurant.</p>
              <div className="flex gap-2">
                {plans.map((p) => (
                  <button
                    key={p.tier}
                    onClick={() => handlePlanChange(p.tier)}
                    disabled={saving === 'plan'}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
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
