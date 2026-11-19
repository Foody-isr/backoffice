'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import FoodyOfferEditor from '@/components/FoodyOfferEditor';
import FoodySubscriptionSummary from '@/components/FoodySubscriptionSummary';
import { getFoodyObservedUsage, getFoodyPrivateBilling, reconcileFoodyBilling, saveFoodyOffer, simulateFoodyRenewal, type FoodyObservedUsage, type FoodyOfferInput, type FoodyPrivateBilling } from '@/lib/api';

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const secondary = 'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50';
const money = (minor: number) => new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS' }).format(minor / 100);
const formatDate = (date: string) => new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium', timeZone: 'Asia/Jerusalem' }).format(new Date(date));
const statusLabels: Record<string, string> = { creating: 'Preparing checkout', pending: 'Awaiting verification', review: 'Needs review', paid: 'Confirmed', failed: 'Failed or expired' };
const metricLabels: Record<string, string> = {
  openai_whisper_requests: 'OpenAI stock transcriptions', anthropic_stock_input_tokens: 'Claude stock import input tokens',
  anthropic_stock_output_tokens: 'Claude stock import output tokens', twilio_verify_sms_requests: 'Twilio Verify SMS requests',
  anthropic_assistant_input_tokens: 'Claude assistant input tokens', anthropic_assistant_output_tokens: 'Claude assistant output tokens',
  whatsapp_order_messages: 'WhatsApp order messages with provider confirmation',
};
/** Show sandbox billing and manage private offers for legacy restaurants. */
export default function FoodyPrivateOffer({ restaurantId, modular }: { restaurantId: number; modular: boolean }) {
  const [view, setView] = useState<FoodyPrivateBilling | null>(null);
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
      setView(result);
    } catch (e) {
      setView(null);
      setError(e instanceof Error && e.message === 'foody_billing_sandbox_only'
        ? 'Select this test restaurant in Foody billing (sandbox) to enable private CST offers here.'
        : 'Could not load sandbox billing.');
    } finally { setLoading(false); }
  }, [restaurantId]);
  useEffect(() => { void load(); }, [load]);
  const offerID = view?.offer?.id;
  useEffect(() => {
    if (!offerID || view?.onboarding) return;
    let current = true;
    setUsageError(false);
    getFoodyObservedUsage(restaurantId).then((next) => { if (current) setUsage(next); },
      () => { if (current) setUsageError(true); });
    return () => { current = false; };
  }, [offerID, restaurantId, view?.onboarding]);

  async function publish(input: FoodyOfferInput) {
    if (!view || modular || view.onboarding || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = await saveFoodyOffer(restaurantId, input);
      const url = new URL(window.location.href);
      url.searchParams.delete('quotation'); url.searchParams.delete('revision');
      window.history.replaceState(window.history.state, '', url);
      setView(next);
      setNotice('Private offer published. The owner can open it in Admin.');
    } catch (e) {
      setError(e instanceof Error && ['foody_billing_conflict', 'foody_catalog_conflict'].includes(e.message)
        ? 'The offer was updated elsewhere. Reload before publishing your changes.'
        : e instanceof Error && e.message === 'foody_offer_quote_expired' ? 'The quotation has expired. Select a current quotation.'
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
    const cycle = view?.agreement?.cycle;
    if (lock.current || !view?.accepted_offer || !cycle || !(cycle === 'annual' ? view.can_simulate_annual_renewal : view.can_simulate_renewal)) return;
    const amount = money(view.accepted_offer[cycle].total_minor);
    const date = formatDate(view.agreement!.period_end);
    if (!window.confirm(`Charge ${amount} in Verifone CST for the ${cycle} period starting ${date}? You can advance the first renewal once.`)) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = await simulateFoodyRenewal(restaurantId, cycle);
      setView(next);
      if (next.payment?.status === 'paid') setNotice('Sandbox renewal confirmed.');
    } catch {
      setError('Could not confirm the sandbox renewal. Reload the published version and verify the current payment before acting again.');
      try { setView(await getFoodyPrivateBilling(restaurantId)); } catch { /* Preserve the existing offer and show the verification error. */ }
    } finally { setBusy(false); lock.current = false; }
  }

  const testRenewal = (view?.can_simulate_annual_renewal || view?.can_simulate_renewal) &&
    <button type="button" disabled={busy || loading} className={secondary + ' mt-2'} onClick={() => void simulateRenewal()}>
      {view.can_simulate_annual_renewal ? 'Tester le premier renouvellement annuel' : 'Test first monthly renewal'}
    </button>;
  const payment = view?.payment;
  const paymentDetails = payment && <div className="mt-2 border-t border-gray-200 pt-2 text-sm">
    <p>{statusLabels[payment.status] ?? payment.status} · {money(payment.amount_minor)} · <bdi>{payment.reference}</bdi></p>
    {payment.status === 'review' && <label className="block text-sm">Matching transaction ID from Verifone Central
      <input value={transaction} maxLength={36} onChange={(e) => setTransaction(e.target.value)} className={inputClass} />
    </label>}
    {['creating', 'pending', 'review'].includes(payment.status) && <button type="button" disabled={busy || loading} className={secondary + ' mt-2'} onClick={() => void reconcile()}>Verify payment</button>}
  </div>;

  if (modular || view?.onboarding) {
    return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6" aria-label="Sandbox subscription and modules">
      {view?.onboarding
        ? <FoodySubscriptionSummary billing={view} onboarding={view.onboarding} />
        : <h2 className="text-lg font-semibold text-gray-900">Subscription &amp; modules</h2>}
      {loading && <p role="status" className="text-sm text-gray-600">Loading subscription…</p>}
      {view?.owner_url && <a href={view.owner_url} className="text-sm font-semibold text-brand-700 underline underline-offset-2">Open owner billing page</a>}
      {paymentDetails}
      {testRenewal}
      {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!loading && !view?.onboarding && (
        <div className="space-y-2">
          {!error && <p role="alert" className="text-sm text-red-700">The modular subscription could not be loaded.</p>}
          <button type="button" onClick={() => void load()} className={secondary}>Reload subscription</button>
        </div>
      )}
    </section>;
  }
  return <section id="private-offer" className="space-y-4 rounded-xl border border-gray-200 bg-white p-6" aria-label="Foody private offer">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Private sandbox offer</h2>
        <p className="mt-1 text-sm text-gray-600">The offer description records the terms shared with the owner. See Features &amp; access for the restaurant’s current rights.</p>
      </div>
      <Link href="/dashboard/foody-billing" className="text-sm font-medium text-brand-700 underline">Foody Verifone settings</Link>
    </div>
    {loading && <p role="status">Loading offer…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {view && <>
      {view.offer && <div className="rounded-lg bg-gray-50 p-4 text-sm">
        <p className="font-medium">Published version {view.offer.version} · {view.offer.title}</p>
        <p>{[view.offer.monthly.total_minor > 0 && `Monthly ${money(view.offer.monthly.total_minor)} incl. VAT`, view.offer.annual.total_minor > 0 && `Annual ${money(view.offer.annual.total_minor)} incl. VAT`].filter(Boolean).join(' · ')}</p>
        <p className="mt-2 whitespace-pre-wrap text-gray-600">{view.offer.includes}</p>
        <p>{view.checkout_enabled ? (view.monthly_enabled ? 'Monthly and annual checkouts enabled' : 'Annual checkout enabled; recurring contract disabled') : 'Checkout disabled in merchant settings'}</p>
        {view.owner_url && <a href={view.owner_url} className="font-medium text-brand-700 underline">Open owner billing page</a>}
        {view.agreement && <p>Paid through {formatDate(view.agreement.period_end)} · {view.agreement.cycle} · accepted version {view.accepted_offer?.version}
          {view.agreement.renews && view.agreement.offer_id !== view.offer.id ? ' · new consent required at renewal' : ''}</p>}
        {view.agreement && view.accepted_offer && view.accepted_offer.id !== view.offer.id && (
          <p className="text-gray-600">Accepted amount {money(view.accepted_offer[view.agreement.cycle].total_minor)} incl. VAT</p>
        )}
        {!view.agreement && <p className="mt-1 text-gray-600">Awaiting a confirmed sandbox payment.</p>}
        {testRenewal}
        {paymentDetails}
      </div>}
      {!loading && <FoodyOfferEditor key={restaurantId + ':' + (view.offer?.version ?? 0)} restaurantId={restaurantId} offer={view.offer}
        busy={busy} onPublish={publish} onReload={load} />}

    </>}
    {!view && !loading && <button onClick={() => void load()} className={secondary}>Reload</button>}
    {offerID && <div className="border-t border-gray-200 pt-4 text-sm">
      <h3 className="font-semibold">Observed usage · no charges</h3>
      {usageError && <p role="alert">Usage is temporarily unavailable.</p>}
      {usage && <><p className="mt-1 text-gray-600">{usage.month} UTC · tracked activity only. Some integrations or periods may not be covered.</p>
        {!usage.complete && <p role="status" className="text-amber-800">Some counters could not be read.</p>}
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(usage.observed).map(([id, count]) => <div key={id} className="flex justify-between gap-2"><dt>{metricLabels[id] ?? id}</dt><dd>{count}</dd></div>)}
        </dl>
      </>}
    </div>}
  </section>;
}
