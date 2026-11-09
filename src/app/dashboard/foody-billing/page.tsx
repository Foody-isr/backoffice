'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { getFoodyMerchant, saveFoodyMerchant, type FoodyMerchant, type FoodyMerchantField } from '@/lib/api';

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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try { setMerchant(await getFoodyMerchant()); form.current?.reset(); }
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
      });
      setMerchant(next);
      setNotice('Sandbox merchant saved.');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(code === 'foody_billing_conflict' || code === 'foody_billing_payment_pending'
        ? 'The configuration changed or these contracts still have an open payment or renewal. Reload before editing.'
        : code === 'foody_billing_invalid' ? 'Fill in the required credentials for the selected payment options.'
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
        <label className="flex items-start gap-2 text-sm"><input key={'enabled-' + merchant.revision} name="enabled" type="checkbox" defaultChecked={merchant.enabled} /> Allow new sandbox checkouts</label>
        <label className="flex items-start gap-2 text-sm"><input key={'recurring-' + merchant.revision} name="recurring_enabled" type="checkbox" defaultChecked={merchant.recurring_enabled} /> Enable monthly enrollment and renewals once Verifone confirms this sandbox contract</label>
        <div className="flex gap-3">
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save configuration</button>
          <button type="button" onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm font-medium">Reload</button>
        </div>
      </fieldset>
    </form>}
    {!merchant && !loading && <button onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm font-medium">Reload</button>}
  </main>;
}
