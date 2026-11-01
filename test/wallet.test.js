// Хэтэвч ба QPay. Мөнгөн гүйлгээний дүрмийг жинхэнэ PostgreSQL дээр шалгах тул TEST_DATABASE_URL шаардана.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { createMemoryStore } from '../src/store/memory.js';
import { createQPayClient, signOrder, verifyOrderSignature } from '../src/services/qpay.js';

const url = process.env.TEST_DATABASE_URL;
const needsDb = { skip: !url && 'TEST_DATABASE_URL тохируулаагүй' };
const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const FIXED_STATUS = { 'data-analysis': 'open', 'vip-course': 'waitlist', 'python-programming': 'planned' };
const testCourses = () => load('courses').map((c) => (FIXED_STATUS[c.id] ? { ...c, status: FIXED_STATUS[c.id] } : c));
const COURSE = 'sql-databases';
const OTHER = 'ai-rag-systems';
const env = {
  QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p', QPAY_INVOICE_CODE: 'CODE', QPAY_CALLBACK_SECRET: 'x',
  QPAY_CALLBACK_URL: 'https://api.example.com/api/qpay/callback',
};

let store;
before(async () => {
  if (url) {
    const { createPrismaStore, seedContent } = await import('../src/store/prisma.js');
    store = createPrismaStore({ url });
    await seedContent(store.prisma, { courses: testCourses(), news: load('news') });
  } else store = createMemoryStore();
  useStore(store);
});
after(() => store.close());

const verifyUser = async (token) => {
  const [role, id] = token.split(':');
  return { id, email: `${id}@example.com`, name: 'Test', role };
};

function fakeQPay() {
  const qpay = {
    paid: new Map(), cancelled: [], failCancel: false,
    available: () => true,
    createInvoice: async (order) => ({ invoiceId: `inv-${order.id}`, details: { qrText: 'qr', qrImage: 'data:image/png;base64,AA', shortUrl: 'https://qpay.example/x', urls: [] } }),
    paidAmount: async (invoiceId) => qpay.paid.get(invoiceId) ?? 0,
    cancelInvoice: async (invoiceId) => {
      if (qpay.failCancel) throw new Error('fail');
      qpay.cancelled.push(invoiceId);
    },
  };
  return qpay;
}

