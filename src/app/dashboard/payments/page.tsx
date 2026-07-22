'use client';

import { useEffect, useState } from 'react';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import {
  getCibusConfig,
  updateCibusConfig,
  type CibusConfigResponse,
  type UpdateCibusConfigInput,
} from '@/lib/api';

export default function PaymentsPage() {
  const [config, setConfig] = useState<CibusConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [integratorKey, setIntegratorKey] = useState('');
  const [integratorSecret, setIntegratorSecret] = useState('');

  useEffect(() => {
    getCibusConfig()
      .then((c) => {
        setConfig(c);
        setEnvironment(c.environment);
        setEndpointUrl(c.endpoint_url || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load Cibus config'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const input: UpdateCibusConfigInput = { environment };
      input.endpoint_url = endpointUrl;
      if (integratorKey) input.integrator_key = integratorKey;
      if (integratorSecret) input.integrator_secret = integratorSecret;
      await updateCibusConfig(input);
      setSaved(true);
      setIntegratorKey('');
      setIntegratorSecret('');
      // Reload to reflect masked values
      const fresh = await getCibusConfig();
      setConfig(fresh);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save Cibus config');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <CreditCardIcon className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">Platform-level payment integration settings shared across all restaurants.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Cibus (Pluxee)</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Foody&apos;s integration environment and (optional) vendor credentials. Each restaurant enters its own
          Cibus terminal ID (restaurantID / posID / companyCode) separately, in their Foody Admin.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Endpoint URL <span className="text-gray-400">(optional — defaults per environment)</span>
            </label>
            <input
              type="text"
              placeholder="https://api.poslb.pluxee.co.il/posws.asmx"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Integrator Key <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="password"
              placeholder={config?.masked_integrator_key || 'Set only if Cibus issued Foody a vendor key'}
              value={integratorKey}
              onChange={(e) => setIntegratorKey(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Integrator Secret <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="password"
              placeholder={config?.masked_integrator_secret || 'Set only if Cibus issued Foody a vendor secret'}
              value={integratorSecret}
              onChange={(e) => setIntegratorSecret(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save Cibus Config'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
