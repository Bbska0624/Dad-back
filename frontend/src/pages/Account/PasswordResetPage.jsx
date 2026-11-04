import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../../api/supabase';
import { errorMessage } from '../../api/client';
import { useLang } from '../../context/LanguageContext';
import './account.css';

export default function PasswordResetPage({ recovery = false }) {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(!recovery);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!recovery) return;
    let active = true;
    let subscription;
    try {
      const client = getSupabase();
      subscription = client.auth.onAuthStateChange((_event, session) => {
        if (active) { setHasSession(Boolean(session)); setReady(true); }
      }).data.subscription;
      client.auth.getSession().then(({ data, error: err }) => {
        if (!active) return;
        setHasSession(!err && Boolean(data.session)); setReady(true);
      }).catch(() => { if (active) { setHasSession(false); setReady(true); } });
    } catch { setError(t('Нэвтрэлтийн тохиргоо дутуу байна.', 'Authentication is not configured.')); setReady(true); }
    return () => { active = false; subscription?.unsubscribe(); };
  }, [recovery, t]);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (recovery && (password.length < 8 || password.length > 128)) { setError(t('Нууц үг 8–128 тэмдэгттэй байна.', 'Use a password with 8–128 characters.')); return; }
    if (recovery && password !== confirmation) { setError(t('Нууц үгүүд таарахгүй байна.', 'The passwords do not match.')); return; }
    setBusy(true);
    try {
      const client = getSupabase();
      if (recovery) {
        const { error: err } = await client.auth.updateUser({ password });
        if (err) throw err;
        setPassword(''); setConfirmation(''); setDone(true);
        await client.auth.signOut({ scope: 'local' });
      } else {
        const { error: err } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin + '/reset-password' });
        if (err) throw err;
        setSent(true);
      }
    } catch (err) {
      setError(errorMessage({ code: err.name === 'AuthRetryableFetchError' ? 'auth_unavailable' : err.code === 'over_email_send_rate_limit' || err.status === 429 ? 'rate_limited' : err.code }, t));
    } finally { setBusy(false); }
  }
  return <main className="account-page wrap"><div className="account-card login-card" style={{ maxWidth: 520, margin: '0 auto' }}>
    <h1 style={{ fontSize: 30 }}>{recovery ? t('Шинэ нууц үг', 'Set a new password') : t('Нууц үг сэргээх', 'Reset your password')}</h1>
    {done ? <p role="status">{t('Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.', 'Your password has been updated. Sign in with your new password.')}</p> : sent ? <p role="status">{t('Энэ имэйлээр бүртгэлтэй бол нууц үг сэргээх холбоос илгээгдэнэ. Имэйл болон спам хавтсаа шалгана уу.', 'If an account exists for this email, a reset link will be sent. Check your inbox and spam folder.')}</p> : !ready ? <p role="status">{t('Холбоосыг шалгаж байна…', 'Checking your reset link…')}</p> : recovery && !hasSession ? <p role="alert">{t('Холбоос хүчингүй эсвэл хугацаа дууссан. Шинэ холбоос авна уу.', 'This link is invalid or expired. Request a new reset link.')}</p> : <form onSubmit={submit}>
      <fieldset disabled={busy}>
        {recovery ? <><label className="auth-field">{t('Шинэ нууц үг', 'New password')}<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} /></label><label className="auth-field">{t('Нууц үг давтах', 'Confirm password')}<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label></> : <label className="auth-field">{t('Бүртгэлтэй имэйл хаяг', 'Account email')}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
        <button className="btn auth-submit" type="submit">{busy ? t('Түр хүлээнэ үү…', 'Please wait…') : recovery ? t('Нууц үг хадгалах', 'Save new password') : t('Сэргээх холбоос илгээх', 'Send reset link')}</button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="account-error">{error}</p>}
    {recovery && !hasSession && !done && <p><Link to="/forgot-password">{t('Шинэ холбоос авах', 'Request a new link')}</Link></p>}
    <p><Link to="/login">{t('Нэвтрэх рүү буцах', 'Back to login')}</Link></p>
  </div></main>;
}
