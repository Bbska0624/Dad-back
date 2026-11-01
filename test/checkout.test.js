// Сайтын нэвтрэлт (cookie), захиалга, хичээл үзэх эрх, админ "Төлөгдсөн" — frontend docs/COURSE-CHECKOUT.md
// Нэвтрэлтийн cookie/алдааны тестүүд үргэлж ажиллана. Захиалгын тестүүд TEST_DATABASE_URL шаардана.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { createMemoryStore } from '../src/store/memory.js';
import { accessExpiresAt } from '../src/services/courseAccess.js';
import { createSupabaseAuth } from '../src/services/session.js';

const url = process.env.TEST_DATABASE_URL;
const needsDb = { skip: !url && 'TEST_DATABASE_URL тохируулаагүй' };
const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const FIXED_STATUS = { 'data-analysis': 'open', 'vip-course': 'waitlist', 'python-programming': 'planned' };
const testCourses = () => load('courses').map((c) => (FIXED_STATUS[c.id] ? { ...c, status: FIXED_STATUS[c.id] } : c));
const ORIGIN = 'http://localhost:5173';

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

// Supabase-ийн оронд: токен = "at:<userId>", refresh = "rt:<userId>".
function fakeSupabase() {
  const users = new Map();
  const account = (u) => ({ id: u.id, email: u.email, user_metadata: { name: u.name }, app_metadata: { role: u.role } });
  const session = (u) => ({ access_token: `at:${u.id}`, refresh_token: `rt:${u.id}`, expires_in: 3600, user: account(u) });
  const fail = (supabaseCode, status = 400) => Object.assign(new Error(supabaseCode), { status, code: 'auth_failed', supabaseCode });
  const auth = {
    confirm: true,
    calls: [],
    async signUp({ email, password, name }) {
      auth.calls.push('signUp');
      const existing = [...users.values()].find((u) => u.email === email);
      if (existing?.confirmed) return { id: randomUUID(), email, identities: [] };
      const user = existing ?? { id: randomUUID(), email, name, password, role: 'user', confirmed: !auth.confirm };
      users.set(user.id, user);
      return auth.confirm ? { ...account(user), identities: [{}] } : session(user);
    },
    async signIn({ email, password }) {
      const user = [...users.values()].find((u) => u.email === email && u.password === password);
      if (!user) throw fail('invalid_credentials');
      if (!user.confirmed) throw fail('email_not_confirmed');
      return session(user);
    },
    async refresh(token) {
      const user = users.get(token.replace(/^rt:/, ''));
      if (!user || user.revoked) throw fail('refresh_token_not_found');
      return session(user);
    },
    async verifyEmail({ tokenHash }) {
      const user = users.get(tokenHash);
      if (!user) throw fail('otp_expired', 403);
      user.confirmed = true;
      return session(user);
    },
    async signOut() { auth.calls.push('signOut'); },
  };
  const verifyUser = async (token) => {
    const user = users.get(String(token).replace(/^at:/, ''));
    if (!user || user.expired) throw Object.assign(new Error('expired'), { status: 401 });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  };
  return { auth, verifyUser, users, session };
}

