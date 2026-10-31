// Imports initial website content and media without overwriting admin edits.
import '../src/env.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Prisma } from '@prisma/client';
import { createPrismaStore } from '../src/store/prisma.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = path.join(root, 'mci-web');
const { homeCourses } = await import(pathToFileURL(path.join(frontend, 'src/data/courses.js')));
const load = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key || !process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL, SUPABASE_URL and SUPABASE_SECRET_KEY first');
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'site-images';
const headers = { apikey: key, ...(!key.startsWith('sb_secret_') ? { Authorization: `Bearer ${key}` } : {}) };
const bucketResult = await fetch(`${base}/storage/v1/bucket/${bucket}`, { headers });
const bucketInfo = await bucketResult.json();
if (bucketResult.status === 404 || String(bucketInfo.statusCode) === '404') {
  const created = await fetch(`${base}/storage/v1/bucket`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 10 * 1024 * 1024, allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'] }) });
  if (!created.ok) throw new Error(`Create storage bucket failed (${created.status})`);
} else if (!bucketResult.ok) throw new Error(`Read storage bucket failed (${bucketResult.status})`);
else if (!bucketInfo.public) throw new Error('Existing bucket is private; choose a separate public site-images bucket');
const uploaded = new Map();
async function asset(src) {
  if (!src.startsWith('/assets/')) return src;
  if (uploaded.has(src)) return uploaded.get(src);
  const file = path.resolve(frontend, 'public', '.' + src);
  if (!file.startsWith(path.resolve(frontend, 'public') + path.sep)) throw new Error('Invalid asset path');
  const bytes = await readFile(file);
  const ext = path.extname(file).toLowerCase();
  const contentType = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' }[ext];
  if (!contentType) throw new Error('Unsupported asset type');
  const object = 'seed/' + src.slice('/assets/'.length);
  const result = await fetch(`${base}/storage/v1/object/${bucket}/${object}`, { method: 'POST', headers: { ...headers, 'Content-Type': contentType, 'x-upsert': 'false' }, body: bytes });
  if (!result.ok) {
    const error = await result.json();
    if (error.error !== 'Duplicate' && String(error.statusCode) !== '409') throw new Error(`Asset upload failed (${result.status}): ${src}`);
  }
  const url = `${base}/storage/v1/object/public/${bucket}/${object}`;
  uploaded.set(src, url); return url;
}
async function media(value) {
  if (Array.isArray(value)) return Promise.all(value.map(media));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const output = {};
  for (const [key, data] of Object.entries(value)) {
    output[key] = key === 'src' && typeof data === 'string' ? await asset(data)
      : key === 'srcSet' && typeof data === 'string' ? (await Promise.all(data.split(',').map(async (entry) => { const [url, size] = entry.trim().split(/\s+/); return [await asset(url), size].filter(Boolean).join(' '); }))).join(', ')
      : await media(data);
  }
  return output;
}
const store = createPrismaStore();
try {
  for (const course of await load('courses')) {
    const existing = await store.prisma.course.findUnique({ where: { id: course.id } });
    if (existing?.managed) continue;
    const home = homeCourses.find((item) => item.id === course.id);
    const row = await media({ ...(existing || course), featured: existing?.featured || Boolean(home), ...(home ? { homePresentation: existing?.homePresentation || home } : {}) });
    for (const key of ['image', 'homePresentation', 'duration', 'level']) if (row[key] === null) row[key] = Prisma.DbNull;
    await store.prisma.course.upsert({ where: { id: row.id }, create: row, update: row });
  }
  for (const news of await load('news')) {
    const existing = await store.prisma.news.findUnique({ where: { id: news.id } });
    if (existing?.managed) continue;
    const row = await media(existing || news);
    for (const key of ['body', 'details', 'coverImage', 'gallery']) if (row[key] === null) row[key] = Prisma.DbNull;
    const data = { ...row, publishedAt: row.publishedAt ? new Date(row.publishedAt) : null };
    await store.prisma.news.upsert({ where: { id: row.id }, create: data, update: data });
  }
  console.log(`Imported initial content; ${uploaded.size} images stored in Supabase Storage. Admin-managed rows preserved; initial asset references migrated.`);
} finally { await store.close(); }
