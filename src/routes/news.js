import { Router } from 'express';
import { notFound, validationError } from '../errors.js';
import { findNews, listNews } from '../store.js';

export const newsRouter = Router();

// GET /api/news?limit=3
newsRouter.get('/', async (req, res) => {
  let limit;
  if (req.query.limit !== undefined && req.query.limit !== '') {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 0) throw validationError({ limit: 'must be a non-negative integer' });
  }
  res.json(await listNews({ limit }));
});

// GET /api/news/:id
newsRouter.get('/:id', async (req, res) => {
  const item = await findNews(req.params.id);
  if (!item) throw notFound('News item');
  res.json(item);
});
