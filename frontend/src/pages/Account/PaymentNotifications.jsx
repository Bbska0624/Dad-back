import { useEffect, useState } from 'react';
import { getPaymentNotifications } from '../../api/admin';
import { useLang } from '../../context/LanguageContext';
import './adminPayments.css';

export default function PaymentNotifications({ onReview, revision }) {
  const { t, lang } = useLang();
  const [data, setData] = useState({ count: 0, orders: [] });
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (inFlight || controller.signal.aborted || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const result = await getPaymentNotifications({ signal: controller.signal });
        if (!controller.signal.aborted) { setData(result); setFailed(false); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { inFlight = false; }
    }
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [revision, attempt]);
  const locale = lang === 'mn' ? 'mn-MN' : 'en-US';
  return <aside className="admin-payment-notifications" aria-label={t('Төлбөрийн мэдэгдэл', 'Payment notifications')}>
    <div className="admin-card-heading"><h2>{t('Төлбөр шалгуулах хүсэлт', 'Payment review requests')} <span className="admin-notification-count" role="status">{data.count}</span></h2><button className="btn secondary" onClick={() => setAttempt((n) => n + 1)}>{t('Шинэчлэх', 'Refresh')}</button></div>
    {failed ? <p role="alert">{t('Мэдэгдэл шинэчилж чадсангүй. Дахин оролдоно уу.', 'Could not refresh notifications. Please retry.')}</p> : <p>{data.count ? t('Хэрэглэгчид төлбөрөө шалгуулах хүсэлт илгээсэн. Банктай тулгаж гараар баталгаажуулна уу.', 'Customers requested payment review. Check your bank transactions before approving.') : t('Шалгуулах шинэ хүсэлт алга.', 'No pending review requests.')}</p>}
    {data.orders.slice(0, 5).map((order) => <button className="admin-payment-notification" key={order.id} onClick={() => onReview(order.id)}>
      <span><strong>{order.user?.name || order.user?.email || t('Хэрэглэгч', 'Customer')}</strong><small>{order.id}</small><small>{new Date(order.reportedAt).toLocaleString(locale)}</small></span>
      <span><strong>{order.amount?.toLocaleString(locale)}₮</strong><small>{t('Шалгах →', 'Review →')}</small></span>
    </button>)}
    {data.count > 5 && <button className="btn secondary" onClick={() => onReview('')}>{t('Бүх хүсэлт харах', 'View all requests')}</button>}
  </aside>;
}
