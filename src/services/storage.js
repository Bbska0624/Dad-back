import { randomUUID } from 'node:crypto';
import { HttpError } from '../errors.js';

export async function uploadImage(dataUrl, env = process.env, fetchImpl = fetch) {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new HttpError(400, 'invalid_image', 'PNG, JPEG, WEBP or GIF required');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 1024 * 1024) throw new HttpError(400, 'invalid_image', 'Image must be at most 1 MB');
  const kind = match[1];
  const valid = kind === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : kind === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : kind === 'gif' ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
    : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  if (!valid) throw new HttpError(400, 'invalid_image', 'Image content does not match its type');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new HttpError(503, 'configuration_error', 'Image storage is not configured');
  const bucket = env.SUPABASE_STORAGE_BUCKET || 'site-images';
  const path = `uploads/${randomUUID()}.${kind === 'jpeg' ? 'jpg' : kind}`;
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  let response;
  try {
    response = await fetchImpl(`${base}/storage/v1/object/${bucket}/${path}`, { method: 'POST',
      headers: { apikey: key, ...(!key.startsWith('sb_secret_') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': `image/${kind}` }, body: bytes, signal: AbortSignal.timeout(20000) });
  } catch { throw new HttpError(502, 'storage_error', 'Image storage unavailable'); }
  if (!response.ok) throw new HttpError(502, 'storage_error', 'Could not upload image');
  return { src: `${base}/storage/v1/object/public/${bucket}/${path}` };
}
