import test from 'node:test';
import assert from 'node:assert/strict';
import { enrollmentAnalytics } from './adminAnalytics.js';

const now = new Date(2026, 9, 25, 12);
const courses = [{ id: 'data', title: { mn: 'Өгөгдөл', en: 'Data Analysis' }, category: 'Data' }];
const record = (id, createdAt, overrides = {}) => ({ id, createdAt, type: 'course', userId: 'student', items: ['Data Analysis'], status: 'new', ...overrides });

test('includes the first calendar day, excludes older, future, invalid and order records', () => {
  const rows = [record('start', new Date(2026, 9, 19)), record('today', now),
    record('old', new Date(2026, 9, 18, 23, 59)), record('future', new Date(2026, 9, 25, 13)),
    record('invalid', 'invalid'), record('order', now, { type: 'order' })];
  const result = enrollmentAnalytics(rows, courses, 7, now);
  assert.deepEqual(result.selected.map((row) => row.id), ['start', 'today']);
  assert.equal(result.timeline.reduce((sum, bucket) => sum + bucket.count, 0), 2);
  assert.equal(result.timeline.length, 7);
});

test('matches bilingual titles and IDs, counts each enrollment once, and deduplicates learners', () => {
  const rows = [record('en', now, { items: ['Data Analysis', 'Data Analysis'] }),
    record('mn', now, { items: ['Өгөгдөл'], status: 'done' }),
    record('id', now, { items: ['data'], userId: 'another' })];
  const result = enrollmentAnalytics(rows, courses, 30, now);
  assert.equal(result.courseCounts[0].count, 3);
  assert.equal(result.learners, 2);
  assert.equal(result.pending, 2);
  assert.equal(result.completed, 1);
  assert.equal(result.timeline.reduce((sum, bucket) => sum + bucket.count, 0), 3);
});

test('empty data produces zero counts without fabricated activity', () => {
  const result = enrollmentAnalytics([], courses, 90, now);
  assert.equal(result.selected.length, 0);
  assert.equal(result.learners, 0);
  assert.ok(result.timeline.every((bucket) => bucket.count === 0));
  assert.equal(result.courseCounts[0].count, 0);
});
