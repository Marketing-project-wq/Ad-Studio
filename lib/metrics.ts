// Campaign performance metrics: local/remote store, KPI math, CSV import/export.
//
// Storage strategy mirrors the rest of the app: when Supabase is configured the
// data lives server-side (via /api/metrics, shared across the team); otherwise
// it falls back to this browser's localStorage so the tool still works in demo
// mode. The pure helpers below (KPI math, CSV parsing, formatting) are used by
// both the client components and the /api/metrics route.

import type {
  CampaignMetric,
  MetricKpis,
  MetricPlatform,
  MetricSourceTag,
  MetricTotals,
} from './types';
import { METRIC_PLATFORMS } from './types';

const METRICS_KEY = '20fit_ad_metrics';

// ---- The fields a caller supplies to create a row (id/created_at are added) --
export interface MetricInput {
  date: string;
  platform: MetricPlatform;
  campaign: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  source?: MetricSourceTag;
}

export type MetricSource = 'supabase' | 'local';

export interface MetricsState {
  rows: CampaignMetric[];
  source: MetricSource;
}

// ---- local storage helpers -------------------------------------------------
function readLocal(): CampaignMetric[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    return raw ? (JSON.parse(raw) as CampaignMetric[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: CampaignMetric[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(METRICS_KEY, JSON.stringify(rows.slice(0, 2000)));
  } catch {
    /* storage unavailable — silently skip */
  }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Turn a validated input into a full row (used by the local fallback path). */
export function toRow(input: MetricInput): CampaignMetric {
  return {
    id: uid(),
    date: normalizeDate(input.date),
    platform: normalizePlatform(input.platform),
    campaign: (input.campaign || '').trim().slice(0, 200),
    impressions: cleanNum(input.impressions),
    clicks: cleanNum(input.clicks),
    cost: cleanNum(input.cost),
    conversions: cleanNum(input.conversions),
    revenue: cleanNum(input.revenue),
    source: input.source || 'manual',
    created_at: new Date().toISOString(),
  };
}

// ---- load / mutate (Supabase-first, local fallback) ------------------------
export async function loadMetrics(): Promise<MetricsState> {
  try {
    const res = await fetch('/api/metrics');
    if (res.ok) {
      const json = (await res.json()) as { metrics?: CampaignMetric[] };
      if (Array.isArray(json.metrics)) {
        return { rows: json.metrics, source: 'supabase' };
      }
    }
  } catch {
    /* not configured / offline — use the local store */
  }
  return { rows: readLocal(), source: 'local' };
}

/** Persist one or more rows. Returns the newly created rows (newest first). */
export async function saveMetrics(
  source: MetricSource,
  inputs: MetricInput[],
): Promise<CampaignMetric[]> {
  if (source === 'supabase') {
    const res = await fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: inputs }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error || `Save failed (${res.status})`);
    }
    const j = (await res.json()) as { metrics?: CampaignMetric[] };
    return j.metrics || [];
  }
  const rows = inputs.map(toRow);
  writeLocal([...rows, ...readLocal()]);
  return rows;
}

