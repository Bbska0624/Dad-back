import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../../context/LanguageContext';
import { changeAdminContent, saveAdminContent } from '../../api/admin';
import { errorMessage } from '../../api/client';
import ApiState from '../../components/ApiState/ApiState';
import { AdminModal, ConfirmDelete, ContentEditor } from './AdminDialogs';
import { downloadCsv, matchSearch, textOf } from './adminTools';

export default function AdminContentManager({ type, api }) {
  const { t, lang } = useLang();
  const course = type === 'courses';
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [category, setCategory] = useState('all');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const all = api.data || [];
  const rows = all.filter((item) => (visibility === 'trash' ? item.deletedAt : !item.deletedAt) &&
    (['all', 'trash'].includes(visibility) || item.publication === visibility) &&
    (category === 'all' || textOf(item.category, lang) === category) &&
    matchSearch(query, [item.title, item.category, item.description, item.summary]));
  const categories = [...new Set(all.filter((item) => !item.deletedAt).map((item) => textOf(item.category, lang)))];
  const publicationName = (item) => item.deletedAt ? t('Устгасан', 'Trash') : ({ published: t('Нийтэлсэн', 'Published'), draft: t('Ноорог', 'Draft'), archived: t('Архив', 'Archived') })[item.publication || 'published'];
  async function action(run, message) {
    setBusy(true); setNotice(''); setError('');
    try { await run(); api.reload(); setNotice(message); } catch (err) { setError(errorMessage(err, t)); } finally { setBusy(false); }
  }
  return <>
    <div className="admin-card-heading"><div><h2>{course ? t('Сургалтын удирдлага', 'Manage courses') : t('Мэдээний удирдлага', 'Manage stories')}</h2><p>{t('Нэмэх, засах, нийтлэх, нуух болон устгасныг сэргээх', 'Create, edit, publish, hide and restore deleted items')}</p></div>
      <div className="admin-inline-actions"><button type="button" className="btn secondary" disabled={!rows.length} onClick={() => downloadCsv(course ? 'courses.csv' : 'news.csv', [[t('Гарчиг', 'Title'), t('Ангилал', 'Category'), t('Нийтлэл', 'Visibility'), course ? t('Үнэ', 'Price') : t('Огноо', 'Date')], ...rows.map((item) => [textOf(item.title, lang), textOf(item.category, lang), publicationName(item), course ? item.price : item.publishedAt])])}>{t('CSV татах', 'Export CSV')}</button>
        <button type="button" className="btn" onClick={() => setEditor({})}>+ {course ? t('Сургалт нэмэх', 'Add course') : t('Мэдээ нэмэх', 'Add story')}</button></div>
    </div>
    <div className="admin-management-filters">
      <label>{t('Хайх', 'Search')}<input type="search" placeholder={t('Гарчиг, агуулга, ангилал…', 'Title, content, category…')} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label>{t('Нийтлэлийн төлөв', 'Visibility')}<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="all">{t('Бүх идэвхтэй', 'All active')}</option><option value="published">{t('Нийтэлсэн', 'Published')}</option><option value="draft">{t('Ноорог', 'Draft')}</option><option value="archived">{t('Архив', 'Archived')}</option><option value="trash">{t('Устгасан', 'Trash')}</option></select></label>
      <label>{t('Ангилал', 'Category')}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t('Бүх ангилал', 'All categories')}</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
    </div>
    <ApiState loading={api.loading} error={api.error} onRetry={api.reload} />
    <p className="admin-feedback" role="status">{notice}</p>{error && <p role="alert" className="account-error">{error}</p>}
    <p className="admin-list-count">{rows.length} {course ? t('сургалт', 'courses') : t('мэдээ', 'stories')}</p>
    {api.data && <div className="admin-table-scroll"><table className="admin-table admin-management-table"><caption className="admin-sr-only">{course ? t('Сургалтын жагсаалт', 'Course list') : t('Мэдээний жагсаалт', 'Story list')}</caption>
      <thead><tr><th>{t('Гарчиг', 'Title')}</th><th>{t('Ангилал', 'Category')}</th><th>{t('Нийтлэлийн төлөв', 'Visibility')}</th><th>{course ? t('Үнэ / Элсэлт', 'Price / Enrollment') : t('Огноо', 'Date')}</th><th>{t('Үйлдлүүд', 'Actions')}</th></tr></thead>
      <tbody>{rows.map((item) => <tr key={item.id}><th scope="row">{textOf(item.title, lang)}{course && item.featured && <small>★ {t('Нүүр хуудсанд онцолсон', 'Featured on home page')}</small>}</th><td>{textOf(item.category, lang)}</td>
        <td>{item.deletedAt ? <span className="admin-category-tag">{publicationName(item)}</span> : <select disabled={busy} aria-label={`${textOf(item.title, lang)} — ${t('нийтлэлийн төлөв', 'visibility')}`} value={item.publication || 'published'} onChange={(event) => action(() => changeAdminContent(type, item.id, event.target.value), t('Нийтлэлийн төлөв шинэчлэгдлээ.', 'Visibility updated.'))}><option value="published">{t('Нийтэлсэн', 'Published')}</option><option value="draft">{t('Ноорог', 'Draft')}</option><option value="archived">{t('Архив', 'Archived')}</option></select>}</td>
        <td>{course ? <>{item.price == null ? t('Үнэ тогтоогоогүй', 'Price not set') : `${item.price.toLocaleString()} ₮`}<small className="admin-cell-detail">{({ open: t('Бүртгэл нээлттэй', 'Enrollment open'), waitlist: t('Хүлээлгийн жагсаалт', 'Waitlist'), planned: t('Төлөвлөсөн', 'Planned') })[item.status]}</small></> : item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(lang === 'mn' ? 'mn-MN' : 'en-US') : '—'}</td>
        <td><div className="admin-row-actions">{item.deletedAt ? <button type="button" disabled={busy} onClick={() => action(() => changeAdminContent(type, item.id, 'restore'), t('Буцааж сэргээлээ.', 'Item restored.'))}>{t('Сэргээх', 'Restore')}</button> : <>
          <button type="button" onClick={() => setEditor(item)}>{t('Засах', 'Edit')}</button>
          <button type="button" onClick={() => setPreview(item)}>{t('Харах', 'Preview')}</button>
          <button type="button" disabled={busy} onClick={() => action(() => saveAdminContent(type, { ...item, publication: 'draft', title: { mn: `${item.title.mn} · Хуулбар`, en: `${item.title.en} · Copy` } }), t('Ноорог хуулбар үүслээ.', 'Draft copy created.'))}>{t('Хуулах', 'Duplicate')}</button>
          <button type="button" className="admin-delete-button" disabled={busy} onClick={() => setDeleting(item)}>{t('Устгах', 'Delete')}</button>
        </>}</div></td></tr>)}</tbody>
    </table>{!rows.length && <p className="admin-empty-inline">{t('Тохирох мэдээлэл алга.', 'No matching items.')}</p>}</div>}
    {editor && <ContentEditor key={editor.id || 'new'} type={type} item={editor.id ? editor : null} number={all.length + 1} onClose={() => setEditor(null)} onSaved={() => { api.reload(); setNotice(t('Амжилттай хадгаллаа.', 'Saved successfully.')); }} />}
    {deleting && <ConfirmDelete title={textOf(deleting.title, lang)} onClose={() => setDeleting(null)} onConfirm={async () => { await changeAdminContent(type, deleting.id, 'delete'); api.reload(); setNotice(t('Устгасан жагсаалт руу шилжүүллээ.', 'Moved to trash.')); }} />}
    {preview && <AdminModal title={textOf(preview.title, lang)} onClose={() => setPreview(null)}>
      {(preview.image || preview.coverImage) && <img className="admin-preview-cover" src={(preview.image || preview.coverImage).src} alt={textOf((preview.image || preview.coverImage).alt, lang)} />}
      <p className="admin-preview-meta">{textOf(preview.category, lang)} · {publicationName(preview)}</p>
      <p>{textOf(course ? preview.description : preview.summary, lang)}</p>
      {!course && textOf(preview.body, lang).split('\n\n').map((paragraph, index) => <p className="admin-preview-paragraph" key={index}>{paragraph}</p>)}
      {preview.publication === 'published' && <Link className="btn secondary" to={course ? '/courses' : `/news/${encodeURIComponent(preview.id)}`}>{t('Сайт дээр харах ↗', 'View on website ↗')}</Link>}
    </AdminModal>}
  </>;
}
