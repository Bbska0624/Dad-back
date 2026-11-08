// Хичээлийн видео (Cloudflare R2, private bucket). Хариунд 2 цагийн хугацаатай линк буцаана.
//  GET /courses/:id/preview                              — нийтэд нээлттэй танилцуулга видео
//  GET /me/courses/:courseId/lessons/:lessonId/video     — нэвтэрсэн, төлбөр батлагдсан хэрэглэгчид
import { Router } from 'express';
import { HttpError, notFound } from '../errors.js';
import { findCourse } from '../store.js';
import { authMiddleware } from '../services/supabase.js';
import { hasActiveAccess } from '../services/courseAccess.js';
import { signedObjectUrl } from '../services/r2.js';
import { findVideoLesson, previewLesson, videoKey } from '../services/videos.js';
import { database } from './admin.js';

export function createVideosRouter({ limit, env = process.env, ...options } = {}) {
  const router = Router();
  const auth = authMiddleware({ env, ...options });
  const limited = limit ?? ((req, res, next) => next());

  router.get('/courses/:id/preview', limited, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!await findCourse(req.params.id)) throw notFound('Course');
    const lesson = previewLesson(req.params.id);
    if (!lesson) throw notFound('Preview');
    res.json({ courseId: req.params.id, lesson, ...signedObjectUrl(videoKey(req.params.id, lesson.id), env) });
  });

  router.get('/me/courses/:courseId/lessons/:lessonId/video', auth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { courseId, lessonId } = req.params;
    const lesson = findVideoLesson(courseId, lessonId);
    if (!lesson) throw notFound('Lesson');
    if (!lesson.preview && !await hasActiveAccess(database(), req.user.id, courseId)) {
      throw new HttpError(403, 'payment_required', 'Payment confirmation is required');
    }
    res.json({ courseId, lesson, ...signedObjectUrl(videoKey(courseId, lessonId), env) });
  });

  return router;
}
