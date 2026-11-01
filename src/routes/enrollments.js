// POST /api/enrollments — docs/API.md §3. Шалгалтын дүрэм frontend-ийн src/api/enrollments.js-тэй ижил.
import { Router } from 'express';
import { HttpError, notFound, validationError } from '../errors.js';
import { findCourse, insertEnrollment, newId } from '../store.js';
import { authMiddleware } from '../services/supabase.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+0-9 ()-]{8,20}$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function createEnrollmentsRouter({ limit, env, verifyUser }) {
  const router = Router();
  router.post('/', limit, async (req, res, next) => {
    if (req.headers.authorization) return authMiddleware({ env, verifyUser })(req, res, next);
    next();
  }, async (req, res) => {
    const body = req.body ?? {};
    const input = { courseId: str(body.courseId), name: str(body.name), email: str(body.email), phone: str(body.phone) };

    const fields = {};
    if (!input.name || input.name.length > 100) fields.name = 'required, max 100 characters';
    if (!EMAIL.test(input.email) || input.email.length > 254) fields.email = 'invalid email';
    if (!PHONE.test(input.phone)) fields.phone = 'invalid phone';
    if (!input.courseId) fields.courseId = 'required';
    if (Object.keys(fields).length) throw validationError(fields);

    const course = await findCourse(input.courseId);
    if (!course) throw notFound('Course');
    if (course.status === 'planned') throw new HttpError(409, 'enrollment_closed', 'Enrollment is not open');

    // Давхар бүртгэлийг store шалгаж 409 already_enrolled шиднэ (устгаагүй бүртгэлийг тооцно).
    const record = await insertEnrollment({
      id: newId('enr'),
      courseId: course.id,
      userId: req.user?.id ?? null,
      name: input.name,
      email: req.user?.email ?? input.email,
      phone: input.phone,
      status: course.status === 'open' ? 'pending_payment' : 'waitlisted',
      createdAt: new Date().toISOString(),
    });
    // Хувийн мэдээллийг (нэр, и-мэйл, утас) хариунд буцаахгүй.
    const { id, courseId, status, createdAt } = record;
    res.status(201).json({ id, courseId, status, createdAt });
  });
  return router;
}
