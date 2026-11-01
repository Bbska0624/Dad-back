export const CONTENT_KEY = 'mc-managed-content-v1';
export const CONTENT_EVENT = 'mc-content-changed';
const clone = (value) => structuredClone(value);
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const localized = (value) => value && hasText(value.mn) && hasText(value.en);
export const safeImageUrl = (value) => !value || /^https?:\/\/[^\s]+$/i.test(value) || /^\/(?!\/)[^\s]*$/.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(value);

export function validateContent(type, item) {
  if (!['courses', 'news'].includes(type) || !item || !hasText(item.id) || !localized(item.title)) fail('validation_error');
  if (!['published', 'draft', 'archived'].includes(item.publication || 'published')) fail('validation_error');
  if (type === 'courses') {
    if (!['AI', 'Data', 'Code', 'Digital'].includes(item.category) || !['open', 'waitlist', 'planned'].includes(item.status) || !localized(item.description)) fail('validation_error');
    if (item.price !== null && item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0)) fail('validation_error');
  } else {
    if (!localized(item.category) || !localized(item.summary)) fail('validation_error');
    if (item.publication === 'published' && !localized(item.body)) fail('body_required');
    if (item.publishedAt && !Number.isFinite(Date.parse(item.publishedAt))) fail('validation_error');
  }
  const images = [item.image, item.coverImage, ...(item.gallery || [])].filter(Boolean);
  if (images.some((image) => !safeImageUrl(image.src))) fail('invalid_image');
  return item;
}

// A single document keeps mutations atomic and makes the previous version recoverable on failure.
export function createContentStore(seed, { storage, changed = () => {}, id = () => crypto.randomUUID(), now = () => new Date().toISOString() }) {
  const initial = () => ({ version: 1, courses: seed.courses.map((item) => ({ ...clone(item), publication: 'published' })), news: seed.news.map((item) => ({ ...clone(item), publication: 'published' })), activity: [] });
  function read() {
    const raw = storage.getItem(CONTENT_KEY);
    if (!raw) return initial();
    let value;
    try { value = JSON.parse(raw); } catch { return fail('corrupt_storage'); }
    if (value.version !== 1 || !Array.isArray(value.courses) || !Array.isArray(value.news) || !Array.isArray(value.activity)) fail('corrupt_storage');
    return value;
  }
  function commit(state, action, type, item) {
    const next = { ...state, activity: [{ id: id(), action, type, title: clone(item.title), at: now() }, ...state.activity].slice(0, 150) };
    try { storage.setItem(CONTENT_KEY, JSON.stringify(next)); } catch { fail('storage_error'); }
    changed();
    return clone(item);
  }
  return {
    list(type, { admin = false } = {}) {
      const rows = read()[type];
      if (!rows) fail('validation_error');
      return clone(admin ? rows : rows.filter((item) => !item.deletedAt && item.publication === 'published'));
    },
    save(type, changes, itemId) {
      const state = read();
      const current = itemId ? state[type]?.find((item) => item.id === itemId && !item.deletedAt) : null;
      if (itemId && !current) fail('not_found');
      const timestamp = now();
      const item = validateContent(type, { ...current, ...clone(changes), id: current?.id || id(), createdAt: current?.createdAt || timestamp, updatedAt: timestamp, deletedAt: null, managed: true });
      if (current) state[type] = state[type].map((row) => row.id === current.id ? item : row);
      else state[type].unshift(item);
      return commit(state, current ? 'update' : 'create', type, item);
    },
    change(type, itemId, action) {
      const state = read();
      const item = state[type]?.find((row) => row.id === itemId);
      if (!item) fail('not_found');
      if (action === 'delete') item.deletedAt = now();
      else if (action === 'restore') item.deletedAt = null;
      else if (['published', 'draft', 'archived'].includes(action) && !item.deletedAt) {
        item.publication = action;
        validateContent(type, item);
      } else fail('validation_error');
      item.updatedAt = now();
      return commit(state, action, type, item);
    },
    activity: () => clone(read().activity),
  };
}
