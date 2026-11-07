import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCartSettings, saveCartSetting } from '../src/services/courseCommerce.js';
import { phoneOrderingGuard } from '../src/services/ordering.js';
import { validateContent } from '../src/services/content.js';

const architecture = { id: 'new-admin-course', title: { mn: 'Компьютер зохион байгуулалт, архитектур' } };
const other = { id: 'data-analysis', title: { mn: 'Power BI' } };

test('all courses remain cartable; only architecture and Python default to online payment', async () => {
  const courses = [architecture, { id: 'python-programming' }, other];
  const db = { siteSection: { findMany: async () => [{ id: 'course-commerce:python-programming', content: { cartEnabled: false } }] } };
  const result = await withCartSettings(db, courses);
  assert.deepEqual(result.map((c) => c.cartEnabled), [true, true, true]);
  assert.deepEqual(result.map((c) => c.onlinePaymentEnabled), [true, true, false]);
});

test('server quotes only eligible courses and rejects contact courses in direct checkout requests', async () => {
  const { priceItems } = await import('../src/routes/checkout.js');
  const catalog = [{ ...architecture, price: 1000 }, { id: 'python-programming', price: 2000 }, { ...other, price: 99000 }];
  const db = { course: { findMany: async ({ where }) => catalog.filter((c) => where.id.in.includes(c.id)) }, siteSection: { findMany: async () => [] } };
  const items = await priceItems(db, [architecture.id, 'python-programming']);
  assert.equal(items.reduce((sum, item) => sum + item.price, 0), 3000);
  await assert.rejects(priceItems(db, [architecture.id, other.id]), { code: 'phone_ordering_only' });
  await assert.rejects(priceItems(db, [other.id]), { code: 'phone_ordering_only' });
});

test('normal payment requests are no longer blocked by default', () => {
  for (const path of ['/orders', '/orders/id/bank-transfer', '/orders/id/qpay', '/me/wallet/topups']) {
    phoneOrderingGuard({})({ method: 'POST', path }, {}, (error) => assert.equal(error, undefined));
  }
});

test('architecture is enabled for payment by default, including newly generated IDs', async () => {
  assert.deepEqual((await withCartSettings(null, [architecture, other])).map((c) => c.onlinePaymentEnabled), [true, false]);
});

test('admin can persist reopening and pausing independently of course title', async () => {
  const saved = new Map();
  const db = { siteSection: {
    findMany: async () => [...saved.values()],
    upsert: async ({ where, create, update }) => saved.set(where.id, saved.has(where.id) ? { ...saved.get(where.id), ...update } : create),
  } };
  await saveCartSetting(db, other.id, true);
  await saveCartSetting(db, architecture.id, false);
  assert.deepEqual((await withCartSettings(db, [architecture, other])).map((c) => c.onlinePaymentEnabled), [false, true]);
  await saveCartSetting(db, other.id, undefined);
  assert.equal((await withCartSettings(db, [other]))[0].onlinePaymentEnabled, true);
});

test('rejects malformed payment setting rather than treating a string as enabled', () => {
  assert.throws(() => validateContent('courses', { onlinePaymentEnabled: 'false' }), (error) => error.fields.onlinePaymentEnabled === 'Boolean required');
});

test('phone ordering blocks new payment actions but preserves access, history and settlement', () => {
  const guard = phoneOrderingGuard({ PHONE_ONLY_ORDERING: 'true' });
  for (const path of ['/orders', '/enrollments/', '/payments', '/me/wallet/topups', '/orders/id/qpay', '/orders/id/wallet', '/orders/id/bank-transfer']) {
    let error;
    guard({ method: 'POST', path }, {}, (e) => { error = e; });
    assert.equal(error?.code, 'phone_ordering_only', path);
  }
  for (const [method, path] of [['GET', '/me/orders'], ['GET', '/me/courses/course/lessons'], ['POST', '/admin/course-orders/id/paid'], ['POST', '/orders/id/qpay/check'], ['GET', '/qpay/callback']]) {
    guard({ method, path }, {}, (error) => assert.equal(error, undefined, path));
  }
  phoneOrderingGuard({ PHONE_ONLY_ORDERING: 'false' })({ method: 'POST', path: '/orders' }, {}, (error) => assert.equal(error, undefined));
});

test('admin setting survives API reload and reaches the public catalog; guests cannot change it', async () => {
  const { createApp } = await import('../src/app.js');
  const { useStore } = await import('../src/store.js');
  let course = { ...other, title: { mn: 'Power BI', en: 'Power BI' }, category: 'Data', status: 'open', publication: 'published', description: { mn: 'Тайлбар', en: 'Description' } };
  const settings = new Map();
  const db = {
    course: { findMany: async () => [course], findUnique: async () => course, update: async ({ data }) => (course = { ...course, ...data }) },
    siteSection: { findMany: async () => [...settings.values()], upsert: async ({ create }) => settings.set(create.id, create) },
    activity: { create: async () => {} },
  };
  db.$transaction = (run) => run(db);
  useStore({ prisma: db, listCourses: async () => [course], findCourse: async () => course });
  const server = createApp({ env: {}, verifyUser: async (token) => ({ id: 'tester', role: token === 'admin' ? 'admin' : 'user' }) }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const update = (token, enabled) => fetch(`${base}/admin/courses/${course.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ onlinePaymentEnabled: enabled }) });
  try {
    assert.equal((await update(null, true)).status, 401);
    assert.equal((await update('user', true)).status, 403);
    assert.equal((await (await fetch(`${base}/courses`)).json())[0].onlinePaymentEnabled, false);
    assert.equal((await update('admin', true)).status, 200);
    assert.equal((await (await fetch(`${base}/courses/${course.id}`)).json()).onlinePaymentEnabled, true);
    assert.equal((await (await fetch(`${base}/admin/courses`, { headers: { Authorization: 'Bearer admin' } })).json())[0].onlinePaymentEnabled, true);
    assert.equal((await update('admin', false)).status, 200);
    assert.equal((await (await fetch(`${base}/courses`)).json())[0].onlinePaymentEnabled, false);
    const blocked = await fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseIds: [course.id] }) });
    assert.equal(blocked.status, 401);
    assert.equal((await blocked.json()).error.code, 'unauthorized');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    useStore(undefined);
  }
});
