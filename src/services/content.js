import { HttpError, validationError } from '../errors.js';

const text = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const localized = (v, max) => v && text(v.mn, max) && text(v.en, max);
export const visibleContent = { publication: 'published', deletedAt: null };
export function validateContent(type, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationError({ body: 'object required' });
  const fields = {};
  if (!localized(input.title, 250)) fields.title = 'Both languages required, max 250';
  if (!['published', 'draft', 'archived'].includes(input.publication)) fields.publication = 'Invalid publication';
  if (type === 'courses' && input.onlinePaymentEnabled !== undefined && typeof input.onlinePaymentEnabled !== 'boolean') fields.onlinePaymentEnabled = 'Boolean required';
  if (type === 'services') {
    if (!localized(input.text)) fields.text = 'Both languages required';
    if (!text(input.price, 150)) fields.price = 'Price range required, max 150';
    if (!Array.isArray(input.features) || input.features.length > 30 || input.features.some((v) => !localized(v, 500))) fields.features = 'Max 30 bilingual features';
    if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0) fields.sortOrder = 'Nonnegative integer required';
    if (!text(input.number, 30)) fields.number = 'Display number required';
  } else if (type === 'courses') {
    if (!['AI', 'Data', 'Code', 'Digital'].includes(input.category)) fields.category = 'Invalid category';
    if (!['open', 'waitlist', 'planned'].includes(input.status)) fields.status = 'Invalid enrollment status';
    if (!localized(input.description)) fields.description = 'Both languages required';
    if (input.price != null && (!Number.isSafeInteger(input.price) || input.price < 0 || input.price > 2147483647)) fields.price = 'Nonnegative 32-bit integer required';
    for (const key of ['duration', 'level']) {
      if (input[key] != null && (typeof input[key] !== 'object' || ['mn', 'en'].some((lang) => typeof input[key][lang] !== 'string' || input[key][lang].length > 250))) fields[key] = 'Localized text required, max 250';
    }
    if (input.featured != null && typeof input.featured !== 'boolean') fields.featured = 'Boolean required';
  } else {
    if (!localized(input.category, 250)) fields.category = 'Both languages required';
    if (!localized(input.summary)) fields.summary = 'Both languages required';
    if (input.publication === 'published' && !localized(input.body, 30000)) throw new HttpError(400, 'body_required', 'Story body required in both languages');
    if (input.publishedAt && !Number.isFinite(Date.parse(input.publishedAt))) fields.publishedAt = 'Invalid date';
  }
  if (input.gallery != null && (!Array.isArray(input.gallery) || input.gallery.length > 30)) fields.gallery = 'Max 30 images';
  for (const image of [input.image, input.coverImage, ...(Array.isArray(input.gallery) ? input.gallery : [])].filter(Boolean)) {
    if (typeof image !== 'object' || typeof image.src !== 'string' || !/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(image.src)) fields.image = 'Use an uploaded image or HTTP URL';
    if (image.srcSet && (typeof image.srcSet !== 'string' || image.srcSet.split(',').some((v) => !/^(https?:\/\/|\/(?!\/))/.test(v.trim())))) fields.image = 'Invalid srcSet';
  }
  if (Object.keys(fields).length) throw validationError(fields);
  const keys = type === 'services' ? ['number', 'title', 'text', 'price', 'features', 'image', 'sortOrder'] : type === 'courses'
    ? ['category', 'status', 'price', 'title', 'description', 'image', 'featured', 'duration', 'level']
    : ['number', 'category', 'title', 'summary', 'body', 'details', 'coverImage', 'gallery', 'publishedAt', 'isSample'];
  return Object.fromEntries([...keys, 'publication'].filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
}
