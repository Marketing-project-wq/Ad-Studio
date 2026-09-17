'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useApp } from '@/app/providers';

interface Health {
  integrations: { ai: boolean; supabase: boolean };
}

function StatusRow({ label, ok, t }: { label: string; ok: boolean; t: ReturnType<typeof useApp>['t'] }) {
  return (
    <div
      className="row"
      style={{
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
      <span
        className="plat-tag"
        style={{
          background: ok ? 'rgba(28,138,75,.12)' : 'var(--glass-strong)',
          color: ok ? 'var(--green)' : 'var(--ink-faint)',
        }}
      >
        <span
          className="plat-dot"
          style={{
            background: ok ? 'var(--green)' : 'var(--ink-faint)',
            width: 7,
            height: 7,
          }}
        />
        {ok ? t.settings.connected : t.settings.notConnected}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang, isDark, toggleTheme } = useApp();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setHealth(j))
      .catch(() => setHealth({ integrations: { ai: false, supabase: false } }));
  }, []);

  const s = t.settings;
  const ai = health?.integrations.ai ?? false;
  const supabase = health?.integrations.supabase ?? false;

  return (
    <>
      <PageHeader title={s.title} sub={s.sub} />

      <div className="section-title">{s.integrations}</div>
      <div className="card">
        <StatusRow label={s.ai} ok={ai} t={t} />
        <StatusRow label={s.supabase} ok={supabase} t={t} />
      </div>

      <div className="section-title">{s.language}</div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
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
            <span>{isDark ? s.theme + ': Dark' : s.theme + ': Light'}</span>
          </button>
        </div>
      </div>

      <div className="section-title">{s.about}</div>
      <div className="card">
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
          {s.aboutText}
        </p>
      </div>
    </>
  );
}
