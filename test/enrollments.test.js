// POST /api/enrollments, POST /api/payments, GET /api/payments/:id — docs/API.md §3
// TEST_DATABASE_URL тохируулсан бол ижил тестүүд PostgreSQL дээр ажиллана (миграц хийгдсэн хоосон DB байх ёстой).
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { createMemoryStore } from '../src/store/memory.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
let store;
before(async () => {
  if (process.env.TEST_DATABASE_URL) {
    const { createPrismaStore, seedContent } = await import('../src/store/prisma.js');
    store = createPrismaStore({ url: process.env.TEST_DATABASE_URL });
    await seedContent(store.prisma, { courses: load('courses'), news: load('news') });
  } else {
    store = createMemoryStore();
  }
  useStore(store);
});
beforeEach(() => store.reset());
after(() => store.close());

const BANK_ENV = { BANK_NAME: 'Хаан банк', BANK_ACCOUNT_NUMBER: '5000123456', BANK_ACCOUNT_NAME: 'Magic Code AI' };

async function withServer(options, fn) {
  const server = createApp(options).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api`);
  } finally {
    server.close();
  }
}

const send = async (base, method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { res, body: await res.json() };
};

const person = { name: 'Бат-Эрдэнэ', email: 'bat@example.com', phone: '+976 9911 2233' };

test('open курс → 201 pending_payment, хувийн мэдээлэл буцаахгүй', async () => {
  await withServer({}, async (base) => {
    const { res, body } = await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', ...person });
    assert.equal(res.status, 201);
    assert.match(body.id, /^enr_/);
    assert.equal(body.courseId, 'data-analysis');
    assert.equal(body.status, 'pending_payment');
    assert.ok(!Number.isNaN(Date.parse(body.createdAt)));
    assert.deepEqual(Object.keys(body).sort(), ['courseId', 'createdAt', 'id', 'status']);
  });
});

test('waitlist курс → waitlisted', async () => {
  await withServer({}, async (base) => {
    const { res, body } = await send(base, 'POST', '/enrollments', { courseId: 'vip-course', ...person });
    assert.equal(res.status, 201);
    assert.equal(body.status, 'waitlisted');
  });
});

test('planned курс → 409 enrollment_closed', async () => {
  await withServer({}, async (base) => {
    const { res, body } = await send(base, 'POST', '/enrollments', { courseId: 'python-programming', ...person });
    assert.equal(res.status, 409);
    assert.equal(body.error.code, 'enrollment_closed');
  });
});

test('байхгүй курс → 404 not_found', async () => {
  await withServer({}, async (base) => {
    const { res, body } = await send(base, 'POST', '/enrollments', { courseId: 'nope', ...person });
    assert.equal(res.status, 404);
    assert.equal(body.error.code, 'not_found');
  });
});

test('ижил и-мэйлээр дахин бүртгүүлбэл 409 already_enrolled (том жижиг үсэг хамаарахгүй)', async () => {
  await withServer({}, async (base) => {
    assert.equal((await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', ...person })).res.status, 201);
    const { res, body } = await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', ...person, email: 'BAT@example.com' });
    assert.equal(res.status, 409);
    assert.equal(body.error.code, 'already_enrolled');
    // Өөр курсад болно
    assert.equal((await send(base, 'POST', '/enrollments', { courseId: 'vip-course', ...person })).res.status, 201);
  });
});

test('буруу талбарууд → 400 validation_error + fields', async () => {
  await withServer({}, async (base) => {
    const { res, body } = await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', name: '  ', email: 'bad', phone: 'abc' });
    assert.equal(res.status, 400);
    assert.equal(body.error.code, 'validation_error');
    assert.deepEqual(Object.keys(body.error.fields).sort(), ['email', 'name', 'phone']);
    const long = await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', ...person, name: 'a'.repeat(101) });
    assert.ok(long.body.error.fields.name);
  });
});

test('банкны төлбөр → 201, дансны заавар, reference = бүртгэлийн id', async () => {
  await withServer({ env: BANK_ENV }, async (base) => {
    const enr = (await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', ...person })).body;
    const { res, body } = await send(base, 'POST', '/payments', { enrollmentId: enr.id, method: 'bank' });
    assert.equal(res.status, 201);
    assert.match(body.id, /^pay_/);
    assert.equal(body.enrollmentId, enr.id);
    assert.equal(body.status, 'pending');
    assert.equal(body.currency, 'MNT');
    assert.equal(body.amount, null); // курсын үнэ одоогоор батлагдаагүй (price: null)
    assert.deepEqual(body.instructions, {
      bankName: 'Хаан банк', accountNumber: '5000123456', accountName: 'Magic Code AI', reference: enr.id,
    });

    const got = await send(base, 'GET', `/payments/${body.id}`);
    assert.equal(got.res.status, 200);
    assert.deepEqual(got.body, body);
  });
});

test('банкны мэдээлэл тохируулаагүй бол instructions: null', async () => {
  await withServer({ env: {} }, async (base) => {
    const enr = (await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', ...person })).body;
    const { res, body } = await send(base, 'POST', '/payments', { enrollmentId: enr.id, method: 'bank' });
    assert.equal(res.status, 201);
    assert.equal(body.instructions, null);
  });
});

test('QPay одоогоор instructions: null (frontend-ийн урсгал тасрахгүй)', async () => {
  await withServer({ env: BANK_ENV }, async (base) => {
    const enr = (await send(base, 'POST', '/enrollments', { courseId: 'data-analysis', ...person })).body;
    const { res, body } = await send(base, 'POST', '/payments', { enrollmentId: enr.id, method: 'qpay' });
    assert.equal(res.status, 201);
    assert.equal(body.method, 'qpay');
    assert.equal(body.instructions, null);
  });
});

test('төлбөрийн алдаанууд: validation, not_found, payment_not_required', async () => {
  await withServer({}, async (base) => {
    let r = await send(base, 'POST', '/payments', { enrollmentId: 'x', method: 'cash' });
    assert.equal(r.res.status, 400);
    assert.ok(r.body.error.fields.method);

    r = await send(base, 'POST', '/payments', { enrollmentId: 'enr_missing', method: 'bank' });
    assert.equal(r.res.status, 404);
    assert.equal(r.body.error.code, 'not_found');

    const waitlisted = (await send(base, 'POST', '/enrollments', { courseId: 'vip-course', ...person })).body;
    r = await send(base, 'POST', '/payments', { enrollmentId: waitlisted.id, method: 'bank' });
    assert.equal(r.res.status, 409);
    assert.equal(r.body.error.code, 'payment_not_required');

    r = await send(base, 'GET', '/payments/pay_missing');
    assert.equal(r.res.status, 404);
  });
});

test('бүртгэлийн rate limit → 429', async () => {
  await withServer({ formLimit: { windowMs: 60_000, max: 2 } }, async (base) => {
    await send(base, 'POST', '/enrollments', { courseId: 'nope', ...person });
    await send(base, 'POST', '/enrollments', { courseId: 'nope', ...person });
    const { res, body } = await send(base, 'POST', '/enrollments', { courseId: 'nope', ...person });
    assert.equal(res.status, 429);
    assert.equal(body.error.code, 'rate_limited');
  });
});
