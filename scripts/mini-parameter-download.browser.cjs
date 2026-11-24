// Run against a local Backoffice build. Terminal and API data are synthetic.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.FOODY_BROWSER_PLAYWRIGHT_PATH || 'playwright');

const origin = 'http://127.0.0.1:19083';
const terminal = {
  device_id: 'mini-demo', restaurant_id: 7, restaurant_name: 'Demo', model: 'Victa Mini',
  name: 'Demo Mini', manufacturer: 'Verifone', status: 'active',
};
const before = { did: 'DEMO', shva_terminal_id: '0000000001', ashrait_terminal_id: '', supplier_id: '', acquirer: '' };
const change = {
  id: 'change-demo', device_id: terminal.device_id, target_device_id: terminal.device_id,
  kind: 'configure', state: 'prepared', target_before: before, source: before,
  requested: { ...before, shva_terminal_id: '0000000002', ashrait_terminal_id: '0000000002' },
  source_serial_number: 'DEMO', target_serial_number: 'DEMO', cst_execution_allowed: true,
};

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    page.setDefaultTimeout(10000);
    await page.addInitScript(() => {
      localStorage.setItem('foody_backoffice_portal_session', 'fp1s.ZGVtbw.test.00');
      localStorage.setItem('foody_admin_user', JSON.stringify({ id: 7, role: 'superadmin', full_name: 'Demo' }));
    });
    const writes = [];
    let metadata = { ...before, ashrait_terminal_id: before.shva_terminal_id, revision: 4,
      lifecycle: 'in_service', serial_number: 'DEMO', configuration_state: 'verified_cst' };
    await page.route('**/*', async route => {
      const { origin: host, pathname } = new URL(route.request().url());
      if (!pathname.startsWith('/api/v1/')) return host === origin ? route.continue() : route.abort();
      if (pathname.endsWith('/auth/refresh')) return route.fulfill({ json: { token: 'fp1s.ZGVtbw.test.00' } });
      if (!['GET', 'OPTIONS'].includes(route.request().method())) writes.push(pathname);
      if (route.request().method() === 'PUT' && pathname.endsWith('/terminals/mini-demo')) {
        const input = route.request().postDataJSON();
        assert.equal(input.shva_terminal_id, '0000000012');
        assert.equal(input.ashrait_terminal_id, '');
        assert.equal(input.revision, metadata.revision);
        metadata = { ...metadata, ...input, revision: input.revision + 1 };
        return route.fulfill({ json: metadata });
      }
      const body = pathname.endsWith('/terminals') ? { terminals: [{ ...terminal, metadata }], has_more: false }
        : pathname.endsWith('/changes') ? { changes: [change] } : {};
      return route.fulfill({ json: body });
    });
    await page.goto(origin + '/dashboard/terminals');
    await page.getByRole('button', { name: 'Terminal settings' }).click();
    await page.getByLabel('SHVA terminal number').fill('0000000012');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('cell').filter({ hasText: 'SHVA 0000000012' }).waitFor();
    assert.deepEqual(writes, ['/api/v1/admin/terminals/mini-demo']);
    await page.reload();
    await page.getByRole('button', { name: 'Terminal settings' }).click();
    assert.equal(await page.getByLabel('SHVA terminal number').inputValue(), '0000000012');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Verifone maintenance' }).click();
    const authorize = page.getByRole('button', { name: 'Authorize parameter download' });
    const remote = page.getByLabel('Send to the connected FoodyPOS automatically');
    const checkMini = page.getByLabel('I verified the Mini and the requested SHVA number.', { exact: false });
    assert.ok(await remote.isChecked());
    assert.ok(await authorize.isDisabled());
    await checkMini.check();
    assert.ok(await authorize.isEnabled());
    await remote.uncheck();
    assert.ok(await page.getByLabel(/any prior batch is closed/).isVisible());
    assert.ok(await authorize.isDisabled());
    await remote.check();
    assert.ok(await checkMini.isVisible());
    assert.ok(await authorize.isDisabled());
    assert.deepEqual(writes, ['/api/v1/admin/terminals/mini-demo']);
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