async function withServer(options, fn) {
  const server = createApp({ formLimit: { windowMs: 60_000, max: 1000 }, authLimit: { windowMs: 60_000, max: 1000 }, env: {}, ...options }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}/api`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

// Хөтөч шиг cookie хадгалдаг жижиг клиент.
function browser(base) {
  const jar = new Map();
  async function call(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { Origin: ORIGIN, ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      if (/Max-Age=0/.test(line)) jar.delete(name); else jar.set(name, value);
    }
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed, headers: res.headers, cookies: res.headers.getSetCookie() };
  }
  return { call, jar };
}

test('session cookies are HttpOnly, SameSite=Lax, scoped to /api and Secure in production', async () => {
  const fake = fakeSupabase();
  fake.auth.confirm = false;
  await withServer({ ...fake, env: { NODE_ENV: 'production', DATABASE_URL: '' } }, async (base) => {
    // DB байхгүй тул profile хадгалахад 503 буцна, гэхдээ cookie-ний тохиргоог шалгаж болно.
    const res = await browser(base).call('POST', '/auth/register', { name: 'Бат', email: 'bat@example.com', password: 'password123' });
    assert.ok(res.cookies.length >= 2, `cookies: ${res.cookies}`);
    for (const line of res.cookies) {
      assert.match(line, /HttpOnly/);
      assert.match(line, /SameSite=Lax/);
      assert.match(line, /Path=\/api/);
      assert.match(line, /Secure/);
    }
  });
});

test('auth validates input, maps Supabase errors and rejects untrusted origins', async () => {
  const fake = fakeSupabase();
  await withServer(fake, async (base) => {
    const b = browser(base);
    assert.equal((await b.call('POST', '/auth/register', { name: '', email: 'bad', password: 'short' })).status, 400);
    assert.equal((await b.call('GET', '/auth/me')).status, 401);
    assert.equal((await b.call('POST', '/auth/login', { email: 'nobody@example.com', password: 'whatever1' })).body.error.code, 'invalid_credentials');
    // Имэйл баталгаажуулалт асаалттай: session өгөхгүй, cookie тавихгүй.
    const reg = await b.call('POST', '/auth/register', { name: 'Сараа', email: 'Saraa@Example.com', password: 'password123' });
    assert.equal(reg.status, 202);
    assert.deepEqual(reg.body, { confirmationRequired: true, email: 'saraa@example.com' });
    assert.equal(b.jar.size, 0);
    const login = await b.call('POST', '/auth/login', { email: 'saraa@example.com', password: 'password123' });
    assert.equal(login.status, 403);
    assert.equal(login.body.error.code, 'email_not_confirmed');
    const evil = await b.call('POST', '/auth/login', { email: 'saraa@example.com', password: 'password123' }, { Origin: 'https://evil.example' });
    assert.equal(evil.status, 403);
    assert.equal(evil.body.error.code, 'forbidden');
    const badLink = await b.call('GET', '/auth/confirm?token_hash=nope&type=email');
    assert.equal(badLink.status, 303);
    assert.equal(badLink.headers.get('location'), '/login?confirm=failed');
  });
});

test('Supabase auth client calls the documented endpoints with the publishable key', async () => {
  const calls = [];
  const env = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'public-key' };
  const auth = createSupabaseAuth(env, async (target, options) => {
    calls.push({ target, options, body: JSON.parse(options.body) });
    if (target.includes('grant_type=password')) return Response.json({ error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, { status: 400 });
    return Response.json({ ok: true });
  });
  await auth.signUp({ email: 'a@b.mn', password: 'password123', name: 'A', redirectTo: 'https://www.mci.mn/account' });
  await assert.rejects(auth.signIn({ email: 'a@b.mn', password: 'x' }), { supabaseCode: 'email_not_confirmed' });
  await auth.verifyEmail({ tokenHash: 'h', type: 'email' });
  assert.equal(calls[0].target, 'https://example.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fwww.mci.mn%2Faccount');
  assert.deepEqual(calls[0].body, { email: 'a@b.mn', password: 'password123', data: { name: 'A' } });
  assert.equal(calls[0].options.headers.apikey, 'public-key');
  assert.equal(calls[1].target, 'https://example.supabase.co/auth/v1/token?grant_type=password');
  assert.deepEqual(calls[2].body, { token_hash: 'h', type: 'email' });
});

test('calendar-month expiry is clamped at month end', () => {
  assert.equal(accessExpiresAt('2026-01-31T10:00:00.000Z').toISOString(), '2026-04-30T10:00:00.000Z');
  assert.equal(accessExpiresAt('2026-11-01T00:00:00.000Z').toISOString(), '2027-02-01T00:00:00.000Z');
});

test('DB: confirm email → logged in → me/refresh → logout', needsDb, async () => {
  const fake = fakeSupabase();
  await withServer(fake, async (base) => {
    const b = browser(base);
    const email = `u${Date.now()}@example.com`;
    assert.equal((await b.call('POST', '/auth/register', { name: 'Дорж', email, password: 'password123' })).status, 202);
    const user = [...fake.users.values()].find((u) => u.email === email);
    const confirm = await b.call('GET', `/auth/confirm?token_hash=${user.id}&type=email`);
    assert.equal(confirm.status, 303);
    assert.equal(confirm.headers.get('location'), '/account?confirmed=1');
    const me = await b.call('GET', '/auth/me');
    assert.deepEqual(me.body, { id: user.id, name: 'Дорж', email, role: 'user' });
    // Дахин бүртгүүлэх оролдлого
    assert.equal((await b.call('POST', '/auth/register', { name: 'Дорж', email, password: 'password123' })).status, 409);
    // Access токены хугацаа дуусахад refresh токеноор сэргээнэ.
    user.expired = true;
    b.jar.set('mci_at', 'at:expired');
    const refreshed = await b.call('GET', '/auth/me');
    user.expired = false;
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.cookies.some((line) => line.startsWith('mci_at=')));
    assert.equal((await b.call('POST', '/auth/logout')).status, 204);
    assert.equal(b.jar.size, 0);
    assert.equal((await b.call('GET', '/auth/me')).status, 401);
  });
});

test('DB: order → bank transfer → admin marks paid → lessons unlocked for 3 months', needsDb, async () => {
  const fake = fakeSupabase();
  fake.auth.confirm = false;
  await withServer(fake, async (base) => {
    const student = browser(base);
    const other = browser(base);
    const email = `s${Date.now()}@example.com`;
    const reg = await student.call('POST', '/auth/register', { name: 'Оюу', email, password: 'password123' });
    assert.equal(reg.status, 201);
    await other.call('POST', '/auth/register', { name: 'Бусад', email: `o${email}`, password: 'password123' });

    // Нэвтрээгүй бол захиалга хийхгүй.
    assert.equal((await browser(base).call('POST', '/orders', { courseIds: ['sql-databases'] })).status, 401);
    assert.equal((await student.call('POST', '/orders', { courseIds: ['no-such-course'] })).status, 400);

    // Power BI-ийн түр эрх нэг удаа үүснэ.
    const courses = await student.call('GET', '/me/courses');
    assert.equal(courses.body.length, 1);
    assert.deepEqual({ ...courses.body[0], activatedAt: undefined, expiresAt: undefined }, { courseId: 'data-analysis', status: 'active', paymentStatus: 'waived', accessType: 'temporary', activatedAt: undefined, expiresAt: undefined });
    assert.deepEqual((await student.call('GET', '/me/courses')).body, courses.body);
    assert.equal((await student.call('GET', '/me/courses/data-analysis/lessons')).body.lessons.length, 4);
    assert.equal((await student.call('POST', '/orders', { courseIds: ['data-analysis'] })).body.error.code, 'already_owned');

    // Үнийг сервер тооцоолно, ижил захиалга дахин үүсэхгүй.
    const created = await student.call('POST', '/orders', { courseIds: ['sql-databases', 'web-development'], userId: 'someone-else', amount: 1 });
    assert.equal(created.status, 201);
    assert.equal(created.body.amount, 99800);
    assert.equal(created.body.status, 'pending_payment');
    assert.equal(created.body.currency, 'MNT');
    assert.deepEqual(created.body.items.map((i) => [i.courseId, i.price]), [['sql-databases', 49900], ['web-development', 49900]]);
    const again = await student.call('POST', '/orders', { courseIds: ['web-development', 'sql-databases'] });
    assert.equal(again.status, 200);
    assert.equal(again.body.id, created.body.id);
    assert.equal((await student.call('POST', '/orders', { courseIds: ['sql-databases'] })).body.error.code, 'already_ordered');
    const id = created.body.id;

    // Бусдын захиалгыг харах, өөрчлөх боломжгүй.
    assert.deepEqual((await other.call('GET', '/me/orders')).body, []);
    assert.equal((await other.call('POST', `/orders/${id}/bank-transfer`)).status, 404);
    assert.equal((await student.call('POST', `/orders/${id}/qpay`)).body.error.code, 'qpay_unavailable');

    // Шилжүүлгийн мэдэгдэл эрх олгохгүй.
    const reported = await student.call('POST', `/orders/${id}/bank-transfer`);
    assert.equal(reported.body.status, 'pending_review');
    assert.equal((await student.call('GET', '/me/courses/sql-databases/lessons')).status, 403);
    assert.equal((await student.call('GET', '/me/orders')).body[0].status, 'pending_review');

    // Энгийн хэрэглэгч өөрөө "төлөгдсөн" болгож чадахгүй.
    assert.equal((await student.call('POST', `/admin/course-orders/${id}/paid`)).status, 403);

    // Админ батална.
    const adminId = randomUUID();
    fake.users.set(adminId, { id: adminId, email: `admin${email}`, name: 'Админ', role: 'admin', confirmed: true });
    const admin = (method, path) => fetch(base + path, { method, headers: { Authorization: `Bearer at:${adminId}` } }).then(async (r) => ({ status: r.status, body: await r.json() }));
    const list = await admin('GET', '/admin/course-orders');
    const listed = list.body.find((o) => o.id === id);
    assert.equal(listed.user.email, email);
    assert.equal(listed.status, 'pending_review');
    const paid = await admin('POST', `/admin/course-orders/${id}/paid`);
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'paid');
    assert.equal((await admin('POST', `/admin/course-orders/${id}/paid`)).body.status, 'paid'); // давтан дарахад аюулгүй

    const access = (await student.call('GET', '/me/courses')).body;
    const sql = access.find((a) => a.courseId === 'sql-databases');
    assert.equal(sql.paymentStatus, 'paid');
    assert.equal(sql.expiresAt, accessExpiresAt(sql.activatedAt).toISOString());
    assert.equal(access.length, 3);
    assert.deepEqual((await student.call('GET', '/me/courses/sql-databases/lessons')).body.lessons[0], { id: 'HXV3zeQKqGY', mn: 'SQL ба өгөгдлийн сангийн суурь', en: 'SQL & database fundamentals', creator: 'freeCodeCamp.org' });
    assert.equal((await other.call('GET', '/me/courses/sql-databases/lessons')).status, 403);
    assert.equal((await student.call('POST', '/orders', { courseIds: ['sql-databases'] })).body.error.code, 'already_owned');
    assert.equal((await student.call('GET', '/me/courses/no-such/lessons')).status, 404);

    // Буцаалт: цуцлахад эрх хаагдана.
    assert.equal((await admin('POST', `/admin/course-orders/${id}/cancelled`)).body.status, 'cancelled');
    assert.equal((await student.call('GET', '/me/courses/sql-databases/lessons')).status, 403);
    assert.equal((await admin('POST', `/admin/course-orders/${id}/paid`)).status, 409);
  });
});
