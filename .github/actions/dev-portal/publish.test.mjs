import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentOrigin, routingFiles } from './publish.mjs';

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
