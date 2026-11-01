import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { errorMessage } from '../../api/client';
import { AdminModal } from './AdminDialogs';
import { downloadCsv, matchSearch } from './adminTools';

export default function AdminUsers() {
  const { accounts, records, updateAccountProfile } = useAuth();
  const { t, lang } = useLang();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const rows = accounts.filter((account) => (role === 'all' || account.role === role) && matchSearch(query, [account.name, account.email, account.phone]));
  return <>
    <div className="admin-card-heading"><div><h2>{t('Хэрэглэгчид', 'Users')}</h2><p>{t('Бүртгэл, холбоо барих мэдээлэл болон үйл ажиллагааны түүх', 'Accounts, contact details and activity history')}</p></div><button className="btn secondary" disabled={!rows.length} onClick={() => downloadCsv('users.csv', [[t('Нэр', 'Name'), t('Имэйл', 'Email'), t('Утас', 'Phone'), t('Эрх', 'Role')], ...rows.map((account) => [account.name, account.email, account.phone, account.role])])}>{t('CSV татах', 'Export CSV')}</button></div>
    <div className="admin-record-filters"><label>{t('Хайх', 'Search')}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Нэр, имэйл, утас…', 'Name, email, phone…')} /></label><label>{t('Эрх', 'Role')}<select value={role} onChange={(event) => setRole(event.target.value)}><option value="all">{t('Бүх эрх', 'All roles')}</option><option value="user">{t('Хэрэглэгч', 'User')}</option><option value="admin">{t('Админ', 'Admin')}</option></select></label></div>
    <p role="status" className="admin-feedback">{notice}</p><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>{t('Нэр', 'Name')}</th><th>{t('Холбоо барих', 'Contact')}</th><th>{t('Эрх', 'Role')}</th><th>{t('Элсэлт / Захиалга', 'Enrollments / Orders')}</th><th>{t('Үйлдэл', 'Action')}</th></tr></thead><tbody>{rows.map((account) => <tr key={account.id}><th scope="row">{account.name}</th><td>{account.email}<small className="admin-cell-detail">{account.phone || '—'}</small></td><td>{account.role === 'admin' ? t('Админ', 'Admin') : t('Хэрэглэгч', 'User')}</td><td>{records.filter((record) => record.userId === account.id && record.type === 'course').length} / {records.filter((record) => record.userId === account.id && record.type === 'order').length}</td><td><div className="admin-row-actions"><button onClick={() => { setSelected(account); setError(''); }}>{t('Дэлгэрэнгүй / Засах', 'Details / Edit')}</button></div></td></tr>)}</tbody></table>{!rows.length && <p className="admin-empty-inline">{t('Хэрэглэгч олдсонгүй.', 'No matching users.')}</p>}</div>
    {selected && <AdminModal title={t('Хэрэглэгчийн мэдээлэл', 'User details')} onClose={() => setSelected(null)}>
      <p>{selected.email} · {selected.role === 'admin' ? t('Админ', 'Admin') : t('Хэрэглэгч', 'User')}</p>
      <form onSubmit={async (event) => { event.preventDefault(); try { await updateAccountProfile(selected.id, selected); setSelected(null); setNotice(t('Хэрэглэгчийн мэдээлэл шинэчлэгдлээ.', 'User profile updated.')); } catch (err) { setError(errorMessage(err, t)); } }}><fieldset>
        {[['name', t('Нэр', 'Name')], ['phone', t('Утас', 'Phone')], ['goal', t('Зорилго', 'Learning goal')]].map(([key, label]) => <label key={key}>{label}<input required={key === 'name'} type={key === 'phone' ? 'tel' : 'text'} maxLength={key === 'goal' ? 300 : 100} value={selected[key] || ''} onChange={(event) => setSelected({ ...selected, [key]: event.target.value })} /></label>)}
        {error && <p className="account-error" role="alert">{error}</p>}
        <div className="admin-dialog-actions"><button type="button" className="btn secondary" onClick={() => setSelected(null)}>{t('Болих', 'Cancel')}</button><button className="btn" type="submit">{t('Хадгалах', 'Save')}</button></div>
      </fieldset></form>
      <h3>{t('Элсэлт, захиалгын түүх', 'Enrollment and order history')}</h3><ul>{records.filter((record) => record.userId === selected.id).map((record) => <li key={record.id}>{record.items.join(', ')} · {new Date(record.createdAt).toLocaleDateString(lang === 'mn' ? 'mn-MN' : 'en-US')}</li>)}</ul>
    </AdminModal>}
  </>;
}
