import { Router } from 'express';
import { validationError } from '../errors.js';
import { rateLimit } from '../middleware/rateLimit.js';

const MAX_MESSAGE = 500;
const MAX_HISTORY_CONTENT = 4000;

function validate(body) {
  const fields = {};
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > MAX_MESSAGE) fields.message = `required, max ${MAX_MESSAGE} characters`;
  const lang = body?.lang;
  if (!['mn', 'en'].includes(lang)) fields.lang = 'must be mn or en';
  const history = body?.history ?? [];
  const historyOk = Array.isArray(history) && history.every((h) =>
    h && ['user', 'assistant'].includes(h.role) && typeof h.content === 'string' && h.content.length <= MAX_HISTORY_CONTENT);
  if (!historyOk) fields.history = 'must be an array of { role: user|assistant, content }';
  if (Object.keys(fields).length) throw validationError(fields);
  // Frontend бүх түүхийг илгээдэг; гэрээний дагуу сүүлийн 10-ыг л ашиглана.
  return { message, lang, history: history.slice(-10) };
}

export function createChatRouter({ generateReply, limit }) {
  const router = Router();
  // POST /api/chat
  router.post('/', rateLimit(limit), async (req, res) => {
    const input = validate(req.body);
    res.json(await generateReply(input));
  });
  return router;
}
