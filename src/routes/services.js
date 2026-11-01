import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { notFound } from '../errors.js';

const services = JSON.parse(readFileSync(new URL('../data/services.json', import.meta.url), 'utf8'));
export const servicesRouter = Router();

servicesRouter.get('/', (_req, res) => res.json(services));
servicesRouter.get('/:id', (req, res) => {
  const service = services.find((item) => item.id === req.params.id);
  if (!service) throw notFound('Service');
  res.json(service);
});
