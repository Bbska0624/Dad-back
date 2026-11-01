import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('session discovery returns an uncached null for guests and expired sessions; protected endpoints still reject guests', async () => {
  const server = createApp({
    env: {},
    verifyUser: async () => { throw Object.assign(new Error('Expired session'), { status: 401 }); },
    auth: { refresh: async () => { throw Object.assign(new Error('Invalid refresh token'), { status: 400 }); } },
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    for (const cookie of ['', 'mci_at=expired', 'mci_at=expired; mci_rt=invalid']) {
      const response = await fetch(`${base}/auth/me`, { headers: cookie ? { Cookie: cookie } : {} });
      assert.equal(response.status, 200);
      assert.equal(await response.json(), null);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (cookie.includes('mci_rt')) assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
    }
    assert.equal((await fetch(`${base}/admin/users`)).status, 401);
    assert.equal((await fetch(`${base}/account/profile`)).status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
