import '../src/env.js';
import { createPrismaStore } from '../src/store/prisma.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: node scripts/set-admin.mjs admin@example.com');
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.env.SUPABASE_URL;
if (!base || !key) throw new Error('Configure server Supabase credentials first');
const headers = { apikey: key, ...(!key.startsWith('sb_secret_') ? { Authorization: `Bearer ${key}` } : {}) };
let account;
for (let page = 1; ; page++) {
  const response = await fetch(`${base}/auth/v1/admin/users?page=${page}&per_page=100`, { headers });
  if (!response.ok) throw new Error(`Could not read Auth users (${response.status})`);
  const { users } = await response.json();
  account = users.find((user) => user.email?.toLowerCase() === email);
  if (account || users.length < 100) break;
}
if (!account) { console.log('ACCOUNT_NOT_REGISTERED: Register on the website and confirm your email first.'); process.exit(2); }
if (!account.email_confirmed_at) { console.log('EMAIL_NOT_CONFIRMED: Open the confirmation link in your email.'); process.exit(2); }
const result = await fetch(`${base}/auth/v1/admin/users/${account.id}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ app_metadata: { ...account.app_metadata, role: 'admin' } }) });
if (!result.ok) throw new Error(`Could not assign admin role (${result.status})`);
const store = createPrismaStore();
try {
  await store.prisma.profile.upsert({ where: { id: account.id }, create: { id: account.id, email, name: account.user_metadata?.name || email, role: 'admin' }, update: { role: 'admin' } });
  console.log('Admin role assigned. Log in again to use the dashboard.');
} finally { await store.close(); }
