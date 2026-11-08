// Cloudflare R2 (S3-compatible): private bucket-ийн файлд хугацаатай линк (presigned GET URL) үүсгэнэ.
// AWS Signature V4, гадны сан хэрэглэхгүй. Түлхүүрүүд зөвхөн серверт (.env / Vercel) хадгалагдана.
import { createHash, createHmac } from 'node:crypto';
import { HttpError } from '../errors.js';

const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
export const VIDEO_URL_TTL_SECONDS = 2 * 60 * 60; // 2 цаг

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
// RFC 3986: encodeURIComponent-оос гадна !'()* -ийг кодлоно.
const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Ерөнхий S3 presigned GET URL (тестэд AWS-ийн албан ёсны жишээгээр шалгагдсан). */
export function presignUrl({ host, path, region, accessKeyId, secretAccessKey, expiresIn, now = new Date() }) {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const canonicalPath = path.split('/').map(encode).join('/');
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = Object.keys(params).sort().map((key) => `${encode(key)}=${encode(params[key])}`).join('&');
  const canonicalRequest = ['GET', canonicalPath, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  let key = hmac(`AWS4${secretAccessKey}`, date);
  for (const part of [region, 's3', 'aws4_request']) key = hmac(key, part);
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');
  return `https://${host}${canonicalPath}?${query}&X-Amz-Signature=${signature}`;
}

export const r2Configured = (env = process.env) => REQUIRED.every((name) => env[name]?.trim());

/** R2 bucket доторх файлд {url, expiresAt}. Тохиргоо дутуу бол 503 video_unavailable. */
export function signedObjectUrl(objectKey, env = process.env, { expiresIn = VIDEO_URL_TTL_SECONDS, now = new Date() } = {}) {
  if (!r2Configured(env)) throw new HttpError(503, 'video_unavailable', 'Video storage is not configured');
  const url = presignUrl({
    host: `${env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
    path: `/${env.R2_BUCKET.trim()}/${objectKey}`,
    region: 'auto',
    accessKeyId: env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim(),
    expiresIn,
    now,
  });
  return { url, expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString() };
}
