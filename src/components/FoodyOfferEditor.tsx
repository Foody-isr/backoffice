'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getEditableFoodyCatalog, previewFoodyOffer, type FoodyOffer, type FoodyOfferInput, type FoodyOfferSelection, type FoodyOfferTerms } from '@/lib/api';
import { commercialDate, documentSources, listCommercialDocuments } from '@/lib/commercial-documents';

const field = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const secondary = 'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50';
const money = (minor: number) => new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS' }).format(minor / 100);
type Mode = 'catalogue' | 'quote' | 'custom';
type Option = { selection: FoodyOfferSelection; label: string };
type Draft = { title: string; includes: string; terms: string; monthly: string; annual: string; tax: '' | FoodyOfferTerms['tax_mode']; date: string };

function editable(offer: FoodyOffer | null): Draft {
  return { title: offer?.title ?? '', includes: offer?.includes ?? '', terms: offer?.terms ?? '',
    monthly: offer?.monthly_minor ? String(offer.monthly_minor / 100) : '', annual: offer?.annual_minor ? String(offer.annual_minor / 100) : '',
    tax: offer?.tax_mode ?? '', date: offer?.start_date ?? commercialDate() };
}

function minor(value: string) {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : 0;
}

function sourceError(reason: unknown) {
  switch (reason instanceof Error ? reason.message : '') {
    case 'foody_offer_unsupported_schedule': return 'This quotation needs one recurring schedule: monthly or 12 months prepaid, with the same start for its recurring lines. Review its lines in Quotes & orders.';
    case 'foody_offer_quote_expired': return 'This quotation is outside its validity period. Select a current quotation.';
    case 'foody_catalog_conflict': return 'The catalogue has changed. Reload to review the current prices.';
    case 'foody_billing_not_found': return 'Select a finalized quotation linked to this restaurant.';
    default: return 'The offer source could not be loaded. Retry to review its terms.';
  }
}

const identity = (source: FoodyOfferSelection) => [source.kind, source.id, source.revision].join(':');

