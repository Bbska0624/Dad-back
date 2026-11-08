// Хичээлийн видео (Cloudflare R2): хугацаатай линк, нээлттэй танилцуулга, төлбөртэй хичээлийн хамгаалалт.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { createMemoryStore } from '../src/store/memory.js';
import { presignUrl, signedObjectUrl } from '../src/services/r2.js';
import { courseLessons } from '../src/services/courseAccess.js';

const COURSE = 'course_86a45b6609a5';
const env = { R2_ACCOUNT_ID: 'acc123', R2_ACCESS_KEY_ID: 'AKID', R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET: 'mci-videos' };
const courses = JSON.parse(readFileSync(new URL('../src/data/courses.json', import.meta.url), 'utf8'));

let server;
let base;
before(async () => {
  useStore(createMemoryStore({ courses: [...courses, {
    id: COURSE, category: 'Code', status: 'open', price: 1000, image: null,
    title: { mn: 'Компьютер зохион байгуулалт, архитектур', en: 'Computer Organization and Architecture' }, description: { mn: 'т', en: 'd' },
  }] }));
  const verifyUser = async (token) => ({ id: `user-${token}`, email: `${token}@example.com`, name: token, role: 'user' });
  server = createApp({ env, verifyUser }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const get = async (path, token) => {
  const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { res, body: await res.json() };
};

test('presigned URL matches the AWS Signature V4 reference example', () => {
  const url = presignUrl({
    host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1', expiresIn: 86400,
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test('R2 links point at the private bucket object, expire in 2 hours and never expose the secret', () => {
  const now = new Date('2026-11-07T10:00:00Z');
  const { url, expiresAt } = signedObjectUrl(`courses/${COURSE}/lesson-02.mp4`, env, { now });
  assert.ok(url.startsWith(`https://acc123.r2.cloudflarestorage.com/mci-videos/courses/${COURSE}/lesson-02.mp4?`));
  assert.match(url, /X-Amz-Expires=7200/);
  assert.equal(expiresAt, '2026-11-07T12:00:00.000Z');
  assert.ok(!url.includes('secret'));
  assert.throws(() => signedObjectUrl('x.mp4', {}), { status: 503, code: 'video_unavailable' });
});

test('course lessons list the R2 videos without links; only lesson-01 is the preview', () => {
  const lessons = courseLessons(COURSE);
  assert.equal(lessons.length, 12);
  assert.deepEqual(lessons.filter((l) => l.preview).map((l) => l.id), ['lesson-01']);
  assert.ok(lessons.every((l) => l.video && !l.url));
  assert.equal(courseLessons('python-programming')[0].creator, 'freeCodeCamp.org'); // YouTube хичээлүүд хэвээр
});

test('anyone can watch the preview; unknown courses and courses without videos return 404', async () => {
  const { res, body } = await get(`/courses/${COURSE}/preview`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(body.lesson.id, 'lesson-01');
  assert.match(body.url, new RegExp(`/mci-videos/courses/${COURSE}/lesson-01\\.mp4\\?`));
  assert.equal((await get('/courses/nope/preview')).res.status, 404);
  assert.equal((await get('/courses/python-programming/preview')).res.status, 404);
});

test('paid lesson videos require login; the preview lesson is also available to signed-in users', async () => {
  const guest = await get(`/me/courses/${COURSE}/lessons/lesson-02/video`);
  assert.equal(guest.res.status, 401);
  const preview = await get(`/me/courses/${COURSE}/lessons/lesson-01/video`, 'learner');
  assert.equal(preview.res.status, 200);
  assert.match(preview.body.url, /lesson-01\.mp4/);
  assert.equal((await get(`/me/courses/${COURSE}/lessons/lesson-08/video`, 'learner')).res.status, 404);
});
