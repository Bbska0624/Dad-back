// Курс, мэдээг src/data/*.json-оос өгөгдлийн сан руу оруулна. Дахин ажиллуулахад аюулгүй (байгааг нь шинэчилнэ).
// Бүртгэл, төлбөрт хүрэхгүй. Ашиглах: npm run db:seed
import '../src/env.js';
import { readFileSync } from 'node:fs';
import { createPrismaStore, seedContent } from '../src/store/prisma.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL тохируулаагүй байна (.env файлаа шалгана уу).');
  process.exit(1);
}

const store = createPrismaStore();
try {
  const courses = load('courses');
  const news = load('news');
  await seedContent(store.prisma, { courses, news });
  console.log(`Seed OK: ${courses.length} courses, ${news.length} news`);
} finally {
  await store.close();
}
