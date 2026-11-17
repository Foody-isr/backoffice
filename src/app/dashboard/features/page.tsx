'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApiEnvironment, getEditableFoodyCatalog, getReviewedFoodyCatalog, publishFoodyCatalog, type FoodyEditableCatalog, type FoodyLicenceCounts, type FoodyPlan } from '@/lib/api';
import { formatFoodyAmount } from '@/lib/foody-modules';
import CommercialDocuments from '@/components/CommercialDocuments';

const field = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm';
const quotaLabels: Record<Exclude<keyof FoodyLicenceCounts, 'pos_users_unlimited'>, string> = {
  pos: 'Named POS users', chef: 'Chef users', kds: 'Kitchen displays', employees: 'Total accounts, including owner', pos_devices: 'Active POS devices',
};
type Tab = 'modules' | 'plans' | 'prices' | 'features' | 'documents';

function Quotas({ value, onChange }: { value: FoodyLicenceCounts; onChange: (next: FoodyLicenceCounts) => void }) {
  return <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <legend className="mb-2 text-sm font-semibold">Included users and devices</legend>
    <label className="text-sm sm:col-span-2 xl:col-span-3"><input type="checkbox" checked={!!value.pos_users_unlimited} onChange={event => onChange({ ...value, pos_users_unlimited: event.target.checked, pos: 0 })} /> Personal POS accounts without a per-employee charge</label>
    {(Object.keys(quotaLabels) as (keyof typeof quotaLabels)[]).filter(key => key !== 'pos' || !value.pos_users_unlimited).map(key => <label key={key} className="text-sm">
      {quotaLabels[key]}
      <input className={field} type="number" min={0} max={10000} step={1} value={value[key] ?? ''}
        placeholder={key === 'employees' || key === 'pos_devices' ? 'Unlimited' : '0'}
        onChange={event => onChange({ ...value, [key]: event.target.value === '' && (key === 'employees' || key === 'pos_devices') ? null : Number(event.target.value) })} />
    </label>)}
    <p className="text-xs text-gray-600 sm:col-span-2 xl:col-span-3">New device-based offers include personal POS accounts. Named-user quotas still apply to legacy offers and chef access. Reauthorizing the same physical device does not consume another device licence. Blank total-account or POS-device limits mean unlimited.</p>
  </fieldset>;
}

function Names({ value, onChange }: { value: Record<'en' | 'fr' | 'he', string>; onChange: (next: typeof value) => void }) {
  return <div className="grid gap-3 sm:grid-cols-3">{(['en', 'fr', 'he'] as const).map(lang => <label key={lang} className="text-sm">
    Name ({lang})<input dir={lang === 'he' ? 'rtl' : 'auto'} className={field} maxLength={120} required value={value[lang]} onChange={event => onChange({ ...value, [lang]: event.target.value })} />
  </label>)}</div>;
}


function QuotaChanges({ before, after }: { before?: FoodyLicenceCounts; after: FoodyLicenceCounts }) {
  return <span className="block text-xs text-gray-600">{(Object.keys(quotaLabels) as (keyof typeof quotaLabels)[])
    .filter(key => !before || before[key] !== after[key])
    .map(key => `${quotaLabels[key]}: ${before ? before[key] ?? 'Unlimited' : '—'} → ${after[key] ?? 'Unlimited'}`).join(' · ')}{before?.pos_users_unlimited !== after.pos_users_unlimited && ` · Personal POS accounts without per-employee charge: ${after.pos_users_unlimited ? 'Yes' : 'No'}`}</span>;
}

