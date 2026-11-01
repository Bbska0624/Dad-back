export const RECORDS_KEY = 'mc-demo-records';
export const RECORDS_EVENT = 'mc-records-changed';
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
export function createRecordStore({ storage, changed = () => {}, id = () => crypto.randomUUID(), now = () => new Date().toISOString() }) {
  function list() {
    const raw = storage.getItem(RECORDS_KEY);
    if (!raw) return [];
    let rows;
    try { rows = JSON.parse(raw); } catch { fail('corrupt_storage'); }
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.id !== 'string' || !['course', 'order'].includes(row.type) || !Array.isArray(row.items))) fail('corrupt_storage');
    return rows;
  }
  function commit(rows) {
    try { storage.setItem(RECORDS_KEY, JSON.stringify(rows)); } catch { fail('storage_error'); }
    changed(); return rows;
  }
  return {
    list,
    add(details) {
      if (!['course', 'order'].includes(details.type) || !Array.isArray(details.items) || !details.items.length || !details.userId) fail('validation_error');
      const record = { ...details, id: id(), status: 'new', createdAt: now(), deletedAt: null };
      commit([record, ...list()]); return record;
    },
    update(recordId, action) {
      if (!['new', 'done', 'cancelled', 'delete', 'restore'].includes(action)) fail('validation_error');
      const rows = list(); const item = rows.find((row) => row.id === recordId);
      if (!item) fail('not_found');
      if (action === 'delete') item.deletedAt = now();
      else if (action === 'restore') item.deletedAt = null;
      else item.status = action;
      item.updatedAt = now(); commit(rows); return item;
    },
  };
}
