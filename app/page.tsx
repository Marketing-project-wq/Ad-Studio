'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { useApp } from '@/app/providers';
import { getStats, listGenerations } from '@/lib/history';
import { PLATFORM_META } from '@/lib/brand';
import { PLATFORM_LABELS, type AdGeneration, type Platform } from '@/lib/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const { t } = useApp();
  const [gens, setGens] = useState<AdGeneration[]>([]);
  const [stats, setStats] = useState({
    totalGenerated: 0,
    activeCampaigns: 0,
    utmLinks: 0,
  });
  const [assetCount, setAssetCount] = useState<number | null>(null);

  useEffect(() => {
    setGens(listGenerations());
    setStats(getStats());
    // Asset count from Supabase (if configured); ignore errors.
    fetch('/api/assets')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.assets) setAssetCount(j.assets.length);
      })
      .catch(() => {});
  }, []);

  const platformCount = (p: Platform) =>
    gens.filter((g) => g.platform === p).length;

  const d = t.dashboard;

  const platforms: { p: Platform; desc: string }[] = [
    { p: 'google_display', desc: 'Responsive display banners & Gmail ads' },
    { p: 'google_sem', desc: 'Keyword strategy & search ad copy' },
    { p: 'google_pmax', desc: 'Full asset groups for Performance Max' },
    { p: 'meta', desc: 'Facebook & Instagram feed / stories copy' },
  ];

  return (
    <>
      <PageHeader title={d.title} sub={d.sub} />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{d.totalGenerated}</div>
          <div className="stat-value">{stats.totalGenerated}</div>
          <div className="stat-foot">all platforms</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{d.activeCampaigns}</div>
          <div className="stat-value">{stats.activeCampaigns}</div>
          <div className="stat-foot">unique products</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{d.utmLinks}</div>
          <div className="stat-value">{stats.utmLinks}</div>
          <div className="stat-foot">saved links</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{d.assets}</div>
          <div className="stat-value">{assetCount ?? '—'}</div>
          <div className="stat-foot">in library</div>
        </div>
      </div>

      <div className="section-title">{d.platforms}</div>
      <div className="plat-grid">
        {platforms.map(({ p, desc }) => {
          const meta = PLATFORM_META[p];
          return (
            <Link key={p} href={meta.route} className="plat-card">
              <div className="plat-head">
                <span className="plat-dot" style={{ background: meta.dot }} />
                <span className="plat-title">{PLATFORM_LABELS[p]}</span>
              </div>
              <div className="plat-desc">{desc}</div>
              <div className="plat-count">
                {platformCount(p)} generated · {d.openGenerator} →
              </div>
            </Link>
          );
        })}
      </div>

      <div className="section-title">{d.recent}</div>
      <div className="card">
        {gens.length === 0 ? (
          <div className="es">
            <div className="es-ico">✦</div>
            <p>{d.recentEmpty}</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>{t.history.colCampaign}</th>
                <th>{t.history.colPlatform}</th>
                <th>{t.history.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {gens.slice(0, 8).map((g) => {
                const meta = PLATFORM_META[g.platform];
                const brief = g.input_brief as { product?: string };
                return (
                  <tr key={g.id}>
                    <td>{brief.product || '—'}</td>
                    <td>
                      <span
                        className="plat-tag"
                        style={{
                          background: 'var(--glass-strong)',
                          color: 'var(--ink)',
                        }}
                      >
                        <span
                          className="plat-dot"
                          style={{ background: meta.dot, width: 7, height: 7 }}
                        />
                        {PLATFORM_LABELS[g.platform]}
                      </span>
                    </td>
                    <td className="mono">{formatDate(g.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
