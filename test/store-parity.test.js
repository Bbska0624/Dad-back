// PostgreSQL store нь санах ойн store-той (= frontend-ийн mock) яг ижил хариу өгөх ёстой.
// Зөвхөн TEST_DATABASE_URL тохируулсан үед ажиллана.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMemoryStore } from '../src/store/memory.js';

const url = process.env.TEST_DATABASE_URL;
const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
let db;
const mem = createMemoryStore();

before(async () => {
  if (!url) return;
  const { createPrismaStore, seedContent } = await import('../src/store/prisma.js');
  db = createPrismaStore({ url });
  await seedContent(db.prisma, { courses: load('courses'), news: load('news') });
  await seedContent(db.prisma, { courses: load('courses'), news: load('news') }); // 2 дахь удаа ажиллуулахад аюулгүй
});
after(() => db?.close());

test('DB: courses / news хариу frontend mock-той ижил', { skip: !url && 'TEST_DATABASE_URL тохируулаагүй' }, async () => {
  assert.deepEqual(await db.listCourses(), await mem.listCourses());
  assert.deepEqual(await db.listCourses({ category: 'AI' }), await mem.listCourses({ category: 'AI' }));
  assert.deepEqual(await db.findCourse('data-analysis'), await mem.findCourse('data-analysis'));
  assert.equal(await db.findCourse('nope'), null);
  assert.deepEqual(await db.listNews(), await mem.listNews());
  assert.deepEqual(await db.listNews({ limit: 3 }), await mem.listNews({ limit: 3 }));
  for (const { id } of load('news')) assert.deepEqual(await db.findNews(id), await mem.findNews(id), `news ${id}`);
});
