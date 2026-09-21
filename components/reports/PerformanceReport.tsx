'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/app/providers';
import {
  deleteMetric,
  deriveKpis,
  formatIDR,
  formatIDROpt,
  formatInt,
  formatPct,
  formatRoas,
  loadMetrics,
  metricsToCsv,
  parseCsv,
  saveMetrics,
  sumMetrics,
  type MetricInput,
  type MetricsState,
} from '@/lib/metrics';
import { PLATFORM_META } from '@/lib/brand';
import {
  METRIC_PLATFORMS,
  PLATFORM_LABELS,
  type CampaignMetric,
  type MetricPlatform,
  type MetricSourceTag,
} from '@/lib/types';
import { BarList, MiniTrend, downloadCsv } from './Charts';

type Period = 'all' | '7' | '30' | 'month';

interface FormState {
  date: string;
  platform: MetricPlatform;
  campaign: string;
  impressions: string;
  clicks: string;
  cost: string;
  conversions: string;
  revenue: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function emptyForm(): FormState {
  return {
    date: today(),
    platform: 'meta',
    campaign: '',
    impressions: '',
    clicks: '',
    cost: '',
    conversions: '',
    revenue: '',
  };
}

export default function PerformanceReport() {
  const { t, toast } = useApp();
  const r = t.reports;
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<MetricsState>({ rows: [], source: 'local' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | MetricPlatform>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [csvText, setCsvText] = useState('');
  const [metaStatus, setMetaStatus] = useState<{
    connected: boolean;
    last_synced_at?: string | null;
  } | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);

  useEffect(() => {
    loadMetrics().then((st) => {
      setState(st);
      setLoading(false);
    });
  }, []);

  // Show a "Meta connected" banner with an inline sync when the integration is on.
  useEffect(() => {
    let active = true;
    fetch('/api/integrations/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j) setMetaStatus(j.statuses?.meta || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const platLabel = (p: MetricPlatform): string =>
    p === 'other' ? r.platOther : PLATFORM_LABELS[p];

  const sourceLabel = (s: MetricSourceTag): string => {
    switch (s) {
      case 'csv_import':
        return r.srcCsv;
      case 'google_ads_api':
        return r.srcGoogle;
      case 'meta_api':
        return r.srcMeta;
      default:
        return r.srcManual;
    }
  };

  const filtered = useMemo(() => {
    const cutoff = cutoffFor(period);
    return state.rows.filter((row) => {
      if (platformFilter !== 'all' && row.platform !== platformFilter) return false;
      if (cutoff > 0 && new Date(row.date).getTime() < cutoff) return false;
      return true;
    });
  }, [state.rows, platformFilter, period]);

  const totals = useMemo(() => sumMetrics(filtered), [filtered]);
  const kpis = useMemo(() => deriveKpis(totals), [totals]);
  const daily = useMemo(() => dailySeries(filtered), [filtered]);
  const byPlatformRaw = useMemo(() => platformSpend(filtered), [filtered]);
  const byPlatform = byPlatformRaw.map((x) => ({
    label: platLabel(x.platform),
    value: x.value,
    color: x.platform === 'other' ? 'var(--ink-faint)' : PLATFORM_META[x.platform].dot,
  }));

  async function persist(inputs: MetricInput[], okMsg: string) {
    setBusy(true);
    try {
      const created = await saveMetrics(state.source, inputs);
      // Merge by id so an upsert that updated an existing row moves it to the
      // top rather than appearing twice.
      setState((s) => {
        const ids = new Set(created.map((c) => c.id));
        return { ...s, rows: [...created, ...s.rows.filter((x) => !ids.has(x.id))] };
      });
      toast(okMsg);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    const input = formToInput(form);
    if (!input.impressions && !input.clicks && !input.cost) {
      toast(r.needNumbers);
      return;
    }
    const ok = await persist([input], r.rowSaved);
    if (ok) {
      setForm(emptyForm());
      setShowAdd(false);
    }
  }

  async function onImportText(text: string) {
    const { rows, imported, skipped } = parseCsv(text);
    if (imported === 0) {
      toast(r.importEmpty);
      return;
    }
    const tagged = rows.map((row) => ({ ...row, source: 'csv_import' as const }));
    const ok = await persist(tagged, `${imported} ${r.importedSuffix}${skipped ? ` · ${skipped} ${r.skippedSuffix}` : ''}`);
    if (ok) {
      setCsvText('');
      setShowImport(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImportText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  async function onSample() {
    await persist(sampleRows(), r.sampleLoaded);
  }

  async function onDelete(id: string) {
    await deleteMetric(state.source, id);
    setState((s) => ({ ...s, rows: s.rows.filter((x) => x.id !== id) }));
  }

  async function syncMeta() {
    setMetaBusy(true);
    try {
      const res = await fetch('/api/integrations/meta/sync?days=30', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Sync failed');
      toast(`${r.metaSync}: +${j.result?.upserted ?? 0}`);
      setState(await loadMetrics());
      const s2 = await fetch('/api/integrations/status');
      if (s2.ok) setMetaStatus((await s2.json()).statuses?.meta || null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
    } finally {
      setMetaBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="ld">
          <div className="sp" />
          {t.common.generating}
        </div>
      </div>
    );
  }

  const hasData = state.rows.length > 0;

  return (
    <>
      {metaStatus?.connected && (
        <div className="meta-banner">
          <span>
            <span
              className="plat-dot"
              style={{ width: 8, height: 8, background: 'var(--blue)', display: 'inline-block' }}
            />{' '}
            <strong>{r.metaBanner}</strong> ·{' '}
            <span className="mono">
              {r.metaLastSync}:{' '}
              {metaStatus.last_synced_at
                ? new Date(metaStatus.last_synced_at).toLocaleString('en-GB')
                : r.metaNever}
            </span>
          </span>
          <button className="btn btn-glass btn-sm" onClick={syncMeta} disabled={metaBusy}>
            {metaBusy ? r.metaSyncing : r.metaSync}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="report-toolbar">
        <span
          className="plat-tag"
          style={{
            background:
              state.source === 'supabase'
                ? 'rgba(28,138,75,.12)'
                : 'var(--glass-strong)',
            color: state.source === 'supabase' ? 'var(--green)' : 'var(--ink-faint)',
          }}
        >
          <span
            className="plat-dot"
            style={{
              width: 7,
              height: 7,
              background: state.source === 'supabase' ? 'var(--green)' : 'var(--ink-faint)',
            }}
          />
          {state.source === 'supabase' ? r.sourceSupabase : r.sourceLocal}
        </span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-glass btn-sm" onClick={() => setShowAdd((v) => !v)}>
            + {r.addRow}
          </button>
          <button className="btn btn-glass btn-sm" onClick={() => setShowImport((v) => !v)}>
            {r.importCsv}
          </button>
          <button className="btn btn-glass btn-sm" onClick={onSample} disabled={busy}>
            {r.loadSample}
          </button>
          <button
            className="btn btn-glass btn-sm"
            onClick={() =>
              downloadCsv(`20fit-performa-${today()}.csv`, metricsToCsv(filtered))
            }
            disabled={!hasData}
          >
            {r.exportCsv}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card">
          <div className="slbl">{r.addRow}</div>
          <div className="fg">
            <Field label={r.fDate}>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label={r.fPlatform}>
              <select
                value={form.platform}
                onChange={(e) =>
                  setForm({ ...form, platform: e.target.value as MetricPlatform })
                }
              >
                {METRIC_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {platLabel(p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={r.fCampaign} full>
              <input
                value={form.campaign}
                placeholder="ems_trial_q3_2026"
                onChange={(e) => setForm({ ...form, campaign: e.target.value })}
              />
            </Field>
            <NumField label={r.fImpressions} v={form.impressions} on={(x) => setForm({ ...form, impressions: x })} />
            <NumField label={r.fClicks} v={form.clicks} on={(x) => setForm({ ...form, clicks: x })} />
            <NumField label={r.fCost} v={form.cost} on={(x) => setForm({ ...form, cost: x })} />
            <NumField label={r.fConversions} v={form.conversions} on={(x) => setForm({ ...form, conversions: x })} />
            <NumField label={r.fRevenue} v={form.revenue} on={(x) => setForm({ ...form, revenue: x })} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-glass btn-sm" onClick={() => setShowAdd(false)}>
              {t.common.cancel}
            </button>
            <button className="btn btn-red btn-sm" onClick={onAdd} disabled={busy}>
              {t.common.save}
            </button>
          </div>
        </div>
      )}

      {/* Import */}
      {showImport && (
        <div className="card">
          <div className="slbl">{r.importCsv}</div>
          <div className="muted" style={{ marginBottom: 8 }}>
            {r.importHelp}
          </div>
          <textarea
            className="import-area"
            rows={5}
            value={csvText}
            placeholder={r.importPlaceholder}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="row mt8" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-glass btn-sm" onClick={() => fileRef.current?.click()}>
                {r.chooseFile}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/plain"
                style={{ display: 'none' }}
                onChange={onFile}
              />
            </div>
            <button
              className="btn btn-red btn-sm"
              onClick={() => onImportText(csvText)}
              disabled={busy || !csvText.trim()}
            >
              {r.importBtn}
            </button>
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="card">
          <div className="es">
            <div className="es-ico">📊</div>
            <p>{r.perfEmpty}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="report-toolbar">
            <div className="filter-tabs" style={{ marginBottom: 0 }}>
              <button
                className={`filter-tab${platformFilter === 'all' ? ' act' : ''}`}
                onClick={() => setPlatformFilter('all')}
              >
                {t.common.all}
              </button>
              {METRIC_PLATFORMS.map((p) => (
                <button
                  key={p}
                  className={`filter-tab${platformFilter === p ? ' act' : ''}`}
                  onClick={() => setPlatformFilter(p)}
                >
                  {platLabel(p)}
                </button>
              ))}
            </div>
            <div className="toggle-group">
              {(['all', '7', '30', 'month'] as Period[]).map((p) => (
                <button
                  key={p}
                  className={`toggle-btn${period === p ? ' act' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 'all' ? r.periodAll : p === 'month' ? r.periodMonth : `${p}d`}
                </button>
              ))}
            </div>
          </div>

          {/* KPI grid */}
          <div className="kpi-grid perf">
            <Kpi label={r.kSpend} value={formatIDR(totals.cost)} />
            <Kpi label={r.kImpr} value={formatInt(totals.impressions)} />
            <Kpi label={r.kClicks} value={formatInt(totals.clicks)} />
            <Kpi label={r.kCtr} value={formatPct(kpis.ctr)} />
            <Kpi label={r.kConv} value={formatInt(totals.conversions)} />
            <Kpi label={r.kCpa} value={formatIDROpt(kpis.cpa)} />
            <Kpi label={r.kCpc} value={formatIDROpt(kpis.cpc)} />
            <Kpi label={r.kRoas} value={formatRoas(kpis.roas)} accent />
          </div>

          {/* Charts */}
          <div className="report-grid">
            <div className="card">
              <div className="slbl">{r.spendTrend}</div>
              <MiniTrend points={daily.spend} color="var(--red)" height={90} />
            </div>
            <div className="card">
              <div className="slbl">{r.convTrend}</div>
              <MiniTrend points={daily.conv} color="var(--green)" height={90} />
            </div>
          </div>

          <div className="card">
            <div className="slbl">{r.byPlatform}</div>
            <BarList items={byPlatform} format={formatIDR} />
          </div>

          {/* Table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{r.colDate}</th>
                  <th>{r.colPlatform}</th>
                  <th>{r.colCampaign}</th>
                  <th style={{ textAlign: 'right' }}>{r.colImpr}</th>
                  <th style={{ textAlign: 'right' }}>{r.colClicks}</th>
                  <th style={{ textAlign: 'right' }}>{r.colCtr}</th>
                  <th style={{ textAlign: 'right' }}>{r.colCost}</th>
                  <th style={{ textAlign: 'right' }}>{r.colConv}</th>
                  <th style={{ textAlign: 'right' }}>{r.colCpa}</th>
                  <th style={{ textAlign: 'right' }}>{r.colRoas}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const k = deriveKpis(row);
                  const meta = row.platform === 'other' ? null : PLATFORM_META[row.platform];
                  return (
                    <tr key={row.id}>
                      <td className="mono">{row.date}</td>
                      <td>
                        <span className="plat-tag" style={{ background: 'var(--glass-strong)', color: 'var(--ink)' }}>
                          <span
                            className="plat-dot"
                            style={{ width: 7, height: 7, background: meta ? meta.dot : 'var(--ink-faint)' }}
                          />
                          {platLabel(row.platform)}
                        </span>
                      </td>
                      <td>
                        <div>{row.campaign || '—'}</div>
                        {row.source && row.source !== 'manual' && (
                          <span
                            className={`src-tag${row.source.endsWith('_api') ? ' api' : ''}`}
                          >
                            {sourceLabel(row.source)}
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatInt(row.impressions)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatInt(row.clicks)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatPct(k.ctr)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatIDR(row.cost)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatInt(row.conversions)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatIDROpt(k.cpa)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRoas(k.roas)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="cbtn" onClick={() => onDelete(row.id)} aria-label="delete">
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ---- small presentational helpers -----------------------------------------
function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: 'var(--red)' } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`fi${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function NumField({ label, v, on }: { label: string; v: string; on: (x: string) => void }) {
  return (
    <div className="fi">
      <label>{label}</label>
      <input inputMode="decimal" value={v} placeholder="0" onChange={(e) => on(e.target.value)} />
    </div>
  );
}

// ---- data helpers ----------------------------------------------------------
function formToInput(f: FormState): MetricInput {
  return {
    date: f.date,
    platform: f.platform,
    campaign: f.campaign,
    impressions: numeric(f.impressions),
    clicks: numeric(f.clicks),
    cost: numeric(f.cost),
    conversions: numeric(f.conversions),
    revenue: numeric(f.revenue),
    source: 'manual',
  };
}
function numeric(s: string): number {
  const n = parseFloat(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cutoffFor(period: Period): number {
  const now = new Date();
  if (period === '7') return Date.now() - 7 * 86400000;
  if (period === '30') return Date.now() - 30 * 86400000;
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return 0;
}

function dailySeries(rows: CampaignMetric[]) {
  const map = new Map<string, { spend: number; conv: number }>();
  for (const row of rows) {
    const cur = map.get(row.date) || { spend: 0, conv: 0 };
    cur.spend += row.cost;
    cur.conv += row.conversions;
    map.set(row.date, cur);
  }
  const days = Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-30);
  return {
    spend: days.map(([d, v]) => ({ label: d.slice(5), value: v.spend })),
    conv: days.map(([d, v]) => ({ label: d.slice(5), value: v.conv })),
  };
}

function platformSpend(rows: CampaignMetric[]) {
  const map = new Map<MetricPlatform, number>();
  for (const row of rows) map.set(row.platform, (map.get(row.platform) || 0) + row.cost);
  return Array.from(map.entries())
    .map(([platform, value]) => ({ platform, value }))
    .sort((a, b) => b.value - a.value);
}

// Clearly-labeled SAMPLE data so the team can see the report populated.
// These are illustrative placeholders, NOT real 20FIT campaign numbers.
function sampleRows(): MetricInput[] {
  const platforms: MetricPlatform[] = ['meta', 'google_sem', 'google_pmax', 'google_display'];
  const out: MetricInput[] = [];
  const start = new Date();
  start.setDate(start.getDate() - 13);
  for (let d = 0; d < 14; d++) {
    const date = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
    for (const p of platforms) {
      const base = p === 'meta' ? 5200 : p === 'google_sem' ? 2600 : p === 'google_pmax' ? 3400 : 4100;
      const impressions = base + ((d * 37 + p.length * 53) % 1800);
      const clicks = Math.round(impressions * (p === 'google_sem' ? 0.055 : 0.021));
      const cost = clicks * (p === 'google_sem' ? 3200 : 1800);
      const conversions = Math.max(0, Math.round(clicks * 0.06));
      const revenue = conversions * 350000; // illustrative avg order value
      out.push({
        date,
        platform: p,
        campaign: `contoh_ems_trial_q3_2026_${p}`,
        impressions,
        clicks,
        cost,
        conversions,
        revenue,
      });
    }
  }
  return out;
}
