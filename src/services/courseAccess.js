// Хичээл үзэх эрх (frontend src/data/courseAccess.js-тэй ижил дүрэм).
import { readFileSync } from 'node:fs';
import { newId } from '../store.js';

export const COURSE_ACCESS_MONTHS = 3;
export const TEMPORARY_FREE_COURSE = 'data-analysis'; // Power BI: хэрэглэгч бүрт нэг удаа 3 сарын түр эрх
export const PENDING_STATUSES = ['awaiting_quote', 'pending_payment', 'pending_review'];

const lessons = JSON.parse(readFileSync(new URL('../data/lessons.json', import.meta.url), 'utf8'));
export const courseLessons = (courseId) => (Object.hasOwn(lessons, courseId) ? structuredClone(lessons[courseId]) : null);

// Хуанлийн 3 сар, сарын сүүлээр хязгаарлана (1-р сарын 31 + 3 сар = 4-р сарын 30).
export function accessExpiresAt(activatedAt) {
  const start = new Date(activatedAt);
  const day = start.getUTCDate();
  const result = new Date(start);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + COURSE_ACCESS_MONTHS);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const activeWhere = (userId, now) => ({ userId, revokedAt: null, activatedAt: { lte: now }, expiresAt: { gt: now } });

/** Power BI-ийн түр эрхийг нэг л удаа үүсгэнэ (давхар хүсэлтэд grantKey unique хамгаална). */
export async function ensureTemporaryAccess(db, userId, now = new Date()) {
  const grantKey = `waived:${TEMPORARY_FREE_COURSE}:${userId}`;
  if (await db.courseAccess.findUnique({ where: { grantKey } })) return;
  try {
    await db.courseAccess.create({ data: {
      id: newId('acc'), userId, courseId: TEMPORARY_FREE_COURSE, paymentStatus: 'waived', accessType: 'temporary',
      grantKey, activatedAt: now, expiresAt: accessExpiresAt(now),
    } });
  } catch (error) {
    if (error?.code !== 'P2002') throw error; // зэрэг ирсэн хүсэлт аль хэдийн үүсгэсэн
  }
}

/** Идэвхтэй эрхүүд, курс бүрт хамгийн сүүлд дуусахыг нь. */
export async function activeAccess(db, userId, now = new Date()) {
  const rows = await db.courseAccess.findMany({ where: activeWhere(userId, now), orderBy: { expiresAt: 'desc' } });
  const byCourse = new Map();
  for (const row of rows) if (!byCourse.has(row.courseId)) byCourse.set(row.courseId, row);
  return [...byCourse.values()].map((row) => ({
    courseId: row.courseId, status: 'active', paymentStatus: row.paymentStatus,
    ...(row.accessType ? { accessType: row.accessType } : {}),
    activatedAt: row.activatedAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
  }));
}

export async function hasActiveAccess(db, userId, courseId, now = new Date()) {
  return Boolean(await db.courseAccess.findFirst({ where: { ...activeWhere(userId, now), courseId }, select: { id: true } }));
}

/** Төлбөрийг баталж, эрх үүсгэнэ. tx нь Prisma-ийн transaction. */
export async function settleOrder(tx, order, adminId, now = new Date()) {
  await tx.courseOrder.update({ where: { id: order.id }, data: { status: 'paid', paidAt: now, paidBy: adminId } });
  for (const item of order.items) {
    await tx.courseAccess.upsert({
      where: { grantKey: `order:${order.id}:${item.courseId}` },
      create: { id: newId('acc'), userId: order.userId, courseId: item.courseId, paymentStatus: 'paid', orderId: order.id,
        grantKey: `order:${order.id}:${item.courseId}`, activatedAt: now, expiresAt: accessExpiresAt(now) },
      update: { revokedAt: null },
    });
  }
}
