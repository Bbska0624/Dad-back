// Сайтын (mci.mn) нэвтрэлт: нууц үгийг Supabase Auth шалгана, токенууд HttpOnly cookie-д хадгалагдана.
// Хөтчийн JavaScript токеныг уншиж чадахгүй. Админ самбар Bearer токеноор ажилласаар байна.
import { HttpError } from '../errors.js';
import { originMatcher } from '../origins.js';
import { supabaseConfig, toUser, verifySupabaseUser } from './supabase.js';

export const ACCESS_COOKIE = 'mci_at';
export const REFRESH_COOKIE = 'mci_rt';
const REFRESH_MAX_AGE = 60 * 24 * 60 * 60; // 60 хоног, нэвтрэх бүрт сунгагдана

const unavailable = () => new HttpError(503, 'auth_unavailable', 'Authentication service unavailable');

/** Supabase Auth (GoTrue) REST API-тай харьцана. Тестэд өөр объектоор солино. */
export function createSupabaseAuth(env = process.env, fetchImpl = fetch) {
  async function call(path, { body, token, query = '' } = {}) {
    const { url, key } = supabaseConfig(env);
    let response;
    try {
      response = await fetchImpl(`${url}/auth/v1/${path}${query}`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(10000),
      });
    } catch { throw unavailable(); }
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    if (response.status >= 500) throw unavailable();
    const code = data.error_code || data.code || data.error;
    if (response.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
      throw new HttpError(429, code === 'over_email_send_rate_limit' ? 'email_rate_limited' : 'rate_limited', 'Too many requests');
    }
    throw Object.assign(new HttpError(response.status === 401 ? 401 : 400, 'auth_failed', 'Authentication failed'), { supabaseCode: code });
  }

  return {
    signUp: ({ email, password, name, redirectTo }) => call('signup', {
      body: { email, password, data: { name } },
      query: redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '',
    }),
    signIn: ({ email, password }) => call('token', { query: '?grant_type=password', body: { email, password } }),
    refresh: (refreshToken) => call('token', { query: '?grant_type=refresh_token', body: { refresh_token: refreshToken } }),
    verifyEmail: ({ tokenHash, type }) => call('verify', { body: { token_hash: tokenHash, type } }),
    signOut: (accessToken) => call('logout', { query: '?scope=local', token: accessToken }),
  };
}

export function readCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name || name in out) continue;
    try { out[name] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* буруу cookie-г үл тооно */ }
  }
  return out;
}

const secure = (env) => env.NODE_ENV === 'production' || Boolean(env.VERCEL);
function cookie(name, value, maxAge, env) {
  return [`${name}=${encodeURIComponent(value)}`, 'Path=/api', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax', ...(secure(env) ? ['Secure'] : [])].join('; ');
}

export function setSessionCookies(res, session, env = process.env) {
  if (!session?.access_token || !session.refresh_token) throw unavailable();
  const accessAge = Math.max(60, Math.min(Number(session.expires_in) || 3600, 24 * 3600));
  res.append('Set-Cookie', cookie(ACCESS_COOKIE, session.access_token, accessAge, env));
  res.append('Set-Cookie', cookie(REFRESH_COOKIE, session.refresh_token, REFRESH_MAX_AGE, env));
  res.set('Cache-Control', 'no-store');
}

export function clearSessionCookies(res, env = process.env) {
  res.append('Set-Cookie', cookie(ACCESS_COOKIE, '', 0, env));
  res.append('Set-Cookie', cookie(REFRESH_COOKIE, '', 0, env));
  res.set('Cache-Control', 'no-store');
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Cookie-тэй өөрчлөх хүсэлтийг зөвхөн зөвшөөрөгдсөн сайтаас хүлээн авна (CSRF хамгаалалт, SameSite=Lax-ийн нэмэлт). */
export function assertTrustedOrigin(req, env = process.env) {
  if (!UNSAFE.has(req.method)) return;
  const origin = req.headers.origin;
  if (origin && !originMatcher(env)(origin)) throw new HttpError(403, 'forbidden', 'Untrusted origin');
}

/**
 * Cookie-оос хэрэглэгчийг тодорхойлно. Access токены хугацаа дууссан бол refresh токеноор шинэчилж cookie-г дахин тавина.
 * Нэвтрээгүй бол null буцаана.
 */
export async function sessionUser(req, res, { env = process.env, verifyUser = verifySupabaseUser, auth } = {}) {
  const cookies = readCookies(req);
  const accessToken = cookies[ACCESS_COOKIE];
  const refreshToken = cookies[REFRESH_COOKIE];
  if (!accessToken && !refreshToken) return null;
  assertTrustedOrigin(req, env);
  if (accessToken) {
    try { return await verifyUser(accessToken, env); }
    catch (error) { if (error.status !== 401) throw error; }
  }
  if (!refreshToken) return null;
  let session;
  try { session = await (auth ?? createSupabaseAuth(env)).refresh(refreshToken); }
  catch (error) {
    if (error.status === 503) throw error;
    clearSessionCookies(res, env);
    return null;
  }
  setSessionCookies(res, session, env);
  return toUser(session.user);
}
