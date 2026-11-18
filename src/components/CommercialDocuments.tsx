'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommercialDocumentError, getEditableFoodyCatalog, listRestaurants, type FoodyEditableCatalog, type Restaurant } from '@/lib/api';
import {
  changeDocumentTax, changeLineBilling, convertCommercialDocument, documentInput, documentSources,
  downloadCommercialDocument, getCommercialDefaults, getCommercialDocument, issueCommercialDocument,
  listCommercialDocuments, newCommercialDraft, newCommercialLine, previewCommercialDocument, previewCommercialPDF,
  saveCommercialDefaults, saveCommercialDocument, sourcePrice,
  type BillingMode, type CommercialAmount, type CommercialDocument, type CommercialInput, type CommercialLine,
  type CommercialMetadata, type CommercialSnapshot, type DocumentDefaults, type DocumentKind, type DocumentLocale,
  type DraftRequest, type Party, type SourceOption, type TaxMode,
} from '@/lib/commercial-documents';

const field = 'field mt-1 block w-full';
const billingLabels: Record<BillingMode, string> = { once: 'One-time payment', monthly: 'Monthly', prepaid: 'Prepaid period', usage: 'By usage', included: 'Included' };
const money = (amount: number) => new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS' }).format(amount / 100);
const kindName = (kind: DocumentKind) => kind === 'quote' ? 'Quotation' : 'Sales order';

function errorMessage(error: unknown): string {
  if (error instanceof CommercialDocumentError) {
    if (error.status === 409) return 'This document or catalogue has changed. Your edits are still here. Open the saved document again before continuing; a finalized document cannot be edited.';
    if (error.message === 'commercial_documents_sandbox_only') return 'Quotes and orders are currently available in the development workspace.';
    if (error.status === 403 || error.status === 401) return 'Your superadmin session is required. Sign in again to continue.';
    if (error.status === 404) return 'The document or linked restaurant was not found. Reload the list and check the restaurant selection.';
    if (error.field) {
      const match = /^lines\[(\d+)\]\.(.+)$/.exec(error.field);
      const label = match ? `line ${Number(match[1]) + 1}: ${match[2].replaceAll('_', ' ')}` : error.field.replaceAll('_', ' ');
      return `Check ${label}. Enter valid names, dates, payment terms and prices; all amounts must be non-negative.`;
    }
  }
  return 'The request could not be completed. Your edits are still here. Retry; after an uncertain save or finalization, reopen the document list to check its status.';
}

function PartyFields({ label, value, onChange }: { label: string; value: Party; onChange: (party: Party) => void }) {
  return <fieldset className="space-y-3"><legend className="mb-2 font-semibold">{label}</legend>
    <label className="block text-sm">Company or contact name<input className={field} dir="auto" required maxLength={180} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} /></label>
    <label className="block text-sm">Company / tax ID<input className={field} dir="auto" maxLength={80} value={value.company_id} onChange={e => onChange({ ...value, company_id: e.target.value })} /></label>
    <label className="block text-sm">Address<textarea className={field} dir="auto" rows={2} maxLength={600} value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Email<input className={field} type="email" maxLength={254} value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} /></label>
      <label className="text-sm">Phone<input className={field} type="tel" maxLength={80} value={value.phone} onChange={e => onChange({ ...value, phone: e.target.value })} /></label></div>
  </fieldset>;
}

