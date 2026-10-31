// PostgreSQL store (Prisma). DATABASE_URL тохируулсан үед ашиглагдана.
// Хариуны хэлбэр memory store-той яг ижил байх ёстой (test/store-parity.test.js шалгана).
import { PrismaClient, Prisma } from '@prisma/client';
import { HttpError } from '../errors.js';
import { newsSummary } from './memory.js';

const toCourse = (c) => ({
  id: c.id,
  category: c.category,
  status: c.status,
  price: c.price,
  image: c.image,
  title: c.title,
  description: c.description,
});

const toNews = (n) => {
  const item = {
    id: n.id,
    number: n.number,
    isSample: n.isSample,
    publishedAt: n.publishedAt ? n.publishedAt.toISOString() : null,
    category: n.category,
    title: n.title,
    summary: n.summary,
    body: n.body,
    details: n.details,
    coverImage: n.coverImage,
  };
  if (n.gallery != null) item.gallery = n.gallery;
  return item;
};

const toEnrollment = (e) => ({
  id: e.id, courseId: e.courseId, name: e.name, email: e.email, phone: e.phone, status: e.status,
  createdAt: e.createdAt.toISOString(),
});

const toPayment = (p) => ({
  id: p.id, enrollmentId: p.enrollmentId, method: p.method, status: p.status, amount: p.amount,
  currency: p.currency, instructions: p.instructions, createdAt: p.createdAt.toISOString(),
});

// Json? баганад null бичихэд Prisma тусгай утга шаарддаг.
const json = (value) => (value == null ? Prisma.DbNull : value);

export function createPrismaStore({ url } = {}) {
  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  const ordered = { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] };

  return {
    kind: 'prisma',
    prisma,

    async listCourses({ category } = {}) {
      const rows = await prisma.course.findMany({ where: category ? { category } : undefined, ...ordered });
      return rows.map(toCourse);
    },
    async findCourse(id) {
      const row = await prisma.course.findUnique({ where: { id } });
      return row ? toCourse(row) : null;
    },

    async listNews({ limit } = {}) {
      const rows = await prisma.news.findMany({ ...ordered, take: limit });
      return rows.map((n) => newsSummary(toNews(n)));
    },
    async findNews(id) {
      const row = await prisma.news.findUnique({ where: { id } });
      return row ? toNews(row) : null;
    },

    async insertEnrollment(record) {
      try {
        const row = await prisma.enrollment.create({
          data: {
            id: record.id,
            courseId: record.courseId,
            name: record.name,
            email: record.email,
            emailNormalized: record.email.toLowerCase(),
            phone: record.phone,
            status: record.status,
            createdAt: new Date(record.createdAt),
          },
        });
        return toEnrollment(row);
      } catch (error) {
        // (course_id, email_normalized) давхардвал — зэрэг ирсэн хүсэлтүүдийг ч зөв барина.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new HttpError(409, 'already_enrolled', 'Already enrolled');
        }
        throw error;
      }
    },
    async findEnrollment(id) {
      const row = await prisma.enrollment.findUnique({ where: { id } });
      return row ? toEnrollment(row) : null;
    },

    async insertPayment(record) {
      const row = await prisma.payment.create({
        data: {
          id: record.id,
          enrollmentId: record.enrollmentId,
          method: record.method,
          status: record.status,
          amount: record.amount,
          currency: record.currency,
          instructions: json(record.instructions),
          createdAt: new Date(record.createdAt),
        },
      });
      return toPayment(row);
    },
    async findPayment(id) {
      const row = await prisma.payment.findUnique({ where: { id } });
      return row ? toPayment(row) : null;
    },

    /** Зөвхөн тестэд: бүртгэл, төлбөрийг устгана. */
    async reset() {
      await prisma.payment.deleteMany();
      await prisma.enrollment.deleteMany();
    },
    async close() {
      await prisma.$disconnect();
    },
  };
}

/** courses, news-ийг JSON-оос DB руу оруулна (байгааг нь шинэчилнэ). Бүртгэл, төлбөрт хүрэхгүй. */
export async function seedContent(prisma, { courses, news }) {
  for (const [i, c] of courses.entries()) {
    const data = {
      category: c.category, status: c.status, price: c.price ?? null, title: c.title, description: c.description,
      image: json(c.image), sortOrder: i,
    };
    await prisma.course.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
  }
  for (const [i, n] of news.entries()) {
    const data = {
      number: n.number, category: n.category, title: n.title, summary: n.summary,
      body: json(n.body), details: json(n.details), coverImage: json(n.coverImage), gallery: json(n.gallery),
      publishedAt: n.publishedAt ? new Date(n.publishedAt) : null, isSample: Boolean(n.isSample), sortOrder: i,
    };
    await prisma.news.upsert({ where: { id: n.id }, create: { id: n.id, ...data }, update: data });
  }
}
