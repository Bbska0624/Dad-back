import { Router } from 'express';
import { database } from './admin.js';
import { authMiddleware } from '../services/supabase.js';
import { validationError } from '../errors.js';
import { newId } from '../store.js';

export function profileData(input = {}) {
  const data = {};
  for (const [key, max] of [['name', 100], ['phone', 100], ['goal', 300]]) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'string' || input[key].length > max || (key === 'name' && !input[key].trim())) throw validationError({ [key]: `Invalid ${key}` });
      data[key] = input[key].trim();
    }
  }
  return data;
}

export async function syncProfile(user) {
  return database().profile.upsert({ where: { id: user.id },
    create: { id: user.id, email: user.email, name: user.name.slice(0, 100), role: user.role },
    update: { email: user.email, role: user.role },
  });
}

export async function listRecords(db, user) {
  const profiles = await db.profile.findMany({ select: { id: true, email: true } });
  const byEmail = new Map(profiles.map((p) => [p.email.toLowerCase(), p.id]));
  const enrollments = await db.enrollment.findMany({ where: user ? { OR: [{ userId: user.id }, { emailNormalized: user.email }] } : undefined, include: { course: true }, orderBy: { createdAt: 'desc' } });
  const orders = await db.order.findMany({ where: user ? { userId: user.id } : undefined, orderBy: { createdAt: 'desc' } });
  return [...enrollments.map((row) => ({ id: row.id, type: 'course', userId: row.userId || byEmail.get(row.emailNormalized) || `guest:${row.emailNormalized}`,
    name: row.name, email: row.email, phone: row.phone, items: [row.course.title.mn], courseId: row.courseId,
    status: row.adminStatus, enrollmentStatus: row.status, createdAt: row.createdAt, deletedAt: row.deletedAt })),
  ...orders.map((row) => ({ ...row, type: 'order' }))].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createAccountRouter(options = {}) {
  const router = Router();
  router.use(authMiddleware(options));
  router.get('/me', async (req, res) => res.json(await syncProfile(req.user)));
  router.put('/me', async (req, res) => {
    await syncProfile(req.user);
    res.json(await database().profile.update({ where: { id: req.user.id }, data: profileData(req.body) }));
  });
  router.get('/records', async (req, res) => res.json(await listRecords(database(), req.user)));
  router.post('/records', async (req, res) => {
    // Course enrollments use /enrollments so pricing and eligibility are validated there.
    const { type, items } = req.body || {};
    if (type !== 'order' || !Array.isArray(items) || !items.length || items.length > 100 || items.some((v) => typeof v !== 'string' || !v.trim() || v.length > 250)) throw validationError({ items: 'Invalid order' });
    await syncProfile(req.user);
    const row = await database().order.create({ data: { id: newId('ord'), userId: req.user.id, items } });
    res.status(201).json({ ...row, type: 'order' });
  });
  return router;
}
