'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '@/app/providers';
import { fetchProductivity } from '@/lib/db/reports';
import type { ProductivityRow } from '@/lib/db/types';
import {
  PLATFORM_ORDER,
  PLATFORM_SHORT,
  ReportState,
  useChartTheme,
} from './shared';

interface WeekRow {
  week: string;
  total: number;
  hours_saved: number;
  [platform: string]: number | string;
}

function fmtWeek(v: unknown): string {
  return new Date(String(v)).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
}

export default function ProductivityTab({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { t } = useApp();
  const th = useChartTheme();
  const [rows, setRows] = useState<ProductivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetchProductivity(startDate, endDate)
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

  const byWeek: Record<string, WeekRow> = {};
  for (const r of rows) {
    const w = (byWeek[r.week_start] ??= {
      week: r.week_start,
      total: 0,
      hours_saved: 0,
    });
    w.total = (w.total as number) + r.gen_count;
    w.hours_saved = (w.hours_saved as number) + r.est_hours_saved;
    w[r.platform] = r.gen_count;
  }
  const chartData = Object.values(byWeek).sort((a, b) =>
    a.week.localeCompare(b.week),
  );
  const totalGen = rows.reduce((s, r) => s + r.gen_count, 0);
  const totalHours = rows.reduce((s, r) => s + r.est_hours_saved, 0);
  const avg = chartData.length ? totalGen / chartData.length : 0;

  return (
    <ReportState
      loading={loading}
      notConfigured={notConfigured}
      error={error}
      empty={rows.length === 0}
    >
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">{t.reports.totalGenerations}</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>
            {totalGen}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.reports.hoursSaved}</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {totalHours.toFixed(1)}h
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.reports.avgPerWeek}</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>
            {avg.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="slbl">{t.reports.weeklyGeneration}</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={th.grid} vertical={false} />
            <XAxis dataKey="week" tick={th.tick} tickFormatter={fmtWeek} />
            <YAxis tick={th.tick} allowDecimals={false} />
            <Tooltip
              contentStyle={th.tooltip}
              cursor={{ fill: th.grid }}
              labelFormatter={fmtWeek}
            />
            <Legend wrapperStyle={{ fontFamily: 'var(--font-display)', fontSize: 12, textTransform: 'uppercase' }} />
            {PLATFORM_ORDER.map((p) => (
              <Bar
                key={p}
                dataKey={p}
                name={PLATFORM_SHORT[p]}
                stackId="gen"
                fill={th.colors[p]}
                stroke={th.surface}
                strokeWidth={1.5}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="slbl">{t.reports.timeSavedTrend}</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={th.grid} vertical={false} />
            <XAxis dataKey="week" tick={th.tick} tickFormatter={fmtWeek} />
            <YAxis tick={th.tick} unit="h" />
            <Tooltip
              contentStyle={th.tooltip}
              cursor={{ stroke: th.grid }}
              labelFormatter={fmtWeek}
              formatter={(v) => [`${Number(v).toFixed(1)}h`, t.reports.hoursSaved]}
            />
            <Line
              type="monotone"
              dataKey="hours_saved"
              stroke={th.colors.google_sem}
              strokeWidth={2}
              dot={{ r: 4, fill: th.colors.google_sem }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ReportState>
  );
}
