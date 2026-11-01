import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_KEY, createContentStore, safeImageUrl } from './contentStore.js';
import { createRecordStore, RECORDS_KEY } from './recordStore.js';
import { csvText } from '../../pages/Account/adminTools.js';

const pair = (value) => ({ mn: value, en: value });
const seed = { courses: [{ id: 'existing', title: pair('Existing course'), description: pair('Description'), category: 'Code', status: 'open', price: 0 }], news: [] };
const course = { title: pair('New course'), description: pair('Description'), category: 'Data', status: 'waitlist', price: null, publication: 'draft', featured: true };
function setup() {
  const values = new Map(); let counter = 0; let changes = 0;
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const options = { storage, changed: () => changes++, id: () => `id-${++counter}`, now: () => '2026-10-31T09:00:00.000Z' };
  return { values, storage, options, store: createContentStore(seed, options), changes: () => changes };
}

test('draft, edit, publish, archive, trash and restore persist across reloads without changing seed data', () => {
  const { store, options, changes } = setup();
  const created = store.save('courses', course);
  assert.equal(store.list('courses').length, 1);
  assert.equal(store.list('courses', { admin: true }).length, 2);
  store.save('courses', { ...course, title: pair('Edited'), price: 125000 }, created.id);
  store.change('courses', created.id, 'published');
  const reloaded = createContentStore(seed, options);
  assert.equal(reloaded.list('courses')[0].title.mn, 'Edited');
  assert.equal(reloaded.list('courses')[0].price, 125000);
  store.change('courses', created.id, 'archived');
  assert.equal(store.list('courses').length, 1);
  store.change('courses', created.id, 'published');
  store.change('courses', created.id, 'delete');
  assert.equal(store.list('courses').length, 1);
  assert.ok(store.list('courses', { admin: true })[0].deletedAt);
  store.change('courses', created.id, 'restore');
  assert.equal(store.list('courses').length, 2);
  assert.equal(store.activity().length, 7);
  assert.equal(changes(), 7);
  assert.equal(seed.courses.length, 1);
  const exported = store.list('courses'); exported[0].title.mn = 'Tampered';
  assert.equal(store.list('courses')[0].title.mn, 'Edited');
});

test('invalid content and failed writes leave the previous saved version intact', () => {
  const { store, storage, values } = setup();
  store.save('courses', course);
  const before = values.get(CONTENT_KEY);
  assert.throws(() => store.save('courses', { ...course, price: -1 }), { code: 'validation_error' });
  assert.throws(() => store.save('courses', { ...course, image: { src: 'javascript:alert(1)' } }), { code: 'invalid_image' });
  assert.equal(values.get(CONTENT_KEY), before);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => store.save('courses', course), { code: 'storage_error' });
  assert.equal(values.get(CONTENT_KEY), before);
  values.set(CONTENT_KEY, '{broken');
  assert.throws(() => store.save('courses', course), { code: 'corrupt_storage' });
  assert.equal(values.get(CONTENT_KEY), '{broken');
});

test('stories require a body before publishing; media accepts safe images and rejects unsafe schemes', () => {
  const { store } = setup();
  const story = store.save('news', { title: pair('Story'), summary: pair('Summary'), category: pair('Community'), publication: 'draft' });
  assert.throws(() => store.change('news', story.id, 'published'), { code: 'body_required' });
  store.save('news', { body: pair('Full article') }, story.id);
  store.change('news', story.id, 'published');
  assert.equal(store.list('news')[0].body.mn, 'Full article');
  assert.equal(safeImageUrl('/assets/image.jpg'), true);
  assert.equal(safeImageUrl('https://example.com/image.png'), true);
  assert.equal(safeImageUrl('data:image/png;base64,AAAA'), true);
  assert.equal(safeImageUrl('data:image/svg+xml;base64,AAAA'), false);
  assert.equal(safeImageUrl('//untrusted.example/image.png'), false);
});

test('records retain contact details, statuses and recoverable deletion across reloads', () => {
  const { options, values } = setup();
  const records = createRecordStore(options);
  const record = records.add({ type: 'course', userId: 'guest:test@example.com', email: 'test@example.com', phone: '99112233', items: ['Course'], courseId: 'existing' });
  records.update(record.id, 'done');
  assert.equal(createRecordStore(options).list()[0].status, 'done');
  assert.equal(records.list()[0].phone, '99112233');
  records.update(record.id, 'cancelled');
  records.update(record.id, 'delete');
  assert.ok(records.list()[0].deletedAt);
  records.update(record.id, 'restore');
  assert.equal(records.list()[0].deletedAt, null);
  assert.equal(records.list()[0].status, 'cancelled');
  const before = values.get(RECORDS_KEY);
  assert.throws(() => records.update(record.id, 'paid'), { code: 'validation_error' });
  assert.equal(values.get(RECORDS_KEY), before);
});

test('CSV quotes commas and newlines and prevents spreadsheet formula execution', () => {
  const csv = csvText([['Нэр', 'Text'], ['=HYPERLINK("bad")', 'hello,\nworld']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"hello,\nworld"'));
});