async function withApi(options, fn) {
  const server = createApp({ verifyUser, formLimit: { windowMs: 60_000, max: 10_000 }, env, ...options }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const api = async (token, method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = text;
    try { data = JSON.parse(text); } catch { /* text/plain callback */ }
    return { status: response.status, body: data };
  };
  try { await fn(api); } finally { await new Promise((resolve) => server.close(resolve)); }
}

const newUser = () => `user:${randomUUID()}`;
const ADMIN = `admin:${randomUUID()}`;

async function topUp(api, user, amount) {
  const { body: order } = await api(user, 'POST', '/me/wallet/topups', { amount });
  await api(user, 'POST', `/orders/${order.id}/bank-transfer`);
  const confirmed = await api(ADMIN, 'POST', `/admin/course-orders/${order.id}/paid`);
  assert.equal(confirmed.status, 200);
  return order;
}

test('top-up credits once, purchase debits and writes the ledger', needsDb, async () => {
  await withApi({ qpay: fakeQPay() }, async (api) => {
    const user = newUser();
    assert.equal((await api(user, 'POST', '/me/wallet/topups', { amount: 10 })).status, 400);
    assert.equal((await api(user, 'POST', '/me/wallet/topups', { amount: 1500.5 })).status, 400);
    const topup = await topUp(api, user, 60000);
    assert.equal((await api(ADMIN, 'POST', `/admin/course-orders/${topup.id}/paid`)).status, 200);
    assert.equal((await api(user, 'GET', '/me/wallet')).body.balance, 60000);
    assert.equal((await api(ADMIN, 'POST', `/admin/course-orders/${topup.id}/cancelled`)).body.error.code, 'topup_settled');
    assert.deepEqual((await api(user, 'GET', '/me/orders')).body, []);

    const { body: order } = await api(user, 'POST', '/orders', { courseIds: [COURSE] });
    const stranger = newUser();
    assert.equal((await api(stranger, 'POST', `/orders/${order.id}/wallet`)).status, 404);
    assert.equal((await api(user, 'GET', `/me/courses/${COURSE}/lessons`)).status, 403);
    const paid = await api(user, 'POST', `/orders/${order.id}/wallet`);
    assert.equal(paid.body.status, 'paid');
    assert.equal(paid.body.method, 'wallet');
    assert.equal((await api(user, 'GET', `/me/courses/${COURSE}/lessons`)).status, 200);

    const wallet = (await api(user, 'GET', '/me/wallet')).body;
    assert.equal(wallet.balance, 60000 - order.amount);
    assert.deepEqual(wallet.transactions.map((row) => row.type).sort(), ['purchase', 'topup']);
    assert.equal((await api(user, 'POST', `/orders/${order.id}/wallet`)).body.error.code, 'payment_not_ready');
  });
});

test('an insufficient balance changes nothing', needsDb, async () => {
  await withApi({ qpay: fakeQPay() }, async (api) => {
    const user = newUser();
    await topUp(api, user, 10000);
    const { body: order } = await api(user, 'POST', '/orders', { courseIds: [COURSE] });
    assert.equal((await api(user, 'POST', `/orders/${order.id}/wallet`)).body.error.code, 'insufficient_balance');
    assert.equal((await api(user, 'GET', '/me/wallet')).body.balance, 10000);
    assert.equal((await api(user, 'GET', '/me/orders')).body[0].status, 'pending_payment');
    assert.equal((await api(user, 'GET', `/me/courses/${COURSE}/lessons`)).status, 403);
  });
});

test('concurrent wallet payments cannot overspend or pay twice', needsDb, async () => {
  await withApi({ qpay: fakeQPay() }, async (api) => {
    const user = newUser();
    const first = (await api(user, 'POST', '/orders', { courseIds: [COURSE] })).body;
    const second = (await api(user, 'POST', '/orders', { courseIds: [OTHER] })).body;
    await topUp(api, user, first.amount + 1000);
    const results = await Promise.all([
      ...[first, first, first].map((order) => api(user, 'POST', `/orders/${order.id}/wallet`)),
      api(user, 'POST', `/orders/${second.id}/wallet`),
    ]);
    assert.ok(results.every((result) => result.status < 500), JSON.stringify(results.map((r) => r.status)));
    const wallet = (await api(user, 'GET', '/me/wallet')).body;
    assert.equal(wallet.transactions.filter((row) => row.type === 'purchase').length, 1);
    assert.equal(wallet.balance, 1000);
  });
});

test('cancelling a wallet-paid order refunds it and closes access', needsDb, async () => {
  await withApi({ qpay: fakeQPay() }, async (api) => {
    const user = newUser();
    const { body: order } = await api(user, 'POST', '/orders', { courseIds: [COURSE] });
    await topUp(api, user, order.amount);
    await api(user, 'POST', `/orders/${order.id}/wallet`);
    assert.equal((await api(ADMIN, 'POST', `/admin/course-orders/${order.id}/cancelled`)).body.status, 'cancelled');
    await api(ADMIN, 'POST', `/admin/course-orders/${order.id}/cancelled`);
    assert.equal((await api(user, 'GET', '/me/wallet')).body.balance, order.amount);
    assert.equal((await api(user, 'GET', `/me/courses/${COURSE}/lessons`)).status, 403);
  });
});

test('QPay callback trusts QPay, not the caller, and settles once', needsDb, async () => {
  const qpay = fakeQPay();
  await withApi({ qpay }, async (api) => {
    const user = newUser();
    const { body: order } = await api(user, 'POST', '/orders', { courseIds: [COURSE] });
    assert.equal(order.qpayAvailable, true);
    assert.equal((await api(newUser(), 'POST', `/orders/${order.id}/qpay`)).status, 404);
    const invoice = await api(user, 'POST', `/orders/${order.id}/qpay`);
    assert.equal(invoice.status, 201);
    assert.equal((await api(user, 'POST', `/orders/${order.id}/qpay`)).body.qrText, 'qr');

    const path = `/qpay/callback?order=${order.id}&sig=${signOrder(order.id, env)}`;
    assert.equal((await api(null, 'GET', `/qpay/callback?order=${order.id}&sig=${'0'.repeat(64)}`)).status, 403);
    assert.equal((await api(null, 'GET', path)).body, 'SUCCESS');
    assert.equal((await api(user, 'GET', '/me/orders')).body[0].status, 'pending_payment');
    qpay.paid.set(`inv-${order.id}`, order.amount - 1);
    await api(null, 'GET', path);
    assert.equal((await api(user, 'GET', '/me/orders')).body[0].status, 'pending_payment');

    qpay.paid.set(`inv-${order.id}`, order.amount);
    await Promise.all([api(null, 'GET', path), api(null, 'GET', path), api(null, 'POST', path)]);
    const [paid] = (await api(user, 'GET', '/me/orders')).body;
    assert.equal(paid.status, 'paid');
    assert.equal(paid.method, 'qpay');
    assert.equal((await api(user, 'GET', `/me/courses/${COURSE}/lessons`)).status, 200);
  });
});

test('QPay top-up credits the wallet exactly once', needsDb, async () => {
  const qpay = fakeQPay();
  await withApi({ qpay }, async (api) => {
    const user = newUser();
    const { body: order } = await api(user, 'POST', '/me/wallet/topups', { amount: 20000 });
    await api(user, 'POST', `/orders/${order.id}/qpay`);
    qpay.paid.set(`inv-${order.id}`, 20000);
    const path = `/qpay/callback?order=${order.id}&sig=${signOrder(order.id, env)}`;
    await Promise.all([api(null, 'GET', path), api(null, 'GET', path)]);
    await api(user, 'POST', `/orders/${order.id}/qpay/check`);
    assert.equal((await api(user, 'GET', '/me/wallet')).body.balance, 20000);
  });
});

test('paying from the wallet closes an open QPay invoice first', needsDb, async () => {
  const qpay = fakeQPay();
  await withApi({ qpay }, async (api) => {
    const user = newUser();
    const { body: order } = await api(user, 'POST', '/orders', { courseIds: [COURSE] });
    await topUp(api, user, order.amount);
    await api(user, 'POST', `/orders/${order.id}/qpay`);
    qpay.failCancel = true;
    assert.equal((await api(user, 'POST', `/orders/${order.id}/wallet`)).body.error.code, 'qpay_in_progress');
    assert.equal((await api(user, 'GET', '/me/wallet')).body.balance, order.amount);
    qpay.failCancel = false;
    assert.equal((await api(user, 'POST', `/orders/${order.id}/wallet`)).body.status, 'paid');
    assert.deepEqual(qpay.cancelled, [`inv-${order.id}`]);
  });
});

test('without QPay keys the site reports it as unavailable', needsDb, async () => {
  await withApi({ env: {} }, async (api) => {
    const user = newUser();
    const { body: order } = await api(user, 'POST', '/orders', { courseIds: [COURSE] });
    assert.equal(order.qpayAvailable, false);
    const result = await api(user, 'POST', `/orders/${order.id}/qpay`);
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, 'qpay_unavailable');
    assert.equal((await api(null, 'GET', `/qpay/callback?order=${order.id}&sig=x`)).status, 403);
  });
});

