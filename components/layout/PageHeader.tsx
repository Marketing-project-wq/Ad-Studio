'use client';

import { useApp } from '@/app/providers';

export default function PageHeader({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  const { lang, setLang, isDark, toggleTheme, t } = useApp();

  return (
    <div className="main-hdr">
      <div>
        <div className="main-title">{title}</div>
        <div className="main-sub">{sub}</div>
      </div>
      <div className="hdr-actions">
        <div className="toggle-group">
          <button
            className={`toggle-btn${lang === 'id' ? ' act' : ''}`}
            onClick={() => setLang('id')}
          >
            🇮🇩 ID
          </button>
          <button
            className={`toggle-btn${lang === 'en' ? ' act' : ''}`}
            onClick={() => setLang('en')}
          >
            🇺🇸 EN
          </button>
        </div>
        <button className="mode-btn" onClick={toggleTheme}>
          <span>{isDark ? '☀' : '☾'}</span>
          <span>{isDark ? t.common.lightMode : t.common.darkMode}</span>
        </button>
      </div>
    </div>
  );
}
