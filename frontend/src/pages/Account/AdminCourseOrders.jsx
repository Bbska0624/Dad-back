import { useEffect, useState } from 'react';
import { useLang } from '../../context/LanguageContext';
import { errorMessage } from '../../api/client';
import { changeCourseOrder, getCourseOrders } from '../../api/admin';
import ApiState from '../../components/ApiState/ApiState';
import useApi from '../../hooks/useApi';
import { AdminModal } from './AdminDialogs';
import { downloadCsv, matchSearch, textOf } from './adminTools';
import './adminPayments.css';

// Сайтын сагснаас ирсэн сургалтын захиалга. Банкны шилжүүлгийг шалгаад "Төлөгдсөн" дарахад
// хэрэглэгчид хичээл үзэх эрх 3 сараар автоматаар нээгдэнэ.
const STATUSES = ['pending_review', 'pending_payment', 'awaiting_quote', 'paid', 'cancelled'];

export default function AdminCourseOrders({ initialQuery = '', onChanged = () => {} }) {
  const { t, lang } = useLang();
  const api = useApi((signal) => getCourseOrders({ signal }), []);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState('unpaid');
  const [confirm, setConfirm] = useState(null); // { order, action }
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && !confirm) api.reload(); }, 15000);
    return () => window.clearInterval(timer);
  }, [confirm]);
  const locale = lang === 'mn' ? 'mn-MN' : 'en-US';
  const date = (value) => (value ? new Date(value).toLocaleString(locale) : '—');
  const money = (value) => (value == null ? '—' : `${value.toLocaleString(locale)}₮`);
  const label = (value) => ({
    pending_review: t('Шалгуулах хүсэлт ирсэн', 'Review requested'), pending_payment: t('Төлбөр хүлээгдэж буй', 'Awaiting payment'),
    awaiting_quote: t('Үнэ тодорхойгүй', 'Awaiting quote'), paid: t('Төлөгдсөн', 'Paid'), cancelled: t('Цуцалсан', 'Cancelled'),
  })[value] || value;
  const titles = (order) => order.kind === 'topup' ? [t('Хэтэвч цэнэглэлт', 'Wallet top-up')] : order.items.map((item) => textOf(item.title, lang) || item.courseId);
  const unpaid = (api.data || []).filter((order) => ['pending_payment', 'pending_review'].includes(order.status));
  const rows = (api.data || []).filter((order) => (status === 'all' || (status === 'unpaid' ? ['pending_payment', 'pending_review'].includes(order.status) : order.status === status))
    && matchSearch(query, [order.id, order.user?.name, order.user?.email, order.user?.phone, ...titles(order)]));

  async function run() {
    if (!confirm || busy || (confirm.action === 'paid' && !verified)) return;
    const { order, action } = confirm;
    setBusy(true); setError('');
    try {
      await changeCourseOrder(order.id, action);
      setNotice(action === 'paid' && order.kind === 'topup' ? t('Цэнэглэлт баталгаажлаа.', 'Wallet top-up confirmed.') : action === 'paid' ? t('Төлбөр батлагдаж, хичээл үзэх эрх нээгдлээ.', 'Payment confirmed and lessons unlocked.') : t('Захиалга цуцлагдлаа.', 'Order cancelled.'));
      setConfirm(null);
      api.reload();
      onChanged();
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }

  async function copyReference(id) {
    try { await navigator.clipboard.writeText(id); setNotice(t('Гүйлгээний утгыг хууллаа.', 'Transfer reference copied.')); }
    catch { setError(t('Хуулж чадсангүй. Дугаарыг сонгож хуулна уу.', 'Could not copy. Select the reference and copy manually.')); }
  }

  return <>
    <div className="admin-card-heading"><div><h2>{t('Сургалтын төлбөр', 'Course payments')}</h2><p>{t('Банкны шилжүүлгийг шалгаад "Төлөгдсөн" дарахад суралцагчид 3 сарын хугацаатай хичээл үзэх эрх нээгдэнэ.', 'Verify the bank transfer, then mark it paid to unlock three months of lessons.')}</p></div>
      <button className="btn secondary" disabled={!rows.length} onClick={() => downloadCsv('course-orders.csv', [['ID', t('Нэр', 'Name'), t('Имэйл', 'Email'), t('Сургалт', 'Courses'), t('Дүн', 'Amount'), t('Төлөв', 'Status'), t('Огноо', 'Date')], ...rows.map((order) => [order.id, order.user?.name || '', order.user?.email || '', titles(order).join('; '), order.amount ?? '', label(order.status), date(order.createdAt)])])}>{t('CSV татах', 'Export CSV')}</button>
    </div>
    <div className="admin-payment-summary"><div><strong>{unpaid.length}</strong><span>{t('Шалгах төлбөр', 'Payments to review')}</span></div><p>{t('Хаан банк эсвэл ХХБ-ны орлогын гүйлгээний утга, дүнг захиалгатай тулгаж шалгана уу. Энд харагдах төлөв нь банкнаас мөнгө орсны баталгаа биш.', 'Match the reference and amount against incoming transactions in Khan Bank or TDB. An order status is not proof of receipt.')}</p><button className="btn secondary" disabled={api.loading || busy} onClick={api.reload}>{t('Шинэчлэх', 'Refresh')}</button></div>
    <div className="admin-management-filters"><label>{t('Хайх', 'Search')}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Нэр, имэйл, сургалт, захиалгын дугаар…', 'Name, email, course, order ID…')} /></label>
      <label>{t('Төлөв', 'Status')}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="unpaid">{t('Шалгах төлбөрүүд', 'Payments to review')}</option><option value="all">{t('Бүх төлөв', 'All statuses')}</option>{STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label></div>
    <ApiState loading={api.loading} error={api.error} onRetry={api.reload} />
    <p role="status" className="admin-feedback">{notice}</p>{error && !confirm && <p role="alert" className="account-error">{error}</p>}
    {api.data && <>
      <p className="admin-list-count">{rows.length} {t('захиалга', 'orders')}</p>
      <div className="admin-table-scroll"><table className="admin-table"><caption className="admin-sr-only">{t('Сургалтын захиалгууд', 'Course orders')}</caption>
        <thead><tr><th>{t('Хэрэглэгч', 'Customer')}</th><th>{t('Сургалт', 'Courses')}</th><th>{t('Дүн', 'Amount')}</th><th>{t('Огноо', 'Date')}</th><th>{t('Төлөв', 'Status')}</th><th>{t('Үйлдлүүд', 'Actions')}</th></tr></thead>
        <tbody>{rows.map((order) => <tr key={order.id}>
          <th scope="row">{order.user?.name || order.userId}<small>{order.user?.email}</small><small>{order.user?.phone}</small></th>
          <td>{titles(order).map((title) => <div key={title}>{title}</div>)}<small className="admin-cell-detail">{t('Гүйлгээний утга', 'Reference')}: {order.id}</small><button className="admin-copy-reference" type="button" onClick={() => copyReference(order.id)}>{t('Утга хуулах', 'Copy reference')}</button></td>
          <td>{money(order.amount)}</td>
          <td className="admin-date">{date(order.createdAt)}{order.reportedAt && <small className="admin-cell-detail">{t('Мэдэгдсэн', 'Reported')}: {date(order.reportedAt)}</small>}</td>
          <td>{label(order.status)}{order.paidAt && <small className="admin-cell-detail">{date(order.paidAt)}</small>}</td>
          <td><div className="admin-row-actions">
            {['pending_payment', 'pending_review'].includes(order.status) && <button onClick={() => { setError(''); setVerified(false); setConfirm({ order, action: 'paid' }); }}>{t('Төлөгдсөн', 'Mark paid')}</button>}
            {order.status !== 'cancelled' && <button className="admin-delete-button" onClick={() => { setError(''); setConfirm({ order, action: 'cancelled' }); }}>{order.status === 'paid' ? t('Эрх цуцлах', 'Revoke access') : t('Цуцлах', 'Cancel')}</button>}
          </div></td>
        </tr>)}</tbody></table>{!rows.length && <p className="admin-empty-inline">{t('Тохирох захиалга алга.', 'No matching orders.')}</p>}</div>
    </>}
    {confirm && <AdminModal busy={busy} title={confirm.action === 'paid' ? t('Төлбөрийг батлах уу?', 'Confirm payment?') : t('Захиалгыг цуцлах уу?', 'Cancel this order?')} onClose={() => !busy && setConfirm(null)}>
      <dl className="admin-detail-list"><dt>{t('Хэрэглэгч', 'Customer')}</dt><dd>{confirm.order.user?.name} · {confirm.order.user?.email}</dd><dt>{t('Сургалт', 'Courses')}</dt><dd>{titles(confirm.order).join(', ')}</dd><dt>{t('Дүн', 'Amount')}</dt><dd>{money(confirm.order.amount)}</dd><dt>{t('Гүйлгээний утга', 'Reference')}</dt><dd>{confirm.order.id}</dd></dl>
      <p>{confirm.action === 'paid' ? t('Дансанд яг энэ дүн орсныг шалгасны дараа батлаарай. Батлахад хичээл үзэх эрх шууд 3 сараар нээгдэнэ.', 'Only confirm after the exact amount has arrived. Lessons unlock immediately for three months.') : confirm.order.status === 'paid' ? t('Хичээл үзэх эрх хаагдана. Банкны шилжүүлгийн мөнгийг систем буцаахгүй; шаардлагатай буцаалтыг банкаар тусад нь хийнэ.', 'Lesson access is revoked. Bank transfer funds are not refunded by this action; handle any refund separately through your bank.') : t('Хэрэглэгч дахин захиалга үүсгэх боломжтой болно.', 'The learner can place a new order.')}</p>
      {confirm.action === 'paid' && <label className="admin-payment-verified"><input type="checkbox" checked={verified} disabled={busy} onChange={(event) => setVerified(event.target.checked)} /><span>{t('Банкны бодит орлогын гүйлгээний утга, дүн таарч байгааг шалгасан. Энэ гүйлгээг өөр захиалгад ашиглаагүй.', 'I checked the actual incoming bank transaction: the reference and amount match, and it has not been used for another order.')}</span></label>}
      {error && <p className="account-error" role="alert">{error}</p>}
      <div className="admin-dialog-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirm(null)}>{t('Болих', 'Back')}</button><button type="button" className="btn" disabled={busy || api.loading || (confirm.action === 'paid' && !verified)} onClick={run}>{busy ? t('Түр хүлээнэ үү…', 'Please wait…') : confirm.action === 'paid' ? t('Төлөгдсөн болгох', 'Mark paid') : t('Тийм, цуцлах', 'Yes, cancel')}</button></div>
    </AdminModal>}
  </>;
}
