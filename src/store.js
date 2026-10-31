// Түр өгөгдлийн давхарга. Одоогоор frontend-ийн mock-оос хуулсан JSON (scripts/sync-from-frontend.mjs).
// PostgreSQL + Prisma холбох үед зөвхөн энэ файлын функцуудыг солино; route-ууд өөрчлөгдөхгүй.
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8'));
const courses = load('courses');
const news = load('news');
const clone = (value) => structuredClone(value);

export const CATEGORIES = ['Code', 'Data', 'AI', 'Digital'];

export function listCourses({ category } = {}) {
  return clone(category ? courses.filter((c) => c.category === category) : courses);
}

export function findCourse(id) {
  const course = courses.find((c) => c.id === id);
  return course ? clone(course) : null;
}

// Frontend-ийн src/api/news.js-тэй ижил: жагсаалтад body, details, gallery орохгүй.
const summary = ({ id, number, category, title, summary: text, publishedAt, isSample, coverImage }) => ({
  id, number, category, title, summary: text, publishedAt, isSample, coverImage,
});

export function listNews({ limit } = {}) {
  return clone(news.slice(0, limit ?? news.length).map(summary));
}

export function findNews(id) {
  const item = news.find((n) => n.id === id);
  return item ? clone(item) : null;
}
