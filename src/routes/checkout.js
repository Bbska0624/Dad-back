// Сайтын сагс, захиалга, хичээл үзэх эрх (frontend docs/COURSE-CHECKOUT.md).
// Хэрэглэгчийг зөвхөн session-оос тодорхойлно, клиентээс ирсэн userId-д итгэхгүй.
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { database } from './admin.js';
import { syncProfile } from './account.js';
import { authMiddleware } from '../services/supabase.js';
import { HttpError, notFound, validationError } from '../errors.js';
import { newId } from '../store.js';
import { visibleContent } from '../services/content.js';
import { qpayConfigured } from '../services/qpay.js';
import { bankAccounts } from '../services/banks.js';
import { activeAccess, courseLessons, hasActiveAccess, PENDING_STATUSES } from '../services/courseAccess.js';

const MAX_ITEMS = 20;

export function toOrder(row, env = process.env) {
  return {
    id: row.id, kind: row.kind, method: row.method, items: row.items, amount: row.amount, currency: row.currency, status: row.status,
    createdAt: row.createdAt.toISOString(),
    ...(row.reportedAt ? { reportedAt: row.reportedAt.toISOString() } : {}),
    ...(row.paidAt ? { paidAt: row.paidAt.toISOString() } : {}),
    qpayAvailable: qpayConfigured(env) && row.status === 'pending_payment',
    banks: bankAccounts(env),
  };
}

const quoted = (items) => items.every((item) => Number.isInteger(item.price) && item.price > 0);
const total = (items) => items.reduce((sum, item) => sum + item.price, 0);
const sameCourses = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

async function priceItems(db, ids) {
  const rows = await db.course.findMany({ where: { id: { in: ids }, ...visibleContent } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw validationError({ courseIds: `Unknown course: ${missing.join(', ')}` });
  return ids.map((id) => ({ courseId: id, title: byId.get(id).title, price: byId.get(id).price }));
}

function parseCourseIds(body = {}) {
  const { courseIds } = body;
  if (!Array.isArray(courseIds) || !courseIds.length || courseIds.length > MAX_ITEMS
    || courseIds.some((id) => typeof id !== 'string' || !id || id.length > 100)) throw validationError({ courseIds: 'Invalid course list' });
  return [...new Set(courseIds)];
}

async function ownOrder(db, user, id) {
  const order = await db.courseOrder.findUnique({ where: { id } });
  if (!order || order.userId !== user.id) throw notFound('Order');
  return order;
}

export function createCheckoutRouter({ limit, env = process.env, ...options } = {}) {
  const router = Router();
  const auth = authMiddleware({ env, ...options });
  const limited = limit ?? ((req, res, next) => next());

  router.post('/orders', limited, auth, async (req, res) => {
    const ids = parseCourseIds(req.body);
    const db = database();
    await syncProfile(req.user);
    const { order, created } = await db.$transaction(async (tx) => {
      // Нэг хэрэглэгчийн зэрэг ирсэн захиалгыг дараалуулна (давхар захиалгаас сэргийлнэ).
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`course-order:${req.user.id}`}))`);
      const items = await priceItems(tx, ids);
      for (const id of ids) if (await hasActiveAccess(tx, req.user.id, id)) throw new HttpError(409, 'already_owned', 'Course is already owned', { courseIds: id });
      const pending = await tx.courseOrder.findMany({ where: { userId: req.user.id, kind: 'course', status: { in: PENDING_STATUSES } }, orderBy: { createdAt: 'desc' } });
      const existing = pending.find((row) => sameCourses(row.items.map((item) => item.courseId), ids));
      if (existing) {
        if (existing.status === 'awaiting_quote' && quoted(items)) {
          return { order: await tx.courseOrder.update({ where: { id: existing.id }, data: { items, amount: total(items), status: 'pending_payment' } }), created: false };
        }
        return { order: existing, created: false };
      }
      if (pending.some((row) => row.items.some((item) => ids.includes(item.courseId)))) throw new HttpError(409, 'already_ordered', 'Course already has a pending order');
      const ready = quoted(items);
      return { order: await tx.courseOrder.create({ data: {
        id: newId('cord'), userId: req.user.id, items, amount: ready ? total(items) : null, currency: 'MNT', status: ready ? 'pending_payment' : 'awaiting_quote',
      } }), created: true };
    });
    res.status(created ? 201 : 200).json(toOrder(order, env));
  });

  router.get('/me/orders', auth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const rows = await database().courseOrder.findMany({ where: { userId: req.user.id, kind: 'course' }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json(rows.map((row) => toOrder(row, env)));
  });

  router.post('/orders/:id/bank-transfer', limited, auth, async (req, res) => {
    const db = database();
    const order = await ownOrder(db, req.user, req.params.id);
    if (!['pending_payment', 'pending_review'].includes(order.status)) throw new HttpError(409, 'payment_not_ready', 'Order cannot be paid');
    // Мэдэгдэл нь эрх олгохгүй: админ шилжүүлгийг шалгаад "Төлөгдсөн" дарна.
    await db.courseOrder.updateMany({ where: { id: order.id, status: 'pending_payment' }, data: { status: 'pending_review', method: 'bank', reportedAt: order.reportedAt ?? new Date() } });
    const updated = await db.courseOrder.findUnique({ where: { id: order.id } });
    res.json(toOrder(updated, env));
  });

  router.get('/me/courses', auth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = database();
    res.json(await activeAccess(db, req.user.id));
  });

  router.get('/me/courses/:courseId/lessons', auth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const lessons = courseLessons(req.params.courseId);
    if (!lessons) throw notFound('Course');
    const db = database();
    if (!await hasActiveAccess(db, req.user.id, req.params.courseId)) throw new HttpError(403, 'payment_required', 'Payment confirmation is required');
    res.json({ lessons });
  });

  return router;
}
