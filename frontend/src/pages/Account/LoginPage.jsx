import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { errorMessage } from '../../api/client';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import './account.css';

function PasswordVisibilityIcon({ visible }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {visible ? <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11.6 11.6 0 0 1 12 5c6 0 10 7 10 7a18.4 18.4 0 0 1-3 3.7M6.5 6.5A19.2 19.2 0 0 0 2 12s4 7 10 7a11 11 0 0 0 5.5-1.5" /></> : <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>;
}

export default function LoginPage() {
  const { user, login, logout, authError } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useDocumentTitle(t("Админ нэвтрэх — Magic Code AI", "Admin login — Magic Code AI"));
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user) return <main className="account-page wrap"><div className="account-card">
    <h1>{t('Админ эрх шаардлагатай', 'Administrator access required')}</h1>
    <p role="alert">{t('Энэ бүртгэл админ эрхгүй байна. Системийн админтай холбогдоно уу.', 'This account does not have administrator access. Contact your administrator.')}</p>
    <p>{user.email}</p>
    {authError && <p role="alert">{errorMessage(authError, t)}</p>}
    <button className="btn" onClick={logout}>{t('Өөр бүртгэлээр нэвтрэх', 'Use another account')}</button>
  </div></main>;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const profile = await login(email, password);
      if (!profile) { setError('login'); return; }
      navigate(profile.role === 'admin' ? '/admin' : '/login', { replace: true });
    } catch (err) {
      setError(err?.code || 'unknown');
    } finally {
      setBusy(false);
    }
  }

  const update = (setter) => (event) => { setter(event.target.value); setError(''); };
  return <main className="account-page wrap login-layout">
    <div className="login-intro">
      <div className="eyebrow">MAGIC CODE · ADMIN</div>
      <h1>{t('Үргэлжлүүлэн', 'Manage')}<br /><em>{t('бүтээцгээе.', 'your workspace.')}</em></h1>
      <p>{t('Сургалт, төлбөр, бүртгэл болон мэдээгээ нэг дороос удирдаарай.', 'Manage courses, enrollments, orders and news in one place.')}</p>
    </div>
    <div className="account-card login-card">
      <div className="eyebrow">{t('ЗӨВХӨН АДМИН', 'ADMIN ACCESS')}</div>
      <h2>{t('Тавтай морил', 'Welcome back')}</h2>
      <p>{t('Админ бүртгэлээрээ нэвтэрнэ үү.', 'Sign in with your administrator account.')}</p>
      {authError && <p className="account-error" role="alert">{errorMessage(authError, t)}</p>}
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <div className="auth-field"><label htmlFor="login-email">{t('Имэйл хаяг', 'Email address')}</label><input id="login-email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={update(setEmail)} /></div>
          <div className="auth-field"><label htmlFor="login-password">{t('Нууц үг', 'Password')}</label>
            <div className="auth-password"><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} value={password} onChange={update(setPassword)} /><button type="button" aria-label={showPassword ? t('Нууц үг нуух', 'Hide password') : t('Нууц үг харах', 'Show password')} aria-controls="login-password" aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}><PasswordVisibilityIcon visible={showPassword} /></button></div>
          </div>
          {error && <p className="account-error" role="alert">{errorMessage({ code: error }, t)}</p>}
          <button className="btn auth-submit" type="submit">{busy ? t('Түр хүлээнэ үү…', 'Please wait…') : t('Нэвтрэх →', 'Log in →')}</button>
        </fieldset>
      </form>
      <p className="auth-switch">{t('Нэвтрэх эрхийг системийн админ олгоно.', 'Access is provided by your system administrator.')}</p>
    </div>
  </main>;
}
