import { useLang } from '../../context/LanguageContext';
import { errorMessage } from '../../api/client';

// Ачааллаж байх эсвэл алдаа гарсан үед харуулна. Өгөгдөл бэлэн бол юу ч харуулахгүй.
export default function ApiState({ loading, error, onRetry }) {
  const { t } = useLang();
  if (loading) {
    return <p className="api-state muted" role="status">{t('Ачааллаж байна…', 'Loading…')}</p>;
  }
  if (error) {
    return (
      <div className="api-state" role="alert">
        <p className="muted">{errorMessage(error, t)}</p>
        {onRetry && (
          <button type="button" className="btn secondary" onClick={onRetry}>
            {t('Дахин оролдох', 'Try again')}
          </button>
        )}
      </div>
    );
  }
  return null;
}
