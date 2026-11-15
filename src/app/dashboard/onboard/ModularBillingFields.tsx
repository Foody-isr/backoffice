'use client';

import type { FoodyModule, FoodyModuleCatalog, ModularOnboardingInput } from '@/lib/api';

export type BillingDraft = {
  mode: 'public' | 'private';
  trial: boolean;
  days: string;
  trialModules: FoodyModule[];
  modules: FoodyModule[];
  extraPOS: string;
  title: string;
  terms: string;
  monthly: string;
  annual: string;
  tax: 'ht' | 'ttc';
};

/** Initial public offer with a two-week trial to be scoped by the operator. */
export function newBillingDraft(days = 14): BillingDraft {
  return { mode: 'public', trial: true, days: String(days), trialModules: [], modules: [], extraPOS: '0',
    title: '', terms: '', monthly: '', annual: '', tax: 'ht' };
}

function amount(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const minor = Math.round(Number(normalized) * 100);
  return minor > 0 && minor <= 100_000_000 ? minor : null;
}

/** Builds a sandbox request; the API validates the offer and computes public prices. */
export function billingInput(catalog: FoodyModuleCatalog, draft: BillingDraft): ModularOnboardingInput | null {
  const days = draft.trial ? Number(draft.days) : 0;
  if (draft.trial && (!Number.isSafeInteger(days) || days < catalog.minimum_trial_days || !draft.trialModules.length)) return null;
  const request: ModularOnboardingInput = {
    mode: draft.mode, catalog_version: catalog.version, trial_days: days, trial_modules: draft.trial ? draft.trialModules : [],
  };
  if (draft.mode === 'public') return request;

  const monthly = amount(draft.monthly);
  const annual = draft.annual.trim() ? amount(draft.annual) : 0;
  const extraPOS = draft.modules.includes('restaurant') ? Number(draft.extraPOS) : 0;
  if (!draft.title.trim() || !draft.terms.trim() || !draft.modules.length || monthly === null || annual === null ||
    !Number.isSafeInteger(extraPOS) || extraPOS < 0 || request.trial_modules.some(id => !draft.modules.includes(id))) return null;
  return { ...request, custom: { modules: draft.modules, title: draft.title.trim(), terms: draft.terms.trim(),
    monthly_minor: monthly, annual_minor: annual, tax_mode: draft.tax, extra_pos_licences: extraPOS } };
}

const field = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm';
const money = (minor: number) => new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS' }).format(minor / 100);

/** Configures the price and trial separately before sending the owner's invitation. */
export default function ModularBillingFields({ catalog, value, onChange }: {
  catalog: FoodyModuleCatalog;
  value: BillingDraft;
  onChange: (value: BillingDraft) => void;
}) {
  function edit<K extends keyof BillingDraft>(key: K, next: BillingDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  function toggleModule(key: 'modules' | 'trialModules', id: FoodyModule, checked: boolean) {
    const next = checked ? [...value[key], id] : value[key].filter(item => item !== id);
    onChange({ ...value, [key]: next,
      ...(key === 'modules' && !checked ? { trialModules: value.trialModules.filter(item => item !== id) } : {}) });
  }

  return <section className="space-y-5 rounded-lg border border-gray-200 bg-white p-6" aria-labelledby="sandbox-offer-title">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="sandbox-offer-title" className="font-semibold text-gray-900">Subscription offer</h2>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">Sandbox</span>
      </div>
      <p className="mt-1 text-sm text-gray-600">The invitation opens the owner’s subscription setup.</p>
    </div>
    <label className="block text-sm font-medium">Offer type
      <select className={field} value={value.mode} onChange={event => {
        const mode = event.target.value as BillingDraft['mode'];
        onChange({ ...value, mode, trialModules: mode === 'private' ? value.trialModules.filter(id => value.modules.includes(id)) : value.trialModules });
      }}>
        <option value="public">Public catalogue</option>
        <option value="private">Custom offer</option>
      </select>
    </label>
    {value.mode === 'public' ? (
      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 px-4 text-sm">
        {catalog.products.map(product => <li key={product.id} className="flex flex-wrap justify-between gap-2 py-3">
          <span>{product.name.en}</span><span>{money(product.monthly_minor)} / month excl. VAT</span>
        </li>)}
        <li className="flex flex-wrap justify-between gap-2 py-3"><span>Additional named POS licence</span><span>{money(catalog.extra_pos_minor)} / month excl. VAT</span></li>
      </ul>
    ) : (
      <div className="space-y-4">
        <label className="block text-sm font-medium">Offer name
          <input className={field} required maxLength={120} value={value.title} onChange={event => edit('title', event.target.value)} />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Included modules</legend>
          {catalog.products.map(product => <label key={product.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.modules.includes(product.id)} onChange={event => toggleModule('modules', product.id, event.target.checked)} />{product.name.en}
          </label>)}
        </fieldset>
        {value.modules.includes('restaurant') && <label className="block text-sm font-medium">Additional named POS licences
          <input className={field} type="number" min={0} step={1} required value={value.extraPOS} onChange={event => edit('extraPOS', event.target.value)} />
        </label>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">Monthly price (ILS)
            <input className={field} inputMode="decimal" required value={value.monthly} onChange={event => edit('monthly', event.target.value)} />
          </label>
          <label className="block text-sm font-medium">Annual price (optional)
            <input className={field} inputMode="decimal" value={value.annual} onChange={event => edit('annual', event.target.value)} />
          </label>
          <label className="block text-sm font-medium">VAT
            <select className={field} value={value.tax} onChange={event => edit('tax', event.target.value as BillingDraft['tax'])}>
              <option value="ht">Prices exclude VAT</option><option value="ttc">Prices include VAT</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">Offer terms
          <textarea className={field} required rows={3} maxLength={5000} value={value.terms} onChange={event => edit('terms', event.target.value)} />
        </label>
      </div>
    )}
    <fieldset className="space-y-3 border-t border-gray-200 pt-4">
      <legend className="pr-2 text-sm font-medium">Trial</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.trial} onChange={event => edit('trial', event.target.checked)} />
        Enable trial
      </label>
      {value.trial ? <>
        <label className="block text-sm font-medium">Duration in days
          <input className={field + ' max-w-32'} required type="number" min={catalog.minimum_trial_days} step={1} value={value.days}
            onChange={event => edit('days', event.target.value)} />
        </label>
        <p className="text-sm text-gray-600">Allowed modules for this trial</p>
        {catalog.products.filter(product => value.mode === 'public' || value.modules.includes(product.id)).map(product => (
          <label key={product.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.trialModules.includes(product.id)} onChange={event => toggleModule('trialModules', product.id, event.target.checked)} />
            {product.name.en}
          </label>
        ))}
        <p className="text-sm text-gray-600">The trial starts when the owner activates it.</p>
      </> : <p className="text-sm text-gray-600">The owner subscribes during account setup.</p>}
    </fieldset>
  </section>;
}
