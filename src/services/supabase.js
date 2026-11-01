import { HttpError } from '../errors.js';

export function supabaseConfig(env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(503, 'configuration_error', 'Supabase is not configured');
  return { url, key };
}

export async function verifySupabaseUser(token, env = process.env, fetchImpl = fetch) {
  const { url, key } = supabaseConfig(env);
  let response;
  try {
    response = await fetchImpl(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
    });
  } catch { throw new HttpError(503, 'auth_unavailable', 'Authentication service unavailable'); }
  if (response.status >= 500) throw new HttpError(503, 'auth_unavailable', 'Authentication service unavailable');
  if (!response.ok) throw new HttpError(401, 'unauthorized', 'Please log in again');
  return toUser(await response.json());
}

/** Supabase-ийн хэрэглэгчийг манай хэлбэрт оруулна. Эрхийг зөвхөн app_metadata-аас (хэрэглэгч засах боломжгүй) уншина. */
export function toUser(account) {
  if (!account?.id || !account.email) throw new HttpError(401, 'unauthorized', 'Invalid account');
  return { id: account.id, email: account.email.toLowerCase(), name: typeof account.user_metadata?.name === 'string' && account.user_metadata.name.trim() ? account.user_metadata.name : account.email,
    role: account.app_metadata?.role === 'admin' ? 'admin' : 'user' };
}

// Админ самбар: Authorization: Bearer <token>. Сайт (mci.mn): HttpOnly cookie (src/services/session.js).
export function authMiddleware({ env = process.env, verifyUser = verifySupabaseUser, auth } = {}) {
  return async (req, res, next) => {
    const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
    if (token) req.user = await verifyUser(token, env);
    else {
      const { sessionUser } = await import('./session.js');
      req.user = await sessionUser(req, res, { env, verifyUser, auth });
    }
    if (!req.user) throw new HttpError(401, 'unauthorized', 'Login required');
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'forbidden', 'Administrator access required');
  next();
}
