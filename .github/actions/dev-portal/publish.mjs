import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const routingBranch = 'dev-portal-routing';

/** Each repository publishes its own application's homepage redirect on its development domain. */
export const portals = {
  'Foody-isr/admin': { project: 'admin', rootRedirect: '/login' },
  'Foody-isr/backoffice': { project: 'backoffice', rootRedirect: '/dashboard' },
};

/** Accept only immutable deployments in the caller's Foody project and Vercel team. */
export function deploymentOrigin(project, address) {
  if (!Object.values(portals).some(portal => portal.project === project) || typeof address !== 'string') return null;
  const pattern = new RegExp('^https://' + project + '-[a-z0-9]{9}-mickaz\\.vercel\\.app/?$');
  return pattern.test(address) ? new URL(address).origin : null;
}

/** Generate a static routing deployment. No application code or credentials enter this branch. */
export function routingFiles(origin, rootRedirect) {
  const config = {
    framework: null, installCommand: '', buildCommand: '', outputDirectory: 'public',
    redirects: [{ source: '/', destination: rootRedirect, permanent: false }],
    rewrites: [{ source: '/:path*', destination: origin + '/:path*' }],
  };
  return [
    { path: 'vercel.json', mode: '100644', type: 'blob', content: JSON.stringify(config, null, 2) + '\n' },
    { path: 'public/.gitkeep', mode: '100644', type: 'blob', content: '' },
  ];
}

/** Check the login revision, the homepage redirect on this host and its destination. */
export async function servesExpectedPortal(origin, sha, rootRedirect) {
  const options = { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000) };
  const login = await fetch(origin + '/login', { ...options, method: 'HEAD' });
  if (login.status !== 200 || login.headers.get('X-Foody-Login-Revision') !== sha) return false;
  const root = await fetch(origin + '/', options);
  await root.body?.cancel();
  const location = root.headers.get('location');
  if (root.status !== 307 || (location !== rootRedirect && location !== origin + rootRedirect)) return false;
  if (rootRedirect === '/login') return true;

  const destination = await fetch(origin + rootRedirect, { ...options, method: 'HEAD' });
  return destination.status === 200;
}

async function publish() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!Object.hasOwn(portals, repo) || !process.env.GH_TOKEN) throw new Error('Expected an authorized Foody portal workflow');
  const { project, rootRedirect } = portals[repo];
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  async function github(endpoint, method = 'GET', body) {
    const response = await fetch('https://api.github.com/repos/' + repo + endpoint, {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + process.env.GH_TOKEN, Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body && JSON.stringify(body),
    });
    if (!response.ok) throw new Error('GitHub ' + method + ' ' + endpoint + ' returned ' + response.status);
    return response.json();
  }

  const head = async () => (await github('/git/ref/heads/develop')).object.sha;
  const sha = await head();
  if (event.deployment && event.deployment.sha !== sha) return;
  const deployments = await github('/deployments?environment=Production&sha=' + sha + '&per_page=100');
  let origin;
  for (const deployment of deployments) {
    if (deployment.creator?.login !== 'vercel[bot]' || deployment.sha !== sha) continue;
    const [latest] = await github('/deployments/' + deployment.id + '/statuses?per_page=1');
    if (latest?.creator?.login === 'vercel[bot]' && latest.state === 'success') {
      origin = deploymentOrigin(project, latest.environment_url);
      if (origin) break;
    }
  }
  if (!origin) throw new Error('No successful Vercel deployment for the current develop commit');

  if (!await servesExpectedPortal(origin, sha, rootRedirect)) {
    throw new Error('The immutable deployment failed the portal entry check for ' + project);
  }

  const reference = 'refs/heads/' + routingBranch;
  const refs = await github('/git/matching-refs/heads/' + routingBranch);
  const parent = refs.find(ref => ref.ref === reference)?.object.sha;
  const tree = await github('/git/trees', 'POST', { tree: routingFiles(origin, rootRedirect) });
  if (!parent || (await github('/git/commits/' + parent)).tree.sha !== tree.sha) {
    if (await head() !== sha) return;
    const commit = await github('/git/commits', 'POST', {
      message: 'chore: route development portal to ' + sha, tree: tree.sha, parents: parent ? [parent] : [],
    });
    if (parent) await github('/git/refs/heads/' + routingBranch, 'PATCH', { sha: commit.sha, force: false });
    else await github('/git/refs', 'POST', { ref: reference, sha: commit.sha });
  }
  const canonical = 'https://dev-' + project + '.foody-pos.co.il';
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (await servesExpectedPortal(canonical, sha, rootRedirect)) {
      console.log('Verified development portal ' + project + ' at ' + sha);
      return;
    }
    if (await head() !== sha) return;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('The development domain failed the portal entry check. Check its Preview branch assignment and routing.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await publish();