function RestaurantLink({ value, onChange }: { value: number | null; onChange: (restaurant: Restaurant | null) => void }) {
  const [search, setSearch] = useState(''); const [rows, setRows] = useState<Restaurant[]>([]); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (search.trim().length < 2) { setRows([]); return; }
      listRestaurants(search.trim()).then(result => { if (active) { setRows(result.restaurants.slice(0, 10)); setError(''); } }, () => { if (active) { setRows([]); setError('Restaurant search is unavailable. Retry or continue with an unlinked prospect.'); } });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);
  return <div className="space-y-2 text-sm">
    <label className="block">Link an existing restaurant (optional)<input className={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name; leave blank for a prospect" /></label>
    {value && <div className="flex items-center gap-3">Linked restaurant #{value}<button type="button" className="underline" onClick={() => { onChange(null); setSearch(''); }}>Unlink</button></div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {rows.length > 0 && <ul className="max-h-48 overflow-y-auto rounded-md border border-gray-200">{rows.map(row => <li key={row.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-gray-50" onClick={() => { onChange(row); setSearch(''); setRows([]); }}>{row.name}</button></li>)}</ul>}
  </div>;
}

function LineEditor({ line, index, source, input, onChange, onRemove, onMove, count }: {
  line: CommercialLine; index: number; source?: SourceOption; input: CommercialInput;
  onChange: (line: CommercialLine) => void; onRemove: () => void; onMove: (direction: number) => void; count: number;
}) {
  const isSubscription = line.category === 'subscription';
  const modes: BillingMode[] = source?.unit === 'quantity' ? ['included'] : isSubscription ? ['monthly', 'prepaid', 'included']
    : source && !source.unit.endsWith('month') ? ['once', 'monthly', 'usage', 'included'] : ['once', 'monthly', 'prepaid', 'usage', 'included'];
  const reference = source ? sourcePrice(source, input, line.billing === 'prepaid' ? line.period_months : 1) : null;
  const update = (patch: Partial<CommercialLine>) => onChange({ ...line, ...patch });
  return <fieldset className="rounded-lg border border-gray-200 bg-white p-4" aria-label={`Line ${index + 1}`}>
    <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{index + 1} · {line.category}</legend>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-gray-600">{source ? `${source.group} · ${source.name}` : 'Custom item'}</span>
      <div className="flex gap-3"><button type="button" className="underline disabled:opacity-30" disabled={index === 0} aria-label={`Move line ${index + 1} up`} onClick={() => onMove(-1)}>Up</button><button type="button" className="underline disabled:opacity-30" disabled={index === count - 1} aria-label={`Move line ${index + 1} down`} onClick={() => onMove(1)}>Down</button><button type="button" className="text-red-700 underline" onClick={onRemove}>Remove</button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Description on PDF<input className={field} dir="auto" required maxLength={300} value={line.description} onChange={e => update({ description: e.target.value })} /></label>
      {line.source_type === 'custom' && <label className="text-sm">Category<select className={field} value={line.category} onChange={e => {
        const category = e.target.value as CommercialLine['category'];
        onChange(category === 'subscription' && !['monthly', 'prepaid', 'included'].includes(line.billing) ? { ...changeLineBilling(line, 'monthly'), category } : { ...line, category });
      }}><option value="fee">Fee / service</option><option value="hardware">Hardware</option><option value="subscription">Subscription</option></select></label>}
      <label className="text-sm">Payment schedule<select className={field} value={line.billing} onChange={e => onChange(changeLineBilling(line, e.target.value as BillingMode, source, input))}>{modes.map(mode => <option key={mode} value={mode}>{billingLabels[mode]}</option>)}</select></label>
      {line.billing === 'prepaid' && <label className="text-sm">Months covered<input className={field} type="number" min={1} max={120} required value={line.period_months || ''} onChange={e => update({ period_months: Number(e.target.value) })} /><span className="mt-1 block text-xs text-gray-600">12, 24, 36 or another duration. Changing this keeps your agreed period price.</span></label>}
      {line.billing === 'monthly' && <label className="text-sm">Minimum commitment (months)<input className={field} type="number" min={0} max={120} required value={line.commitment_months} onChange={e => update({ commitment_months: Number(e.target.value) })} /><span className="mt-1 block text-xs text-gray-600">0 = no minimum commitment. Payment remains monthly.</span></label>}
      <label className="text-sm">Quantity<input className={field} type="number" required min={1} max={10000} disabled={line.billing === 'usage'} value={line.quantity || ''} onChange={e => update({ quantity: Number(e.target.value) })} /></label>
      <label className="text-sm">{line.billing === 'prepaid' ? 'Price per unit for the entire period' : line.billing === 'monthly' ? 'Price per unit / month' : line.billing === 'usage' ? 'Price per usage unit' : 'Unit price'} (ILS {input.tax_mode === 'ttc' ? 'incl. VAT' : input.tax_mode === 'ht' ? 'excl. VAT' : 'no VAT'})
        <input className={field} type="number" required min={0} max={1000000} step={0.01} disabled={line.billing === 'included'} value={line.unit_price_minor === null ? '' : line.unit_price_minor / 100} placeholder="Enter agreed price" onChange={e => update({ unit_price_minor: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) })} />
        {source && line.billing !== 'included' && <span className="mt-1 block text-xs text-gray-600">{reference === null ? 'Price on quotation: enter the agreed amount.' : <>Catalogue: {money(reference)} <button type="button" className="ml-1 underline" onClick={() => update({ unit_price_minor: reference })}>Use catalogue price</button></>}</span>}
      </label>
      {line.source_type === 'custom' && <label className="text-sm">Unit on PDF<input className={field} required maxLength={60} value={line.unit} onChange={e => update({ unit: e.target.value })} /></label>}
      <label className="text-sm">{line.billing === 'monthly' || line.billing === 'usage' ? 'Billing starts' : 'Payment due'}<select className={field} value={line.due} onChange={e => update({ due: e.target.value as CommercialLine['due'], start_date: '' })}><option value="order">On order</option><option value="activation">On activation</option><option value="date">On a date</option></select></label>
      {line.due === 'date' && <label className="text-sm">Date<input className={field} type="date" min="2000-01-01" max="2200-12-31" required value={line.start_date} onChange={e => update({ start_date: e.target.value })} /></label>}
      <label className="text-sm sm:col-span-2">Line details (optional)<textarea className={field} rows={2} dir="auto" maxLength={1500} value={line.notes} onChange={e => update({ notes: e.target.value })} /></label>
    </div>
    {source?.billingPolicy && <p className="mt-3 text-xs text-gray-600">Standard software terms: monthly without a minimum commitment, or 12 months prepaid for the price of 11 (8.33% saving). Complete prepaid years use the same annual rate. Hardware, additional licences and services are excluded. Negotiated amounts stay unchanged; use the catalogue price to apply the standard annual rate.</p>}
    {line.billing === 'usage' && <p className="mt-3 text-xs text-gray-600">The actual quantity will be billed by usage. This rate is excluded from fixed totals.</p>}
  </fieldset>;
}

