import { homeCourses } from '../data/courses';
import { courses, news } from './mock/db';
import { createContentStore, CONTENT_EVENT, CONTENT_KEY } from './mock/contentStore';

export { CONTENT_EVENT, CONTENT_KEY };
export const contentStore = createContentStore({ courses: courses.map((course) => ({ ...course, featured: homeCourses.some((item) => item.id === course.id), homePresentation: homeCourses.find((item) => item.id === course.id) })), news }, {
  storage: { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
  changed: () => window.dispatchEvent(new Event(CONTENT_EVENT)),
});
