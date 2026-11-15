'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  getCibusConfig,
  updateCibusConfig,
  type CibusConfigResponse,
  type UpdateCibusConfigInput,
} from '@/lib/api';

/** Configures the shared Cibus integration for the connected API. */
export default function CibusPage() {
  const [config, setConfig] = useState<CibusConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [integratorKey, setIntegratorKey] = useState('');
  const [integratorSecret, setIntegratorSecret] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getCibusConfig();
      setConfig(current);
      setEnvironment(current.environment);
      setEndpointUrl(current.endpoint_url || '');
    } catch (err: unknown) {
      setConfig(null);
      setError(err instanceof Error ? err.message : 'Could not load Cibus settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || loading || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const input: UpdateCibusConfigInput = { environment, endpoint_url: endpointUrl };
      if (integratorKey) input.integrator_key = integratorKey;
      if (integratorSecret) input.integrator_secret = integratorSecret;
      await updateCibusConfig(input);
      setSaved(true);
      setIntegratorKey('');
      setIntegratorSecret('');
      await loadConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save Cibus settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-xl space-y-6">
      <header>
        <h1 className="page-title">Cibus (Pluxee)</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
          Set the Cibus environment, endpoint and vendor credentials shared by restaurants in this API environment.
          Each restaurant enters its terminal identifiers separately in Foody Admin.
        </p>
      </header>

      {saved && <p role="status" className="text-sm font-medium text-green-700">Cibus settings saved.</p>}
      {error && (
        <div className="error-notice flex flex-wrap items-center justify-between gap-3">
          <p role="alert">{error}</p>
          {!config && <button type="button" className="btn-secondary" onClick={() => void loadConfig()}>Retry</button>}
        </div>
      )}
      {loading && <p role="status" className="text-sm text-[var(--fg-muted)]">Loading Cibus settings…</p>}
      {config && !loading && (
        <form className="rounded-lg border border-[var(--line)] p-5 sm:p-6" onChange={() => setSaved(false)} onSubmit={handleSave}>
          <fieldset disabled={saving} className="space-y-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Environment
              <select
                className="field max-w-xs font-normal"
                value={environment}
                onChange={event => setEnvironment(event.target.value as 'sandbox' | 'production')}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Endpoint URL (optional)
              <input
                className="field font-normal"
                value={endpointUrl}
                onChange={event => setEndpointUrl(event.target.value)}
                placeholder="Use the environment default"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Integrator key (optional)
              <input
                className="field font-normal"
                type="password"
                autoComplete="off"
                value={integratorKey}
                onChange={event => setIntegratorKey(event.target.value)}
                placeholder={config.masked_integrator_key || 'Set only if supplied by Cibus'}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Integrator secret (optional)
              <input
                className="field font-normal"
                type="password"
                autoComplete="off"
                value={integratorSecret}
                onChange={event => setIntegratorSecret(event.target.value)}
                placeholder={config.masked_integrator_secret || 'Set only if supplied by Cibus'}
              />
            </label>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Cibus settings'}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
