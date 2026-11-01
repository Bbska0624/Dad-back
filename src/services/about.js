import { readFileSync } from 'node:fs';
import { validationError } from '../errors.js';

export const defaultAbout = JSON.parse(readFileSync(new URL('../data/about.json', import.meta.url), 'utf8'));
export async function readAbout(db) {
  return (db ? await db.siteSection.findUnique({ where: { id: 'about' } }) : null)?.content ?? defaultAbout;
}
export function validateAbout(input) {
  const fields = {};
  const localized = (v, max = 10000) => v && ['mn', 'en'].every((lang) => typeof v[lang] === 'string' && v[lang].trim() && v[lang].length <= max);
  const list = (v, max, valid) => Array.isArray(v) && v.length <= max && v.every(valid);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationError({ body: 'Object required' });
  if (typeof input.visible !== 'boolean') fields.visible = 'Boolean required';
  for (const key of ['heading', 'name', 'role', 'bio']) if (!localized(input[key])) fields[key] = 'Both languages required, max 10000 characters';
  const photo = input.photo;
  if (!photo || typeof photo.src !== 'string' || photo.src.length > 2000 || !/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(photo.src) || !['width', 'height'].every((key) => Number.isInteger(photo[key]) && photo[key] > 0 && photo[key] <= 10000)) fields.photo = 'Valid image URL and dimensions required';
  if (!list(input.languages, 30, (v) => localized(v, 250))) fields.languages = 'Max 30 bilingual languages';
  if (!list(input.stats, 12, (v) => v && typeof v.value === 'string' && v.value.trim().length > 0 && v.value.length <= 100 && localized(v.label, 250))) fields.stats = 'Max 12 nonempty statistics with bilingual labels';
  if (!list(input.facts, 12, (v) => v && localized(v.title, 250) && list(v.items, 30, (item) => localized(item)))) fields.facts = 'Max 12 groups with 30 bilingual items each';
  if (Object.keys(fields).length) throw validationError(fields);
  return Object.fromEntries(['visible', 'heading', 'name', 'role', 'bio', 'photo', 'languages', 'stats', 'facts'].map((key) => [key, input[key]]));
}