function Totals({ content }: { content: CommercialSnapshot }) {
  function amount(label: string, value: CommercialAmount) {
    return <div className="space-y-2 border-b border-gray-200 py-4"><h4 className="text-sm font-semibold">{label}</h4><div className="flex justify-between text-sm text-gray-600"><span>Excluding VAT</span><span>{money(value.net)}</span></div><div className="flex justify-between text-sm text-gray-600"><span>VAT</span><span>{money(value.vat)}</span></div><div className="flex justify-between gap-3 font-semibold tabular-nums"><span>{content.tax_mode === 'none' ? 'Total' : 'Including VAT'}</span><span>{money(value.gross)}</span></div></div>;
  }
  return <div aria-label="Calculated totals">
    {content.lines.some(l => l.billing === 'once' || l.billing === 'prepaid') && amount('One-time & prepaid', content.single)}
    {content.lines.some(l => l.billing === 'monthly') && amount('Each month', content.monthly)}
    {content.lines.some(l => l.billing === 'usage') && <p className="mt-4 text-xs text-gray-600">Usage fees are additional, according to actual consumption.</p>}
    {content.priced_lines.filter(l => (l.software_saving_minor ?? 0) > 0).map((l, i) => <p key={`saving-${i}`} className="mt-3 text-sm text-gray-700"><span dir="auto">{l.description}</span>: save {money(l.software_saving_minor!)} excl. VAT against {l.period_months} monthly software payments.</p>)}
    {content.priced_lines.filter(l => l.commitment_months > 0).map((l, i) => <p key={i} className="mt-3 text-xs text-gray-600"><span dir="auto">{l.description}</span>: {l.commitment_months} monthly payments, {money(l.commitment.gross)} {content.tax_mode === 'none' ? 'total' : 'incl. VAT'} over the commitment.</p>)}
    <p className="mt-4 text-xs leading-relaxed text-gray-600">Payment dates are defined on each line. These totals are not an amount collected today.</p>
  </div>;
}

