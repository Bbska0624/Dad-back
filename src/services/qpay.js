// QPay Merchant API v2. Гэрээ хийж QPAY_* түлхүүр авсны дараа идэвхжинэ.
// Анхаар: замууд, хариуны талбаруудыг QPay-ийн албан ёсны баримт бичиг, sandbox дээр баталгаажуулна.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../errors.js';

const REQUIRED = ['QPAY_USERNAME', 'QPAY_PASSWORD', 'QPAY_INVOICE_CODE', 'QPAY_CALLBACK_URL', 'QPAY_CALLBACK_SECRET'];
const TOKEN_TTL_MS = 10 * 60 * 1000;

export const qpayConfigured = (env) => REQUIRED.every((key) => env[key]?.trim());

const unavailable = () => new HttpError(503, 'qpay_unavailable', 'QPay is currently unavailable');

// callback нь нэвтрэлтгүй ирдэг тул URL-д захиалгын HMAC гарын үсэг тавина.
export function signOrder(orderId, env) {
  return createHmac('sha256', env.QPAY_CALLBACK_SECRET).update(orderId).digest('hex');
}

export function verifyOrderSignature(orderId, signature, env) {
  if (!qpayConfigured(env) || typeof orderId !== 'string' || typeof signature !== 'string') return false;
  const expected = Buffer.from(signOrder(orderId, env));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createQPayClient({ env = process.env, fetch: request = globalThis.fetch } = {}) {
  const base = () => (env.QPAY_BASE_URL?.trim() || 'https://merchant.qpay.mn').replace(/\/$/, '');
  let token = null;
  let tokenExpiresAt = 0;

  async function authenticate() {
    if (token && Date.now() < tokenExpiresAt) return token;
    const basic = Buffer.from(`${env.QPAY_USERNAME}:${env.QPAY_PASSWORD}`).toString('base64');
    const response = await request(`${base()}/v2/auth/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
    if (!response.ok) throw unavailable();
    const data = await response.json();
    if (!data.access_token) throw unavailable();
    token = data.access_token;
    tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    return token;
  }

  async function call(path, { method = 'POST', body } = {}, retry = true) {
    if (!qpayConfigured(env)) throw unavailable();
    const response = await request(`${base()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await authenticate()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401 && retry) {
      token = null;
      return call(path, { method, body }, false);
    }
    if (!response.ok) throw unavailable();
    return response.status === 204 ? null : response.json();
  }

  return {
    available: () => qpayConfigured(env),

    async createInvoice(order) {
      const callback = new URL(env.QPAY_CALLBACK_URL);
      callback.searchParams.set('order', order.id);
      callback.searchParams.set('sig', signOrder(order.id, env));
      const data = await call('/v2/invoice', { body: {
        invoice_code: env.QPAY_INVOICE_CODE,
        sender_invoice_no: order.id,
        invoice_receiver_code: order.userId,
        invoice_description: `Magic Code AI ${order.id}`,
        amount: order.amount,
        callback_url: callback.toString(),
      } });
      if (!data?.invoice_id) throw unavailable();
      return {
        invoiceId: data.invoice_id,
        details: {
          qrText: data.qr_text ?? null,
          qrImage: data.qr_image ? `data:image/png;base64,${data.qr_image}` : null,
          shortUrl: data.qPay_shortUrl ?? null,
          urls: Array.isArray(data.urls) ? data.urls.map(({ name, logo, link }) => ({ name, logo, link })) : [],
        },
      };
    },

    /** QPay дээр төлөгдсөн нийт дүн. callback-ийн агуулгад биш, үүнд итгэнэ. */
    async paidAmount(invoiceId) {
      const data = await call('/v2/payment/check', { body: { object_type: 'INVOICE', object_id: invoiceId, offset: { page_number: 1, page_limit: 100 } } });
      return (data?.rows || [])
        .filter((row) => row.payment_status === 'PAID')
        .reduce((sum, row) => sum + Number(row.payment_amount || 0), 0);
    },

    async cancelInvoice(invoiceId) {
      await call(`/v2/invoice/${encodeURIComponent(invoiceId)}`, { method: 'DELETE' });
    },
  };
}
