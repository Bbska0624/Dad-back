import express from 'express';
import cors from 'cors';
import { coursesRouter } from './routes/courses.js';
import { newsRouter } from './routes/news.js';
import { createChatRouter } from './routes/chat.js';
import { createEnrollmentsRouter } from './routes/enrollments.js';
import { createPaymentsRouter } from './routes/payments.js';
import { rateLimit } from './middleware/rateLimit.js';
import { generateReply as geminiReply } from './services/gemini.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { initStore } from './store.js';

// CORS_ORIGINS="https://www.mci.mn,https://mci.mn" — таслалаар тусгаарлана. Хоосон бол dev хаягууд л зөвшөөрөгдөнө.
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];
const allowedOrigins = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',').map((o) => o.trim()).filter(Boolean);

/**
 * @param {object} [options]
 * @param {Function} [options.generateReply]  Чатын хариу үүсгэгч (тестэд солино)
 * @param {{ windowMs: number, max: number }} [options.chatLimit]
 * @param {{ windowMs: number, max: number }} [options.formLimit]  Бүртгэл, төлбөрийн хязгаар
 * @param {object} [options.env]  Тохиргоо (тестэд солино)
 */
export function createApp({ generateReply = geminiReply, chatLimit, formLimit, env = process.env } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Vercel-ийн proxy-ийн ард жинхэнэ IP-г авна
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '100kb' }));

  const limit = chatLimit ?? { windowMs: 60_000, max: Number(process.env.CHAT_RATE_LIMIT) || 10 };

  const api = express.Router();
  api.get('/health', (req, res) => res.json({ status: 'ok' }));
  // Анхны хүсэлтээр өгөгдлийн сангийн холболтыг бэлдэнэ (DATABASE_URL байвал Postgres, үгүй бол санах ой).
  api.use(async (req, res, next) => {
    await initStore();
    next();
  });
  api.use('/courses', coursesRouter);
  api.use('/news', newsRouter);
  api.use('/chat', createChatRouter({ generateReply, limit }));
  // Спамаас сэргийлэх: нэг IP-ээс минутад 20 бүртгэл/төлбөрийн хүсэлт
  const formLimiter = rateLimit(formLimit ?? { windowMs: 60_000, max: 20 });
  api.use('/enrollments', createEnrollmentsRouter({ limit: formLimiter }));
  api.use('/payments', createPaymentsRouter({ limit: formLimiter, env }));

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp();
