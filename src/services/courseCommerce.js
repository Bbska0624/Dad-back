// Use the existing site_sections table: no schema migration or course data rewrite.
export function defaultCartEnabled(course) {
  return course?.id === 'python-programming' || course?.title?.mn?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('mn') === 'компьютер зохион байгуулалт, архитектур';
}

const key = (id) => `course-commerce:${id}`;
export async function withCartSettings(db, courses) {
  const settings = db ? await db.siteSection.findMany({ where: { id: { in: courses.map((course) => key(course.id)) } } }) : [];
  const byId = new Map(settings.map((setting) => [setting.id, setting.content]));
  return courses.map((course) => ({ ...course, cartEnabled: true, onlinePaymentEnabled: typeof byId.get(key(course.id))?.onlinePaymentEnabled === 'boolean'
    ? byId.get(key(course.id)).onlinePaymentEnabled : defaultCartEnabled(course) }));
}

export async function saveCartSetting(db, courseId, cartEnabled) {
  if (typeof cartEnabled !== 'boolean') return;
  const content = { onlinePaymentEnabled: cartEnabled };
  await db.siteSection.upsert({ where: { id: key(courseId) }, create: { id: key(courseId), content }, update: { content } });
}
