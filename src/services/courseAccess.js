// Хичээл үзэх эрх (frontend src/data/courseAccess.js-тэй ижил дүрэм).
import { readFileSync } from 'node:fs';
import { newId } from '../store.js';
import { moveWallet } from './wallet.js';

export const COURSE_ACCESS_MONTHS = 3;
export const PENDING_STATUSES = ['awaiting_quote', 'pending_payment', 'pending_review'];
export const PAYABLE_STATUSES = ['pending_payment', 'pending_review'];

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

const activeWhere = (userId, now) => ({ userId, paymentStatus: 'paid', revokedAt: null, activatedAt: { lte: now }, expiresAt: { gt: now } });

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

/**
 * Төлбөрийг баталж, эрх үүсгэнэ (цэнэглэлт бол хэтэвчид орлого болгоно). tx нь Prisma-ийн transaction.
 * Статусын нөхцөлтэй UPDATE нь давтан callback, зэрэг хүсэлтийг нэг л удаа нэвтрүүлнэ; давтагдвал false.
 */
export async function settleOrder(tx, order, adminId, now = new Date(), method = order.method ?? 'bank') {
  const claimed = await tx.courseOrder.updateMany({
    where: { id: order.id, status: { in: PAYABLE_STATUSES } },
    data: { status: 'paid', paidAt: now, paidBy: adminId, method },
  });
  if (!claimed.count) return false;
  if (order.kind === 'topup') {
    await moveWallet(tx, { userId: order.userId, delta: order.amount, type: 'topup', orderId: order.id, now });
    return true;
  }
  for (const item of order.items) {
    await tx.courseAccess.upsert({
      where: { grantKey: `order:${order.id}:${item.courseId}` },
      create: { id: newId('acc'), userId: order.userId, courseId: item.courseId, paymentStatus: 'paid', orderId: order.id,
        grantKey: `order:${order.id}:${item.courseId}`, activatedAt: now, expiresAt: accessExpiresAt(now) },
      update: { revokedAt: null },
    });
  }
  return true;
}
