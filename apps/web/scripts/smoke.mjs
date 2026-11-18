import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const port = '32190';
const origin = `http://127.0.0.1:${port}`;
const appDirectory = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], {
  cwd: appDirectory,
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'smoke-test-only',
    SUPABASE_SERVICE_ROLE_KEY: '',
    TOOLNEST_SERVER_PROCESSING_ENABLED: 'false',
  },
  stdio: 'inherit',
});

function request(path, method = 'GET') {
  return fetch(`${origin}${path}`, { method, redirect: 'manual', signal: AbortSignal.timeout(5000) });
}

try {
  let home;
  let connectionError;
  for (let i = 0; i < 60 && !home && server.exitCode === null; i++) {
    home = await request('/').catch(error => { connectionError = error; });
    if (!home) await delay(250);
  }
  if (!home) throw connectionError ?? new Error('The smoke-test server never started');
  assert.equal(home.status, 200, 'The home page must be public');
  assert.match(await home.text(), /Everyday PDF, image, and text tools/);
  assert.match(home.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);

  for (const route of ['/login', '/register', '/forgot-password']) {
    assert.equal((await request(route)).status, 200, route);
  }
  for (const route of ['/dashboard', '/tools', '/tools/merge-pdf', '/settings', '/admin']) {
    const response = await request(route);
    assert.equal(response.status, 307, route);
    assert.equal(response.headers.get('location'), '/login', route);
  }
  for (const method of ['GET', 'POST']) {
    assert.equal((await request('/api/v1/jobs', method)).status, 401, method);
  }
  console.log('Public routes, protected redirects, unauthenticated API responses, and CSP passed.');
} finally {
  server.kill();
}
