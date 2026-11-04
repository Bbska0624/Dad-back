import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { verifySupabaseUser } from '../src/services/supabase.js';
import { validateContent } from '../src/services/content.js';
import { uploadImage } from '../src/services/storage.js';

async function withApp(options, fn) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}/api`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('admin endpoints reject demo sessions, missing tokens and ordinary users before database access', async () => {
  await withApp({ verifyUser: async () => ({ id: 'user', email: 'user@example.com', role: 'user' }) }, async (url) => {
    for (const path of ['/admin/courses', '/admin/news', '/admin/activity', '/admin/users', '/admin/records', '/admin/payment-notifications']) {
      assert.equal((await fetch(url + path, { headers: { Cookie: 'mc-demo-session=admin' } })).status, 401);
      assert.equal((await fetch(url + path, { headers: { Authorization: 'Bearer ordinary-user' } })).status, 403);
    }
    for (const path of ['/admin/courses', '/admin/images', '/admin/records/anything/delete']) {
      assert.equal((await fetch(url + path, { method: 'POST', headers: { Authorization: 'Bearer ordinary-user', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    }
  });
});

test('Supabase verifies tokens remotely and ignores user-editable role metadata', async () => {
  let called;
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-key' };
  const user = await verifySupabaseUser('token', env, async (url, options) => {
    called = { url, options };
    return Response.json({ id: 'u1', email: 'USER@example.com', user_metadata: { role: 'admin', name: 'Student' }, app_metadata: {} });
  });
  assert.equal(user.role, 'user');
  assert.equal(user.email, 'user@example.com');
  assert.equal(called.options.headers.Authorization, 'Bearer token');
  assert.equal(called.url, 'https://example.supabase.co/auth/v1/user');
  await assert.rejects(verifySupabaseUser('bad', env, async () => new Response('', { status: 401 })), { status: 401 });
});

test('content validation rejects unsafe media, invalid prices and incomplete published stories; strips protected fields', () => {
  const course = { title: { mn: 'Курс', en: 'Course' }, description: { mn: 'Тайлбар', en: 'Description' }, category: 'Code', status: 'open', publication: 'draft', price: 100 };
  assert.throws(() => validateContent('courses', { ...course, price: -1 }), { code: 'validation_error' });
  assert.throws(() => validateContent('courses', { ...course, image: { src: 'javascript:alert(1)' } }), { code: 'validation_error' });
  assert.throws(() => validateContent('news', { title: course.title, publication: 'published', category: course.title, summary: course.title }), { code: 'body_required' });
  const cleaned = validateContent('courses', { ...course, id: 'overwrite', deletedAt: new Date(), role: 'admin' });
  assert.equal(cleaned.id, undefined);
  assert.equal(cleaned.deletedAt, undefined);
  assert.equal(cleaned.role, undefined);
});

test('image upload validates file signature and never sends secrets to client', async () => {
  await assert.rejects(uploadImage('data:image/png;base64,SGVsbG8='), { code: 'invalid_image' });
  const data = 'data:image/png;base64,' + Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
  const image = await uploadImage(data, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'server-secret' }, async (url, options) => {
    assert.equal(options.headers.apikey, 'server-secret');
    assert.match(url, /storage\/v1\/object\/site-images\/uploads\//);
    return Response.json({});
  });
  assert.match(image.src, /^https:\/\/example.supabase.co\/storage\/v1\/object\/public\/site-images\//);
  assert.ok(!JSON.stringify(image).includes('server-secret'));
});
