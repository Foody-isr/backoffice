import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function client(host, respond) {
  const exports = {};
  const requests = [];
  const context = {
    exports, Error, AbortSignal, URLSearchParams,
    window: { location: { hostname: host } },
    localStorage: { getItem: () => null, removeItem() {} },
    process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://dev-api.foody-pos.co.il' } },
    require: name => name === './portal-session' ? portal : ({ withScope: fn => fn({ setTag() {}, setContext() {} }), captureException() {} }),
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      const result = respond(url, options);
      return { ok: result.status === 200, status: result.status, json: async () => result.body, headers: new Headers() };
    },
  };
  const portal = {};
  const helpers = ts.transpileModule(fs.readFileSync(new URL('../src/lib/portal-session.ts', import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(helpers,{...context,exports:portal,Headers,URL});
  vm.runInNewContext(compiled,context);
  return { api: exports, requests };
}

test('production catalogue edits use production API while sandbox onboarding remains unavailable', async () => {
  const catalog = { revision: 4, products: [], plans: [], tariffs: [] };
  const { api, requests } = client('backoffice.foody-pos.co.il', url => url.endsWith('/onboarding-catalog')
    ? { status: 404, body: { error: 'foody_billing_sandbox_only' } }
    : { status: 200, body: catalog });
  assert.equal(api.getApiEnvironment(), 'production');
  assert.equal(await api.getEditableFoodyCatalog(), catalog);
  assert.equal(await api.getReviewedFoodyCatalog(), catalog);
  assert.equal(await api.publishFoodyCatalog(catalog, 4), catalog);
  assert.equal(await api.getFoodyModuleCatalog(), null);
  assert.deepEqual(requests.map(r => r.url), [
    'https://api.foody-pos.co.il/api/v1/admin/foody-billing/catalog',
    'https://api.foody-pos.co.il/api/v1/admin/foody-billing/catalog/reviewed',
    'https://api.foody-pos.co.il/api/v1/admin/foody-billing/catalog',
    'https://api.foody-pos.co.il/api/v1/admin/foody-billing/onboarding-catalog',
  ]);
  assert.equal(requests[2].method, 'PUT');
  assert.deepEqual(JSON.parse(requests[2].body), { expected_revision: 4, catalog });
});

test('development onboarding reads its dedicated guarded catalogue', async () => {
  const catalog = { revision: 2, products: [] };
  const { api, requests } = client('dev-backoffice.foody-pos.co.il', () => ({ status: 200, body: catalog }));
  assert.equal(api.getApiEnvironment(), 'development');
  assert.equal(await api.getFoodyModuleCatalog(), catalog);
  assert.equal(requests[0].url, 'https://dev-api.foody-pos.co.il/api/v1/admin/foody-billing/onboarding-catalog');
});

test('unavailable development onboarding and catalogue errors cannot become silent legacy fallbacks', async () => {
  const dev = client('dev-backoffice.foody-pos.co.il', () => ({ status: 404, body: { error: 'foody_billing_sandbox_only' } }));
  await assert.rejects(dev.api.getFoodyModuleCatalog(), /foody_billing_sandbox_only/);
  for (const status of [403, 409, 500]) {
    const prod = client('backoffice.foody-pos.co.il', () => ({ status, body: { error: `catalog_error_${status}` } }));
    await assert.rejects(prod.api.getEditableFoodyCatalog(), new RegExp(`catalog_error_${status}`));
    await assert.rejects(prod.api.publishFoodyCatalog({}, 4), new RegExp(`catalog_error_${status}`));
    await assert.rejects(prod.api.getFoodyModuleCatalog(), new RegExp(`catalog_error_${status}`));
  }
});
