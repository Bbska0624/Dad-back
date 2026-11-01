import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { getStore } from '../store.js';
import { visibleContent } from '../services/content.js';
import { notFound } from '../errors.js';

const services = JSON.parse(readFileSync(new URL('../data/services.json', import.meta.url), 'utf8'));
export const servicesRouter = Router();

servicesRouter.get('/', async (_req, res) => {
  const db = getStore().prisma;
  res.json(db ? await db.service.findMany({ where: visibleContent, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }) : services);
});
servicesRouter.get('/:id', async (req, res) => {
  const db = getStore().prisma;
  const service = db ? await db.service.findFirst({ where: { id: req.params.id, ...visibleContent } }) : services.find((item) => item.id === req.params.id);
  if (!service) throw notFound('Service');
  res.json(service);
});