/** Edits versioned commercial offers while accepted customer contracts remain frozen. */
export default function PlansAndModulesPage() {
  const production = getApiEnvironment() === 'production';
  const sections: Tab[] = production ? ['modules', 'plans', 'prices', 'features'] : ['modules', 'plans', 'prices', 'features', 'documents'];
  const [saved, setSaved] = useState<FoodyEditableCatalog | null>(null);
  const [draft, setDraft] = useState<FoodyEditableCatalog | null>(null);
  const [tab, setTab] = useState<Tab>('modules');
  const [documentsDirty, setDocumentsDirty] = useState(false);
  const [selected, setSelected] = useState('restaurant');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    getEditableFoodyCatalog(request.signal).then(value => {
      if (request.signal.aborted) return;
      setSaved(value); setDraft(structuredClone(value)); setError('');
    }, () => { if (!request.signal.aborted) setError('The catalogue could not be loaded. Retry before editing.'); });
    return () => request.abort();
  }, [attempt]);
  const changed = saved && draft && JSON.stringify(saved) !== JSON.stringify(draft);
  const product = draft?.products.find(p => p.id === selected);
  const plan = draft?.plans.find(p => p.id === selected);
  const included = useMemo(() => {
    if (product) return product.capabilities ?? [];
    if (!plan || !draft) return [];
    return [...new Set([...draft.products.filter(p => plan.modules.includes(p.id)).flatMap(p => p.capabilities ?? []), ...plan.add_features])].filter(key => !plan.remove_features.includes(key));
  }, [product, plan, draft]);
  const missing = draft?.capabilities.filter(f => included.includes(f.key)).flatMap(f => f.requires_all.filter(key => !included.includes(key)).map(key => `${f.name.en} requires ${draft.capabilities.find(item => item.key === key)?.name.en ?? key}`)) ?? [];
  const categories = [...new Set(draft?.capabilities.map(f => f.category) ?? [])];
  const features = draft?.capabilities.filter(f => (category === 'all' || f.category === category) && `${f.name.en} ${f.name.fr} ${f.key}`.toLowerCase().includes(query.toLowerCase())) ?? [];

  function updateProduct(patch: Partial<NonNullable<typeof product>>) {
    setDraft(current => current && ({ ...current, products: current.products.map(p => p.id === selected ? { ...p, ...patch } : p) })); setReview(false);
  }
  function updatePlan(patch: Partial<FoodyPlan>) {
    setDraft(current => current && ({ ...current, plans: current.plans.map(p => p.id === selected ? { ...p, ...patch } : p) })); setReview(false);
  }
  function toggleFeature(key: string, enabled: boolean) {
    if (product) updateProduct({ capabilities: enabled ? [...included, key] : included.filter(f => f !== key) });
    if (plan && draft) {
      const fromModule = draft.products.some(p => plan.modules.includes(p.id) && p.capabilities?.includes(key));
      updatePlan({ add_features: [...plan.add_features.filter(f => f !== key), ...(!fromModule && enabled ? [key] : [])], remove_features: [...plan.remove_features.filter(f => f !== key), ...(fromModule && !enabled ? [key] : [])] });
    }
  }
  function addPlan() {
    const id = `plan-${Date.now()}`;
    const next: FoodyPlan = { id, name: { en: '', fr: '', he: '' }, modules: ['restaurant'], monthly_minor: draft?.products[0].monthly_minor ?? 59000,
      included: { pos: 0, pos_users_unlimited: true, chef: 0, kds: 0, employees: null, pos_devices: 2 }, add_features: [], remove_features: [], published: false };
    setDraft(current => current && ({ ...current, plans: [...current.plans, next] })); setSelected(id); setReview(false);
  }
  async function loadReviewed() {
    if (!draft || busy) return;
    setBusy(true); setError('');
    try {
      const template = await getReviewedFoodyCatalog();
      setDraft(current => current && ({ ...current,
        products: template.products,
        plans: [...template.plans, ...current.plans.filter(p => !template.plans.some(t => t.id === p.id))],
        tariffs: current.tariffs.map(row => row.id === 'extraPOSDevice' ? template.tariffs.find(t => t.id === row.id)! : row),
      }));
      setReview(true); setNotice('Reviewed software offers loaded into this draft. Review before publication. Equipment, setup and payment prices are retained.');
    } catch { setError('The reviewed offers could not be loaded. No changes were applied.'); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!draft || !saved || busy) return;
    setBusy(true); setError('');
    try {
      const next = await publishFoodyCatalog(draft, saved.revision);
      setSaved(next); setDraft(structuredClone(next)); setReview(false); setNotice('New catalogue version published. Existing invitations, trials and accepted contracts keep their terms.');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      setError(message.includes('conflict') ? 'Another version was published while you were editing. Your draft is still here. Reload the catalogue before applying it again.' : message.includes('requires') ? message : 'Publication failed. Check translated names, feature dependencies, prices and licence limits. Your draft is still here.');
    } finally { setBusy(false); }
  }
  return <div className="max-w-screen-xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="page-title">Plans &amp; modules</h1><p className="mt-1 max-w-2xl text-sm text-gray-600">Manage public offers, included features and licence limits. Prices exclude VAT.</p></div>
      <div className="flex items-center gap-3 text-sm"><span className="text-gray-600">{saved ? `Version ${saved.version}` : 'Loading…'}</span>
        <button type="button" className="btn-secondary" disabled={!draft || busy} onClick={() => void loadReviewed()}>Load reviewed software offers</button>
        <button type="button" className="btn-primary" disabled={!changed || busy} onClick={() => { setReview(true); setNotice(''); }}>Review changes</button>
      </div>
    </header>
    <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
      {production
        ? 'Production catalogue. Publication updates public prices and new offers after the website cache refreshes (about one minute). Existing contracts keep their agreed terms. Publishing does not charge a customer.'
        : 'Development catalogue. Publications here do not change production prices. Quotes, orders and subscription payment trials remain available in this environment.'}
    </p>
    {error && <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" className="underline" onClick={() => { if (!changed || window.confirm('Discard this local draft and reload the published catalogue?')) { setDraft(null); setSaved(null); setAttempt(n => n + 1); } }}>Reload catalogue</button></div>}
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{notice}</p>}
    {!draft ? <p role="status" className="text-sm text-gray-600">Loading catalogue…</p> : <>
      {review && saved && <section aria-label="Review catalogue publication" className="space-y-3 rounded-xl border border-brand-300 bg-brand-50 p-5">
        <h2 className="font-semibold">Publish the next version</h2>
        <p className="text-sm">{production ? 'These prices and inclusions will appear on the public website and in new offers.' : 'New invitations and additional purchases in this environment will use these prices and inclusions.'} Existing customer contracts keep their agreed prices, features and licence limits.</p>
        <ul className="list-inside list-disc text-sm">
          {draft.products.filter(p => JSON.stringify(p) !== JSON.stringify(saved.products.find(old => old.id === p.id))).map(p => <li key={p.id}>{p.name.en}: {formatFoodyAmount(saved.products.find(old => old.id === p.id)?.monthly_minor ?? 0)} → {formatFoodyAmount(p.monthly_minor)} / month
            <QuotaChanges before={saved.products.find(old => old.id === p.id)?.included} after={p.included} />
            {(['Added', 'Removed'] as const).map(kind => {
              const old = saved.products.find(row => row.id === p.id)?.capabilities ?? [];
              const now = p.capabilities ?? [];
              const keys = kind === 'Added' ? now.filter(key => !old.includes(key)) : old.filter(key => !now.includes(key));
              return keys.length ? <span key={kind} className="block text-xs text-gray-700">{kind}: {keys.map(key => draft.capabilities.find(f => f.key === key)?.name.en ?? key).join(', ')}</span> : null;
            })}
          </li>)}
          {draft.plans.filter(p => JSON.stringify(p) !== JSON.stringify(saved.plans.find(old => old.id === p.id))).map(p => <li key={p.id}>{p.name.en || 'Unnamed plan'}: {formatFoodyAmount(p.monthly_minor)} / month, {p.published ? 'offered to customers' : 'not offered'}
            <QuotaChanges before={saved.plans.find(old => old.id === p.id)?.included} after={p.included} />
            <span className="block text-xs text-gray-600">Modules: {p.modules.join(', ')}. Added features: {p.add_features.map(key => draft.capabilities.find(f => f.key === key)?.name.en ?? key).join(', ') || 'None'}. Excluded features: {p.remove_features.map(key => draft.capabilities.find(f => f.key === key)?.name.en ?? key).join(', ') || 'None'}.</span>
          </li>)}
          {draft.tariffs.filter(p => JSON.stringify(p) !== JSON.stringify(saved.tariffs.find(old => old.id === p.id))).map(p => <li key={p.id}>{p.name.en}: {p.quantity ?? (p.amount_minor === null ? 'On quotation' : formatFoodyAmount(p.amount_minor))}</li>)}
        </ul>
        <div className="flex gap-3"><button type="button" className="btn-primary" disabled={busy} onClick={publish}>{busy ? 'Publishing…' : 'Publish new version'}</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => setReview(false)}>Continue editing</button></div>
      </section>}
      <nav aria-label="Catalogue sections" className="flex flex-wrap gap-1 border-b border-gray-200">
        {sections.map(id => <button type="button" key={id} aria-current={tab === id ? 'page' : undefined}
          className={`px-4 py-3 text-sm font-semibold ${tab === id ? 'border-b-2 border-brand-500 text-brand-700' : 'text-gray-600 hover:text-gray-900'}`}
          onClick={() => { if (tab === 'documents' && id !== tab && documentsDirty && !window.confirm('Discard unsaved document changes?')) return; setTab(id); setCategory('all'); if (id === 'modules') setSelected('restaurant'); if (id === 'plans') setSelected(draft.plans[0]?.id ?? ''); }}>
          {{ modules: 'Modules', plans: 'Plans', prices: 'All prices', features: 'Feature inventory', documents: 'Quotes & orders' }[id]}
        </button>)}
      </nav>
      {tab === 'documents' && <CommercialDocuments onDirtyChange={setDocumentsDirty} />}
      {(tab === 'modules' || tab === 'plans') && <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="space-y-2" aria-label="Select an offer">
          {(tab === 'modules' ? draft.products : draft.plans).map(p => <button key={p.id} type="button" onClick={() => setSelected(p.id)} aria-pressed={selected === p.id}
            className={`w-full rounded-lg border p-3 text-left text-sm ${selected === p.id ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white'}`}>
            <span className="block font-semibold">{p.name.en || 'New plan'}</span><span className="text-gray-600">{formatFoodyAmount(p.monthly_minor)} / month</span>
          </button>)}
          {tab === 'plans' && <button type="button" className="btn-secondary w-full" onClick={addPlan}>Add a plan</button>}
        </aside>
        {product || plan ? <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <Names value={(product ?? plan)!.name} onChange={name => product ? updateProduct({ name }) : updatePlan({ name })} />
          <label className="block max-w-xs text-sm">Monthly price (ILS, excluding VAT)<input className={field} type="number" min={0.01} max={1000000} step={0.01} value={(product ?? plan)!.monthly_minor / 100} onChange={e => product ? updateProduct({ monthly_minor: Math.round(Number(e.target.value) * 100) }) : updatePlan({ monthly_minor: Math.round(Number(e.target.value) * 100) })} /></label>
          {plan && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Included modules</legend>{draft.products.map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.modules.includes(p.id)} onChange={e => updatePlan({ modules: e.target.checked ? [...plan.modules, p.id] : plan.modules.filter(id => id !== p.id) })} />{p.name.en}</label>)}
            <label className="flex items-center gap-2 pt-2 text-sm font-medium"><input type="checkbox" checked={plan.published} onChange={e => updatePlan({ published: e.target.checked })} />Offer this plan to customers</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!plan.automatic} onChange={e => updatePlan({ automatic: e.target.checked })} />Apply automatically when exactly these modules are selected (no feature exclusions)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!plan.recommended} onChange={e => updatePlan({ recommended: e.target.checked })} />Highlight as recommended on the pricing page</label>
          </fieldset>}
          <Quotas value={(product ?? plan)!.included} onChange={value => product ? updateProduct({ included: value }) : updatePlan({ included: value })} />
          <div className="border-t border-gray-200 pt-4"><h2 className="font-semibold">Included features</h2><p className="mt-1 text-sm text-gray-600">A plan inherits its modules. You can add or exclude individual features here.</p></div>
          {missing.length > 0 && <ul role="alert" className="space-y-1 text-sm text-red-700">{missing.map(message => <li key={message}>{message}</li>)}</ul>}
          <div className="flex flex-wrap gap-2"><input className={field + ' max-w-sm'} aria-label="Search features" placeholder="Search features…" value={query} onChange={e => setQuery(e.target.value)} /><select className={field + ' max-w-xs'} aria-label="Feature category" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="divide-y divide-gray-100">{features.map(f => <label key={f.key} className="flex items-start gap-3 py-3 text-sm"><input className="mt-1" type="checkbox" checked={included.includes(f.key)} onChange={e => toggleFeature(f.key, e.target.checked)} /><span><span className="block font-medium">{f.name.en}</span><span className="text-xs text-gray-500">{f.category}{f.requires_all.length > 0 ? ` · Requires ${f.requires_all.map(key => draft.capabilities.find(item => item.key === key)?.name.en).join(', ')}` : ''}</span></span></label>)}</div>
        </div> : <p className="text-sm text-gray-600">Create a plan to combine modules, choose its price and set its included licences.</p>}
      </div>}
      {tab === 'prices' && <section className="space-y-5"><p className="text-sm text-gray-600">All public price lines. A quoted price requires an agreed offer. Hardware and payment-service prices are displayed here and are not added to software checkouts automatically.</p>
        {[...new Set(draft.tariffs.map(row => row.category))].map(group => <div key={group} className="overflow-hidden rounded-xl border border-gray-200 bg-white"><h2 className="border-b border-gray-200 px-5 py-3 font-semibold capitalize">{group}</h2><div className="divide-y divide-gray-100">{draft.tariffs.filter(row => row.category === group).map(row => <div key={row.id} className="grid items-center gap-3 p-4 sm:grid-cols-[1fr_170px_120px]">
          <span className="text-sm font-medium">{row.name.en}<span className="mt-1 block text-xs font-normal text-gray-500">{row.unit.replaceAll('_', ' ')}</span></span>
          <label className="text-sm"><span className="sr-only">{row.name.en} {row.unit === 'quantity' ? 'quantity' : 'price in ILS'}</span><input className={field} type="number" min={0} step={row.unit === 'quantity' ? 1 : 0.01} value={row.unit === 'quantity' ? row.quantity ?? 0 : row.amount_minor === null ? '' : row.amount_minor / 100} placeholder="On quotation" onChange={e => {
            setDraft(current => current && ({ ...current, tariffs: current.tariffs.map(t => t.id !== row.id ? t : { ...t, ...(row.unit === 'quantity' ? { quantity: Number(e.target.value) } : { amount_minor: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) }) }) })); setReview(false);
          }} /></label><span className="text-xs text-gray-600">{row.unit === 'quantity' ? 'included units' : row.amount_minor === null ? 'On quotation' : row.amount_minor === 0 ? 'Included / free' : 'ILS excl. VAT'}</span>
        </div>)}</div></div>)}
      </section>}
      {tab === 'features' && <section className="space-y-4"><p className="text-sm text-gray-600">{draft.capabilities.length} individually categorized features. Staff role permissions still apply within the purchased scope.</p>
        <input className={field + ' max-w-md'} aria-label="Search feature inventory" placeholder="Search features…" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="table-scroll" role="region" aria-label="Feature matrix" tabIndex={0}><table className="data-table min-w-[45rem]"><thead><tr><th className="px-4 py-3 text-left">Feature</th><th className="px-4 py-3 text-left">Category</th>{draft.products.map(p => <th key={p.id} className="px-4 py-3 text-left">{p.name.en}</th>)}</tr></thead><tbody>{features.map(f => <tr key={f.key}><th className="px-4 py-3 text-left font-medium">{f.name.en}</th><td className="px-4 py-3 text-sm text-gray-600">{f.category}</td>{draft.products.map(p => <td key={p.id} className="px-4 py-3 text-sm">{p.capabilities?.includes(f.key) ? 'Included' : '—'}</td>)}</tr>)}</tbody></table></div>
      </section>}
    </>}
  </div>;
}
