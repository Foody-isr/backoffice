'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { getFoodyObservedUsage, getFoodyPrivateBilling, reconcileFoodyBilling, saveFoodyOffer, simulateFoodyRenewal, type FoodyObservedUsage, type FoodyPrivateBilling } from '@/lib/api';

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const secondary = 'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50';
const money = (minor: number) => new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS' }).format(minor / 100);
const formatDate = (date: string) => new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium', timeZone: 'Asia/Jerusalem' }).format(new Date(date));
const statusLabels: Record<string, string> = { creating: 'Preparing checkout', pending: 'Awaiting verification', review: 'Needs review', paid: 'Confirmed', failed: 'Failed or expired' };
const metricLabels: Record<string, string> = {
  google_autocomplete: 'Google Places suggestions', google_details: 'Google Places details', google_geocoding: 'Google geocoding',
  google_routes: 'Google routes', google_optimization_single: 'Google single vehicle shipments',
  google_optimization_fleet: 'Google fleet shipments', google_tiles: 'Google map tiles', geoapify_credits: 'Geoapify estimated credits',
  openai_whisper_requests: 'OpenAI stock transcriptions', anthropic_stock_input_tokens: 'Claude stock import input tokens',
  anthropic_stock_output_tokens: 'Claude stock import output tokens', twilio_verify_sms_requests: 'Twilio Verify SMS requests',
  anthropic_assistant_input_tokens: 'Claude assistant input tokens', anthropic_assistant_output_tokens: 'Claude assistant output tokens',
  whatsapp_order_messages: 'WhatsApp order messages with provider confirmation',
};
type Draft = { title: string; includes: string; terms: string; monthly: string; annual: string; tax: '' | 'ht' | 'ttc'; date: string };
function fromOffer(offer: FoodyPrivateBilling['offer']): Draft {
  if (!offer) return { title: '', includes: '', terms: '', monthly: '', annual: '', tax: '', date: '' };
  return { title: offer.title, includes: offer.includes, terms: offer.terms, monthly: String(offer.monthly_minor / 100),
    annual: String(offer.annual_minor / 100), tax: offer.tax_mode, date: offer.start_date };
}
function minor(value: string) {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return 0;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** Publish private sandbox offers for the selected restaurant. */
export default function FoodyPrivateOffer({ restaurantId }: { restaurantId: number }) {
  const [view, setView] = useState<FoodyPrivateBilling | null>(null);
  const [draft, setDraft] = useState<Draft>(fromOffer(null));
  const [usage, setUsage] = useState<FoodyObservedUsage | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [transaction, setTransaction] = useState('');
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const result = await getFoodyPrivateBilling(restaurantId);
      setView(result); setDraft(fromOffer(result.offer));
    } catch (e) {
      setView(null);
      setError(e instanceof Error && e.message === 'foody_billing_sandbox_only' ? 'Private offers are available in the development Backoffice.' : 'Could not load the private offer.');
    } finally { setLoading(false); }
  }, [restaurantId]);
  useEffect(() => { void load(); }, [load]);
  const offerID = view?.offer?.id;
  useEffect(() => {
    if (!offerID) return;
    let current = true;
    setUsageError(false);
    getFoodyObservedUsage(restaurantId).then((next) => { if (current) setUsage(next); },
      () => { if (current) setUsageError(true); });
    return () => { current = false; };
  }, [offerID, restaurantId]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view || lock.current || !draft.tax) return;
    const monthly_minor = minor(draft.monthly), annual_minor = minor(draft.annual);
    if (!monthly_minor || !annual_minor || monthly_minor > 100000000 || annual_minor > 100000000) {
      setError('Enter positive ILS amounts with up to two decimal places.'); return;
    }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = await saveFoodyOffer(restaurantId, {
        expected_version: view.offer?.version ?? 0, title: draft.title, includes: draft.includes, terms: draft.terms,
        monthly_minor, annual_minor, tax_mode: draft.tax, start_date: draft.date,
      });
      setView(next); setDraft(fromOffer(next.offer));
      setNotice('Private offer published. The owner can open it in Admin.');
    } catch (e) {
      setError(e instanceof Error && e.message === 'foody_billing_conflict'
        ? 'The offer was updated elsewhere. Reload before publishing your changes.'
        : 'Could not confirm publication. Check the fields and reload to verify the current version.');
    } finally { setBusy(false); lock.current = false; }
  }

  async function reconcile() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      setView(await reconcileFoodyBilling(restaurantId, transaction.trim() || undefined));
      setTransaction('');
    } catch { setError('Could not verify this payment. Check the matching reference in Verifone Central.'); }
    finally { setBusy(false); lock.current = false; }
  }

  async function simulateRenewal() {
    if (lock.current || !view?.can_simulate_renewal) return;
    if (!window.confirm('Send the next monthly test debit to Verifone sandbox now? A confirmed payment covers the next period. This is allowed once for this mandate.')) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = await simulateFoodyRenewal(restaurantId);
      setView(next);
      if (next.payment?.status === 'paid') setNotice('Sandbox renewal confirmed.');
    } catch {
      setError('Could not confirm the sandbox renewal. Reload the published version and verify the current payment before acting again.');
      try { setView(await getFoodyPrivateBilling(restaurantId)); } catch { /* Preserve the existing offer and show the verification error. */ }
    } finally { setBusy(false); lock.current = false; }
  }

  const edit = (field: Exclude<keyof Draft, 'tax'>, value: string) => setDraft((prev) => ({ ...prev, [field]: value }));
  return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6" aria-label="Foody private offer">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Sandbox</p>
        <h2 className="text-lg font-semibold text-gray-900">Foody private offer</h2>
        <p className="mt-1 text-sm text-gray-600">Publish for this restaurant’s owner. Accepted amounts and payments already in progress keep their original terms.</p>
      </div>
      <Link href="/dashboard/foody-billing" className="text-sm font-medium text-brand-700 underline">Foody Verifone settings</Link>
    </div>
    {loading && <p role="status">Loading offer…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {view && <>
      {view.offer && <div className="rounded-lg bg-gray-50 p-4 text-sm">
        <p className="font-medium">Published version {view.offer.version} · {view.offer.title}</p>
        <p>Monthly {money(view.offer.monthly.total_minor)} incl. VAT · Annual {money(view.offer.annual.total_minor)} incl. VAT</p>
        <p>{view.checkout_enabled ? (view.monthly_enabled ? 'Monthly and annual checkouts enabled' : 'Annual checkout enabled; recurring contract disabled') : 'Checkout disabled in merchant settings'}</p>
        {view.owner_url && <a href={view.owner_url} className="font-medium text-brand-700 underline">Open owner billing page</a>}
        {view.agreement && <p>Paid until {formatDate(view.agreement.period_end)} · accepted version {view.accepted_offer?.version}
          {view.agreement.renews && view.agreement.offer_id !== view.offer.id ? ' · new consent required at renewal' : ''}</p>}
        {view.can_simulate_renewal && <button type="button" disabled={busy || loading} className={secondary + ' mt-2'}
          onClick={() => void simulateRenewal()}>Test first monthly renewal</button>}
        {view.payment && <div className="mt-2 border-t border-gray-200 pt-2">
          <p>{statusLabels[view.payment.status] ?? view.payment.status} · {money(view.payment.amount_minor)} · <bdi>{view.payment.reference}</bdi></p>
          {view.payment.status === 'review' && <label className="block text-sm">Matching transaction ID from Verifone Central
            <input value={transaction} maxLength={36} onChange={(e) => setTransaction(e.target.value)} className={inputClass} />
          </label>}
          {['creating', 'pending', 'review'].includes(view.payment.status) && <button type="button" disabled={busy} className={secondary + ' mt-2'} onClick={() => void reconcile()}>Verify payment</button>}
        </div>}
      </div>}
      <form onSubmit={publish}>
        <fieldset disabled={busy || loading} className="space-y-3">
          <legend className="font-medium">{view.offer ? 'Edit and publish a new version' : 'Create an offer'}</legend>
          <label className="block text-sm">Offer name<input required maxLength={120} className={inputClass} value={draft.title} onChange={(e) => edit('title', e.target.value)} /></label>
          <label className="block text-sm">Included modules and licences<textarea required maxLength={5000} rows={3} className={inputClass} value={draft.includes} onChange={(e) => edit('includes', e.target.value)} /></label>
          <label className="block text-sm">Terms, exclusions and cancellation<textarea required maxLength={5000} rows={3} className={inputClass} value={draft.terms} onChange={(e) => edit('terms', e.target.value)} /></label>
          <button type="button" className={secondary} onClick={() => setDraft((prev) => ({ ...prev, monthly: '400', annual: '4560' }))}>Use pilot prices: ₪400 / ₪4,560</button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Monthly amount (ILS)<input required inputMode="decimal" maxLength={10} className={inputClass} value={draft.monthly} onChange={(e) => edit('monthly', e.target.value)} /></label>
            <label className="block text-sm">Annual amount (ILS)<input required inputMode="decimal" maxLength={10} className={inputClass} value={draft.annual} onChange={(e) => edit('annual', e.target.value)} /></label>
            <label className="block text-sm">Agreed VAT treatment<select required className={inputClass} value={draft.tax} onChange={(e) => setDraft({ ...draft, tax: e.target.value as Draft['tax'] })}>
              <option value="">Select VAT treatment</option><option value="ttc">Amounts include VAT (TTC)</option><option value="ht">Amounts exclude VAT (HT)</option>
            </select></label>
            <label className="block text-sm">First payment available from (Israel date)<input type="date" required className={inputClass} value={draft.date} onChange={(e) => edit('date', e.target.value)} /></label>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish offer</button>
            <button type="button" onClick={() => void load()} className={secondary}>Reload published version</button>
          </div>
        </fieldset>
      </form>
    </>}
    {!view && !loading && <button onClick={() => void load()} className={secondary}>Reload</button>}
    {offerID && <div className="border-t border-gray-200 pt-4 text-sm">
      <h3 className="font-semibold">Observed usage · no charges</h3>
      {usageError && <p role="alert">Usage is temporarily unavailable.</p>}
      {usage && <><p className="mt-1 text-gray-600">{usage.month} UTC · tracked activity only. Some integrations or periods may not be covered.</p>
        {!usage.complete && <p role="status" className="text-amber-800">Some counters could not be read.</p>}
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {(usage.quotas?.counters ?? []).map((counter) => <div key={counter.id} className="flex justify-between gap-2"><dt>{metricLabels[counter.id] ?? counter.id}</dt><dd>{counter.used}</dd></div>)}
          {Object.entries(usage.observed).map(([id, count]) => <div key={id} className="flex justify-between gap-2"><dt>{metricLabels[id] ?? id}</dt><dd>{count}</dd></div>)}
        </dl>
      </>}
    </div>}
  </section>;
}
