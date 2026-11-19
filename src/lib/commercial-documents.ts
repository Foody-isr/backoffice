import type { FoodyEditableCatalog, FoodyLicenceCounts, FoodyBillingPolicy } from './api';
import { commercialDocumentRequest } from './api';

export type DocumentLocale = 'he' | 'fr' | 'en';
export type DocumentKind = 'quote' | 'order';
export type BillingMode = 'once' | 'monthly' | 'prepaid' | 'usage' | 'included';
export type TaxMode = 'ht' | 'ttc' | 'none';
export type Party = { name: string; company_id: string; address: string; email: string; phone: string };
export type DocumentDefaults = { revision: number; issuer: Party; locale: DocumentLocale; tax_mode: TaxMode; vat_bps: number; terms: string };
export type CommercialLine = {
  source_type: 'custom' | 'module' | 'plan' | 'tariff'; source_id: string;
  category: 'subscription' | 'hardware' | 'fee'; description: string; notes: string;
  quantity: number; unit: string; unit_price_minor: number | null; billing: BillingMode;
  period_months: number; commitment_months: number; due: 'order' | 'activation' | 'date'; start_date: string;
};
export type CommercialInput = {
  kind: DocumentKind; restaurant_id: number | null; catalog_revision: number; title: string;
  locale: DocumentLocale; date: string; valid_until: string; issuer: Party; customer: Party;
  tax_mode: TaxMode; vat_bps: number; include_features: boolean; lines: CommercialLine[]; terms: string; notes: string;
};
export type CommercialAmount = { net: number; vat: number; gross: number };
export type PricedLine = CommercialLine & { amount: CommercialAmount; reference_price_minor?: number; software_saving_minor?: number; modules?: string[]; seats?: FoodyLicenceCounts; features?: string[]; commitment: CommercialAmount };
export type CommercialSnapshot = CommercialInput & { priced_lines: PricedLine[]; once: CommercialAmount; prepaid: CommercialAmount; monthly: CommercialAmount; single: CommercialAmount };
export type CommercialMetadata = { id: number; revision: number; kind: DocumentKind; status: 'draft' | 'issued'; number: string; restaurant_id?: number; source_id?: number; title: string; customer_name: string; created_at: string; updated_at: string; issued_at?: string };
export type CommercialDocument = CommercialMetadata & { content: CommercialSnapshot; catalog: FoodyEditableCatalog };
export type DraftRequest = { document_id: number; expected_revision: number; idempotency_key: string; document: CommercialInput };
export type SourceOption = { key: string; type: CommercialLine['source_type']; id: string; name: string; group: string; unit: string; price: number | null; quantity?: number; billingPolicy?: FoodyBillingPolicy };

/** Lists sources from the published or document-frozen catalogue. */
export function documentSources(catalog: FoodyEditableCatalog, locale: DocumentLocale): SourceOption[] {
  return [
    ...catalog.plans.map(p => ({ key: `plan:${p.id}`, type: 'plan' as const, id: p.id, name: p.name[locale], group: 'Plans', unit: 'subscription', price: p.monthly_minor, billingPolicy: catalog.billing_policy })),
    ...catalog.products.map(p => ({ key: `module:${p.id}`, type: 'module' as const, id: p.id, name: p.name[locale], group: 'Modules', unit: 'subscription', price: p.monthly_minor, billingPolicy: catalog.billing_policy })),
    ...catalog.tariffs.map(p => ({ key: `tariff:${p.id}`, type: 'tariff' as const, id: p.id, name: p.name[locale], group: p.category === 'hardware' ? 'Hardware' : 'Fees & licences', unit: p.unit, price: p.amount_minor, quantity: p.quantity })),
  ];
}

/** Uses Israel's calendar date for documents without relying on the browser zone. */
export function commercialDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Starts a private draft; nothing is saved or billed until an explicit action. */
export function newCommercialDraft(kind: DocumentKind, defaults: DocumentDefaults, catalog: FoodyEditableCatalog): CommercialInput {
  const date = commercialDate();
  const expiry = new Date(`${date}T12:00:00Z`); expiry.setUTCDate(expiry.getUTCDate() + 30);
  return { kind, restaurant_id: null, catalog_revision: catalog.revision, title: '', locale: defaults.locale, date,
    valid_until: kind === 'quote' ? expiry.toISOString().slice(0, 10) : '', issuer: { ...defaults.issuer },
    customer: { name: '', company_id: '', address: '', email: '', phone: '' }, tax_mode: defaults.tax_mode, vat_bps: defaults.vat_bps,
    include_features: false, lines: [], terms: defaults.terms, notes: '' };
}

/** Copies only editable fields, avoiding server-calculated totals in save requests. */
export function documentInput(content: CommercialSnapshot): CommercialInput {
  const { kind, restaurant_id, catalog_revision, title, locale, date, valid_until, issuer, customer, tax_mode, vat_bps, include_features, lines, terms, notes } = content;
  return structuredClone({ kind, restaurant_id, catalog_revision, title, locale, date, valid_until, issuer, customer, tax_mode, vat_bps, include_features, lines, terms, notes });
}

/** Returns the catalogue price in the document's selected input tax basis. */
export function sourcePrice(source: SourceOption, input: Pick<CommercialInput, 'tax_mode' | 'vat_bps'>, months = 1): number | null {
  if (source.price === null) return null;
  const policy = source.billingPolicy;
  const eligible = (source.type === 'module' || source.type === 'plan') && policy && policy.annual_period_months > 0 && months > 0 && months % policy.annual_period_months === 0;
  const net = source.price * (eligible ? months / policy.annual_period_months * policy.annual_billed_months : months);
  return input.tax_mode === 'ttc' ? net + Math.floor((net * input.vat_bps + 5000) / 10000) : net;
}