export async function deleteMetric(source: MetricSource, id: string): Promise<void> {
  if (source === 'supabase') {
    await fetch(`/api/metrics?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    return;
  }
  writeLocal(readLocal().filter((r) => r.id !== id));
}

// ---- normalization ---------------------------------------------------------
export function normalizePlatform(value: string): MetricPlatform {
  const v = (value || '').toString().trim().toLowerCase();
  if (!v) return 'other';
  if ((METRIC_PLATFORMS as string[]).includes(v)) return v as MetricPlatform;
  if (/(search|sem|keyword)/.test(v)) return 'google_sem';
  if (/display|gdn|gmail/.test(v)) return 'google_display';
  if (/(performance|pmax|p\.?\s*max)/.test(v)) return 'google_pmax';
  if (/(meta|facebook|instagram|\bfb\b|\big\b)/.test(v)) return 'meta';
  if (/google/.test(v)) return 'google_sem';
  return 'other';
}

/** Coerce any input to a finite, non-negative number. */
export function cleanNum(value: unknown): number {
  const n = typeof value === 'number' ? value : parseNum(String(value ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Parse a locale-formatted number string (handles Rp, %, and , / . groups). */
export function parseNum(raw: string): number {
  let s = String(raw).trim().replace(/rp|idr|%/gi, '').replace(/\s/g, '');
  if (!s) return 0;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // The right-most separator is the decimal point.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = s.split(',');
    // "1,5" → decimal; "1,234" or "1,234,567" → thousands.
    s = parts.length === 2 && parts[1].length <= 2 ? parts.join('.') : parts.join('');
  } else if (hasDot) {
    const parts = s.split('.');
    const thousands =
      parts.length > 2 ||
      (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3);
    if (thousands) s = parts.join('');
    // otherwise keep the dot as a decimal point (e.g. "12.34")
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize a date string to yyyy-mm-dd; defaults to today when unparseable. */
export function normalizeDate(raw: string): string {
  const today = () => new Date().toISOString().slice(0, 10);
  if (!raw) return today();
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy (common in ID exports)
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${mo}-${d}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? today() : parsed.toISOString().slice(0, 10);
}

// ---- KPI math --------------------------------------------------------------
export function sumMetrics(rows: MetricTotals[]): MetricTotals {
  return rows.reduce<MetricTotals>(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      cost: acc.cost + r.cost,
      conversions: acc.conversions + r.conversions,
      revenue: acc.revenue + r.revenue,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 },
  );
}

export function deriveKpis(t: MetricTotals): MetricKpis {
  return {
    ctr: t.impressions ? t.clicks / t.impressions : null,
    cpc: t.clicks ? t.cost / t.clicks : null,
    cpm: t.impressions ? (t.cost / t.impressions) * 1000 : null,
    cvr: t.clicks ? t.conversions / t.clicks : null,
    cpa: t.conversions ? t.cost / t.conversions : null,
    // ROAS needs real purchase revenue. When revenue is 0 (e.g. a lead/traffic
    // campaign with no purchase objective) it is not measurable → null → "—".
    roas: t.cost > 0 && t.revenue > 0 ? t.revenue / t.cost : null,
  };
}

// ---- CSV import / export ---------------------------------------------------
const CSV_HEADER = [
  'date',
  'platform',
  'campaign',
  'impressions',
  'clicks',
  'cost',
  'conversions',
  'revenue',
];

// Header aliases so exports from Google Ads / Meta / Excel map cleanly.
const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'tanggal', 'reporting starts'],
  platform: ['platform', 'channel', 'source', 'network'],
  campaign: ['campaign', 'campaign name', 'kampanye', 'nama campaign', 'ad set name'],
  impressions: ['impressions', 'impr', 'impr.', 'impresi', 'tayangan'],
  clicks: ['clicks', 'click', 'klik', 'link clicks'],
  cost: ['cost', 'spend', 'biaya', 'amount spent', 'amount spent (idr)', 'cost (idr)'],
  conversions: ['conversions', 'conv', 'conv.', 'konversi', 'results', 'hasil'],
  revenue: [
    'revenue',
    'conv. value',
    'conversion value',
    'total conv. value',
    'nilai konversi',
    'purchase conversion value',
    'pendapatan',
  ],
};

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function resolveHeader(cells: string[]): Record<string, number> | null {
  const lower = cells.map((c) => c.toLowerCase().replace(/^"|"$/g, '').trim());
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = lower.findIndex((c) => aliases.includes(c));
    if (idx !== -1) map[field] = idx;
  }
  // Need at least the numeric core to trust this as a header row.
  return 'impressions' in map || 'clicks' in map || 'cost' in map ? map : null;
}

export interface CsvParseResult {
  rows: MetricInput[];
  imported: number;
  skipped: number;
}

/** Parse pasted or uploaded CSV/TSV text into metric inputs. */
export function parseCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], imported: 0, skipped: 0 };

  const delimiter = pickDelimiter(lines[0]);
  const first = splitCsvLine(lines[0], delimiter);
  const header = resolveHeader(first);
  const dataLines = header ? lines.slice(1) : lines;

  // Positional fallback order when there is no recognizable header.
  const col = header || {
    date: 0,
    platform: 1,
    campaign: 2,
    impressions: 3,
    clicks: 4,
    cost: 5,
    conversions: 6,
    revenue: 7,
  };

  const rows: MetricInput[] = [];
  let skipped = 0;
  for (const line of dataLines) {
    const cells = splitCsvLine(line, delimiter);
    const at = (field: string): string => {
      const i = col[field];
      return i === undefined ? '' : cells[i] ?? '';
    };
    const impressions = parseNum(at('impressions'));
    const clicks = parseNum(at('clicks'));
    const cost = parseNum(at('cost'));
    const conversions = parseNum(at('conversions'));
    const revenue = parseNum(at('revenue'));
    // Skip empty/total rows with no numbers at all.
    if (!impressions && !clicks && !cost && !conversions && !revenue) {
      skipped++;
      continue;
    }
    rows.push({
      date: normalizeDate(at('date')),
      platform: normalizePlatform(at('platform')),
      campaign: at('campaign') || '—',
      impressions,
      clicks,
      cost,
      conversions,
      revenue,
    });
  }
  return { rows, imported: rows.length, skipped };
}

function pickDelimiter(line: string): string {
  const tab = (line.match(/\t/g) || []).length;
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  if (tab >= semi && tab >= comma && tab > 0) return '\t';
  if (semi >= comma && semi > 0) return ';';
  return ',';
}

export function metricsToCsv(rows: CampaignMetric[]): string {
  const head = CSV_HEADER.join(',');
  const body = rows
    .map((r) =>
      [
        r.date,
        r.platform,
        `"${(r.campaign || '').replace(/"/g, '""')}"`,
        r.impressions,
        r.clicks,
        r.cost,
        r.conversions,
        r.revenue,
      ].join(','),
    )
    .join('\n');
  return `${head}\n${body}`;
}

