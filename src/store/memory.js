// Санах ойн store: DATABASE_URL байхгүй үед (жишээ нь тест) ашиглагдана.
// courses, news нь JSON файлаас; enrollments, payments нь сервер унтрахад арилна.
import { readFileSync } from 'node:fs';
import { HttpError } from '../errors.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const clone = (value) => structuredClone(value);

export function createMemoryStore({ courses = load('courses'), news = load('news') } = {}) {
  const enrollments = new Map();
  const payments = new Map();

  return {
    kind: 'memory',

    async listCourses({ category } = {}) {
      return clone(category ? courses.filter((c) => c.category === category) : courses);
    },
    async findCourse(id) {
      const course = courses.find((c) => c.id === id);
      return course ? clone(course) : null;
    },

    async listNews({ limit } = {}) {
      return clone(news.slice(0, limit ?? news.length).map(newsSummary));
    },
    async findNews(id) {
      const item = news.find((n) => n.id === id);
      return item ? clone(item) : null;
    },

    async insertEnrollment(record) {
      const key = record.email.toLowerCase();
      for (const e of enrollments.values()) {
        if (e.courseId === record.courseId && e.email.toLowerCase() === key) {
          throw new HttpError(409, 'already_enrolled', 'Already enrolled');
        }
      }
      enrollments.set(record.id, clone(record));
      return clone(record);
    },
    async findEnrollment(id) {
      const e = enrollments.get(id);
      return e ? clone(e) : null;
    },

    async insertPayment(record) {
      payments.set(record.id, clone(record));
      return clone(record);
    },
    async findPayment(id) {
      const p = payments.get(id);
      return p ? clone(p) : null;
    },

    async reset() {
      enrollments.clear();
      payments.clear();
    },
    async close() {},
  };
}

// Frontend-ийн src/api/news.js-тэй ижил: жагсаалтад body, details, gallery орохгүй.
export const newsSummary = ({ id, number, category, title, summary, publishedAt, isSample, coverImage }) => ({
  id, number, category, title, summary, publishedAt, isSample, coverImage,
});