/** Adds a line with explicit, editable payment terms and a negotiated unit price. */
export function newCommercialLine(source: SourceOption | null, input: Pick<CommercialInput, 'tax_mode' | 'vat_bps'>): CommercialLine {
  const subscription = source?.type === 'module' || source?.type === 'plan';
  const billing: BillingMode = source?.unit === 'quantity' ? 'included' : subscription || source?.unit.endsWith('month') ? 'monthly'
    : ['transaction', 'message', 'request'].includes(source?.unit ?? '') ? 'usage' : 'once';
  return { source_type: source?.type ?? 'custom', source_id: source?.id ?? '', category: subscription ? 'subscription' : source?.group === 'Hardware' ? 'hardware' : 'fee',
    description: source ? source.name + (source.quantity !== undefined ? ` (${source.quantity})` : '') : '', notes: '', quantity: 1,
    unit: source?.unit ?? 'once', unit_price_minor: billing === 'included' ? 0 : source ? sourcePrice(source, input) : null,
    billing, period_months: 0, commitment_months: 0, due: billing === 'monthly' || subscription ? 'activation' : 'order', start_date: '' };
}

/** Changes frequency without confusing a monthly rate with a whole-period price. */
export function changeLineBilling(line: CommercialLine, billing: BillingMode, source?: SourceOption, input?: Pick<CommercialInput, 'tax_mode' | 'vat_bps'>): CommercialLine {
  let price = line.unit_price_minor;
  const period = billing === 'prepaid' ? 12 : 0;
  if (price !== null && line.billing === 'prepaid') price = Math.round(price / line.period_months);
  if (price !== null && billing === 'prepaid') price *= period;
  // Reprice a catalogue amount only. A negotiated or historical amount stays explicit.
  if (source && input && line.billing !== 'included' && line.unit_price_minor !== null &&
      line.unit_price_minor === sourcePrice(source, input, line.billing === 'prepaid' ? line.period_months : 1)) {
    price = sourcePrice(source, input, billing === 'prepaid' ? period : 1);
  }
  if (billing === 'included') price = 0;
  return { ...line, billing, unit_price_minor: price, period_months: period, commitment_months: billing === 'monthly' ? line.commitment_months : 0, quantity: billing === 'usage' ? 1 : line.quantity };
}

/** Changes price display basis while preserving negotiated net prices. */
export function changeDocumentTax(input: CommercialInput, mode: TaxMode, vatBps: number): CommercialInput {
  const rate = mode === 'none' ? 0 : vatBps;
  return { ...input, tax_mode: mode, vat_bps: rate, lines: input.lines.map(line => {
    if (line.unit_price_minor === null) return line;
    const net = input.tax_mode === 'ttc' ? Math.floor((line.unit_price_minor * 10000 + (10000 + input.vat_bps) / 2) / (10000 + input.vat_bps)) : line.unit_price_minor;
    return { ...line, unit_price_minor: mode === 'ttc' ? net + Math.floor((net * rate + 5000) / 10000) : net };
  }) };
}

/** Loads private metadata without customer document bodies or archived PDFs. */
export function listCommercialDocuments(page: number, kind: string, status: string, restaurantId?: number) {
  const query = new URLSearchParams({ page: String(page), kind, status });
  if (restaurantId !== undefined) query.set('restaurant_id', String(restaurantId));
  return commercialDocumentRequest<{ documents: CommercialMetadata[]; has_more: boolean }>(`?${query}`);
}
/** Retrieves a saved document and the catalogue used when it was created. */
export function getCommercialDocument(id: number) { return commercialDocumentRequest<CommercialDocument>(`/${id}`); }
/** Reads the issuer defaults for future drafts. */
export function getCommercialDefaults() { return commercialDocumentRequest<DocumentDefaults>('/defaults'); }
/** Saves issuer defaults using their last-read revision. */
export function saveCommercialDefaults(input: DocumentDefaults) { return commercialDocumentRequest<DocumentDefaults>('/defaults', { method: 'PUT', body: JSON.stringify(input) }); }
/** Validates a draft and calculates authoritative frequency-specific totals. */
export function previewCommercialDocument(input: DraftRequest) { return commercialDocumentRequest<CommercialDocument>('/preview', { method: 'POST', body: JSON.stringify(input) }); }
/** Renders an unsaved draft, explicitly marked as a draft. */
export function previewCommercialPDF(input: DraftRequest) { return commercialDocumentRequest<Blob>('/preview.pdf', { method: 'POST', body: JSON.stringify(input) }, true); }
/** Saves a private draft without issuing it or changing customer contracts. */
export function saveCommercialDocument(input: DraftRequest) { return commercialDocumentRequest<CommercialDocument>(input.document_id ? `/${input.document_id}` : '', { method: input.document_id ? 'PUT' : 'POST', body: JSON.stringify(input) }); }
/** Assigns a document number and archives the reviewed, immutable PDF. */
export function issueCommercialDocument(id: number, revision: number) { return commercialDocumentRequest<CommercialDocument>(`/${id}/issue`, { method: 'POST', body: JSON.stringify({ expected_revision: revision }) }); }
/** Creates the single order draft linked to an issued quotation. */
export function convertCommercialDocument(id: number, revision: number) { return commercialDocumentRequest<CommercialDocument>(`/${id}/order`, { method: 'POST', body: JSON.stringify({ expected_revision: revision }) }); }
/** Downloads an issued archive or a saved draft's marked PDF. */
export function downloadCommercialDocument(id: number) { return commercialDocumentRequest<Blob>(`/${id}/pdf`, {}, true); }
