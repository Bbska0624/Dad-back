import { useLang } from '../../context/LanguageContext';

export default function WorkspaceHeading({ eyebrow, title, description, actions, onLogout }) {
  const { t } = useLang();
  return <div className="workspace-heading">
    <div className="eyebrow">{eyebrow}</div>
    <div className="workspace-title-row">
      <h1>{title}</h1>
      <div className="workspace-heading-actions">
        {actions}
        <button type="button" className="btn secondary workspace-logout" onClick={onLogout}>
          {t('Гарах', 'Log out')}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h13" /></svg>
        </button>
      </div>
    </div>
    <p>{description}</p>
  </div>;
}
