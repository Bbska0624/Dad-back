import { Router } from 'express';
import { notFound } from '../errors.js';
import { withCartSettings } from '../services/courseCommerce.js';
import { getStore, findCourse, listCourses } from '../store.js';

export const coursesRouter = Router();

// GET /api/courses?category=Data
coursesRouter.get('/', async (req, res) => {
  const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
  res.set('Cache-Control', 'no-store');
  res.json(await withCartSettings(getStore().prisma, await listCourses({ category })));
});

// GET /api/courses/:id
coursesRouter.get('/:id', async (req, res) => {
  const course = await findCourse(req.params.id);
  if (!course) throw notFound('Course');
  res.set('Cache-Control', 'no-store');
  res.json((await withCartSettings(getStore().prisma, [course]))[0]);
});
