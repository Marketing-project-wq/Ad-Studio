'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '@/app/providers';
import { fetchQuality } from '@/lib/db/reports';
import type { QualityRow } from '@/lib/db/types';
import { PLATFORM_SHORT, ReportState, useChartTheme } from './shared';

function complianceColor(pct: number): string {
  if (pct >= 90) return 'var(--green)';
  if (pct >= 70) return 'var(--amber)';
  return 'var(--red)';
}

export default function QualityTab({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { t } = useApp();
  const th = useChartTheme();
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetchQuality(startDate, endDate)
      .then((d) => active && setRows(d))
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

  const avg = rows.length
    ? rows.reduce((s, r) => s + (r.compliance_pct || 0), 0) / rows.length
    : 0;
  const chartData = rows.map((r) => ({
    platform: PLATFORM_SHORT[r.platform] || r.platform,
    compliance: r.compliance_pct || 0,
  }));

  return (
    <ReportState
      loading={loading}
      notConfigured={notConfigured}
      error={error}
      empty={rows.length === 0}
    >
      <div className="stat-card" style={{ textAlign: 'center' }}>
        <div className="stat-label">{t.reports.overallCompliance}</div>
        <div
          className="stat-value"
          style={{ fontSize: 46, color: complianceColor(avg) }}
        >
          {avg.toFixed(1)}%
        </div>
        <div className="stat-foot">{t.reports.charLimitCompliance}</div>
      </div>

      <div className="card">
        <div className="slbl">{t.reports.complianceByPlatform}</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={th.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={th.tick} unit="%" />
            <YAxis
              type="category"
              dataKey="platform"
              tick={{ ...th.tick, fontFamily: 'var(--font-display)', fontSize: 12 }}
              width={70}
            />
            <Tooltip
              contentStyle={th.tooltip}
              cursor={{ fill: th.grid }}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Compliance']}
            />
            <Bar dataKey="compliance" radius={[0, 6, 6, 0]} barSize={28}>
              {chartData.map((e, i) => (
                <Cell key={i} fill={complianceColor(e.compliance)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Platform</th>
              <th style={{ textAlign: 'right' }}>{t.reports.generations}</th>
              <th style={{ textAlign: 'right' }}>Compliance</th>
              <th>{t.reports.worstField}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.platform}>
                <td>{PLATFORM_SHORT[r.platform] || r.platform}</td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {r.total_generations}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span
                    className="mono"
                    style={{ color: complianceColor(r.compliance_pct || 0), fontWeight: 700 }}
                  >
                    {(r.compliance_pct ?? 0).toFixed(1)}%
                  </span>
                </td>
                <td className="mono">{r.worst_field || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportState>
  );
}
