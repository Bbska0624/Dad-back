import { useState } from 'react';
import { request, errorMessage } from '../../api/client';
import { uploadAdminImage } from '../../api/admin';
import useApi from '../../hooks/useApi';
import { useLang } from '../../context/LanguageContext';
import ApiState from '../../components/ApiState/ApiState';

const bilingual = () => ({ mn: '', en: '' });
function TextPair({ label, value, onChange, multiline = false }) {
  const Tag = multiline ? 'textarea' : 'input';
  return <fieldset className="about-editor-pair"><legend>{label}</legend>{['mn', 'en'].map((lang) => <label key={lang}>{lang === 'mn' ? 'Монгол' : 'English'}<Tag required rows={multiline ? 5 : undefined} maxLength={10000} value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} /></label>)}</fieldset>;
}
function AboutForm({ initial }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const update = (key, index, value) => set(key, form[key].map((item, i) => i === index ? value : item));
  const remove = (key, index) => set(key, form[key].filter((_, i) => i !== index));
  async function upload(file) {
    if (!file) return;
    setError(''); setNotice('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1024 * 1024) { setError(t('Зураг 1 MB-аас бага байх ёстой.', 'Choose a PNG, JPG, WEBP or GIF under 1 MB.')); return; }
    setBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = await uploadAdminImage(dataUrl);
      setForm((old) => ({ ...old, photo: { ...old.photo, src: image.src } }));
    } catch (err) { setError(errorMessage(err, t)); } finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const saved = await request('/admin/site/about', { method: 'PUT', body: form }); setForm(saved); setNotice(t('Хадгаллаа. Нүүр хуудсыг шинэчилж өөрчлөлтийг харна уу.', 'Saved. Refresh the public home page to see changes.')); }
    catch (err) { setError(err.fields ? Object.entries(err.fields).map(([key, value]) => `${key}: ${value}`).join(' · ') : errorMessage(err, t)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="about-editor">
    <fieldset disabled={busy} className="about-editor-fields">
      <label className="about-editor-toggle"><input type="checkbox" checked={form.visible} onChange={(e) => set('visible', e.target.checked)} />{t('Бидний тухай хэсгийг сайт дээр харуулах', 'Show the About profile on the website')}</label>
      {['heading', 'name', 'role', 'bio'].map((key) => <TextPair key={key} label={({ heading: t('Хэсгийн гарчиг', 'Section heading'), name: t('Нэр', 'Name'), role: t('Албан тушаал', 'Role'), bio: t('Танилцуулга', 'Biography') })[key]} value={form[key]} onChange={(value) => set(key, value)} multiline={key === 'bio'} />)}
      <fieldset><legend>{t('Зураг', 'Photo')}</legend><img className="about-editor-photo" src={form.photo.src} alt="" /><label>{t('Зургийн URL', 'Image URL')}<input required value={form.photo.src} onChange={(e) => set('photo', { ...form.photo, src: e.target.value })} /></label><label>{t('Зураг оруулах', 'Upload photo')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => upload(e.target.files[0])} /></label></fieldset>
      <fieldset><legend>{t('Хэлний мэдлэг', 'Languages')}</legend>{form.languages.map((item, i) => <div className="about-editor-item" key={i}><TextPair label={`${i + 1}`} value={item} onChange={(value) => update('languages', i, value)} /><button type="button" onClick={() => remove('languages', i)}>{t('Хасах', 'Remove')}</button></div>)}<button type="button" disabled={form.languages.length >= 30} onClick={() => set('languages', [...form.languages, bilingual()])}>+ {t('Хэл нэмэх', 'Add language')}</button></fieldset>
      <fieldset><legend>{t('Тоон үзүүлэлт', 'Statistics')}</legend>{form.stats.map((item, i) => <div className="about-editor-item" key={i}><label>{t('Утга', 'Value')}<input required maxLength={100} value={item.value} onChange={(e) => update('stats', i, { ...item, value: e.target.value })} /></label><TextPair label={t('Тайлбар', 'Label')} value={item.label} onChange={(label) => update('stats', i, { ...item, label })} /><button type="button" onClick={() => remove('stats', i)}>{t('Хасах', 'Remove')}</button></div>)}<button type="button" disabled={form.stats.length >= 12} onClick={() => set('stats', [...form.stats, { value: '', label: bilingual() }])}>+ {t('Үзүүлэлт нэмэх', 'Add statistic')}</button></fieldset>
      <fieldset><legend>{t('Боловсрол, туршлага, мэргэшил, амжилт', 'Education, experience, expertise and recognition')}</legend>{form.facts.map((group, i) => <div className="about-editor-item" key={i}><TextPair label={t('Бүлгийн гарчиг', 'Group heading')} value={group.title} onChange={(title) => update('facts', i, { ...group, title })} />{group.items.map((item, j) => <div className="about-editor-item" key={j}><TextPair multiline label={`${j + 1}`} value={item} onChange={(value) => update('facts', i, { ...group, items: group.items.map((old, k) => k === j ? value : old) })} /><button type="button" onClick={() => update('facts', i, { ...group, items: group.items.filter((_, k) => k !== j) })}>{t('Мөр хасах', 'Remove item')}</button></div>)}<button type="button" disabled={group.items.length >= 30} onClick={() => update('facts', i, { ...group, items: [...group.items, bilingual()] })}>+ {t('Мөр нэмэх', 'Add item')}</button> <button type="button" onClick={() => remove('facts', i)}>{t('Бүлэг хасах', 'Remove group')}</button></div>)}<button type="button" disabled={form.facts.length >= 12} onClick={() => set('facts', [...form.facts, { title: bilingual(), items: [] }])}>+ {t('Бүлэг нэмэх', 'Add group')}</button></fieldset>
      <button className="btn" type="submit">{t('Өөрчлөлтийг хадгалах', 'Save changes')}</button>
    </fieldset>
    {busy && <p role="status">{t('Хадгалж байна…', 'Working…')}</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert" className="account-error">{error}</p>}
  </form>;
}
export default function AdminAbout() {
  const { t } = useLang();
  const api = useApi((signal) => request('/admin/site/about', { signal }), []);
  return <><h2>{t('Бидний тухай', 'About profile')}</h2><p>{t('Агуулгыг засах эсвэл хэсгийг бүхэлд нь нуух. Мэдээний хэсэгт нөлөөлөхгүй.', 'Edit profile content or hide the entire profile. Stories are managed separately.')}</p><ApiState loading={api.loading} error={api.error} onRetry={api.reload} />{api.data && <AboutForm initial={api.data} />}</>;
}
