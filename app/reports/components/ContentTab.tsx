'use client';

import { useEffect, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp } from '@/app/providers';
import { fetchContentInsights } from '@/lib/db/reports';
import type { ContentInsights } from '@/lib/db/types';
import { PLATFORM_SHORT, ReportState, useChartTheme } from './shared';

export default function ContentTab({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { t } = useApp();
  const th = useChartTheme();
  const [data, setData] = useState<ContentInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetchContentInsights(startDate, endDate)
      .then((d) => active && setData(d))
      .catch((e) => {
        if (!active) return;
        if (e?.name === 'NotConfiguredError') setNotConfigured(true);
        else setError(e instanceof Error ? e.message : 'Error');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [startDate, endDate]);

  const langColors: Record<string, string> = {
    id: th.colors.google_display,
    en: th.colors.google_pmax,
  };
  const langData = Object.entries(data?.language_split || {}).map(([k, v]) => ({
    name: k === 'id' ? 'Indonesia' : 'English',
    value: v,
    color: langColors[k] || th.tick.fill,
  }));
  const platData = Object.entries(data?.platform_distribution || {}).map(
    ([k, v]) => ({
      name: PLATFORM_SHORT[k] || k,
      value: v,
      color: th.colors[k] || th.tick.fill,
    }),
  );
  const topProducts = data?.top_products || [];
  const maxProd = topProducts[0]?.cnt || 1;
  const totalGen = Object.values(data?.platform_distribution || {}).reduce(
    (s, n) => s + n,
    0,
  );

  const donut = (rows: { name: string; value: number; color: string }[]) => (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={rows}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          dataKey="value"
          paddingAngle={3}
          stroke={th.surface}
          strokeWidth={2}
        >
          {rows.map((e, i) => (
            <Cell key={i} fill={e.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={th.tooltip} />
        <Legend wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: 12, textTransform: 'uppercase' }} />
      </PieChart>
    </ResponsiveContainer>
  );

  return (
    <ReportState
      loading={loading}
      notConfigured={notConfigured}
      error={error}
      empty={!data || totalGen === 0}
    >
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">{t.reports.favorites}</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            ♥ {data?.favorite_count ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.reports.copyEngagement}</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>
            {data?.copy_engagement ?? 0}
          </div>
          <div className="stat-foot">{t.reports.generationsWithCopies}</div>
        </div>
      </div>

      <div
        className="plat-grid"
        style={{ gridTemplateColumns: 'repeat(2,1fr)' }}
      >
        <div className="card">
          <div className="slbl">{t.reports.languageSplit}</div>
          {donut(langData)}
        </div>
        <div className="card">
          <div className="slbl">{t.reports.platformDistribution}</div>
          {donut(platData)}
        </div>
      </div>

      <div className="card">
        <div className="slbl">{t.reports.topProducts}</div>
        {topProducts.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>
            {t.reports.noData}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topProducts.map((item, i) => (
              <div key={i} className="row" style={{ alignItems: 'center', gap: 10 }}>
                <span
                  className="mono"
                  style={{ width: 24, textAlign: 'right', color: 'var(--ink-faint)', fontSize: 11 }}
                >
                  #{i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between', marginBottom: 4 }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{item.prod}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                      {item.cnt}×
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: 'var(--glass-strong)',
                      borderRadius: 99,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(item.cnt / maxProd) * 100}%`,
                        background: 'var(--blue)',
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ReportState>
  );
}
