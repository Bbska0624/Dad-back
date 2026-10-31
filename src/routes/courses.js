import { Router } from 'express';
import { notFound } from '../errors.js';
import { findCourse, listCourses } from '../store.js';

export const coursesRouter = Router();

// GET /api/courses?category=Data
coursesRouter.get('/', (req, res) => {
  const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
  res.json(listCourses({ category }));
});

// GET /api/courses/:id
coursesRouter.get('/:id', (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) throw notFound('Course');
  res.json(course);
});
