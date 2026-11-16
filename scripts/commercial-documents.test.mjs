import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/lib/commercial-documents.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => ({ commercialDocumentRequest: () => { throw new Error('No network in pricing tests'); } }), Intl, Date, structuredClone, URLSearchParams });
const { newCommercialLine, changeLineBilling, changeDocumentTax, sourcePrice, commercialDate, documentInput } = exports;
const tax = { tax_mode: 'ht', vat_bps: 1800 };
const module = { type: 'module', id: 'restaurant', name: 'Restaurant', group: 'Modules', unit: 'subscription', price: 59000 };

test('PDF blobs are embedded only in the document workspace while anti-framing and other policies stay intact', async () => {
  const { default: nextConfig } = await import('../next.config.mjs');
  const rules = await nextConfig.headers();
  const globalRule = rules.find(rule => rule.source === '/(.*)');
  const documentRule = rules.find(rule => rule.source === '/dashboard/features');
  assert.ok(globalRule && documentRule);
  const directives = rule => new Map(rule.headers.find(header => header.key === 'Content-Security-Policy').value
    .split(';').map(value => { const [name, ...sources] = value.trim().split(/\s+/); return [name, sources.join(' ')]; }));
  const globalPolicy = directives(globalRule);
  const documentPolicy = directives(documentRule);
  assert.equal(globalPolicy.get('object-src'), "'none'");
  assert.equal(globalPolicy.has('frame-src'), false);
  assert.equal(documentPolicy.get('object-src'), 'blob:');
  assert.equal(documentPolicy.get('frame-src'), "'self' blob:");
  assert.equal(documentPolicy.get('frame-ancestors'), "'none'");
  assert.equal(globalRule.headers.find(header => header.key === 'X-Frame-Options').value, 'DENY');
  assert.deepEqual(documentRule.headers.map(header => header.key), ['Content-Security-Policy']);
  for (const [directive, sources] of globalPolicy) {
    if (directive !== 'object-src') assert.equal(documentPolicy.get(directive), sources, directive);
  }
});

test('prepayment converts a negotiated monthly rate to a whole-period amount exactly once', () => {
  const monthly = newCommercialLine(module, tax);
  monthly.unit_price_minor = 40000;
  const prepaid = changeLineBilling(monthly, 'prepaid');
  assert.equal(prepaid.period_months, 12);
  assert.equal(prepaid.unit_price_minor, 480000);
  assert.equal(prepaid.commitment_months, 0);
  assert.equal(changeLineBilling(prepaid, 'monthly').unit_price_minor, 40000);
  assert.equal(monthly.unit_price_minor, 40000);
});

test('24/36-month catalogue prepayment and TTC basis use period amount', () => {
  assert.equal(sourcePrice(module, tax, 24), 1416000);
  assert.equal(sourcePrice(module, { tax_mode: 'ttc', vat_bps: 1800 }, 36), 2506320);
});

test('switching HT/TTC preserves negotiated net amounts and does not silently replace quoted prices', () => {
  const original = { ...tax, lines: [{ ...newCommercialLine(module, tax), unit_price_minor: 41000 }, newCommercialLine(null, tax)] };
  const gross = changeDocumentTax(original, 'ttc', 1800);
  assert.equal(gross.lines[0].unit_price_minor, 48380);
  assert.equal(gross.lines[1].unit_price_minor, null);
  assert.equal(changeDocumentTax(gross, 'ht', 1800).lines[0].unit_price_minor, 41000);
  assert.equal(changeDocumentTax(gross, 'none', 0).vat_bps, 0);
  assert.equal(changeDocumentTax(gross, 'none', 0).lines[0].unit_price_minor, 41000);
  assert.equal(original.lines[0].unit_price_minor, 41000);
});

test('hardware, virtual terminal fees, usage rates and included quantities retain separate frequencies', () => {
  const tariff = (unit, price = 4900) => ({ type: 'tariff', id: unit, name: 'Demo', group: 'Fees & licences', unit, price });
  assert.equal(newCommercialLine({ ...tariff('device'), group: 'Hardware' }, tax).billing, 'once');
  assert.equal(newCommercialLine(tariff('terminal_month'), tax).billing, 'monthly');
  assert.equal(newCommercialLine(tariff('employee_month', null), tax).unit_price_minor, null);
  assert.equal(newCommercialLine(tariff('transaction'), tax).billing, 'usage');
  const included = newCommercialLine({ ...tariff('quantity', null), quantity: 100 }, tax);
  assert.equal(included.billing, 'included');
  assert.equal(included.unit_price_minor, 0);
  assert.equal(included.description, 'Demo (100)');
  const monthly = { ...newCommercialLine(tariff('terminal_month'), tax), commitment_months: 24, quantity: 5 };
  const usage = changeLineBilling(monthly, 'usage');
  assert.equal(usage.quantity, 1);
  assert.equal(usage.commitment_months, 0);
});

test('document dates follow the Israeli calendar at midnight', () => {
  assert.equal(commercialDate(new Date('2026-11-15T22:30:00Z')), '2026-11-16');
});

test('server totals and inclusions cannot become editable request fields', () => {
  const input = documentInput({ lines: [newCommercialLine(module, tax)], priced_lines: [{ seats: { pos: 99 } }], single: { gross: 1 }, issuer: { name: 'Demo' } });
  assert.equal('priced_lines' in input, false);
  assert.equal('single' in input, false);
  assert.equal(input.lines[0].unit_price_minor, 59000);
});

test('the offer preview distinguishes an automatic bundle from separate module and payment charges', () => {
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/commercial-catalog.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const preview = {};
  vm.runInNewContext(code,{exports:preview});
  const name = {en:'Test',fr:'Test',he:'בדיקה'};
  const seats = {pos:0,pos_users_unlimited:true,chef:0,kds:0,employees:null,pos_devices:2};
  const catalog = {products:[{id:'restaurant',name,monthly_minor:59000,included:seats,capabilities:['pos']},{id:'ordering',name,monthly_minor:59000,included:{...seats,pos_devices:0,pos_users_unlimited:false},capabilities:['website']}],plans:[{id:'duo',name,modules:['restaurant','ordering'],monthly_minor:99000,included:seats,capabilities:['pos','website'],automatic:true,published:true}]};
  assert.equal(preview.commercialSelection(catalog,['restaurant','ordering']).monthlyMinor,99000);
  assert.equal(preview.commercialSelection(catalog,['restaurant','ordering']).seats.pos_devices,2);
  assert.equal(preview.commercialSelection(catalog,['restaurant','ordering']).seats.pos,0);
  catalog.plans[0].included = {...seats,pos_devices:1};
  assert.equal(preview.commercialSelection(catalog,['restaurant','ordering']).monthlyMinor,118000);
});
