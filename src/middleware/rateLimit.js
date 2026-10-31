// Энгийн санах ойн rate limit: нэг IP-ээс `windowMs` хугацаанд `max`-аас их хүсэлт ирвэл 429.
// Анхаар: Vercel дээр instance бүр тусдаа санах ойтой тул энэ нь яг нарийн хязгаар биш.
// Өгөгдлийн сан / Redis холбох үед илүү найдвартай болгоно.
import { HttpError } from '../errors.js';

export function rateLimit({ windowMs = 60_000, max = 10 } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, 'rate_limited', 'Too many requests'));
    }
    next();
  };
}
