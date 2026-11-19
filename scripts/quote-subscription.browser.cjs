// Run against a local Backoffice build on port 19083. All API replies use synthetic data.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.FOODY_BROWSER_PLAYWRIGHT_PATH || 'playwright');

const origin = 'http://127.0.0.1:19083';
const route = '/dashboard/restaurants/19';
const merchant = { name: 'Demo restaurant', id: 19, slug: 'demo', created_at: '2026-10-01', features: [] };
const quote = { id: 31, revision: 2, title: 'Demo quotation', number: 'FQ-demo' };
const monthly = { net_minor: 10000, vat_minor: 1800, total_minor: 11800 };
const annual = { net_minor: 110000, vat_minor: 19800, total_minor: 129800 };
const zero = { net_minor: 0, vat_minor: 0, total_minor: 0 };

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    await page.addInitScript(() => {
      localStorage.setItem('foody_admin_token', 'local-test');
      localStorage.setItem('foody_admin_user', JSON.stringify({ id: 7, role: 'superadmin', full_name: 'Demo' }));
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    let published = null;
    const view = () => ({ offer: published, checkout_enabled: true, monthly_enabled: true, annual_renewal_enabled: true });
    function preview(source) {
      const quoted = source.kind === 'quote';
      return { id: 0, version: 0, title: quoted ? quote.title : 'Foody Example', includes: quoted ? 'FQ-demo · Monthly licence' : 'Demo module',
        terms: 'Demo terms', tax_mode: 'ht', vat_bps: 1800, start_date: '2026-11-19', monthly_minor: monthly.net_minor, annual_minor: quoted ? 0 : annual.net_minor,
        monthly, annual: quoted ? zero : annual, commercial_source: { ...source, ...(quoted ? { number: quote.number, valid_until: '2027-11-19' } : {}) } };
    }
    await page.route('**/*', async handler => {
      const request = handler.request(), url = new URL(request.url());
      const path = url.pathname;
      if (!path.startsWith('/api/v1/')) return url.origin === origin ? handler.continue() : handler.abort();
      let body = {};
      if (path.endsWith('/documents')) {
        assert.equal(url.searchParams.get('restaurant_id'), '19');
        assert.equal(url.searchParams.get('status'), 'issued');
        body = { documents: [quote], has_more: false };
      } else if (path.endsWith('/catalog')) {
        body = { revision: 4, plans: [{ id: 'demo-plan', name: { en: 'Foody Example' }, monthly_minor: monthly.net_minor }], products: [], tariffs: [] };
      } else if (path.endsWith('/offer/preview')) {
        body = preview(request.postDataJSON());
      } else if (path.endsWith('/offer') && request.method() === 'PUT') {
        const data = request.postDataJSON();
        requests.push(data);
        published = { ...(data.source ? preview(data.source) : { ...data, monthly, annual }), id: requests.length, version: requests.length };
        body = view();
      } else if (path.endsWith('/foody-billing')) {
        body = view();
      } else if (path.endsWith('/usage')) {
        body = { observed: {}, complete: true };
      } else if (path.endsWith('/restaurants/19')) {
        body = { restaurant: merchant };
      } else if (path.endsWith('/subscription')) {
        body = { subscription: null };
      }
      return handler.fulfill({ json: body });
    });
    await page.goto(origin + route);
    const source = page.getByRole('combobox', { name: /^Offer source/ });
    await page.getByLabel('Foody plan or module').selectOption('plan:demo-plan:4');
    await page.getByText('Demo module', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Customize this offer' }).click();
    assert.equal(await source.inputValue(), 'custom');
    assert.equal(await page.getByLabel('Monthly amount (ILS)').inputValue(), '100');
    await page.getByLabel('Offer name').fill('Negotiated demo');
    await source.selectOption('catalogue');
    await page.getByLabel('Foody plan or module').selectOption('plan:demo-plan:4');
    await page.getByRole('button', { name: 'Publish offer', exact: true }).click();
    await page.getByText('Private offer published.', { exact: false }).waitFor();
    assert.deepEqual(requests[0].source, { kind: 'plan', id: 'demo-plan', revision: 4 });
    assert.equal(requests[0].monthly_minor, undefined);
    await page.goto(origin + route + '?quotation=31&revision=2#private-offer');
    await page.getByText('FQ-demo · Monthly licence', { exact: true }).waitFor();
    assert.equal(await source.inputValue(), 'quote');
    assert.equal(await page.getByLabel('Restaurant quotation').inputValue(), 'quote:31:2');
    await page.getByRole('button', { name: 'Publish offer', exact: true }).click();
    await page.getByText('Private offer published.', { exact: false }).waitFor();
    assert.deepEqual(requests[1].source, { kind: 'quote', id: '31', revision: 2 });
    assert.equal(requests[1].expected_version, 1);
    await source.selectOption('custom');
    await page.getByLabel('Offer name').fill('Negotiated demo');
    await page.getByLabel('Offer description').fill('Demo services');
    await page.getByLabel('Terms, exclusions and cancellation').fill('Negotiated terms');
    await page.getByLabel('Monthly amount (ILS)').fill('12.34');
    await page.getByLabel('Annual amount (ILS)').fill('120');
    await page.getByLabel('Agreed VAT treatment').selectOption('ttc');
    const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith('/offer'));
    await page.getByRole('button', { name: 'Publish offer', exact: true }).click();
    await saved;
    assert.equal(requests[2].source, undefined);
    assert.equal(requests[2].monthly_minor, 1234);
    assert.equal(requests[2].annual_minor, 12000);
    assert.deepEqual(errors, []);
    console.log('PASS: catalog plan, finalized restaurant quote and custom offer publication.');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
