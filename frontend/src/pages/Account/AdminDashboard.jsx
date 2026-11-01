import AdminServices from './AdminServices';
import { useId, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import ApiState from '../../components/ApiState/ApiState';
import useApi from '../../hooks/useApi';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { getAdminActivity, getAdminContent } from '../../api/admin';
import AdminContentManager from './AdminContentManager';
import AdminRecordsManager from './AdminRecordsManager';
import AdminUsers from './AdminUsers';
import AdminCourseOrders from './AdminCourseOrders';
import { textOf } from './adminTools';
import { enrollmentAnalytics } from './adminAnalytics';
import WorkspaceHeading from './WorkspaceHeading';
import './admin.css';

const ADMIN_TABS = [
  { id: 'services', mn: 'Үйлчилгээ', en: 'Services' },
  { id: 'overview', mn: 'Тойм', en: 'Overview' },
  { id: 'courses', mn: 'Сургалтууд', en: 'Courses' },
  { id: 'course-orders', mn: 'Сургалтын төлбөр', en: 'Course payments' },
  { id: 'enrollments', mn: 'Элсэлтүүд', en: 'Enrollments' },
  { id: 'orders', mn: 'Захиалгууд', en: 'Orders' },
  { id: 'news', mn: 'Мэдээлэл', en: 'Content' },
  { id: 'users', mn: 'Хэрэглэгчид', en: 'Users' },
  { id: 'activity', mn: 'Үйлдлийн түүх', en: 'Activity' },
];

function EnrollmentChart({ timeline, locale, t }) {
  const gradient = useId();
  const ceiling = Math.max(4, Math.ceil(Math.max(...timeline.map((bucket) => bucket.count)) / 4) * 4);
  const step = 564 / timeline.length;
  const date = (value) => value.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
  const label = (bucket) => date(bucket.from) === date(bucket.last) ? date(bucket.from) : `${date(bucket.from)}–${date(bucket.last)}`;
  const total = timeline.reduce((sum, bucket) => sum + bucket.count, 0);
  return <>
    <div className="admin-trend-scroll"><svg className="admin-trend" viewBox="0 0 640 246" role="img" aria-label={t(`Элсэлтийн баганан график. Нийт ${total} бүртгэл.`, `Enrollment bar chart. ${total} records in total.`)}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--admin-accent)" /><stop offset="1" stopColor="var(--admin-accent-soft)" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((tick) => <g key={tick}>
        <line x1="44" x2="620" y1={196 - tick * 40} y2={196 - tick * 40} className="admin-gridline" />
        <text x="30" y={201 - tick * 40} textAnchor="end">{ceiling * tick / 4}</text>
      </g>)}
      {timeline.map((bucket, index) => {
        const height = bucket.count / ceiling * 160;
        const x = 50 + index * step;
        return <g key={bucket.from.toISOString()}>
          <rect x={x + step * .18} y={196 - height} width={step * .64} height={height} rx="5" fill={`url(#${gradient})`}>
            <title>{label(bucket)}: {bucket.count}</title>
          </rect>
          {bucket.count > 0 && <text x={x + step / 2} y={188 - height} textAnchor="middle" className="admin-bar-value">{bucket.count}</text>}
          <text x={x + step / 2} y="222" textAnchor="middle">{label(bucket)}</text>
        </g>;
      })}
    </svg></div>
    {total === 0 && <p className="admin-empty-inline">{t('Энэ хугацаанд сургалтын бүртгэл үүсээгүй байна.', 'No enrollments in this period yet.')}</p>}
    <details className="admin-chart-data"><summary>{t('Тоон мэдээлэл харах', 'View chart data')}</summary>
      <dl>{timeline.map((bucket) => <div key={bucket.from.toISOString()}><dt>{label(bucket)}</dt><dd>{bucket.count}</dd></div>)}</dl>
    </details>
  </>;
}