// ---- formatting ------------------------------------------------------------
const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export function formatInt(n: number): string {
  return nf0.format(Math.round(n));
}
export function formatIDR(n: number): string {
  return `Rp${nf0.format(Math.round(n))}`;
}
export function formatNum2(n: number): string {
  return nf2.format(n);
}
export function formatPct(ratio: number | null): string {
  return ratio === null ? '—' : `${nf2.format(ratio * 100)}%`;
}
export function formatIDROpt(n: number | null): string {
  return n === null ? '—' : formatIDR(n);
}
export function formatRoas(n: number | null): string {
  return n === null ? '—' : `${nf2.format(n)}×`;
}

// ---- unified readable formatting (KPI cards + table) -----------------------
export type NumberType = 'currency' | 'compact' | 'percent' | 'multiplier' | 'int';

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(lang: 'id' | 'en', decimals: number): Intl.NumberFormat {
  const key = `${lang}:${decimals}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', {
      maximumFractionDigits: decimals,
    });
    nfCache.set(key, f);
  }
  return f;
}

/**
 * One readable formatter for display. Abbreviates only at ≥ 1 million so exact
 * values below that stay legible.
 *   currency   → "Rp 20,97 jt" (≥1jt) / "Rp 582"
 *   compact    → "1,29 jt" (≥1jt) / "24.679"
 *   percent    → ratio in → "2,34%"
 *   multiplier → "18,8x"     (null → "—")
 *   int        → "24.679"
 */
export function formatNumber(
  n: number | null,
  type: NumberType,
  lang: 'id' | 'en' = 'id',
): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const jt = lang === 'id' ? ' jt' : 'M'; // juta / million
  const mlr = lang === 'id' ? ' M' : 'B'; // miliar / billion
  const abs = Math.abs(n);
  switch (type) {
    case 'currency':
      if (abs >= 1e9) return `Rp ${nf(lang, 2).format(n / 1e9)}${mlr}`;
      if (abs >= 1e6) return `Rp ${nf(lang, 2).format(n / 1e6)}${jt}`;
      return `Rp ${nf(lang, 0).format(Math.round(n))}`;
    case 'compact':
      if (abs >= 1e9) return `${nf(lang, 2).format(n / 1e9)}${mlr}`;
      if (abs >= 1e6) return `${nf(lang, 2).format(n / 1e6)}${jt}`;
      return nf(lang, 0).format(Math.round(n));
    case 'percent':
      return `${nf(lang, 2).format(n * 100)}%`;
    case 'multiplier':
      return `${nf(lang, 1).format(n)}x`;
    default:
      return nf(lang, 0).format(Math.round(n));
  }
}

// ---- KPI colour tones ------------------------------------------------------
// NOTE: these thresholds are general guidance, not absolute standards — adjust
// them to 20FIT's own targets (they could be made configurable later).
export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export function roasTone(roas: number | null): Tone {
  if (roas === null) return 'neutral';
  if (roas > 3) return 'good';
  if (roas >= 1) return 'warn';
  return 'bad';
}
export function ctrTone(ctr: number | null): Tone {
  if (ctr === null) return 'neutral';
  if (ctr > 0.02) return 'good';
  if (ctr >= 0.01) return 'warn';
  return 'bad';
}
export function cvrTone(cvr: number | null): Tone {
  if (cvr === null) return 'neutral';
  if (cvr > 0.05) return 'good';
  if (cvr >= 0.02) return 'warn';
  return 'bad';
}

// ---- per-campaign aggregation (Top campaigns) ------------------------------
export interface CampaignAgg extends MetricTotals {
  campaign: string;
}
export function aggregateByCampaign(rows: CampaignMetric[]): CampaignAgg[] {
  const map = new Map<string, CampaignAgg>();
  for (const row of rows) {
    const key = row.campaign || '—';
    const cur =
      map.get(key) ||
      { campaign: key, impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 };
    cur.impressions += row.impressions;
    cur.clicks += row.clicks;
    cur.cost += row.cost;
    cur.conversions += row.conversions;
    cur.revenue += row.revenue;
    map.set(key, cur);
  }
  return Array.from(map.values());
}

/** ROAS from an aggregate — null (not measurable) when there is no purchase revenue. */
export function roasOf(t: MetricTotals): number | null {
  return t.cost > 0 && t.revenue > 0 ? t.revenue / t.cost : null;
}

// ---- table sorting ---------------------------------------------------------
export type SortKey =
  | 'date'
  | 'campaign'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cost'
  | 'conversions'
  | 'cpa'
  | 'revenue'
  | 'roas';
export type SortDir = 'asc' | 'desc';

/** The comparable value for a column. Strings for text, numbers for metrics,
 *  and null for "not measurable" (CTR/CPA/ROAS with a zero denominator). */
export function metricSortValue(row: CampaignMetric, key: SortKey): string | number | null {
  switch (key) {
    case 'date':
      return row.date; // ISO yyyy-mm-dd sorts lexicographically
    case 'campaign':
      return (row.campaign || '').toLowerCase();
    case 'ctr':
      return row.impressions ? row.clicks / row.impressions : null;
    case 'cpa':
      return row.conversions ? row.cost / row.conversions : null;
    case 'roas':
      return roasOf(row);
    default:
      return row[key];
  }
}

/** Stable-ish client-side sort. null always sinks to the bottom, regardless of
 *  direction (so an unmeasurable ROAS never ranks as if it were 0). */
export function sortMetrics(
  rows: CampaignMetric[],
  key: SortKey,
  dir: SortDir,
): CampaignMetric[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = metricSortValue(a, key);
    const vb = metricSortValue(b, key);
    const na = va === null;
    const nb = vb === null;
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb)) * mul;
    }
    return ((va as number) - (vb as number)) * mul;
  });
}

// ---- auto insights (the "Ringkasan" cards) ---------------------------------
export interface InsightSummary {
  hasData: boolean;
  /** Highest ROAS among campaigns that spent enough to be meaningful. */
  best: { campaign: string; roas: number } | null;
  /** Lowest ROAS, or (when nothing has revenue) the biggest spender with 0 conversions. */
  worst: { campaign: string; roas: number } | { campaign: string; noConv: true } | null;
  /** Day with the most conversions. */
  bestDay: { date: string; conversions: number } | null;
  /** A day whose spend exceeds 2× the daily average, if any. */
  anomaly: { date: string; spend: number; ratio: number } | null;
}

const MIN_RELEVANT_SPEND = 100000; // Rp — below this a ROAS is too noisy to rank

export function computeInsights(rows: CampaignMetric[]): InsightSummary {
  if (rows.length === 0) {
    return { hasData: false, best: null, worst: null, bestDay: null, anomaly: null };
  }
  const camps = aggregateByCampaign(rows).map((c) => ({ ...c, roas: roasOf(c) }));

  // Best: highest ROAS among campaigns that spent > Rp100k.
  let best: InsightSummary['best'] = null;
  for (const c of camps) {
    if (c.cost > MIN_RELEVANT_SPEND && c.roas !== null && (!best || c.roas > best.roas)) {
      best = { campaign: c.campaign, roas: c.roas };
    }
  }

  // Worst: lowest ROAS among campaigns that actually earned revenue; otherwise
  // the biggest spender with zero conversions.
  let worst: InsightSummary['worst'] = null;
  const withRoas = camps.filter((c) => c.roas !== null);
  if (withRoas.length > 0) {
    const w = withRoas.reduce((m, c) => (c.roas! < m.roas! ? c : m));
    worst = { campaign: w.campaign, roas: w.roas! };
  } else {
    const zeroConv = camps.filter((c) => c.cost > 0 && c.conversions === 0);
    if (zeroConv.length > 0) {
      const w = zeroConv.reduce((m, c) => (c.cost > m.cost ? c : m));
      worst = { campaign: w.campaign, noConv: true };
    }
  }

  // Best day (max conversions) and spend anomaly (> 2× daily average).
  const convByDate = new Map<string, number>();
  const spendByDate = new Map<string, number>();
  for (const r of rows) {
    convByDate.set(r.date, (convByDate.get(r.date) || 0) + r.conversions);
    spendByDate.set(r.date, (spendByDate.get(r.date) || 0) + r.cost);
  }
  let bestDay: InsightSummary['bestDay'] = null;
  for (const [date, conversions] of convByDate) {
    if (!bestDay || conversions > bestDay.conversions) bestDay = { date, conversions };
  }
  let anomaly: InsightSummary['anomaly'] = null;
  const spendDays = Array.from(spendByDate.entries());
  if (spendDays.length > 1) {
    const total = spendDays.reduce((s, [, v]) => s + v, 0);
    const avg = total / spendDays.length;
    if (avg > 0) {
      let top: { date: string; spend: number } | null = null;
      for (const [date, spend] of spendDays) {
        if (!top || spend > top.spend) top = { date, spend };
      }
      if (top && top.spend > 2 * avg) {
        anomaly = { date: top.date, spend: top.spend, ratio: top.spend / avg };
      }
    }
  }

  return { hasData: true, best, worst, bestDay, anomaly };
}

// ---- campaign efficiency (scatter plot) ------------------------------------
export interface CampaignEfficiency {
  campaign: string;
  spend: number;
  revenue: number;
  roas: number | null;
  conversions: number;
}

/** One point per campaign that spent money — for the spend-vs-ROAS scatter. */
export function campaignEfficiency(rows: CampaignMetric[]): CampaignEfficiency[] {
  return aggregateByCampaign(rows)
    .filter((c) => c.cost > 0)
    .map((c) => ({
      campaign: c.campaign,
      spend: c.cost,
      revenue: c.revenue,
      roas: roasOf(c),
      conversions: c.conversions,
    }));
}
