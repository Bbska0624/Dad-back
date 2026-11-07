import { withCartSettings, saveCartSetting } from '../services/courseCommerce.js';
import { Router } from 'express';
import { readAbout, validateAbout } from '../services/about.js';
import { Prisma } from '@prisma/client';
import { getStore, newId } from '../store.js';
import { HttpError, notFound, validationError } from '../errors.js';
import { authMiddleware, requireAdmin } from '../services/supabase.js';
import { validateContent } from '../services/content.js';
import { uploadImage } from '../services/storage.js';
import { rateLimit } from '../middleware/rateLimit.js';

export function database() {
  const prisma = getStore().prisma;
  if (!prisma) throw new HttpError(503, 'configuration_error', 'DATABASE_URL must be configured');
  return prisma;
}
const modelName = (type) => {
  if (!['courses', 'news', 'services'].includes(type)) throw notFound('Content type');
  return ({ courses: 'course', news: 'news', services: 'service' })[type];
};
const jsonFields = ['image', 'coverImage', 'gallery', 'body', 'details', 'duration', 'level'];
const toData = (item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key,
  key === 'publishedAt' && value ? new Date(value) : jsonFields.includes(key) && value === null ? Prisma.DbNull : value]));

export function createAdminRouter(options = {}) {
  const router = Router();
  router.use(authMiddleware(options), requireAdmin);
  router.use(rateLimit({ windowMs: 60000, max: 120 }));
  router.get('/site/about', async (_req, res) => res.json(await readAbout(database())));
  router.put('/site/about', async (req, res) => {
    const content = validateAbout(req.body);
    await database().$transaction(async (tx) => {
      await tx.siteSection.upsert({ where: { id: 'about' }, create: { id: 'about', content }, update: { content } });
      await tx.activity.create({ data: { id: newId('act'), actorId: req.user.id, action: 'update', type: 'about', title: content.heading } });
    });
    res.json(content);
  });
  router.post('/images', async (req, res) => res.status(201).json(await uploadImage(req.body?.dataUrl, options.env)));
  router.get('/activity', async (req, res) => res.json(await database().activity.findMany({ orderBy: { at: 'desc' }, take: 150 })));
  router.get('/users', async (req, res) => res.json(await database().profile.findMany({ orderBy: { createdAt: 'desc' } })));
  router.put('/users/:id', async (req, res) => {
    const { profileData } = await import('./account.js');
    if (!await database().profile.findUnique({ where: { id: req.params.id } })) throw notFound('User');
    res.json(await database().profile.update({ where: { id: req.params.id }, data: profileData(req.body) }));
  });
  router.get('/records', async (req, res) => {
    const { listRecords } = await import('./account.js');
    res.json(await listRecords(database()));
  });
  router.post('/records/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    if (!['new', 'done', 'cancelled', 'delete', 'restore'].includes(action)) throw validationError({ action: 'Invalid action' });
    const db = database();
    const enrollment = await db.enrollment.findUnique({ where: { id } });
    const current = enrollment || await db.order.findUnique({ where: { id } });
    if (!current) throw notFound('Record');
    if (current.deletedAt && !['restore', 'delete'].includes(action)) throw validationError({ action: 'Restore first' });
    const data = action === 'delete' ? { deletedAt: new Date() } : action === 'restore' ? { deletedAt: null }
      : enrollment ? { adminStatus: action, ...(action === 'cancelled' ? { status: 'cancelled' } : {}) } : { status: action };
    await db[enrollment ? 'enrollment' : 'order'].update({ where: { id }, data });
    res.json({ id, action });
  });
  // Сайтын курсын захиалга: админ шилжүүлгийг шалгаад "Төлөгдсөн" дарахад хичээл үзэх эрх 3 сараар үүснэ.
  router.get('/payment-notifications', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = database();
    const where = { status: 'pending_review', reportedAt: { not: null } };
    const [rows, count] = await Promise.all([
      db.courseOrder.findMany({ where, orderBy: { reportedAt: 'asc' }, take: 50 }),
      db.courseOrder.count({ where }),
    ]);
    const profiles = await db.profile.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, name: true, email: true } });
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    res.json({ count, orders: rows.map((row) => ({ id: row.id, amount: row.amount, currency: row.currency, reportedAt: row.reportedAt, user: byId.get(row.userId) ?? null })) });
  });
  router.get('/course-orders', async (req, res) => {
    const { toOrder } = await import('./checkout.js');
    const db = database();
    const rows = await db.courseOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    const profiles = await db.profile.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, name: true, email: true, phone: true } });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    res.json(rows.map((row) => ({ ...toOrder(row), userId: row.userId, user: byId.get(row.userId) ?? null,
      paidBy: row.paidBy, cancelledAt: row.cancelledAt?.toISOString() ?? null })));
  });
  router.post('/course-orders/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    if (!['paid', 'cancelled'].includes(action)) throw validationError({ action: 'Invalid action' });
    const { settleOrder } = await import('../services/courseAccess.js');
    const { toOrder } = await import('./checkout.js');
    const row = await database().$transaction(async (tx) => {
      const order = await tx.courseOrder.findUnique({ where: { id } });
      if (!order) throw notFound('Order');
      if (action === 'paid') {
        if (order.status === 'paid') return order;
        if (!['pending_payment', 'pending_review'].includes(order.status)) throw new HttpError(409, 'payment_not_ready', 'Only unpaid, priced orders can be marked paid');
        await settleOrder(tx, order, req.user.id);
      } else {
        if (order.status === 'cancelled') return order;
        if (order.kind === 'topup' && order.status === 'paid') throw new HttpError(409, 'topup_settled', 'A confirmed top-up cannot be cancelled');
        // Хэтэвчээр төлсөн захиалгыг цуцлахад мөнгө нь хэтэвчид буцна.
        if (order.status === 'paid' && order.method === 'wallet') {
          const { moveWallet } = await import('../services/wallet.js');
          await moveWallet(tx, { userId: order.userId, delta: order.amount, type: 'refund', orderId: id });
        }
        // Төлөгдсөн захиалгыг цуцлахад (буцаалт) хичээл үзэх эрх шууд хаагдана.
        await tx.courseAccess.updateMany({ where: { orderId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.courseOrder.update({ where: { id }, data: { status: 'cancelled', cancelledAt: new Date() } });
      }
      await tx.activity.create({ data: { id: newId('act'), actorId: req.user.id, action, type: 'course-orders',
        title: { mn: `Захиалга ${id}`, en: `Order ${id}` } } });
      return tx.courseOrder.findUnique({ where: { id } });
    });
    res.json(toOrder(row));
  });
  router.get('/:type', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = database();
    const rows = await db[modelName(req.params.type)].findMany({ orderBy: { createdAt: 'desc' } });
    res.json(req.params.type === 'courses' ? await withCartSettings(db, rows) : rows);
  });
  const save = async (req, res) => {
    const { type, id } = req.params;
    const model = modelName(type);
    const db = database();
    const item = await db.$transaction(async (tx) => {
      const current = id ? await tx[model].findUnique({ where: { id } }) : null;
      if (id && (!current || current.deletedAt)) throw notFound('Content');
      const data = toData(validateContent(type, { publication: 'draft', ...current, ...req.body }));
      const row = id ? await tx[model].update({ where: { id }, data: { ...data, managed: true } })
        : await tx[model].create({ data: { ...data, id: newId(model), managed: true } });
      if (type === 'courses') await saveCartSetting(tx, row.id, req.body.cartEnabled);
      await tx.activity.create({ data: { id: newId('act'), actorId: req.user.id, action: id ? 'update' : 'create', type, title: row.title } });
      return row;
    });
    res.status(id ? 200 : 201).json(item);
  };
  router.post('/:type', save);
  router.put('/:type/:id', save);
  router.post('/:type/:id/:action', async (req, res) => {
    const { type, id, action } = req.params;
    const model = modelName(type);
    if (!['published', 'draft', 'archived', 'delete', 'restore'].includes(action)) throw validationError({ action: 'Invalid action' });
    const row = await database().$transaction(async (tx) => {
      const current = await tx[model].findUnique({ where: { id } });
      if (!current) throw notFound('Content');
      if (current.deletedAt && !['delete', 'restore'].includes(action)) throw validationError({ action: 'Restore first' });
      const data = action === 'delete' ? { deletedAt: new Date() } : action === 'restore' ? { deletedAt: null } : { publication: action };
      validateContent(type, { ...current, ...data });
      const updated = await tx[model].update({ where: { id }, data });
      await tx.activity.create({ data: { id: newId('act'), actorId: req.user.id, action, type, title: updated.title } });
      return updated;
    });
    res.json(row);
  });
  return router;
}
