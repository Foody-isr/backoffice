'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { getFoodyMerchant, listRestaurants, saveFoodyMerchant, type FoodyMerchant, type FoodyMerchantField } from '@/lib/api';

const fields: { key: FoodyMerchantField; label: string; max: number }[] = [
  { key: 'user_id', label: 'Verifone user ID', max: 255 },
  { key: 'api_key', label: 'API key', max: 2048 },
  { key: 'entity_id', label: 'Foody merchant entity ID', max: 100 },
  { key: 'checkout_contract_id', label: 'Hosted Checkout / CVV contract ID', max: 100 },
  { key: 'token_contract_id', label: 'Recurring / No-CVV token contract ID', max: 100 },
  { key: 'token_scope', label: 'Reuse token scope', max: 100 },
];

/** Manage Foody's own Verifone sandbox merchant, separately from restaurants. */
export default function FoodyMerchantPage() {
  const [merchant, setMerchant] = useState<FoodyMerchant | null>(null);
  const [restaurants, setRestaurants] = useState<{id: number; name: string}[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const config = await getFoodyMerchant();
      if (config.requires_restaurant_selection) setRestaurants((await listRestaurants()).restaurants);
      setMerchant(config);
      form.current?.reset();
    }
    catch (e) { setMerchant(null); setError(e instanceof Error && e.message === 'foody_billing_sandbox_only' ? 'Open the development Backoffice to configure sandbox billing.' : 'Could not read the Foody merchant configuration.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchant || lock.current) return;
    const data = new FormData(event.currentTarget);
    const values: Partial<Record<FoodyMerchantField, string>> = {};
    for (const field of fields) {
      const value = String(data.get(field.key) ?? '').trim();
      if (value) values[field.key] = value;
    }
    lock.current = true; setLoading(true); setError(''); setNotice('');
    try {
      const next = await saveFoodyMerchant({
        revision: merchant.revision, enabled: data.has('enabled'), recurring_enabled: data.has('recurring_enabled'), ...values,
        ...(merchant.requires_restaurant_selection && { cst_test_restaurant_id: Number(data.get('test_restaurant')) }),
      });
      setMerchant(next);
      setNotice('Sandbox merchant saved.');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(code === 'foody_billing_conflict' || code === 'foody_billing_payment_pending'
        ? 'Reload the settings. To change the test restaurant, verify any pending payment and stop its automatic renewal in Foody Admin.'
        : code === 'foody_billing_invalid' ? 'Check the credentials and choose a test restaurant without an active modular billing enrollment.'
        : 'Could not confirm the save. Reload to check the stored configuration.');
    } finally {
      form.current?.reset(); lock.current = false; setLoading(false);
    }
  }

  return <main className="max-w-3xl space-y-5">
    <div>
      <p className="text-sm font-medium text-brand-700">Sandbox</p>
      <h1 className="text-2xl font-bold text-gray-900">Foody billing</h1>
      <p className="mt-2 text-sm text-gray-600">Set up the Verifone merchant that receives Foody software subscription payments. Use the sandbox contracts issued to Foody.</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {loading && !merchant && <p role="status">Loading configuration…</p>}
    {merchant && <form ref={form} onSubmit={save} className="rounded-xl border border-gray-200 bg-white p-6">
      <fieldset disabled={loading} className="space-y-5">
        <legend className="mb-2 text-lg font-semibold">Verifone credentials</legend>
        <p className="text-sm text-gray-600">Existing values stay hidden. Leave a field empty to keep its saved value.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, label, max }) => <label key={key} className="block text-sm font-medium text-gray-900">
            {label}
            <input name={key} type="password" autoComplete="new-password" spellCheck={false} maxLength={max}
              placeholder={merchant.configured[key] ? 'Saved · enter to replace' : 'Not configured'}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>)}
        </div>
        {merchant.requires_restaurant_selection && <label className="block text-sm font-medium text-gray-900">
          CST test restaurant
          <select key={'cst-' + merchant.revision} name="test_restaurant" defaultValue={merchant.cst_test_restaurant_id}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
            <option value="0">None · disable CST subscriptions on production</option>
            {restaurants.filter(r => r.id > 0).map(r => <option key={r.id} value={r.id}>{r.name} (#{r.id})</option>)}
          </select>
          <span className="mt-1 block font-normal text-gray-600">Only this restaurant can use Foody subscription checkout and renewals on the production site. Payments go to Verifone CST.</span>
        </label>}
        <label className="flex items-start gap-2 text-sm"><input key={'enabled-' + merchant.revision} name="enabled" type="checkbox" defaultChecked={merchant.enabled} /> Allow new sandbox checkouts</label>
        <label className="flex items-start gap-2 text-sm"><input key={'recurring-' + merchant.revision} name="recurring_enabled" type="checkbox" defaultChecked={merchant.recurring_enabled} /> Enable monthly and annual recurring payments on the CST contract</label>
        <div className="flex gap-3">
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save configuration</button>
          <button type="button" onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm font-medium">Reload</button>
        </div>
      </fieldset>
    </form>}
    {!merchant && !loading && <button onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm font-medium">Reload</button>}
  </main>;
}