/** Composes private quotations and orders from a frozen Foody catalogue. */
export default function CommercialDocuments({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [catalog, setCatalog] = useState<FoodyEditableCatalog | null>(null);
  const [defaults, setDefaults] = useState<DocumentDefaults | null>(null);
  const [defaultsDraft, setDefaultsDraft] = useState<DocumentDefaults | null>(null);
  const [settings, setSettings] = useState(false);
  const [rows, setRows] = useState<CommercialMetadata[]>([]); const [more, setMore] = useState(false);
  const [listError, setListError] = useState(''); const [listLoading, setListLoading] = useState(true);
  const listGeneration = useRef(0);
  const [page, setPage] = useState(1); const [kindFilter, setKindFilter] = useState(''); const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true); const [attempt, setAttempt] = useState(0);
  const [current, setCurrent] = useState<CommercialDocument | null>(null);
  const [input, setInput] = useState<CommercialInput | null>(null);
  const [baseline, setBaseline] = useState(''); const [key, setKey] = useState('');
  const [totals, setTotals] = useState<CommercialSnapshot | null>(null); const [totalsKey, setTotalsKey] = useState('');
  const [query, setQuery] = useState(''); const [sourceKey, setSourceKey] = useState('');
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [review, setReview] = useState(false); const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);
  const form = useRef<HTMLFormElement>(null); const dialog = useRef<HTMLDialogElement>(null);
  const serialized = input ? JSON.stringify(input) : '';
  const dirty = serialized !== baseline || JSON.stringify(defaultsDraft) !== JSON.stringify(defaults);
  const locked = current?.status === 'issued';
  const docCatalog = current?.catalog ?? catalog;
  const sources = useMemo(() => docCatalog && input ? documentSources(docCatalog, input.locale) : [], [docCatalog, input]);
  const filteredSources = sources.filter(s => `${s.name} ${s.group} ${s.id}`.toLowerCase().includes(query.toLowerCase()));
  const visibleTotals = totals && totalsKey === serialized ? totals : null;

  const reload = useCallback(async () => {
    const generation = ++listGeneration.current;
    setListLoading(true);
    try {
      const list = await listCommercialDocuments(page, kindFilter, statusFilter);
      if (generation === listGeneration.current) { setRows(list.documents); setMore(list.has_more); setListError(''); }
    } catch (reason) {
      if (generation === listGeneration.current) setListError(errorMessage(reason));
      throw reason;
    } finally { if (generation === listGeneration.current) setListLoading(false); }
  }, [page, kindFilter, statusFilter]);
  useEffect(() => {
    let active = true; setLoading(true);
    Promise.all([getEditableFoodyCatalog(), getCommercialDefaults()]).then(([c, d]) => {
      if (active) { setCatalog(c); setDefaults(d); setDefaultsDraft(structuredClone(d)); setError(''); }
    }, reason => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => { void reload().catch(() => { /* The list keeps its own visible error and retry control. */ }); }, [reload, attempt]);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const navigate = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest('a[href]');
      const href = link?.getAttribute('href') ?? '';
      if (link && !href.startsWith('#') && !href.startsWith('blob:') && !window.confirm('Leave this page and discard unsaved changes?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty]);
  useEffect(() => {
    if (!pdf) return;
    dialog.current?.showModal();
    return () => URL.revokeObjectURL(pdf.url);
  }, [pdf]);

  function adopt(value: CommercialDocument) {
    const next = documentInput(value.content);
    setCurrent(value); setInput(next); setBaseline(JSON.stringify(next)); setTotals(value.content); setTotalsKey(JSON.stringify(next)); setReview(false); setError('');
  }
  function patch(value: Partial<CommercialInput>) { setInput(previous => previous && ({ ...previous, ...value })); setReview(false); }
  function request(): DraftRequest {
    if (!input) throw new Error('No document');
    return { document_id: current?.id ?? 0, expected_revision: current?.revision ?? 0, idempotency_key: key, document: input };
  }
  async function act(label: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(label); setError(''); setNotice('');
    try { await work(); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(''); }
  }
  async function start(kind: DocumentKind) {
    if (dirty && !window.confirm('Discard unsaved changes and start a new document?')) return;
    await act('Loading catalogue…', async () => {
      const [c, d] = await Promise.all([getEditableFoodyCatalog(), getCommercialDefaults()]);
      setCatalog(c); setDefaults(d); setDefaultsDraft(structuredClone(d)); setSettings(false);
      setCurrent(null); setInput(newCommercialDraft(kind, d, c)); setBaseline(''); setKey(crypto.randomUUID()); setTotals(null); setReview(false); setQuery(''); setSourceKey('');
    });
  }
  async function open(id: number) {
    if (dirty && !window.confirm('Discard unsaved changes and open this saved document?')) return;
    await act('Opening…', async () => { adopt(await getCommercialDocument(id)); setSettings(false); setDefaultsDraft(defaults && structuredClone(defaults)); });
  }
  function ready() { return form.current?.reportValidity() ?? false; }
  function addLine(source: SourceOption | null) {
    if (!input || input.lines.length >= 100) return;
    patch({ lines: [...input.lines, newCommercialLine(source, input)] }); setSourceKey('');
  }
  async function save() {
    if (!ready()) return;
    await act('Saving…', async () => { adopt(await saveCommercialDocument(request())); setNotice('Draft saved. Prices and inclusions are preserved with this document.'); await reload(); });
  }
  async function previewPDF() {
    if (!locked && !ready()) return;
    await act('Preparing PDF…', async () => {
      const blob = locked && current ? await downloadCommercialDocument(current.id) : await previewCommercialPDF(request());
      setPdf({ url: URL.createObjectURL(blob), name: current?.number ? `${current.number}.pdf` : 'Foody-draft.pdf' });
    });
  }

  return <section className="space-y-6" aria-label="Quotes and orders" aria-busy={!!busy}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Commercial documents</div><h2 className="text-2xl font-semibold">Quotes &amp; orders</h2><p className="mt-2 max-w-2xl text-sm text-gray-600">Bring software, equipment and services together. Monthly software has no minimum commitment; annual prepayment includes one free month. Review the payment schedule, then finalize a numbered PDF. This does not collect payment or activate a subscription.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={!!busy || loading} onClick={() => setSettings(!settings)}>Issuer settings</button><button type="button" className="btn-secondary" disabled={!!busy || loading} onClick={() => start('order')}>New order</button><button type="button" className="btn-primary" disabled={!!busy || loading} onClick={() => start('quote')}>New quotation</button></div>
    </header>
    {error && <div role="alert" className="error-notice"><p>{error}</p>{!input && <button type="button" className="mt-2 underline" onClick={() => setAttempt(n => n + 1)}>Retry</button>}</div>}
    {notice && <p role="status" className="rounded-md bg-green-50 p-4 text-sm text-green-900">{notice}</p>}
    {busy && <p role="status" className="text-sm text-gray-600">{busy}</p>}
    {loading && <p role="status">Loading document workspace…</p>}

    {settings && defaultsDraft && <form className="space-y-4 rounded-xl border border-gray-200 p-5" onSubmit={e => {
      e.preventDefault(); void act('Saving issuer settings…', async () => {
        const d = await saveCommercialDefaults(defaultsDraft); setDefaults(d); setDefaultsDraft(structuredClone(d)); setNotice('Issuer defaults saved for new documents. Existing documents keep their details.');
      });
    }}><fieldset disabled={!!busy} className="space-y-4"><div><h3 className="text-lg font-semibold">Issuer &amp; new-document defaults</h3><p className="mt-1 text-sm text-gray-600">Enter Foody’s legal company details. These settings are copied into future documents.</p></div>
      <PartyFields label="Issuer" value={defaultsDraft.issuer} onChange={issuer => setDefaultsDraft({ ...defaultsDraft, issuer })} />
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Default PDF language<select className={field} value={defaultsDraft.locale} onChange={e => setDefaultsDraft({ ...defaultsDraft, locale: e.target.value as DocumentLocale })}><option value="he">עברית</option><option value="fr">Français</option><option value="en">English</option></select></label>
        <label className="text-sm">Price entry<select className={field} value={defaultsDraft.tax_mode} onChange={e => setDefaultsDraft({ ...defaultsDraft, tax_mode: e.target.value as TaxMode, vat_bps: e.target.value === 'none' ? 0 : defaultsDraft.vat_bps || 1800 })}><option value="ht">Excluding VAT</option><option value="ttc">Including VAT</option><option value="none">No VAT charged</option></select></label>
        <label className="text-sm">VAT (%)<input className={field} type="number" min={0.01} max={100} step={0.01} required disabled={defaultsDraft.tax_mode === 'none'} value={defaultsDraft.vat_bps / 100} onChange={e => setDefaultsDraft({ ...defaultsDraft, vat_bps: Math.round(Number(e.target.value) * 100) })} /></label></div>
      <label className="block text-sm">Default commercial terms<textarea className={field} dir="auto" rows={4} maxLength={8000} value={defaultsDraft.terms} onChange={e => setDefaultsDraft({ ...defaultsDraft, terms: e.target.value })} /></label>
      <button type="submit" className="btn-primary">Save issuer settings</button>
    </fieldset></form>}

    {input && <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <form ref={form} className="min-w-0 space-y-5" onSubmit={e => { e.preventDefault(); void save(); }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4"><div><h3 className="text-xl font-semibold">{kindName(input.kind)} <span className="font-normal text-gray-500">{current?.number || (current ? `· Draft #${current.id}` : '· New draft')}</span></h3><p className="mt-1 text-xs text-gray-600">{locked ? 'Finalized · archived PDF' : serialized !== baseline ? 'Unsaved changes' : 'Saved draft'} · Catalogue version {docCatalog?.version}{current?.source_id ? ` · From quotation #${current.source_id}` : ''}</p></div>
          <button type="button" className="text-sm underline" disabled={!!busy} onClick={() => { if (serialized === baseline || window.confirm('Close this document and discard unsaved changes?')) { setInput(null); setCurrent(null); setBaseline(''); setReview(false); } }}>Close editor</button></div>
        <fieldset disabled={!!busy || locked} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Document title<input className={field} required dir="auto" maxLength={160} value={input.title} placeholder="Foody equipment & subscription proposal" onChange={e => patch({ title: e.target.value })} /></label>
            <label className="text-sm">Date<input className={field} type="date" min="2000-01-01" max="2200-12-31" required value={input.date} onChange={e => patch({ date: e.target.value })} /></label>
            {input.kind === 'quote' && <label className="text-sm">Valid until<input className={field} type="date" min={input.date} max="2200-12-31" required value={input.valid_until} onChange={e => patch({ valid_until: e.target.value })} /></label>}
            <label className="text-sm">PDF language<select className={field} value={input.locale} onChange={e => patch({ locale: e.target.value as DocumentLocale })}><option value="he">עברית</option><option value="fr">Français</option><option value="en">English</option></select><span className="mt-1 block text-xs text-gray-600">Your descriptions and terms keep the text you enter.</span></label>
          </div>
          <div className="space-y-4 rounded-lg border border-gray-200 p-4"><PartyFields label="Customer / prospect" value={input.customer} onChange={customer => patch({ customer })} />
            <RestaurantLink value={input.restaurant_id} onChange={row => patch({ restaurant_id: row?.id ?? null, customer: row && !input.customer.name ? { ...input.customer, name: row.name, address: row.address || '', phone: row.phone || '' } : input.customer })} /></div>
          <details className="rounded-lg border border-gray-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Issuer on this document · {input.issuer.name || 'Enter company details'}</summary><div className="pt-4"><PartyFields label="Issuer details" value={input.issuer} onChange={issuer => patch({ issuer })} /></div></details>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Prices entered<select className={field} value={input.tax_mode} onChange={e => { setInput(changeDocumentTax(input, e.target.value as TaxMode, input.vat_bps || 1800)); setReview(false); }}><option value="ht">Excluding VAT (HT)</option><option value="ttc">Including VAT (TTC)</option><option value="none">No VAT charged</option></select></label>
            <label className="text-sm">VAT (%)<input className={field} type="number" min={0.01} max={100} step={0.01} required disabled={input.tax_mode === 'none'} value={input.vat_bps / 100} onChange={e => { setInput(changeDocumentTax(input, input.tax_mode, Math.round(Number(e.target.value) * 100))); setReview(false); }} /></label><p className="text-xs text-gray-600 sm:col-span-2">Changing the tax display preserves negotiated prices excluding VAT, with rounding to the nearest agora.</p></div>
          <div className="space-y-4"><div><h3 className="text-lg font-semibold">Items &amp; payment schedule</h3><p className="mt-1 text-sm text-gray-600">Combine plans, modules, hardware, terminal services and additional fees.</p></div>
            {!locked && <div className="space-y-3 rounded-lg bg-gray-50 p-4"><label className="block text-sm">Find a catalogue item<input className={field} value={query} placeholder="Plan, licence, terminal, setup…" onChange={e => { setQuery(e.target.value); setSourceKey(''); }} /></label>
              <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">Catalogue item<select className={field} value={sourceKey} onChange={e => setSourceKey(e.target.value)}><option value="">Select an item</option>{['Plans', 'Modules', 'Hardware', 'Fees & licences'].map(group => <optgroup key={group} label={group}>{filteredSources.filter(s => s.group === group).map(s => <option key={s.key} value={s.key}>{s.name}{s.price === null ? ' · On quotation' : ''}</option>)}</optgroup>)}</select></label><button type="button" className="btn-secondary" disabled={!sourceKey || input.lines.length >= 100} onClick={() => { const source = sources.find(s => s.key === sourceKey); if (source) addLine(source); }}>Add item</button><button type="button" className="btn-secondary" disabled={input.lines.length >= 100} onClick={() => addLine(null)}>Custom item</button></div>
              <p className="text-xs text-gray-600">Source prices and inclusions are preserved when the draft is first saved. You can negotiate the price of each line.</p>
            </div>}
            {input.lines.length === 0 && <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">Add the software, equipment and services for this customer.</p>}
            {input.lines.map((line, index) => <LineEditor key={index} line={line} index={index} input={input} source={sources.find(s => s.type === line.source_type && s.id === line.source_id)} count={input.lines.length}
              onChange={value => patch({ lines: input.lines.map((l, i) => i === index ? value : l) })}
              onRemove={() => patch({ lines: input.lines.filter((_, i) => i !== index) })}
              onMove={direction => { const lines = [...input.lines]; [lines[index], lines[index + direction]] = [lines[index + direction], lines[index]]; patch({ lines }); }} />)}
          </div>
          <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={input.include_features} onChange={e => patch({ include_features: e.target.checked })} /><span>Include the detailed feature list in the PDF<span className="mt-1 block text-xs text-gray-600">Included account and device quotas are always shown per unit for catalogue plans and modules. Custom items use your written description.</span></span></label>
          <label className="block text-sm">Commercial terms<textarea className={field} dir="auto" rows={5} maxLength={8000} placeholder="Delivery, activation, renewal, cancellation, payment terms…" value={input.terms} onChange={e => patch({ terms: e.target.value })} /></label>
          <label className="block text-sm">Additional information<textarea className={field} dir="auto" rows={3} maxLength={4000} value={input.notes} onChange={e => patch({ notes: e.target.value })} /></label>
        </fieldset>
        {!locked && <button type="submit" className="btn-primary" disabled={!!busy}>Save draft</button>}
      </form>

      <aside className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5 xl:sticky xl:top-6">
        <div><h3 className="text-lg font-semibold">Payment summary</h3><p className="mt-1 text-xs text-gray-600">Amounts in ILS</p></div>
        {visibleTotals ? <Totals content={visibleTotals} /> : <p className="text-sm text-gray-600">Complete the document and calculate its current totals before finalizing.</p>}
        {!locked && <button type="button" className="btn-secondary w-full" disabled={!!busy || !input.lines.length} onClick={() => { if (ready()) void act('Calculating…', async () => { const value = await previewCommercialDocument(request()); setTotals(value.content); setTotalsKey(serialized); }); }}>Calculate totals</button>}
        <button type="button" className="btn-secondary w-full" disabled={!!busy || !input.lines.length} onClick={previewPDF}>{locked ? 'View archived PDF' : 'Preview PDF'}</button>
        {!locked && current && <button type="button" className="btn-primary w-full" disabled={!!busy || serialized !== baseline} onClick={() => setReview(true)}>Review &amp; finalize</button>}
        {!locked && <p className="text-xs leading-relaxed text-gray-600">Save the draft before finalizing. Finalization assigns a number and freezes its PDF.</p>}
        {locked && current?.kind === 'quote' && <button type="button" className="btn-primary w-full" disabled={!!busy} onClick={() => void act('Creating order draft…', async () => { adopt(await convertCommercialDocument(current.id, current.revision)); setNotice('Order draft opened with the quotation’s prices and inclusions. Review it before finalizing.'); await reload(); })}>Create order draft</button>}
        <p className="border-t border-gray-200 pt-4 text-xs leading-relaxed text-gray-600">Commercial documents only. Finalizing does not collect a payment, activate licences or replace a subscription contract.</p>
        {review && current && !locked && <div role="region" aria-label="Finalize document" className="space-y-3 border-t border-gray-300 pt-4"><h4 className="font-semibold">Finalize this {input.kind === 'quote' ? 'quotation' : 'order'}?</h4><p className="text-sm">Check the issuer, customer, prices, VAT and terms in the PDF. The numbered document will be read-only.</p><button type="button" className="btn-primary w-full" disabled={!!busy || serialized !== baseline} onClick={() => void act('Finalizing…', async () => { adopt(await issueCommercialDocument(current.id, current.revision)); setNotice('Document finalized. Its numbered PDF is archived and ready to download.'); await reload(); })}>Finalize document</button><button type="button" className="text-sm underline" disabled={!!busy} onClick={() => setReview(false)}>Continue reviewing</button></div>}
      </aside>
    </div>}

    <section className="space-y-3 border-t border-gray-200 pt-6" aria-label="Saved commercial documents"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Saved documents</h3><div className="flex flex-wrap gap-2"><select className="field" aria-label="Document type filter" value={kindFilter} onChange={e => { setKindFilter(e.target.value); setPage(1); }}><option value="">All types</option><option value="quote">Quotations</option><option value="order">Sales orders</option></select><select className="field" aria-label="Document status filter" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="draft">Drafts</option><option value="issued">Finalized</option></select><button type="button" className="btn-secondary" disabled={!!busy} onClick={() => void act('Refreshing…', reload)}>Refresh</button></div></div>
      <div className="table-scroll relative" tabIndex={0} role="region" aria-label="Document list"><table className="data-table min-w-[38rem]"><thead><tr><th>Document</th><th>Customer</th><th>Status</th><th>Date</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><span className="block font-medium">{row.number || `${kindName(row.kind)} · Draft #${row.id}`}</span><span className="text-xs text-gray-600" dir="auto">{row.title}</span></td><td dir="auto">{row.customer_name}</td><td>{row.status === 'issued' ? 'Finalized' : 'Draft'}</td><td>{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem' }).format(new Date(row.created_at))}</td><td><button type="button" className="font-medium underline" disabled={!!busy} onClick={() => open(row.id)}>Open<span className="sr-only"> {row.number || row.title}</span></button></td></tr>)}</tbody></table></div>
      {listError && <p role="alert" className="error-notice">The document list could not be refreshed. {listError} Use Refresh to try again.</p>}
      {listLoading && <p role="status" className="text-sm text-gray-600">Loading saved documents…</p>}
      {!listLoading && !listError && !rows.length && <p className="py-5 text-center text-sm text-gray-600">No documents in this view.</p>}
      <div className="flex items-center justify-end gap-4 text-sm"><button type="button" className="underline disabled:opacity-40" disabled={page === 1 || !!busy} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page}</span><button type="button" className="underline disabled:opacity-40" disabled={!more || !!busy} onClick={() => setPage(n => n + 1)}>Next</button></div>
    </section>

    {pdf && <dialog ref={dialog} onCancel={() => setPdf(null)} onClose={() => setPdf(null)} className="h-[92dvh] w-[min(1100px,95vw)] max-w-none rounded-xl border border-gray-300 p-0 backdrop:bg-black/40" aria-label="PDF preview"><div className="flex h-full flex-col"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4"><h3 className="font-semibold">{pdf.name}</h3><div className="flex gap-3"><a className="btn-primary" href={pdf.url} download={pdf.name}>Download PDF</a><button type="button" className="btn-secondary" onClick={() => setPdf(null)}>Close preview</button></div></div><iframe className="min-h-0 flex-1" src={pdf.url} title="Foody commercial document PDF" /></div></dialog>}
  </section>;
}
