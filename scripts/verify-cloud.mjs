// Tests API persistence against the configured database inside a rolled-back transaction.
import '../src/env.js';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { createPrismaStore } from '../src/store/prisma.js';

const store = createPrismaStore();
const rollback = new Error('ROLLBACK_VERIFICATION');
try {
  await store.prisma.$transaction(async (tx) => {
    // Routes share this one transaction; nested route transactions join it.
    const client = new Proxy(tx, { get(target, key) { return key === '$transaction' ? (fn) => fn(tx) : target[key]; } });
    useStore(createPrismaStore({ client }));
    const user = { id: 'verification-user', email: 'verification@example.invalid', name: 'Verification', role: 'admin' };
    const server = createApp({ verifyUser: async () => user }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function api(path, method = 'GET', body, expected = 200) {
      const res = await fetch(base + path, { method, headers: { Authorization: 'Bearer integration-verification', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      assert.equal(res.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
      return data;
    }
    try {
      await api('/account/me');
      await api('/account/me', 'PUT', { name: 'Verified profile', phone: '99112233', goal: 'Test' });
      assert.equal((await api('/account/me')).name, 'Verified profile');
      const course = await api('/admin/courses', 'POST', { title: { mn: 'Шалгалт', en: 'Verification' }, description: { mn: 'Тайлбар', en: 'Description' }, publication: 'draft', category: 'Code', status: 'open', price: 100, featured: true }, 201);
      await api(`/courses/${course.id}`, 'GET', undefined, 404);
      await api(`/admin/courses/${course.id}/published`, 'POST');
      assert.equal((await api(`/courses/${course.id}`)).price, 100);
      await api(`/admin/courses/${course.id}`, 'PUT', { price: 200 });
      assert.equal((await api(`/courses/${course.id}`)).price, 200);
      const enrollment = await api('/enrollments', 'POST', { courseId: course.id, name: 'Verification', email: user.email, phone: '99112233' }, 201);
      const records = await api('/admin/records');
      assert.ok(records.some((row) => row.id === enrollment.id && row.userId === user.id));
      await api(`/admin/records/${enrollment.id}/done`, 'POST');
      assert.equal((await api('/account/records')).find((r) => r.id === enrollment.id).status, 'done');
      const order = await api('/account/records', 'POST', { type: 'order', items: ['Verification item'] }, 201);
      await api(`/admin/records/${order.id}/delete`, 'POST');
      assert.ok((await api('/admin/records')).find((r) => r.id === order.id).deletedAt);
      await api(`/admin/records/${order.id}/restore`, 'POST');
      await api(`/admin/courses/${course.id}/delete`, 'POST');
      await api(`/courses/${course.id}`, 'GET', undefined, 404);
      await api(`/admin/courses/${course.id}/restore`, 'POST');
      await api(`/courses/${course.id}`);
      await api(`/admin/courses/${course.id}/archived`, 'POST');
      await api(`/courses/${course.id}`, 'GET', undefined, 404);
      const news = await api('/admin/news', 'POST', { title: { mn: 'Мэдээ', en: 'News' }, category: { mn: 'Ангилал', en: 'Category' }, summary: { mn: 'Товч', en: 'Summary' }, body: { mn: 'Агуулга', en: 'Body' }, publication: 'published', number: '99' }, 201);
      await api(`/news/${news.id}`);
      await api(`/admin/news/${news.id}/draft`, 'POST');
      await api(`/news/${news.id}`, 'GET', undefined, 404);
      assert.ok((await api('/admin/activity')).some((row) => row.actorId === user.id));
      console.log('Cloud API verification passed: profile, content lifecycle, public visibility, enrollment, order, records and activity. All verification data rolled back.');
    } finally { await new Promise((resolve) => server.close(resolve)); }
    throw rollback;
  }, { timeout: 90000 });
} catch (err) { if (err !== rollback) throw err; }
finally { await store.close(); }
