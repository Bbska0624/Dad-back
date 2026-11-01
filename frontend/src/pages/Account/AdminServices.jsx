import { useState } from 'react';
import { useLang } from '../../context/LanguageContext';
import { saveAdminContent, changeAdminContent, uploadAdminImage } from '../../api/admin';
import { errorMessage } from '../../api/client';
import ApiState from '../../components/ApiState/ApiState';
import { AdminModal, ConfirmDelete } from './AdminDialogs';
const fresh = () => ({number:'01 /',title:{mn:'',en:''},text:{mn:'',en:''},price:'',features:[],image:null,sortOrder:0,publication:'draft'});
export default function AdminServices({api}) {
 const {t,lang}=useLang(); const [editing,edit]=useState(null); const [deleting,del]=useState(null); const [trash,setTrash]=useState(false); const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function run(fn){setBusy(true);setError('');try{await fn();api.reload();}catch(e){setError(errorMessage(e,t));}finally{setBusy(false);}}
 const rows=(api.data||[]).filter(row=>!!row.deletedAt===trash);
 return <><div className="admin-card-heading"><h2>{t('Үйлчилгээний удирдлага','Manage services')}</h2><button className="btn" onClick={()=>edit(fresh())}>+ {t('Үйлчилгээ нэмэх','Add service')}</button></div>
 <label>{t('Жагсаалт','List')}<select value={trash?'trash':'active'} onChange={e=>setTrash(e.target.value==='trash')}><option value="active">{t('Идэвхтэй','Active')}</option><option value="trash">{t('Устгасан','Trash')}</option></select></label>
 <ApiState loading={api.loading} error={api.error} onRetry={api.reload}/>{error&&<p role="alert">{error}</p>}
 <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>{t('Үйлчилгээ','Service')}</th><th>{t('Үнэ','Price range')}</th><th>{t('Төлөв','Visibility')}</th><th>{t('Үйлдэл','Actions')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.title[lang]}</td><td>{row.price}</td><td><select disabled={busy||trash} value={row.publication} onChange={e=>run(()=>changeAdminContent('services',row.id,e.target.value))}><option value="draft">{t('Ноорог','Draft')}</option><option value="published">{t('Нийтэлсэн','Published')}</option><option value="archived">{t('Архив','Archived')}</option></select></td><td><div className="admin-row-actions">{trash?<button disabled={busy} onClick={()=>run(()=>changeAdminContent('services',row.id,'restore'))}>{t('Сэргээх','Restore')}</button>:<><button onClick={()=>edit(row)}>{t('Засах','Edit')}</button><button onClick={()=>del(row)}>{t('Устгах','Delete')}</button></>}</div></td></tr>)}</tbody></table></div>
 {!rows.length&&!api.loading&&<p>{t('Үйлчилгээ алга.','No services.')}</p>}
 {editing&&<ServiceEditor item={editing} onClose={()=>edit(null)} onSaved={()=>{edit(null);api.reload();}}/>}
 {deleting&&<ConfirmDelete title={deleting.title[lang]} onClose={()=>del(null)} onConfirm={async()=>{await changeAdminContent('services',deleting.id,'delete');api.reload();}}/>}</>;
}
function ServiceEditor({item,onClose,onSaved}){
 const {t}=useLang();const [form,setForm]=useState(()=>structuredClone(item));const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [featureText,setFeatureText]=useState(()=>({mn:item.features.map(f=>f.mn).join('\n'),en:item.features.map(f=>f.en).join('\n')}));
 const set=(key,value)=>setForm(old=>({...old,[key]:value}));
 async function save(e){e.preventDefault();setBusy(true);setError('');try{const mn=featureText.mn.split('\n').map(v=>v.trim()).filter(Boolean);const en=featureText.en.split('\n').map(v=>v.trim()).filter(Boolean);if(mn.length!==en.length)throw {code:'validation_error'};await saveAdminContent('services',{...form,features:mn.map((value,i)=>({mn:value,en:en[i]}))},item.id);onSaved();}catch(err){setError(errorMessage(err,t));}finally{setBusy(false);}}
 async function upload(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const result=await uploadAdminImage(dataUrl);set('image',{...(form.image||{}),src:result.url||result.src,srcSet:undefined});}catch(err){setError(errorMessage(err,t));}finally{setBusy(false);}}
 return <AdminModal title={t('Үйлчилгээ засах','Edit service')} onClose={onClose} busy={busy}><form onSubmit={save}><fieldset disabled={busy} style={{border:0,display:'grid',gap:16,padding:0}}>
 {['mn','en'].map(lang=><div key={lang} style={{display:'grid',gap:12}}><h3>{lang==='mn'?'Монгол':'English'}</h3><label>{t('Гарчиг','Title')}<input required maxLength={250} value={form.title[lang]} onChange={e=>set('title',{...form.title,[lang]:e.target.value})}/></label><label>{t('Тайлбар','Description')}<textarea required maxLength={4000} value={form.text[lang]} onChange={e=>set('text',{...form.text,[lang]:e.target.value})}/></label><label>{t('Дэлгэрэнгүй — мөр бүр нэг зүйл','Features — one per line')}<textarea value={featureText[lang]} onChange={e=>setFeatureText(old=>({...old,[lang]:e.target.value}))}/></label></div>)}
 <label>{t('Үнийн хүрээ','Price range')}<input required maxLength={150} value={form.price} onChange={e=>set('price',e.target.value)}/></label>
 <label>{t('Дугаар','Display number')}<input required value={form.number} onChange={e=>set('number',e.target.value)}/></label>
 <label>{t('Дараалал','Sort order')}<input type="number" min="0" step="1" required value={form.sortOrder} onChange={e=>set('sortOrder',Number(e.target.value))}/></label>
 <label>{t('Зургийн холбоос','Image URL')}<input value={form.image?.src||''} onChange={e=>set('image',e.target.value?{src:e.target.value,alt:form.title}:null)}/></label><label>{t('Зураг оруулах','Upload image')}<input type="file" accept="image/*" onChange={upload}/></label>
 <label>{t('Төлөв','Visibility')}<select value={form.publication} onChange={e=>set('publication',e.target.value)}><option value="draft">{t('Ноорог','Draft')}</option><option value="published">{t('Нийтэлсэн','Published')}</option><option value="archived">{t('Архив','Archived')}</option></select></label>
 {error&&<p role="alert">{error}</p>}<button className="btn" type="submit">{busy?t('Хадгалж байна…','Saving…'):t('Хадгалах','Save')}</button></fieldset></form></AdminModal>;
}
