'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { useApp } from '@/app/providers';

interface StatusView {
  platform: string;
  connected: boolean;
  configured: boolean;
  account_id?: string | null;
  account_name?: string | null;
  status?: string;
  error_message?: string | null;
  last_synced_at?: string | null;
}
interface StatusResponse {
  statuses: Record<string, StatusView>;
  prereqs: { supabase: boolean; encryption: boolean };
}

export default function IntegrationsSettingsPage() {
  const { t, toast } = useApp();
  const g = t.integrations;
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) setData((await res.json()) as StatusResponse);
    } catch {
      /* ignore — demo mode */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the OAuth redirect result carried in the query string.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const google = p.get('google');
    if (google === 'connected') toast(g.connectedToast);
    else if (google === 'error') toast(`${g.errorToast}: ${p.get('reason') || ''}`);
    if (google) window.history.replaceState({}, '', '/reports/settings');
  }, [g, toast]);

  const google = data?.statuses.google_ads;
  const prereqs = data?.prereqs;

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/google-ads/sync?days=${days}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Sync failed');
      toast(`${g.syncDone}: +${json.result?.imported ?? 0}`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch('/api/integrations/google-ads/sync', { method: 'DELETE' });
      toast(g.disconnected);
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={g.title} sub={g.sub} />
      <Link
        href="/reports"
        className="muted"
        style={{ fontWeight: 700, display: 'inline-block', marginBottom: 14 }}
      >
        ← {t.reports.title}
      </Link>

      {prereqs && (!prereqs.supabase || !prereqs.encryption) && (
        <div className="banner-note">
          {!prereqs.supabase && <div>{g.needSupabase}</div>}
          {!prereqs.encryption && <div>{g.needEncryption}</div>}
        </div>
      )}

      {/* Google Ads */}
      <div className="card">
        <IntegrationHead name={g.googleAds} dot="#4285f4" status={google} g={g} />
        {loading ? (
          <div className="ld">
            <div className="sp" />
            {t.common.generating}
          </div>
        ) : !google?.configured ? (
          <div className="muted">{g.needGoogleEnv}</div>
        ) : !google.connected ? (
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn btn-red btn-sm" href="/api/integrations/google-ads/auth">
              {g.connect}
            </a>
          </div>
        ) : (
          <>
            <div className="int-meta">
              <div>
                <span className="int-k">{g.account}</span>
                <span className="int-v mono">{google.account_id || '—'}</span>
              </div>
              <div>
                <span className="int-k">{g.lastSync}</span>
                <span className="int-v mono">
                  {google.last_synced_at
                    ? new Date(google.last_synced_at).toLocaleString('en-GB')
                    : g.never}
                </span>
              </div>
            </div>
            {google.status === 'error' && google.error_message && (
              <div className="banner-note" style={{ marginTop: 10 }}>
                {google.error_message}
              </div>
            )}
            <div
              className="row"
              style={{ marginTop: 12, gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div className="fi" style={{ maxWidth: 160 }}>
                <label>{g.syncPeriod}</label>
                <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  <option value={7}>{g.days7}</option>
                  <option value={30}>{g.days30}</option>
                  <option value={90}>{g.days90}</option>
                </select>
              </div>
              <button className="btn btn-red btn-sm" onClick={sync} disabled={busy}>
                {busy ? g.syncing : g.sync}
              </button>
              <button
                className="btn btn-glass btn-sm"
                onClick={disconnect}
                disabled={busy}
              >
                {g.disconnect}
              </button>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              {g.autoSourceNote}
            </div>
          </>
        )}
      </div>

      {/* Meta — arrives in Phase 2 */}
      <div className="card" style={{ opacity: 0.65 }}>
        <IntegrationHead name={g.meta} dot="var(--blue)" status={undefined} g={g} />
        <div className="muted">{g.metaSoon}</div>
      </div>
    </>
  );
}

function IntegrationHead({
  name,
  dot,
  status,
  g,
}: {
  name: string;
  dot: string;
  status?: StatusView;
  g: ReturnType<typeof useApp>['t']['integrations'];
}) {
  const connected = status?.connected;
  const isError = status?.status === 'error';
  const label = isError ? g.error : connected ? g.connected : g.notConnected;
  const color = isError ? 'var(--red)' : connected ? 'var(--green)' : 'var(--ink-faint)';
  const bg = isError
    ? 'rgba(228,0,43,.10)'
    : connected
      ? 'rgba(28,138,75,.12)'
      : 'var(--glass-strong)';
  return (
    <div
      className="row"
      style={{ justifyContent: 'space-between', marginBottom: 6, gap: 10 }}
    >
      <div className="row" style={{ gap: 8 }}>
        <span className="plat-dot" style={{ background: dot }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, textTransform: 'uppercase' }}>
          {name}
        </span>
      </div>
      <span className="plat-tag" style={{ background: bg, color }}>
        <span className="plat-dot" style={{ width: 7, height: 7, background: color }} />
        {label}
      </span>
    </div>
  );
}