function AdminWorkspace() {
  const { records, logout } = useAuth();
  const { lang, t } = useLang();
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState('overview');
  const courseApi = useApi((signal) => getAdminContent('courses', { signal }), []);
  const servicesApi = useApi((signal) => getAdminContent('services', { signal }), []);
  const newsApi = useApi((signal) => getAdminContent('news', { signal }), []);
  const activityApi = useApi((signal) => getAdminActivity({ signal }), []);
  const courses = (courseApi.data || []).filter((course) => !course.deletedAt);
  const locale = lang === 'mn' ? 'mn-MN' : 'en-US';
  const analytics = enrollmentAnalytics(records, courses, days);
  const categories = [...new Set(courses.map((course) => course.category))];
  const categoryCounts = categories.map((name) => ({ name, count: courses.filter((course) => course.category === name).length }));
  const categoryMax = Math.max(1, ...categoryCounts.map((item) => item.count));
  const metrics = [
    { label: t('Нийт сургалт', 'Total courses'), value: courseApi.data ? courses.length : '—', detail: t('Сургалтын каталогоос', 'From the course catalog'), icon: 'courses' },
    { label: t('Сургалтын бүртгэл', 'Enrollments'), value: analytics.selected.length, detail: t(`Сүүлийн ${days} хоногт`, `In the last ${days} days`), icon: 'enrollments' },
    { label: t('Суралцагч', 'Learners'), value: analytics.learners, detail: t('Давхардалгүй бүртгэл', 'Unique enrolled accounts'), icon: 'learners' },
    { label: t('Шинэ хүсэлт', 'Pending requests'), value: analytics.pending, detail: t('Шалгах шаардлагатай', 'Awaiting review'), icon: 'pending' },
  ];
  return <>

    <main className="account-page workspace-page admin-page wrap">
      <WorkspaceHeading
        eyebrow="MAGIC CODE · ADMIN"
        title={t('Удирдлагын самбар', 'Admin dashboard')}
        description={t('Сургалт, элсэлт, мэдээллээ нэг дороос хянаарай.', 'Monitor courses, enrollments and content in one place.')}
        onLogout={logout}
      />
      <div className="admin-toolbar">
        <div className="admin-sections" role="tablist" aria-label={t('Удирдлагын хэсгүүд', 'Dashboard sections')}>
          {ADMIN_TABS.map((tab, index) => <button key={tab.id} id={`admin-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`admin-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)} onKeyDown={(event) => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % ADMIN_TABS.length;
            else if (event.key === 'ArrowLeft') next = (index + ADMIN_TABS.length - 1) % ADMIN_TABS.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = ADMIN_TABS.length - 1;
            else return;
            event.preventDefault();
            setActiveTab(ADMIN_TABS[next].id);
            event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus({ preventScroll: true });
          }}>{t(tab.mn, tab.en)}</button>)}
        </div>
        <label className="admin-period">{t('Хугацаа', 'Period')}<select value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {[7, 30, 90].map((value) => <option value={value} key={value}>{t(`Сүүлийн ${value} хоног`, `Last ${value} days`)}</option>)}
        </select></label>
      </div>
      <div className="admin-demo-note"><span className="admin-note-dot" /><p>{t('Бодит backend-д холбогдсон удирдлагын самбар.', 'Admin dashboard connected to the live backend.')}</p></div>

      <section id="admin-overview" className="admin-overview-section" role="tabpanel" aria-labelledby="admin-tab-overview" tabIndex={0} hidden={activeTab !== 'overview'}>
        <div className="admin-metrics">{metrics.map((metric, index) => <div className="account-card admin-metric" key={metric.icon}>
          <div className="admin-metric-top"><span>{metric.label}</span><span className={`admin-metric-icon admin-metric-icon--${index}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{index === 0 ? <><path d="M4 5h6a3 3 0 0 1 3 3v12a4 4 0 0 0-4-2H4zM20 5h-4a3 3 0 0 0-3 3M20 5v13h-3" /></> : index === 1 ? <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 3v4m6-4v4M9 12h6m-6 4h4" /></> : index === 2 ? <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}</svg></span></div>
          <strong>{metric.value}</strong><small>{metric.detail}</small>
        </div>)}</div>
        <div className="admin-charts">
          <section className="account-card admin-chart-card"><div className="admin-card-heading"><div><h2>{t('Элсэлтийн идэвх', 'Enrollment activity')}</h2><p>{t(`Сүүлийн ${days} хоногийн сургалтын бүртгэл`, `Course enrollments over the last ${days} days`)}</p></div><span className="admin-chart-total">{analytics.selected.length}<small>{t('бүртгэл', 'enrollments')}</small></span></div>
            <EnrollmentChart timeline={analytics.timeline} locale={locale} t={t} />
          </section>
          <section className="account-card admin-chart-card"><div className="admin-card-heading"><div><h2>{t('Сургалтын чиглэлүүд', 'Course categories')}</h2><p>{t('Каталог дахь сургалтын тоо', 'Number of courses in the catalog')}</p></div></div>
            <ApiState loading={courseApi.loading} error={courseApi.error} onRetry={courseApi.reload} />
            {courseApi.data && <div className="admin-category-bars">{categoryCounts.map((item, index) => <div className="admin-category-row" key={item.name}>
              <div><span>{item.name}</span><strong>{item.count}</strong></div><div className="admin-bar-track"><span className={`admin-category-fill admin-category-fill--${index % 4}`} style={{ width: `${item.count / categoryMax * 100}%` }} /></div>
            </div>)}{!courses.length && <p className="admin-empty-inline">{t('Сургалт бүртгэгдээгүй байна.', 'No courses in the catalog yet.')}</p>}</div>}
            {courseApi.data && <div className="admin-catalog-summary"><span><i />{t('Нээлттэй', 'Open')} <strong>{courses.filter((course) => course.status === 'open').length}</strong></span><span><i />{t('Хүлээлт / төлөвлөгөө', 'Waitlist / planned')} <strong>{courses.filter((course) => ['waitlist', 'planned'].includes(course.status)).length}</strong></span></div>}
          </section>
        </div>
      </section>

      <section id="admin-courses" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-courses" tabIndex={0} hidden={activeTab !== 'courses'}>
        <AdminContentManager type="courses" api={courseApi} />
      </section>
      <section id="admin-course-orders" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-course-orders" tabIndex={0} hidden={activeTab !== 'course-orders'}>
        {activeTab === 'course-orders' && <AdminCourseOrders />}
      </section>
      <section id="admin-enrollments" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-enrollments" tabIndex={0} hidden={activeTab !== 'enrollments'}>
        <AdminRecordsManager type="course" days={days} />
      </section>
      <section id="admin-orders" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-orders" tabIndex={0} hidden={activeTab !== 'orders'}>
        <AdminRecordsManager type="order" days={days} />
      </section>
      <section id="admin-services" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-services" hidden={activeTab !== 'services'}><AdminServices api={servicesApi}/></section>
      <section id="admin-news" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-news" tabIndex={0} hidden={activeTab !== 'news'}>
        <AdminContentManager type="news" api={newsApi} />
      </section>
      <section id="admin-users" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-users" tabIndex={0} hidden={activeTab !== 'users'}>
        <AdminUsers />
      </section>
      <section id="admin-activity" className="account-card admin-panel" role="tabpanel" aria-labelledby="admin-tab-activity" tabIndex={0} hidden={activeTab !== 'activity'}>
        <div className="admin-card-heading"><div><h2>{t('Үйлдлийн түүх', 'Activity log')}</h2><p>{t('Мэдээ, сургалтын сүүлийн 150 өөрчлөлт', 'The latest 150 story and course changes')}</p></div></div>
        <ApiState loading={activityApi.loading} error={activityApi.error} onRetry={activityApi.reload} />
        <ul className="admin-activity-list">{activityApi.data?.map((entry) => <li key={entry.id}><div><strong>{textOf(entry.title, lang)}</strong><span>{({ create: t('Нэмсэн', 'Created'), update: t('Зассан', 'Edited'), delete: t('Устгасан', 'Deleted'), restore: t('Сэргээсэн', 'Restored'), published: t('Нийтэлсэн', 'Published'), paid: t('Төлбөр баталсан', 'Payment confirmed'), cancelled: t('Захиалга цуцалсан', 'Order cancelled'), draft: t('Ноорог болгосон', 'Moved to draft'), archived: t('Архивласан', 'Archived') })[entry.action]}</span></div><time dateTime={entry.at}>{new Date(entry.at).toLocaleString(locale)}</time></li>)}</ul>
        {activityApi.data?.length === 0 && <p className="admin-empty-inline">{t('Одоогоор өөрчлөлт хийгдээгүй байна.', 'No changes yet.')}</p>}
      </section>
    </main>
  </>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  useDocumentTitle(t('Удирдлагын самбар — Magic Code AI', 'Admin dashboard — Magic Code AI'));
  const { loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== 'admin') return <Navigate to="/login" replace />;
  return <AdminWorkspace />;
}
