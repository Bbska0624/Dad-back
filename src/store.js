// Өгөгдлийн давхарга. Route-ууд зөвхөн энэ файлын функцуудыг ашиглана.
//  - DATABASE_URL тохируулсан бол: PostgreSQL (Prisma) — src/store/prisma.js
//  - Үгүй бол: санах ой — src/store/memory.js (тест, хурдан туршилтад)
import { randomBytes } from 'node:crypto';
import { createMemoryStore } from './store/memory.js';

export const CATEGORIES = ['Code', 'Data', 'AI', 'Digital'];
export const newId = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`;

let store;

/** Тестэд эсвэл эхлүүлэхэд store-ийг солино. */
export function useStore(next) {
  store = next;
  return store;
}

export async function initStore(env = process.env) {
  if (store) return store;
  if (env.DATABASE_URL) {
    const { createPrismaStore } = await import('./store/prisma.js');
    return useStore(createPrismaStore());
  }
  return useStore(createMemoryStore());
}

export function getStore() {
  if (!store) throw new Error('Store is not initialised: call initStore() first');
  return store;
}

const call = (name) => (...args) => getStore()[name](...args);

export const listCourses = call('listCourses');
export const findCourse = call('findCourse');
export const listNews = call('listNews');
export const findNews = call('findNews');
export const insertEnrollment = call('insertEnrollment');
export const findEnrollment = call('findEnrollment');
export const insertPayment = call('insertPayment');
export const findPayment = call('findPayment');
