import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentOrigin, routingFiles, servesExpectedPortal } from './publish.mjs';

test('uses only immutable URLs from the correct Foody project and team', () => {
  const target = 'https://admin-1234abcde-mickaz.vercel.app';
  assert.equal(deploymentOrigin('admin', target), target);
  for (const candidate of [target + '.example.com', target + '/login', target + '?ref=1',
    target.replace('admin-', 'backoffice-'), target.replace('1234abcde', 'git-develop'),
    target.replace('mickaz', 'otherteam'), target.replace('https:', 'http:')]) {
    assert.equal(deploymentOrigin('admin', candidate), null);
  }
});

test('the routing branch contains only a static rewrite to the verified build', () => {
  const origin = 'https://backoffice-1234abcde-mickaz.vercel.app';
  const [manifest, directory] = routingFiles(origin);
  assert.equal(directory.path, 'public/.gitkeep');
  assert.deepEqual(JSON.parse(manifest.content), {
    framework: null, installCommand: '', buildCommand: '', outputDirectory: 'public',
    rewrites: [{ source: '/:path*', destination: origin + '/:path*' }],
  });
});

test('Admin redirects only the homepage to sign-in on the same host', () => {
  const origin = 'https://admin-1234abcde-mickaz.vercel.app';
  const [manifest] = routingFiles(origin, '/login');
  const config = JSON.parse(manifest.content);
  assert.deepEqual(config.redirects, [{ source: '/', destination: '/login', permanent: false }]);
  assert.deepEqual(config.rewrites, [{ source: '/:path*', destination: origin + '/:path*' }]);
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
