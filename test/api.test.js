// docs/API.md гэрээг шалгах тест. Ажиллуулах: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { createMemoryStore } from '../src/store/memory.js';

useStore(createMemoryStore());

let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const get = async (path, headers) => {
  const res = await fetch(base + path, { headers });
  return { res, body: await res.json() };
};

test('GET /courses бүх курсыг буцаана', async () => {
  const { res, body } = await get('/courses');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.ok(body.length > 0);
  for (const c of body) {
    assert.equal(typeof c.id, 'string');
    assert.ok(['Code', 'Data', 'AI', 'Digital'].includes(c.category));
    assert.ok(['open', 'waitlist', 'planned'].includes(c.status));
    assert.ok(c.price === null || Number.isInteger(c.price));
    assert.equal(typeof c.title.mn, 'string');
    assert.equal(typeof c.title.en, 'string');
  }
  // Нүүр хуудасны курсууд заавал байх ёстой
  for (const id of ['vip-course', 'data-analysis', 'computer-skills']) assert.ok(body.some((c) => c.id === id), id);
});

test('GET /courses?category=Data шүүнэ', async () => {
  const { body } = await get('/courses?category=Data');
  assert.ok(body.length > 0);
  assert.ok(body.every((c) => c.category === 'Data'));
});

test('GET /courses/:id', async () => {
  const { res, body } = await get('/courses/data-analysis');
  assert.equal(res.status, 200);
  assert.equal(body.id, 'data-analysis');
});

test('GET /courses/:id олдохгүй бол 404 not_found', async () => {
  const { res, body } = await get('/courses/nope');
  assert.equal(res.status, 404);
  assert.equal(body.error.code, 'not_found');
  assert.equal(typeof body.error.message, 'string');
});

test('GET /news жагсаалтад body/details/gallery орохгүй', async () => {
  const { res, body } = await get('/news');
  assert.equal(res.status, 200);
  assert.ok(body.length > 0);
  for (const n of body) {
    assert.deepEqual(Object.keys(n).sort(),
      ['category', 'coverImage', 'id', 'isSample', 'number', 'publishedAt', 'summary', 'title'].sort());
  }
});

test('GET /news?limit=3', async () => {
  const { body } = await get('/news?limit=3');
  assert.equal(body.length, 3);
});

test('GET /news?limit=abc бол 400 validation_error', async () => {
  const { res, body } = await get('/news?limit=abc');
  assert.equal(res.status, 400);
  assert.equal(body.error.code, 'validation_error');
  assert.ok(body.error.fields.limit);
});

test('GET /news/:id дэлгэрэнгүй', async () => {
  const { res, body } = await get('/news/1');
  assert.equal(res.status, 200);
  assert.equal(body.id, '1');
  assert.ok('body' in body && 'details' in body);
});

test('GET /news/:id олдохгүй бол 404', async () => {
  const { res, body } = await get('/news/999');
  assert.equal(res.status, 404);
  assert.equal(body.error.code, 'not_found');
});

test('Мэдэгдэхгүй route JSON 404 буцаана', async () => {
  const { res, body } = await get('/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(body.error.code, 'not_found');
});

test('CORS: зөвшөөрсөн origin-д header буцаана', async () => {
  const { res } = await get('/courses', { Origin: 'http://localhost:5173' });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const other = await get('/courses', { Origin: 'https://evil.example' });
  assert.equal(other.res.headers.get('access-control-allow-origin'), null);
});

test('CORS: CORS_ORIGIN_REGEX-д таарсан Preview хаягийг зөвшөөрнө', async () => {
  const app = createApp({ env: { ...process.env, CORS_ORIGIN_REGEX: '^https://mci-web-[a-z0-9-]+\\.vercel\\.app$' } });
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/health`;
    const ok = await fetch(base, { headers: { Origin: 'https://mci-web-abc123-team.vercel.app' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://mci-web-abc123-team.vercel.app');
    const bad = await fetch(base, { headers: { Origin: 'https://mci-web.vercel.app.evil.com' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  } finally {
    server.close();
  }
});
