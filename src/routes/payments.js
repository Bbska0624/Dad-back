// POST /api/payments, GET /api/payments/:id — docs/API.md §3.
// Одоогоор: банкны шилжүүлэг → дансны мэдээлэл (.env-ээс). QPay → instructions: null (7-р алхамд холбоно).
import { Router } from 'express';
import { HttpError, notFound, validationError } from '../errors.js';
import { findCourse, findEnrollment, findPayment, insertPayment, newId } from '../store.js';

function bankInstructions(reference, env) {
  const { BANK_NAME, BANK_ACCOUNT_NUMBER, BANK_ACCOUNT_NAME } = env;
  if (!BANK_NAME || !BANK_ACCOUNT_NUMBER || !BANK_ACCOUNT_NAME) return null; // тохируулаагүй бол mock-той адил null
  return { bankName: BANK_NAME, accountNumber: BANK_ACCOUNT_NUMBER, accountName: BANK_ACCOUNT_NAME, reference };
}

const publicPayment = ({ id, enrollmentId, method, status, amount, currency, instructions, createdAt }) => ({
  id, enrollmentId, method, status, amount, currency, instructions, createdAt,
});

export function createPaymentsRouter({ limit, env = process.env }) {
  const router = Router();

  router.post('/', limit, async (req, res) => {
    const { enrollmentId, method } = req.body ?? {};
    const fields = {};
    if (typeof enrollmentId !== 'string' || !enrollmentId) fields.enrollmentId = 'required';
    if (!['qpay', 'bank'].includes(method)) fields.method = 'must be qpay or bank';
    if (Object.keys(fields).length) throw validationError(fields);

    const enrollment = await findEnrollment(enrollmentId);
    if (!enrollment) throw notFound('Enrollment');
    if (enrollment.status !== 'pending_payment') {
      throw new HttpError(409, 'payment_not_required', 'This enrollment does not need payment');
    }
    // Дүнг үргэлж серверийн курсын үнээс авна (frontend-ээс биш).
    const course = await findCourse(enrollment.courseId);
    const payment = await insertPayment({
      id: newId('pay'),
      enrollmentId,
      method,
      status: 'pending',
      amount: course?.price ?? null,
      currency: 'MNT',
      instructions: method === 'bank' ? bankInstructions(enrollmentId, env) : null,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(publicPayment(payment));
  });

  router.get('/:id', async (req, res) => {
    const payment = await findPayment(req.params.id);
    if (!payment) throw notFound('Payment');
    res.json(publicPayment(payment));
  });

  return router;
}