test('QPay client signs in, reuses its token and sums only PAID rows', async () => {
  const calls = [];
  const json = (data) => new Response(JSON.stringify(data), { status: 200 });
  const client = createQPayClient({ env, fetch: async (target, options) => {
    calls.push({ path: new URL(target).pathname, options });
    if (target.endsWith('/v2/auth/token')) return json({ access_token: 'tok' });
    if (target.endsWith('/v2/invoice')) return json({ invoice_id: 'inv', qr_text: 't', qr_image: 'AAA', urls: [] });
    return json({ rows: [{ payment_status: 'PAID', payment_amount: '700' }, { payment_status: 'NEW', payment_amount: '999' }, { payment_status: 'PAID', payment_amount: 300 }] });
  } });
  const invoice = await client.createInvoice({ id: 'cord_1', userId: 'u1', amount: 1000 });
  assert.equal(invoice.details.qrImage, 'data:image/png;base64,AAA');
  assert.equal(await client.paidAmount('inv'), 1000);
  assert.deepEqual(calls.map((call) => call.path), ['/v2/auth/token', '/v2/invoice', '/v2/payment/check']);
  const sent = JSON.parse(calls[1].options.body);
  const callback = new URL(sent.callback_url);
  assert.equal(sent.amount, 1000);
  assert.ok(verifyOrderSignature('cord_1', callback.searchParams.get('sig'), env));
  assert.equal(verifyOrderSignature('cord_2', callback.searchParams.get('sig'), env), false);
});
