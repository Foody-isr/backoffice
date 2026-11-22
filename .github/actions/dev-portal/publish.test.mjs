import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentOrigin, portals, routingFiles, servesExpectedPortal } from './publish.mjs';

test('uses only immutable URLs from the correct Foody project and team', () => {
  const target = 'https://admin-1234abcde-mickaz.vercel.app';
  assert.equal(deploymentOrigin('admin', target), target);
  for (const candidate of [target + '.example.com', target + '/login', target + '?ref=1',
    target.replace('admin-', 'backoffice-'), target.replace('1234abcde', 'git-develop'),
    target.replace('mickaz', 'otherteam'), target.replace('https:', 'http:')]) {
    assert.equal(deploymentOrigin('admin', candidate), null);
  }
});

for (const [project, entryPath] of [['backoffice', '/dashboard'], ['admin', '/login']]) {
  test(project + ' redirects the homepage on the same host and forwards other paths to its build', () => {
    const origin = 'https://' + project + '-1234abcde-mickaz.vercel.app';
    const portal = portals['Foody-isr/' + project];
    assert.equal(portal.project, project);
    const [manifest, directory] = routingFiles(origin, portal.rootRedirect);
    assert.equal(directory.path, 'public/.gitkeep');
    assert.deepEqual(JSON.parse(manifest.content), {
      framework: null, installCommand: '', buildCommand: '', outputDirectory: 'public',
      redirects: [{ source: '/', destination: entryPath, permanent: false }],
      rewrites: [{ source: '/:path*', destination: origin + '/:path*' }],
    });
  });
}

test('a healthy Backoffice login cannot hide a broken homepage or dashboard', async t => {
  const origin = 'https://dev-backoffice.foody-pos.co.il';
  const { rootRedirect } = portals['Foody-isr/backoffice'];
  let root = new Response(null, { status: 404 });
  let dashboardStatus = 200;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.redirect, 'manual');
    if (url === origin + '/') {
      assert.equal(options.method ?? 'GET', 'GET');
      return root;
    }
    assert.equal(options.method, 'HEAD');
    if (url === origin + '/login') return new Response(null, { headers: { 'X-Foody-Login-Revision': 'current' } });
    assert.equal(url, origin + '/dashboard');
    return new Response(null, { status: dashboardStatus });
  });

  assert.equal(await servesExpectedPortal(origin, 'current', rootRedirect), false);
  root = new Response(null, { status: 307, headers: { location: '/login' } });
  assert.equal(await servesExpectedPortal(origin, 'current', rootRedirect), false);
  root = new Response(null, { status: 307, headers: { location: '/dashboard' } });
  dashboardStatus = 404;
  assert.equal(await servesExpectedPortal(origin, 'current', rootRedirect), false);
  dashboardStatus = 200;
  assert.equal(await servesExpectedPortal(origin, 'current', rootRedirect), true);
});

test('Admin publication requires both the homepage redirect and the expected login revision', async t => {
  const origin = 'https://dev-admin.foody-pos.co.il';
  const sha = 'current';
  let root;
  let loginRevision = sha;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.redirect, 'manual');
    if (url === origin + '/login') {
      assert.equal(options.method, 'HEAD');
      return new Response(null, { headers: { 'X-Foody-Login-Revision': loginRevision } });
    }
    assert.equal(url, origin + '/');
    assert.equal(options.method ?? 'GET', 'GET');
    return root;
  });

  root = new Response(null, { status: 404 });
  assert.equal(await servesExpectedPortal(origin, sha, '/login'), false);
  for (const location of ['/login', origin + '/login']) {
    root = new Response(null, { status: 307, headers: { location } });
    assert.equal(await servesExpectedPortal(origin, sha, '/login'), true);
  }
  for (const location of ['/', 'https://other.example/login']) {
    root = new Response(null, { status: 307, headers: { location } });
    assert.equal(await servesExpectedPortal(origin, sha, '/login'), false);
  }
  root = new Response(null, { status: 307, headers: { location: '/login' } });
  loginRevision = 'previous';
  assert.equal(await servesExpectedPortal(origin, sha, '/login'), false);
});