/** Composes the restaurant's payable offer from reviewed commercial terms or a custom agreement. */
export default function FoodyOfferEditor({restaurantId, offer, busy, onPublish, onReload}: {
  restaurantId: number; offer: FoodyOffer | null; busy: boolean; onPublish: (input: FoodyOfferInput) => Promise<void>; onReload: () => Promise<void>;
}) {
  const existing = offer?.commercial_source;
  const [mode, setMode] = useState<Mode>(existing?.kind === 'quote' ? 'quote' : existing || !offer ? 'catalogue' : 'custom');
  const [selection, setSelection] = useState<FoodyOfferSelection | null>(existing ?? null);
  const [draft, setDraft] = useState(() => editable(offer));
  const [options, setOptions] = useState<Option[]>([]);
  const [preview, setPreview] = useState<FoodyOffer | null>(null);
  const [terms, setTerms] = useState('');
  const [start, setStart] = useState('');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('quotation'), revision = Number(params.get('revision'));
    if (id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(revision) && revision > 0) {
      setMode('quote'); setSelection({ kind: 'quote', id, revision });
    }
  }, [restaurantId]);

  useEffect(() => {
    setOptions([]); setMore(false); setListError('');
    if (mode === 'custom') { setLoading(false); return; }
    const request = new AbortController();
    setLoading(true);
    async function loadOptions() {
      if (mode === 'quote') {
        const list = await listCommercialDocuments(page, 'quote', 'issued', restaurantId);
        if (request.signal.aborted) return;
        setOptions(list.documents.map(doc => ({ selection: { kind: 'quote', id: String(doc.id), revision: doc.revision }, label: doc.number + ' · ' + doc.title })));
        setMore(list.has_more);
      } else {
        const catalog = await getEditableFoodyCatalog(request.signal);
        if (request.signal.aborted) return;
        setOptions(documentSources(catalog, 'en').flatMap(item => item.type === 'module' || item.type === 'plan'
          ? [{ selection: { kind: item.type, id: item.id, revision: catalog.revision }, label: item.name + ' · ' + money(item.price!) + ' / month excl. VAT' }] : []));
      }
    }
    loadOptions().catch(() => { if (!request.signal.aborted) setListError('Could not load the available offers.'); })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [restaurantId, mode, page, attempt]);

  useEffect(() => {
    setPreview(null); setError('');
    if (!selection || mode === 'custom') return;
    const request = new AbortController();
    previewFoodyOffer(restaurantId, selection, request.signal).then(next => {
      if (request.signal.aborted) return;
      const published = offer?.commercial_source && identity(offer.commercial_source) === identity(selection) ? offer : null;
      setPreview(next); setStart(published?.start_date ?? next.start_date); setTerms(published?.terms ?? next.terms);
    }).catch(reason => { if (!request.signal.aborted) setError(sourceError(reason)); });
    return () => request.abort();
  }, [restaurantId, mode, selection, attempt, offer]);

  function switchMode(next: Mode) {
    setSelection(null); setPreview(null); setError(''); setListError(''); setPage(1); setMode(next);
  }
  function edit(key: keyof Draft, value: string) { setDraft(prev => ({ ...prev, [key]: value })); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const expected_version = offer?.version ?? 0;
    if (mode !== 'custom') {
      if (selection && preview) void onPublish({ source: selection, start_date: start, terms, expected_version });
      return;
    }
    const monthly_minor = minor(draft.monthly), annual_minor = minor(draft.annual);
    if (!draft.tax || !monthly_minor || !annual_minor || monthly_minor > 100000000 || annual_minor > 100000000) {
      setError('Enter positive monthly and annual ILS amounts with up to two decimal places.'); return;
    }
    void onPublish({ expected_version, title: draft.title, includes: draft.includes, terms: draft.terms, monthly_minor, annual_minor, tax_mode: draft.tax, start_date: draft.date });
  }

  const key = selection ? identity(selection) : '';
  return <form onSubmit={submit}><fieldset disabled={busy} className="space-y-3">
    <legend className="font-medium">{offer ? 'Edit and publish a new version' : 'Create an offer'}</legend>
    <label className="block text-sm">Offer source<select className={field} value={mode} onChange={e => switchMode(e.target.value as Mode)}>
      <option value="catalogue">Foody catalogue</option><option value="quote">Finalized quotation</option><option value="custom">Custom offer</option>
    </select></label>
    {mode !== 'custom' && <>
      <label className="block text-sm">{mode === 'quote' ? 'Restaurant quotation' : 'Foody plan or module'}
        <select className={field} value={key} onChange={e => { setPreview(null); setSelection(options.find(item => identity(item.selection) === e.target.value)?.selection ?? null); }}>
          <option value="">Select an offer</option>
          {selection && !options.some(item => identity(item.selection) === key) && <option value={key}>{preview?.commercial_source?.number ?? preview?.title ?? selection.id}</option>}
          {options.map(item => <option key={identity(item.selection)} value={identity(item.selection)}>{item.label}</option>)}
        </select>
      </label>
      {loading && <p role="status" className="text-sm">Loading offers…</p>}
      {listError && <p role="alert" className="text-sm text-red-700">{listError}</p>}
      {mode === 'quote' && !loading && !listError && options.length === 0 && !selection && <p className="text-sm">Link the quotation to this restaurant and finalize it in Plans &amp; modules → Quotes &amp; orders.</p>}
      {mode === 'quote' && (page > 1 || more) && <div className="flex gap-2">
        <button type="button" className={secondary} disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous quotations</button>
        <button type="button" className={secondary} disabled={!more || loading} onClick={() => setPage(page + 1)}>More quotations</button></div>}
      {selection && !preview && !error && <p role="status" className="text-sm">Loading subscription terms…</p>}
      {preview && <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
        <p className="font-semibold" dir="auto">{preview.title}</p><p className="whitespace-pre-line" dir="auto">{preview.includes}</p>
        {(['monthly', 'annual'] as const).filter(cycle => preview[cycle].total_minor > 0).map(cycle => <p key={cycle}>
          {cycle === 'monthly' ? 'Monthly' : 'Annual'} · {money(preview[cycle].net_minor)} excl. VAT · <strong>{money(preview[cycle].total_minor)} incl. VAT</strong>
        </p>)}
        {mode === 'quote' && <><p>One-time and usage charges are billed separately.</p>{terms && <p className="whitespace-pre-line" dir="auto">{terms}</p>}</>}
        <button type="button" className="font-medium underline" onClick={() => { setDraft({ ...editable(preview), terms, date: start }); switchMode('custom'); }}>Customize this offer</button>
      </div>}
      {preview && mode === 'catalogue' && <label className="block text-sm">Terms, exclusions and cancellation<textarea required maxLength={5000} className={field} value={terms} onChange={e => setTerms(e.target.value)} /></label>}
      {preview && <label className="block text-sm">First payment available from (Israel date)<input required type="date" className={field} value={start} readOnly={!!preview.commercial_source?.first_date} max={preview.commercial_source?.valid_until} onChange={e => setStart(e.target.value)} /></label>}
    </>}
    {mode === 'custom' && <>
      <label className="block text-sm">Offer name<input required maxLength={120} className={field} value={draft.title} onChange={e => edit('title', e.target.value)} /></label>
      <label className="block text-sm">Offer description<textarea required maxLength={5000} rows={3} className={field} value={draft.includes} onChange={e => edit('includes', e.target.value)} /></label>
      <label className="block text-sm">Terms, exclusions and cancellation<textarea required maxLength={5000} rows={3} className={field} value={draft.terms} onChange={e => edit('terms', e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Monthly amount (ILS)<input required inputMode="decimal" maxLength={10} className={field} value={draft.monthly} onChange={e => edit('monthly', e.target.value)} /></label>
        <label className="block text-sm">Annual amount (ILS)<input required inputMode="decimal" maxLength={10} className={field} value={draft.annual} onChange={e => edit('annual', e.target.value)} /></label>
        <label className="block text-sm">Agreed VAT treatment<select required className={field} value={draft.tax} onChange={e => edit('tax', e.target.value)}>
          <option value="">Select VAT treatment</option><option value="ttc">Amounts include VAT (TTC)</option><option value="ht">Amounts exclude VAT (HT)</option>
        </select></label>
        <label className="block text-sm">First payment available from (Israel date)<input type="date" required className={field} value={draft.date} onChange={e => edit('date', e.target.value)} /></label>
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {(listError || error) && mode !== 'custom' && <button type="button" className={secondary} onClick={() => setAttempt(n => n + 1)}>Reload offers</button>}
    <div className="flex gap-3"><button type="submit" disabled={mode !== 'custom' && !preview} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish offer</button>
      <button type="button" onClick={() => void onReload()} className={secondary}>Reload published version</button></div>
  </fieldset></form>;
}
