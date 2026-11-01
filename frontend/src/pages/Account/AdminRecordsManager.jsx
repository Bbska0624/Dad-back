import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { errorMessage } from '../../api/client';
import { AdminModal, ConfirmDelete } from './AdminDialogs';
import { downloadCsv, matchSearch } from './adminTools';

export default function AdminRecordsManager({ type, days }) {
  const { allRecords, accounts, updateStatus, changeRecord } = useAuth();
  const { t, lang } = useLang();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [trash, setTrash] = useState(false);
  const [details, setDetails] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const course = type === 'course';
  const person = (record) => {
    const account = accounts.find((item) => item.id === record.userId);
    return { name: record.name || account?.name || record.userId, email: record.email || account?.email || '', phone: record.phone || account?.phone || '' };
  };
  const date = (value) => new Date(value).toLocaleString(lang === 'mn' ? 'mn-MN' : 'en-US');
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  const rows = allRecords.filter((record) => record.type === type && Boolean(record.deletedAt) === trash && new Date(record.createdAt) >= start &&
    (status === 'all' || record.status === status) && matchSearch(query, [record.id, ...record.items, ...Object.values(person(record))]));
  const statusLabel = (value) => ({ new: t('Шинэ', 'New'), done: t('Шийдвэрлэсэн', 'Completed'), cancelled: t('Цуцалсан', 'Cancelled') })[value] || value;
  async function run(action, message) { setError(''); try { await action(); setNotice(message); } catch (err) { setError(errorMessage(err, t)); } }
  return <>
    <div className="admin-card-heading"><div><h2>{course ? t('Элсэлтийн хүсэлтүүд', 'Enrollment requests') : t('Бүтээгдэхүүний захиалгууд', 'Product orders')}</h2><p>{t(`Сүүлийн ${days} хоногийн хүсэлт, холбоо барих мэдээлэл болон төлөв`, `Requests, contact details and status over the last ${days} days`)}</p></div>
      <button className="btn secondary" disabled={!rows.length} onClick={() => downloadCsv(course ? 'enrollments.csv' : 'orders.csv', [['ID', t('Нэр', 'Name'), t('Имэйл', 'Email'), t('Утас', 'Phone'), t('Бараа / Сургалт', 'Items / Course'), t('Төлөв', 'Status'), t('Огноо', 'Date')], ...rows.map((record) => [record.id, person(record).name, person(record).email, person(record).phone, record.items.join('; '), statusLabel(record.status), date(record.createdAt)])])}>{t('CSV татах', 'Export CSV')}</button>
    </div>
    <div className="admin-management-filters"><label>{t('Хайх', 'Search')}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Нэр, имэйл, утас, сургалт…', 'Name, email, phone, course…')} /></label>
      <label>{t('Төлөв', 'Status')}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t('Бүх төлөв', 'All statuses')}</option>{['new', 'done', 'cancelled'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
      <label>{t('Жагсаалт', 'List')}<select value={trash ? 'trash' : 'active'} onChange={(event) => setTrash(event.target.value === 'trash')}><option value="active">{t('Идэвхтэй', 'Active')}</option><option value="trash">{t('Устгасан', 'Trash')}</option></select></label></div>
    <p role="status" className="admin-feedback">{notice}</p>{error && <p role="alert" className="account-error">{error}</p>}
    <p className="admin-list-count">{rows.length} {t('бүртгэл', 'records')}</p>
    <div className="admin-table-scroll"><table className="admin-table"><caption className="admin-sr-only">{course ? t('Элсэлтүүд', 'Enrollments') : t('Захиалгууд', 'Orders')}</caption><thead><tr><th>{t('Хэрэглэгч', 'Customer')}</th><th>{course ? t('Сургалт', 'Course') : t('Бүтээгдэхүүн', 'Products')}</th><th>{t('Огноо', 'Date')}</th><th>{t('Төлөв', 'Status')}</th><th>{t('Үйлдлүүд', 'Actions')}</th></tr></thead><tbody>{rows.map((record) => <tr key={record.id}>
      <th scope="row">{person(record).name}<small>{person(record).email}</small><small>{person(record).phone}</small></th><td>{[...new Set(record.items)].map((item) => <div key={item}>{item} {record.items.filter((value) => value === item).length > 1 && `× ${record.items.filter((value) => value === item).length}`}</div>)}</td><td className="admin-date">{date(record.createdAt)}</td>
      <td><select disabled={trash} aria-label={`${person(record).name} — ${t('төлөв', 'status')}`} value={record.status} onChange={(event) => run(() => updateStatus(record.id, event.target.value), t('Төлөв шинэчлэгдлээ.', 'Status updated.'))}>{['new', 'done', 'cancelled'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></td>
      <td><div className="admin-row-actions"><button onClick={() => setDetails(record)}>{t('Дэлгэрэнгүй', 'Details')}</button>{trash ? <button onClick={() => run(() => changeRecord(record.id, 'restore'), t('Сэргээгдлээ.', 'Restored.'))}>{t('Сэргээх', 'Restore')}</button> : <button className="admin-delete-button" onClick={() => setDeleting(record)}>{t('Устгах', 'Delete')}</button>}</div></td>
    </tr>)}</tbody></table>{!rows.length && <p className="admin-empty-inline">{t('Тохирох бүртгэл алга.', 'No matching records.')}</p>}</div>
    {deleting && <ConfirmDelete title={`${person(deleting).name} · ${deleting.items.join(', ')}`} onClose={() => setDeleting(null)} onConfirm={async () => { await changeRecord(deleting.id, 'delete'); setNotice(t('Устгасан жагсаалт руу шилжүүллээ.', 'Moved to trash.')); }} />}
    {details && <AdminModal title={t('Бүртгэлийн дэлгэрэнгүй', 'Record details')} onClose={() => setDetails(null)}><dl className="admin-detail-list"><dt>ID</dt><dd>{details.id}</dd><dt>{t('Нэр', 'Name')}</dt><dd>{person(details).name}</dd><dt>{t('Имэйл', 'Email')}</dt><dd>{person(details).email || '—'}</dd><dt>{t('Утас', 'Phone')}</dt><dd>{person(details).phone || '—'}</dd><dt>{t('Үүссэн', 'Created')}</dt><dd>{date(details.createdAt)}</dd><dt>{t('Төлөв', 'Status')}</dt><dd>{statusLabel(details.status)}</dd></dl><ul>{details.items.map((item, index) => <li key={index}>{item}</li>)}</ul></AdminModal>}
  </>;
}
