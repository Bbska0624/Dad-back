import { useEffect, useId, useRef, useState } from 'react';
import { useLang } from '../../context/LanguageContext';
import { errorMessage } from '../../api/client';
import { saveAdminContent, uploadAdminImage } from '../../api/admin';
import closeOnBackdrop from '../../hooks/dialogBackdrop';
import { textOf } from './adminTools';

export function AdminModal({ title, onClose, children, busy = false, className = '' }) {
  const ref = useRef(null);
  const heading = useId();
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className={`admin-dialog ${className}`} aria-labelledby={heading} onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }} onClick={(event) => { if (!busy) closeOnBackdrop(event); }}>
    <div className="admin-dialog-heading"><h2 id={heading}>{title}</h2><button type="button" disabled={busy} aria-label="Close / Хаах" onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}

export function ConfirmDelete({ title, onConfirm, onClose }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <AdminModal title={t('Устгах уу?', 'Move to trash?')} onClose={onClose} busy={busy} className="admin-confirm">
    <p><strong>{title}</strong></p><p>{t('Жагсаалт болон нийтэд харагдах хэсгээс хасна. Устгасан жагсаалтаас буцааж сэргээж болно.', 'This item will be removed from active and public lists. You can restore it from the trash.')}</p>
    {error && <p role="alert" className="account-error">{error}</p>}
    <div className="admin-dialog-actions"><button className="btn secondary" disabled={busy} onClick={onClose}>{t('Болих', 'Cancel')}</button><button className="btn admin-danger" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } catch (err) { setError(errorMessage(err, t)); } finally { setBusy(false); } }}>{busy ? t('Устгаж байна…', 'Deleting…') : t('Устгах', 'Move to trash')}</button></div>
  </AdminModal>;
}

