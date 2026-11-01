import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useLang } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import { errorMessage } from './api/client';
import LoginPage from './pages/Account/LoginPage';
import AdminDashboard from './pages/Account/AdminDashboard';

function Shell() {
  const { user, loading, authError, reload } = useAuth();
  const { lang, toggleLang, t } = useLang();
  const { toggleTheme } = useTheme();
  if (loading) return <main className="account-page wrap"><p role="status">{t('Нэвтрэлтийг шалгаж байна…', 'Checking your session…')}</p></main>;
  return <>
    <header className="package-header"><Link to={user?.role === 'admin' ? '/admin' : '/login'}>MAGIC CODE · ADMIN</Link><div><button onClick={toggleLang} aria-label={t('Хэл солих', 'Switch language')}>{lang === 'mn' ? 'EN' : 'MN'}</button><button onClick={toggleTheme}>{t('Горим солих', 'Theme')}</button></div></header>
    <Routes>
      <Route path="/login" element={<LoginPage key="login" />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to={user?.role === 'admin' ? '/admin' : '/login'} replace />} />
    </Routes>
    {authError && user && <div className="account-page wrap"><p role="alert">{errorMessage(authError, t)}</p><button className="btn secondary" onClick={() => reload().catch(() => {})}>{t('Дахин оролдох', 'Retry')}</button></div>}
  </>;
}
export default function App() { return <AuthProvider><Shell /></AuthProvider>; }
