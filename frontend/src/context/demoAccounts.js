// Browser-only demo accounts. This is not server-side authentication.
export const normalizeEmail = (email) => email.trim().toLowerCase();
export const publicProfile = ({ id, name, email, role }) => ({ id, name, email, role });

export function validateRegistration({ name, email, password }, accounts) {
  if (!name.trim() || name.trim().length > 100) return 'name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)) || email.length > 254) return 'email';
  if (password.length < 8 || password.length > 128) return 'password';
  if (accounts.some((account) => account.email === normalizeEmail(email))) return 'duplicate';
  return null;
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createDemoAccount({ name, email, password }) {
  const salt = crypto.randomUUID();
  return { id: crypto.randomUUID(), name: name.trim(), email: normalizeEmail(email), role: 'user', salt, passwordHash: await passwordHash(password, salt) };
}

export async function matchesPassword(account, password) {
  return account.passwordHash === await passwordHash(password, account.salt);
}

export function registeredAccounts(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((account) => account && typeof account.id === 'string' && !['admin', 'student'].includes(account.id) &&
    typeof account.name === 'string' && typeof account.email === 'string' && typeof account.salt === 'string' &&
    /^[a-f0-9]{64}$/.test(account.passwordHash)).map((account) => ({ ...account, role: 'user' }));
}
