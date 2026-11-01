import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { defaultAbout, validateAbout } from '../src/services/about.js';

test('About validation accepts bilingual content and rejects unsafe or malformed content', () => {
  assert.deepEqual(validateAbout({ ...defaultAbout, id: 'protected' }), defaultAbout);
  for (const patch of [{ visible: 'false' }, { photo: { ...defaultAbout.photo, src: 'javascript:alert(1)' } }, { bio: { mn: 'Only one language' } }, { facts: [{ title: defaultAbout.name, items: [null] }] }, { stats: null }, { stats: [{ value: '  ', label: defaultAbout.name }] }]) {
    assert.throws(() => validateAbout({ ...defaultAbout, ...patch }), { code: 'validation_error' });
  }
  assert.equal(validateAbout({ ...defaultAbout, visible: false, languages: [], stats: [], facts: [] }).visible, false);
});

test('About saves are admin-only, persist, and hide public profile content while retaining admin access', async () => {
  let saved;
  let activities = 0;
  const db = { siteSection: {
    findUnique: async () => saved ? { content: saved } : null,
    upsert: async ({ create, update }) => { saved = structuredClone(saved ? update.content : create.content); },
  }, activity: { create: async () => { activities++; } } };
  db.$transaction = async (run) => run(db);
  useStore({ prisma: db });
  const server = createApp({ verifyUser: async (token) => ({ id: 'user', role: token === 'admin' ? 'admin' : 'user' }) }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const put = (token, body) => fetch(`${base}/admin/site/about`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });
  try {
    assert.deepEqual(await (await fetch(`${base}/site/about`)).json(), defaultAbout);
    assert.equal((await put(null, defaultAbout)).status, 401);
    assert.equal((await put('user', defaultAbout)).status, 403);
    assert.equal((await put('admin', { visible: true })).status, 400);
    assert.equal(saved, undefined);
    const edited = { ...defaultAbout, name: { mn: 'Шинэ нэр', en: 'Updated name' }, visible: false };
    assert.equal((await put('admin', edited)).status, 200);
    assert.equal(activities, 1);
    const hidden = await fetch(`${base}/site/about`);
    assert.equal(hidden.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await hidden.json(), { visible: false });
    assert.deepEqual(await (await fetch(`${base}/admin/site/about`, { headers: { Authorization: 'Bearer admin' } })).json(), edited);
    assert.equal((await put('admin', { ...edited, visible: true })).status, 200);
    assert.equal((await (await fetch(`${base}/site/about`)).json()).name.en, 'Updated name');
  } finally { await new Promise((resolve) => server.close(resolve)); useStore(undefined); }
});
