// Хэтэвч ба QPay: /orders/:id/{wallet,qpay,qpay/check}, /me/wallet, /me/wallet/topups, /qpay/callback.
// Эрх нээх, цэнэглэлтийг орлого болгох нь зөвхөн settleOrder-оор хийгдэнэ.
import { Router } from 'express';
import { database } from './admin.js';
import { toOrder } from './checkout.js';
import { HttpError, notFound, validationError } from '../errors.js';
import { hasActiveAccess, PAYABLE_STATUSES, settleOrder } from '../services/courseAccess.js';
import { createQPayClient, verifyOrderSignature } from '../services/qpay.js';
import { authMiddleware } from '../services/supabase.js';
import { moveWallet, walletSummary } from '../services/wallet.js';
import { newId } from '../store.js';
import { bankAccounts } from '../services/banks.js';

const TOPUP_MIN = 1_000;
const TOPUP_MAX = 5_000_000;
const MAX_OPEN_TOPUPS = 3;

function bankDetails(env) {
  const { BANK_NAME, BANK_ACCOUNT_NUMBER, BANK_ACCOUNT_NAME } = env;
  return BANK_NAME && BANK_ACCOUNT_NUMBER && BANK_ACCOUNT_NAME
    ? { bankName: BANK_NAME, accountNumber: BANK_ACCOUNT_NUMBER, accountName: BANK_ACCOUNT_NAME } : null;
}

async function ownOrder(req) {
  const order = await database().courseOrder.findUnique({ where: { id: req.params.id } });
  if (!order || order.userId !== req.user.id) throw notFound('Order');
  return order;
}

export function createWalletRouter({ limit, env = process.env, qpay = createQPayClient({ env }), ...options } = {}) {
  const router = Router();
  const auth = authMiddleware({ env, ...options });
  const limited = limit ?? ((req, res, next) => next());
  const notReady = () => new HttpError(409, 'payment_not_ready', 'Order cannot be paid');

  /** QPay-ээс шууд асууж, бүрэн төлөгдсөн бол захиалгыг хаана. Давтан дуудахад аюулгүй. */
  async function reconcile(order) {
    if (!order.qpayInvoiceId || !PAYABLE_STATUSES.includes(order.status)) return order;
    if (await qpay.paidAmount(order.qpayInvoiceId) < order.amount) return order;
    const db = database();
    await db.$transaction((tx) => settleOrder(tx, order, null, new Date(), 'qpay'));
    return db.courseOrder.findUnique({ where: { id: order.id } });
  }

  // QPay нэвтрэлтгүй дууддаг: гарын үсгийг шалгаад, төлбөрийг QPay-ээс өөрөө асууна.
  router.all('/qpay/callback', limited, async (req, res) => {
    const { order: orderId, sig } = req.query;
    if (!verifyOrderSignature(orderId, sig, env)) throw new HttpError(403, 'forbidden', 'Invalid signature');
    const order = await database().courseOrder.findUnique({ where: { id: orderId } });
    if (!order) throw notFound('Order');
    await reconcile(order);
    res.type('text/plain').send('SUCCESS');
  });

  router.post('/orders/:id/wallet', limited, auth, async (req, res) => {
    const order = await ownOrder(req);
    if (order.kind !== 'course' || order.status !== 'pending_payment') throw notReady();
    // Нээлттэй нэхэмжлэхийг хаахгүй бол нэг захиалгыг хоёр удаа төлөх боломжтой.
    if (order.qpayInvoiceId) {
      await qpay.cancelInvoice(order.qpayInvoiceId).catch(() => { throw new HttpError(409, 'qpay_in_progress', 'A QPay invoice is still open'); });
    }
    const db = database();
    await db.$transaction(async (tx) => {
      for (const { courseId } of order.items) {
        if (await hasActiveAccess(tx, order.userId, courseId)) throw new HttpError(409, 'already_owned', 'Course is already owned', { courseIds: courseId });
      }
      const now = new Date();
      if (!await settleOrder(tx, order, null, now, 'wallet')) throw notReady();
      await moveWallet(tx, { userId: order.userId, delta: -order.amount, type: 'purchase', orderId: order.id, now });
    }, { timeout: 15_000 });
    res.json(toOrder(await db.courseOrder.findUnique({ where: { id: order.id } }), env));
  });

  router.post('/orders/:id/qpay', limited, auth, async (req, res) => {
    const order = await ownOrder(req);
    if (order.status !== 'pending_payment') throw notReady();
    if (!qpay.available()) throw new HttpError(503, 'qpay_unavailable', 'QPay is currently unavailable');
    if (order.qpayInvoiceId) return res.json({ orderId: order.id, ...order.qpayInvoice });

    const { invoiceId, details } = await qpay.createInvoice(order);
    const saved = await database().courseOrder.updateMany({
      where: { id: order.id, status: 'pending_payment', qpayInvoiceId: null },
      data: { method: 'qpay', qpayInvoiceId: invoiceId, qpayInvoice: details },
    });
    if (!saved.count) {
      await qpay.cancelInvoice(invoiceId).catch(() => {});
      throw notReady();
    }
    res.status(201).json({ orderId: order.id, ...details });
  });

  router.post('/orders/:id/qpay/check', limited, auth, async (req, res) => {
    res.json(toOrder(await reconcile(await ownOrder(req)), env));
  });

  router.get('/me/wallet', auth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = database();
    const topups = await db.courseOrder.findMany({
      where: { userId: req.user.id, kind: 'topup', status: { in: PAYABLE_STATUSES } }, orderBy: { createdAt: 'desc' },
    });
    res.json({
      ...await walletSummary(db, req.user.id),
      limits: { min: TOPUP_MIN, max: TOPUP_MAX },
      bank: bankDetails(env),
      banks: bankAccounts(env),
      topups: topups.map((row) => toOrder(row, env)),
    });
  });

  router.post('/me/wallet/topups', limited, auth, async (req, res) => {
    const amount = req.body?.amount;
    if (!Number.isInteger(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
      throw validationError({ amount: `must be between ${TOPUP_MIN} and ${TOPUP_MAX}` });
    }
    const db = database();
    const open = await db.courseOrder.findMany({ where: { userId: req.user.id, kind: 'topup', status: { in: PAYABLE_STATUSES } } });
    const existing = open.find((order) => order.amount === amount);
    if (existing) return res.json(toOrder(existing, env));
    if (open.length >= MAX_OPEN_TOPUPS) throw new HttpError(409, 'too_many_topups', 'Finish or cancel your open top-ups first');
    const { syncProfile } = await import('./account.js');
    await syncProfile(req.user);
    const order = await db.courseOrder.create({ data: {
      id: newId('cord'), userId: req.user.id, kind: 'topup', items: [], amount, currency: 'MNT', status: 'pending_payment',
    } });
    res.status(201).json(toOrder(order, env));
  });

  return router;
}