const pair = (value) => ({ mn: value?.mn || '', en: value?.en || '' });
export function ContentEditor({ type, item, number, onClose, onSaved }) {
  const { t } = useLang();
  const course = type === 'courses';
  const [form, setForm] = useState(() => ({
    title: pair(item?.title), description: pair(item?.description), category: course ? item?.category || 'Code' : pair(item?.category),
    summary: pair(item?.summary), body: pair(item?.body), status: item?.status || 'planned', publication: item?.publication || 'draft',
    onlinePaymentEnabled: item?.onlinePaymentEnabled ?? (item?.id === 'python-programming' || item?.title?.mn?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('mn') === 'компьютер зохион байгуулалт, архитектур'),
    price: item?.price ?? '', featured: item?.featured ?? false, duration: pair(item?.duration), level: pair(item?.level),
    publishedAt: item?.publishedAt?.slice(0, 10) || '', imageSrc: (course ? item?.image?.src : item?.coverImage?.src) || '',
    imageAlt: pair(course ? item?.image?.alt : item?.coverImage?.alt), gallery: (item?.gallery || []).map((image) => image.src).join('\n'),
    location: pair(item?.details?.location), partners: pair(item?.details?.partners),
  }));
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const uid = useId();
  const set = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setError(''); };
  const both = (field) => ({ mn: form[field].mn.trim(), en: form[field].en.trim() || form[field].mn.trim() });
  const field = (name, label, { long = false, required = false } = {}) => <div className="admin-bilingual" key={name}>{['mn', 'en'].map((lang) => {
    const id = `${uid}-${name}-${lang}`;
    const props = { id, value: form[name][lang], required: required && lang === 'mn', maxLength: name === 'body' ? 30000 : long ? 4000 : 250, onChange: (event) => set(name, { ...form[name], [lang]: event.target.value }) };
    return <label key={lang} htmlFor={id}>{label} · {lang === 'mn' ? 'MN' : 'EN'}{long ? <textarea {...props} rows={name === 'body' ? 7 : 3} /> : <input {...props} />}</label>;
  })}</div>;
  async function upload(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1024 * 1024) { setError(t('PNG, JPG, WEBP эсвэл GIF зураг сонгоно уу. Дээд хэмжээ: 1 MB.', 'Choose a PNG, JPG, WEBP or GIF image up to 1 MB.')); return; }
    setImageBusy(true);
    const reader = new FileReader();
    reader.onload = () => { set('imageSrc', reader.result); setImageBusy(false); };
    reader.onerror = () => { setError(t('Зургийг уншиж чадсангүй.', 'Could not read the image.')); setImageBusy(false); };
    reader.readAsDataURL(file);
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || imageBusy) return;
    setBusy(true); setError('');
    try {
      const oldImage = course ? item?.image : item?.coverImage;
      let imageSrc = form.imageSrc.trim();
      if (imageSrc.startsWith('data:')) imageSrc = (await uploadAdminImage(imageSrc)).src;
      const image = imageSrc ? { ...(oldImage?.src === imageSrc ? oldImage : { width: 1600, height: 900 }), src: imageSrc, alt: { mn: form.imageAlt.mn.trim() || form.title.mn.trim(), en: form.imageAlt.en.trim() || form.title.en.trim() || form.title.mn.trim() } } : null;
      const common = { title: both('title'), publication: form.publication };
      const data = course ? { ...common, description: both('description'), category: form.category, status: form.status, onlinePaymentEnabled: form.onlinePaymentEnabled, price: form.price === '' ? null : Number(form.price), image, featured: form.featured, duration: both('duration'), level: both('level') } : {
        ...common, category: both('category'), summary: both('summary'), body: both('body'), publishedAt: form.publishedAt ? `${form.publishedAt}T00:00:00.000Z` : null, isSample: false, number: item?.number || String(number).padStart(2, '0'), coverImage: image,
        details: { ...item?.details, date: form.publishedAt ? { mn: form.publishedAt.replaceAll('-', '.'), en: form.publishedAt } : null, location: both('location'), partners: both('partners') },
        gallery: form.gallery.split('\n').map((url) => url.trim()).filter(Boolean).map((src) => item?.gallery?.find((image) => image.src === src) || { src, width: 1600, height: 900, alt: both('title') }),
      };
      await saveAdminContent(type, data, item?.id);
      onSaved(); onClose();
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }
  return <AdminModal title={course ? item ? t('Сургалт засах', 'Edit course') : t('Сургалт нэмэх', 'Add course') : item ? t('Мэдээ засах', 'Edit story') : t('Мэдээ нэмэх', 'Add story')} onClose={onClose} busy={busy}>
    <p className="admin-editor-help">{t('Англи хувилбарыг хоосон үлдээвэл монгол текстийг ашиглана.', 'Empty English fields use the Mongolian text.')}</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {field('title', t('Гарчиг', 'Title'), { required: true })}
      {course ? <>
        {field('description', t('Тайлбар', 'Description'), { long: true, required: true })}
        <div className="admin-form-grid"><label>{t('Чиглэл', 'Category')}<select value={form.category} onChange={(event) => set('category', event.target.value)}>{['Code', 'Data', 'AI', 'Digital'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>{t('Элсэлтийн төлөв', 'Enrollment status')}<select value={form.status} onChange={(event) => set('status', event.target.value)}><option value="open">{t('Бүртгэл нээлттэй', 'Enrollment open')}</option><option value="waitlist">{t('Хүлээлгийн жагсаалт', 'Waitlist')}</option><option value="planned">{t('Төлөвлөсөн', 'Planned')}</option></select></label>
          <label>{t('Үнэ (₮)', 'Price (MNT)')}<input type="number" min="0" step="1" value={form.price} placeholder={t('Тогтоогоогүй', 'Not set')} onChange={(event) => set('price', event.target.value)} /></label>
        </div>
        <label className="admin-checkbox"><input type="checkbox" checked={form.onlinePaymentEnabled} onChange={(event) => set('onlinePaymentEnabled', event.target.checked)} />{t('Онлайнаар төлбөр төлөх боломжтой', 'Allow online payment')}</label>
        <p>{t('Бүх сургалтыг сагсалж болно. Унтраавал төлбөрт тооцохгүй, холбоо барих дугаар харуулна.', 'All courses can be added to cart. When disabled, this course is excluded from payment and shows a contact number.')}</p>
        {field('duration', t('Үргэлжлэх хугацаа', 'Duration'))}{field('level', t('Түвшин', 'Level'))}
        <label className="admin-checkbox"><input type="checkbox" checked={form.featured} onChange={(event) => set('featured', event.target.checked)} />{t('Нүүр хуудсанд онцлох', 'Feature on the home page')}</label>
      </> : <>
        {field('category', t('Ангилал', 'Category'), { required: true })}
        {field('summary', t('Товч агуулга', 'Summary'), { long: true, required: true })}
        {field('body', t('Дэлгэрэнгүй', 'Story body'), { long: true, required: form.publication === 'published' })}
        <label>{t('Нийтэлсэн огноо', 'Publication date')}<input type="date" value={form.publishedAt} onChange={(event) => set('publishedAt', event.target.value)} /></label>
        {field('location', t('Байршил', 'Location'))}{field('partners', t('Хамтрагчид', 'Partners'))}
      </>}
      <div className="admin-image-field"><label>{t('Зургийн холбоос', 'Image URL')}<input value={form.imageSrc.startsWith('data:') ? '' : form.imageSrc} placeholder="https://… /assets/…" onChange={(event) => set('imageSrc', event.target.value)} /></label>
        <label>{t('Эсвэл зураг сонгох (1 MB)', 'Or choose an image (1 MB)')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => upload(event.target.files?.[0])} /></label>
        {form.imageSrc && <div className="admin-image-preview"><img src={form.imageSrc} alt={t('Зургийн урьдчилсан харагдац', 'Image preview')} /><button type="button" className="admin-text-button" onClick={() => set('imageSrc', '')}>{t('Зураг хасах', 'Remove image')}</button></div>}
      </div>
      {field('imageAlt', t('Зургийн тайлбар', 'Image description'))}
      {!course && <label>{t('Нэмэлт зургууд (мөр бүрд нэг холбоос)', 'Gallery images (one URL per line)')}<textarea rows="3" value={form.gallery} onChange={(event) => set('gallery', event.target.value)} /></label>}
      <label>{t('Нийтлэлийн төлөв', 'Visibility')}<select value={form.publication} onChange={(event) => set('publication', event.target.value)}><option value="draft">{t('Ноорог · Сайт дээр харагдахгүй', 'Draft · Hidden from the website')}</option><option value="published">{t('Нийтэлсэн · Сайт дээр харагдана', 'Published · Visible on the website')}</option><option value="archived">{t('Архивласан', 'Archived')}</option></select></label>
      {error && <p role="alert" className="account-error">{error}</p>}
      <div className="admin-dialog-actions"><button type="button" className="btn secondary" onClick={onClose}>{t('Болих', 'Cancel')}</button><button type="submit" className="btn" disabled={busy || imageBusy}>{busy || imageBusy ? t('Хадгалж байна…', 'Saving…') : t('Хадгалах', 'Save')}</button></div>
    </fieldset></form>
  </AdminModal>;
}
