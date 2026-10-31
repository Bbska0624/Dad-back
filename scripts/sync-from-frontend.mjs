// Frontend-ийн mock өгөгдлийг (src/api/mock/db.js) JSON болгон src/data/ руу хуулна.
// Frontend-ийн файлуудыг зөвхөн уншина, юу ч өөрчлөхгүй.
// Ашиглах: node scripts/sync-from-frontend.mjs ../Dad
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const frontend = path.resolve(process.argv[2] ?? '../Dad');
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

const tmp = await mkdtemp(path.join(tmpdir(), 'mci-sync-'));
try {
  const db = await readFile(path.join(frontend, 'src/api/mock/db.js'), 'utf8');
  const images = await readFile(path.join(frontend, 'src/assets/siteImages.js'), 'utf8');
  // db.js нь client.js-ээс ApiError импортлодог (Vite-ийн import.meta.env ашигладаг тул Node-д ажиллахгүй) -> орлуулна.
  const patched = db
    .replace("from '../client'", "from './client-stub.mjs'")
    .replace("from '../../assets/siteImages'", "from './siteImages.mjs'");
  await writeFile(path.join(tmp, 'client-stub.mjs'), 'export class ApiError extends Error {}\n');
  await writeFile(path.join(tmp, 'siteImages.mjs'), images);
  await writeFile(path.join(tmp, 'db.mjs'), patched);
  const { courses, news } = await import(pathToFileURL(path.join(tmp, 'db.mjs')).href);
  await writeFile(path.join(outDir, 'courses.json'), JSON.stringify(courses, null, 2) + '\n');
  await writeFile(path.join(outDir, 'news.json'), JSON.stringify(news, null, 2) + '\n');
  // Чатботын системийн prompt (src/data/chat.js-д import байхгүй тул шууд уншина)
  const { chatSystemPrompt } = await import(pathToFileURL(path.join(frontend, 'src/data/chat.js')).href);
  await writeFile(path.join(outDir, 'chat-prompt.json'), JSON.stringify(chatSystemPrompt, null, 2) + '\n');
  console.log(`OK: ${courses.length} courses, ${news.length} news, chat prompt -> ${outDir}`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
