// R2 дээрх өөрсдийн хичээлийн видео (src/data/videos.json). Файлын зам: courses/<courseId>/<lessonId>.mp4
// "preview" хичээлийг хэн ч үзнэ, бусад нь төлбөр батлагдсан (идэвхтэй эрхтэй) хэрэглэгчид л нээгдэнэ.
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../data/videos.json', import.meta.url), 'utf8'));

export const videoKey = (courseId, lessonId) => `courses/${courseId}/${lessonId}.mp4`;

const toLesson = (course, lesson) => ({
  id: lesson.id, mn: lesson.mn, en: lesson.en, duration: lesson.duration, video: true, preview: lesson.id === course.preview,
});

/** Курсын видео хичээлүүд (линкгүй), эсвэл видеогүй курс бол null. */
export function videoLessons(courseId) {
  const course = Object.hasOwn(catalog, courseId) ? catalog[courseId] : null;
  return course ? course.lessons.map((lesson) => toLesson(course, lesson)) : null;
}

export function findVideoLesson(courseId, lessonId) {
  return videoLessons(courseId)?.find((lesson) => lesson.id === lessonId) ?? null;
}

export function previewLesson(courseId) {
  return videoLessons(courseId)?.find((lesson) => lesson.preview) ?? null;
}
