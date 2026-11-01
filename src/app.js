import express from 'express';
import cors from 'cors';
import { coursesRouter } from './routes/courses.js';
import { servicesRouter } from './routes/services.js';
import { newsRouter } from './routes/news.js';
import { createChatRouter } from './routes/chat.js';
import { createEnrollmentsRouter } from './routes/enrollments.js';
import { createPaymentsRouter } from './routes/payments.js';
import { rateLimit } from './middleware/rateLimit.js';
import { generateReply as geminiReply } from './services/gemini.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { initStore } from './store.js';
import { createAdminRouter } from './routes/admin.js';
import { createAccountRouter } from './routes/account.js';
import { createAuthRouter } from './routes/auth.js';
import { createCheckoutRouter } from './routes/checkout.js';
import { createWalletRouter } from './routes/wallet.js';
import { originMatcher } from './origins.js';

function buildOriginCheck(env) {
  const isAllowed = originMatcher(env);
  return (origin, callback) => callback(null, isAllowed(origin));
}

/**
 * @param {object} [options]
 * @param {Function} [options.generateReply]  Чатын хариу үүсгэгч (тестэд солино)
 * @param {{ windowMs: number, max: number }} [options.chatLimit]
 * @param {{ windowMs: number, max: number }} [options.formLimit]  Бүртгэл, төлбөрийн хязгаар
 * @param {object} [options.env]  Тохиргоо (тестэд солино)
 * @param {Function} [options.verifyUser]  Supabase токен шалгагч (тестэд солино)
 * @param {object} [options.auth]  Supabase Auth клиент (тестэд солино), src/services/session.js
 * @param {{ windowMs: number, max: number }} [options.authLimit]  Нэвтрэх/бүртгүүлэх хязгаар
 * @param {object} [options.qpay]  QPay клиент (тестэд солино)
 */
export function createApp({ generateReply = geminiReply, chatLimit, formLimit, env = process.env, verifyUser, auth, authLimit, qpay } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Vercel-ийн proxy-ийн ард жинхэнэ IP-г авна
  app.use(cors({ origin: buildOriginCheck(env) }));
  app.use(express.json({ limit: '2mb' }));

  const limit = chatLimit ?? { windowMs: 60_000, max: Number(process.env.CHAT_RATE_LIMIT) || 10 };

  const api = express.Router();
  api.get('/health', (req, res) => res.json({ status: 'ok' }));
  // Анхны хүсэлтээр өгөгдлийн сангийн холболтыг бэлдэнэ (DATABASE_URL байвал Postgres, үгүй бол санах ой).
  api.use(async (req, res, next) => {
    await initStore(env);
    next();
  });
  api.use('/services', servicesRouter);
  api.use('/courses', coursesRouter);
  api.use('/news', newsRouter);
  const session = { env, verifyUser, auth };
  api.use('/auth', createAuthRouter({ ...session, limit: rateLimit(authLimit ?? { windowMs: 60_000, max: 10 }) }));
  api.use('/admin', createAdminRouter(session));
  api.use('/account', createAccountRouter(session));
  api.use('/chat', createChatRouter({ generateReply, limit }));
  // Спамаас сэргийлэх: нэг IP-ээс минутад 20 бүртгэл/төлбөрийн хүсэлт
  const formLimiter = rateLimit(formLimit ?? { windowMs: 60_000, max: 20 });
  api.use('/enrollments', createEnrollmentsRouter({ limit: formLimiter, env, verifyUser }));
  api.use('/payments', createPaymentsRouter({ limit: formLimiter, env }));
  // Сайтын сагс, захиалга, хичээл үзэх эрх: /orders, /me/orders, /me/courses
  api.use(createCheckoutRouter({ ...session, limit: formLimiter }));
  api.use(createWalletRouter({ ...session, limit: formLimiter, qpay }));

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp();
