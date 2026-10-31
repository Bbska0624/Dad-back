import { Router } from 'express';
import { notFound } from '../errors.js';
import { findCourse, listCourses } from '../store.js';

export const coursesRouter = Router();

// GET /api/courses?category=Data
coursesRouter.get('/', async (req, res) => {
  const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
  res.json(await listCourses({ category }));
});

// GET /api/courses/:id
coursesRouter.get('/:id', async (req, res) => {
  const course = await findCourse(req.params.id);
  if (!course) throw notFound('Course');
  res.json(course);
});
