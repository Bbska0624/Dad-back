// Сайтын нэвтрэлт (frontend docs/COURSE-CHECKOUT.md): /auth/register, /auth/login, /auth/me, /auth/logout, /auth/confirm
import { Router } from 'express';
import { HttpError, validationError } from '../errors.js';
import { syncProfile } from './account.js';
import { toUser } from '../services/supabase.js';
import {
  ACCESS_COOKIE, assertTrustedOrigin, clearSessionCookies, createSupabaseAuth, readCookies, sessionUser, setSessionCookies,
} from '../services/session.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicProfile = (profile) => ({ id: profile.id, name: profile.name, email: profile.email, role: profile.role });

function credentials(body = {}, { register = false } = {}) {
  const fields = {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!EMAIL.test(email) || email.length > 254) fields.email = 'Invalid email';
  if (register ? password.length < 8 || password.length > 128 : !password || password.length > 128) fields.password = 'Invalid password';
  if (register && (!name || name.length > 100)) fields.name = 'Invalid name';
  if (Object.keys(fields).length) throw validationError(fields);
  return { email, password, name };
}

// Имэйл баталгаажуулах линк: SITE_URL/api/auth/confirm (Supabase-ийн "Confirm signup" загварт тохируулна, SUPABASE.md).
const siteUrl = (env) => (env.SITE_URL || 'https://www.mci.mn').replace(/\/$/, '');

export function createAuthRouter({ env = process.env, verifyUser, auth, limit } = {}) {
  const router = Router();
  const client = () => auth ?? createSupabaseAuth(env);
  const noop = (req, res, next) => next();
  const limited = limit ?? noop;

  async function signedIn(res, session) {
    setSessionCookies(res, session, env);
    return publicProfile(await syncProfile(toUser(session.user)));
  }

  router.post('/register', limited, async (req, res) => {
    assertTrustedOrigin(req, env);
    const { email, password, name } = credentials(req.body, { register: true });
    let result;
    try { result = await client().signUp({ email, password, name, redirectTo: `${siteUrl(env)}/account` }); }
    catch (error) {
      if (error.supabaseCode === 'user_already_exists' || error.supabaseCode === 'email_exists') throw new HttpError(409, 'duplicate', 'Email is already registered');
      if (error.supabaseCode === 'weak_password') throw validationError({ password: 'Password is too weak' });
      if (error.supabaseCode === 'email_address_invalid') throw validationError({ email: 'Invalid email' });
      throw error;
    }
    // Имэйл баталгаажуулалт асаалттай үед Supabase session буцаахгүй.
    if (result.access_token) return res.status(201).json(await signedIn(res, result));
    const user = result.user ?? result;
    // Аль хэдийн баталгаажсан имэйл бол Supabase хоосон identities-тэй хуурамч хэрэглэгч буцаана.
    if (Array.isArray(user.identities) && user.identities.length === 0) throw new HttpError(409, 'duplicate', 'Email is already registered');
    res.status(202).json({ confirmationRequired: true, email });
  });

  router.post('/login', limited, async (req, res) => {
    assertTrustedOrigin(req, env);
    const { email, password } = credentials(req.body);
    let session;
    try { session = await client().signIn({ email, password }); }
    catch (error) {
      if (error.supabaseCode === 'email_not_confirmed') throw new HttpError(403, 'email_not_confirmed', 'Please confirm your email first');
      if (error.code === 'auth_failed') throw new HttpError(401, 'invalid_credentials', 'Incorrect email or password');
      throw error;
    }
    res.json(await signedIn(res, session));
  });

  router.get('/me', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const user = await sessionUser(req, res, { env, verifyUser, auth });
    // Session discovery is public: being signed out is a normal result.
    if (!user) return res.json(null);
    res.json(publicProfile(await syncProfile(user)));
  });

  router.post('/logout', async (req, res) => {
    assertTrustedOrigin(req, env);
    const token = readCookies(req)[ACCESS_COOKIE];
    if (token) await client().signOut(token).catch(() => {}); // токен аль хэдийн хүчингүй байж болно
    clearSessionCookies(res, env);
    res.status(204).end();
  });

  // Имэйл дэх линк: /api/auth/confirm?token_hash=...&type=email → баталгаажуулж, нэвтрүүлээд /account руу шилжүүлнэ.
  router.get('/confirm', limited, async (req, res) => {
    const tokenHash = typeof req.query.token_hash === 'string' ? req.query.token_hash : '';
    const type = ['email', 'signup'].includes(req.query.type) ? req.query.type : 'email';
    res.set('Cache-Control', 'no-store');
    if (!tokenHash || tokenHash.length > 500) return res.redirect(303, '/login?confirm=failed');
    try {
      await signedIn(res, await client().verifyEmail({ tokenHash, type }));
    } catch (error) {
      if (error.status === 503) throw error;
      return res.redirect(303, '/login?confirm=failed');
    }
    res.redirect(303, '/account?confirmed=1');
  });

  return router;
}
