import { createContext, useContext, useState } from 'react';
import { request, errorMessage } from '../../api/client';
import { uploadAdminImage } from '../../api/admin';
import useApi from '../../hooks/useApi';
import { useLang } from '../../context/LanguageContext';
import ApiState from '../../components/ApiState/ApiState';

const EditingLanguage = createContext('mn');
const bilingual = () => ({ mn: '', en: '' });
function TextPair({ label, value, onChange, multiline = false }) {
  const editingLanguage = useContext(EditingLanguage);
  const Tag = multiline ? 'textarea' : 'input';
  return <fieldset className="about-editor-pair"><legend>{label}</legend>{[editingLanguage].map((lang) => <label key={lang}>{lang === 'mn' ? 'Монгол' : 'English'}<Tag aria-label={`${label} (${lang === 'mn' ? 'Монгол' : 'English'})`} required rows={multiline ? 5 : undefined} maxLength={10000} value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} /></label>)}</fieldset>;
}
function AboutForm({ initial }) {
  const { t } = useLang();
  const [editingLanguage, setEditingLanguage] = useState('mn');
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => { setDirty(true); setNotice(''); setForm((old) => ({ ...old, [key]: value })); };
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
      setDirty(true);
      setForm((old) => ({ ...old, photo: { ...old.photo, src: image.src } }));
    } catch (err) { setError(errorMessage(err, t)); } finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault();
    const pairs = [form.heading, form.name, form.role, form.bio, ...form.languages, ...form.stats.map(item => item.label), ...form.facts.flatMap(group => [group.title, ...group.items])];
    const missingLanguage = ['mn', 'en'].find(language => pairs.some(pair => !pair[language]?.trim()));
    if (missingLanguage) {
      setEditingLanguage(missingLanguage);
      e.currentTarget.querySelectorAll('details').forEach(section => { section.open = true; });
      setError(missingLanguage === 'mn' ? t('Монгол хэлний хоосон талбаруудыг бөглөөд дахин хадгалаарай.', 'Complete the empty Mongolian fields, then save again.') : t('Англи орчуулгын хоосон талбаруудыг бөглөөд дахин хадгалаарай.', 'Complete the empty English translations, then save again.'));
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try { const saved = await request('/admin/site/about', { method: 'PUT', body: form }); setForm(saved); setDirty(false); setNotice(t('Хадгаллаа. Нүүр хуудсыг шинэчилж өөрчлөлтийг харна уу.', 'Saved. Refresh the public home page to see changes.')); }
    catch (err) { setError(err.fields ? t('Мэдээллээ шалгана уу. Хоёр хэлний талбаруудыг бүрэн бөглөж, зургийн холбоос зөв эсэхийг шалгаарай.', 'Check that both languages are complete and the photo link is valid.') : errorMessage(err, t)); }
    finally { setBusy(false); }
  }
  return <EditingLanguage.Provider value={editingLanguage}><form onSubmit={save} onInvalidCapture={event => { let parent = event.target.parentElement; while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; } }} onChange={() => { setDirty(true); setNotice(''); }} className="about-editor">
    <div className="about-language-picker"><div><strong>{t('Засах хэл', 'Editing language')}</strong><p>{t('Эхлээд монгол мэдээллээ засаарай. Англи орчуулгыг хэлээ сольж засна.', 'Edit one language at a time. Switch languages to update the translation.')}</p></div><div role="group" aria-label={t('Засах хэл', 'Editing language')}>{['mn', 'en'].map(language => <button type="button" key={language} aria-pressed={editingLanguage === language} onClick={() => setEditingLanguage(language)}>{language === 'mn' ? 'Монгол' : 'English'}</button>)}</div></div>
    <fieldset disabled={busy} className="about-editor-fields">
      <label className="about-editor-toggle"><input type="checkbox" checked={form.visible} onChange={(e) => set('visible', e.target.checked)} />{t('Бидний тухай хэсгийг сайт дээр харуулах', 'Show the About profile on the website')}</label>
      <details className="about-step" open><summary><span>1</span><div><strong>{t('Үндсэн мэдээлэл', 'Basic information')}</strong><small>{t('Гарчиг, нэр, албан тушаал, танилцуулга', 'Heading, name, role and introduction')}</small></div></summary><div className="about-step-body">{['heading', 'name', 'role', 'bio'].map((key) => <TextPair key={key} label={({ heading: t('Хэсгийн гарчиг', 'Section heading'), name: t('Нэр', 'Name'), role: t('Албан тушаал', 'Role'), bio: t('Танилцуулга', 'Biography') })[key]} value={form[key]} onChange={(value) => set(key, value)} multiline={key === 'bio'} />)}
      </div></details><details className="about-step"><summary><span>2</span><div><strong>{t('Танилцуулгын зураг', 'Profile photo')}</strong><small>{t('Зураг солих', 'Change the profile photo')}</small></div></summary><div className="about-step-body"><fieldset><legend>{t('Зураг', 'Photo')}</legend><img className="about-editor-photo" src={form.photo.src} alt="" /><details className="about-advanced"><summary>{t('Зургийн холбоосоор оруулах', 'Use an image link instead')}</summary><label>{t('Зургийн URL', 'Image URL')}<input required value={form.photo.src} onChange={(e) => set('photo', { ...form.photo, src: e.target.value })} /></label></details><p>{t('Компьютероосоо зураг сонгоно уу. JPG, PNG, WEBP эсвэл GIF; 1 MB хүртэл.', 'Choose a JPG, PNG, WEBP or GIF from your computer, up to 1 MB.')}</p><label>{t('Зураг оруулах', 'Upload photo')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => upload(e.target.files[0])} /></label></fieldset>
      </div></details><details className="about-step"><summary><span>3</span><div><strong>{t('Хэл ба тоон үзүүлэлт', 'Languages & key numbers')}</strong><small>{t('Хэлний мэдлэг, ажлын туршлагын тоон мэдээлэл', 'Languages and highlights in numbers')}</small></div></summary><div className="about-step-body"><fieldset><legend>{t('Хэлний мэдлэг', 'Languages')}</legend>{form.languages.map((item, i) => <div className="about-editor-item" key={i}><TextPair label={`${i + 1}`} value={item} onChange={(value) => update('languages', i, value)} /><button type="button" onClick={() => remove('languages', i)}>{t('Хасах', 'Remove')}</button></div>)}<button type="button" disabled={form.languages.length >= 30} onClick={() => set('languages', [...form.languages, bilingual()])}>+ {t('Хэл нэмэх', 'Add language')}</button></fieldset>
      <fieldset><legend>{t('Тоон үзүүлэлт', 'Statistics')}</legend>{form.stats.map((item, i) => <div className="about-editor-item" key={i}><label>{t('Утга', 'Value')}<input required maxLength={100} value={item.value} onChange={(e) => update('stats', i, { ...item, value: e.target.value })} /></label><TextPair label={t('Тайлбар', 'Label')} value={item.label} onChange={(label) => update('stats', i, { ...item, label })} /><button type="button" onClick={() => remove('stats', i)}>{t('Хасах', 'Remove')}</button></div>)}<button type="button" disabled={form.stats.length >= 12} onClick={() => set('stats', [...form.stats, { value: '', label: bilingual() }])}>+ {t('Үзүүлэлт нэмэх', 'Add statistic')}</button></fieldset>
      </div></details><details className="about-step"><summary><span>4</span><div><strong>{t('Боловсрол ба туршлага', 'Education & experience')}</strong><small>{t('Бүлгээ нээж, хэрэгтэй мөрөө засаарай', 'Open a group to edit its details')}</small></div></summary><div className="about-step-body"><fieldset><legend>{t('Боловсрол, туршлага, мэргэшил, амжилт', 'Education, experience, expertise and recognition')}</legend>{form.facts.map((group, i) => <details className="about-fact-group" key={i}><summary>{group.title[editingLanguage] || t(`Бүлэг ${i + 1}`, `Group ${i + 1}`)}</summary><div className="about-step-body"><TextPair label={t('Бүлгийн гарчиг', 'Group heading')} value={group.title} onChange={(title) => update('facts', i, { ...group, title })} />{group.items.map((item, j) => <div className="about-editor-item" key={j}><TextPair multiline label={`${j + 1}`} value={item} onChange={(value) => update('facts', i, { ...group, items: group.items.map((old, k) => k === j ? value : old) })} /><button type="button" onClick={() => update('facts', i, { ...group, items: group.items.filter((_, k) => k !== j) })}>{t('Мөр хасах', 'Remove item')}</button></div>)}<button type="button" disabled={group.items.length >= 30} onClick={() => update('facts', i, { ...group, items: [...group.items, bilingual()] })}>+ {t('Мөр нэмэх', 'Add item')}</button> <button type="button" onClick={() => remove('facts', i)}>{t('Бүлэг хасах', 'Remove group')}</button></div></details>)}<button type="button" disabled={form.facts.length >= 12} onClick={() => set('facts', [...form.facts, { title: bilingual(), items: [] }])}>+ {t('Бүлэг нэмэх', 'Add group')}</button></fieldset>
      </div></details><div className="about-save-bar"><p role="status">{dirty ? t('Хадгалаагүй өөрчлөлт байна', 'You have unsaved changes') : t('Мэдээллээ зассаны дараа хадгалаарай.', 'Save when you have finished editing.')}</p><button disabled={!dirty || busy} className="btn" type="submit">{t('Өөрчлөлтийг хадгалах', 'Save changes')}</button></div>
    </fieldset>
    {busy && <p role="status">{t('Хадгалж байна…', 'Working…')}</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert" className="account-error">{error}</p>}
  </form></EditingLanguage.Provider>;
}
export default function AdminAbout() {
  const { t } = useLang();
  const api = useApi((signal) => request('/admin/site/about', { signal }), []);
  return <><p>{t('1. Хэрэгтэй бүлгээ нээнэ. 2. Мэдээллээ засна. 3. Доорх хадгалах товчийг дарна.', '1. Open a section. 2. Edit your information. 3. Save your changes below.')}</p><ApiState loading={api.loading} error={api.error} onRetry={api.reload} />{api.data && <AboutForm initial={api.data} />}</>;
}
