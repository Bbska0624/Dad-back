import { Router } from 'express';
import { notFound, validationError } from '../errors.js';
import { findNews, listNews } from '../store.js';

export const newsRouter = Router();

// GET /api/news?limit=3
newsRouter.get('/', (req, res) => {
  let limit;
  if (req.query.limit !== undefined && req.query.limit !== '') {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 0) throw validationError({ limit: 'must be a non-negative integer' });
  }
  res.json(listNews({ limit }));
});

// GET /api/news/:id
newsRouter.get('/:id', (req, res) => {
  const item = findNews(req.params.id);
  if (!item) throw notFound('News item');
  res.json(item);
});
