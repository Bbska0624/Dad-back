import { ApiError, request } from './client';
import { contentStore } from './managedContent';

function authorized(action) {
  if (localStorage.getItem('mc-demo-session') !== 'admin') throw new ApiError(403, 'forbidden', 'Administrator access required');
  return action();
}
export const getAdminContent = (type, { signal } = {}) => request(`/admin/${type}`, { signal, mock: () => authorized(() => contentStore.list(type, { admin: true })) });
export const saveAdminContent = (type, data, id) => request(`/admin/${type}${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: data, mock: () => authorized(() => contentStore.save(type, data, id)) });
export const changeAdminContent = (type, id, action) => request(`/admin/${type}/${encodeURIComponent(id)}/${action}`, { method: 'POST', mock: () => authorized(() => contentStore.change(type, id, action)) });
export const getAdminActivity = ({ signal } = {}) => request('/admin/activity', { signal, mock: () => authorized(() => contentStore.activity()) });
export const getAdminRecords = ({ signal, token } = {}) => request('/admin/records', { signal, token });
export const changeAdminRecord = (id, action) => request(`/admin/records/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
export const getAdminUsers = ({ signal, token } = {}) => request('/admin/users', { signal, token });
export const updateAdminUser = (id, body) => request(`/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body });
export const uploadAdminImage = (dataUrl) => request('/admin/images', { method: 'POST', body: { dataUrl } });
