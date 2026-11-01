import { createRecordStore, RECORDS_EVENT } from './mock/recordStore';
export const recordStore = createRecordStore({
  storage: { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
  changed: () => window.dispatchEvent(new Event(RECORDS_EVENT)),
});
