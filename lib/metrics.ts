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
    roas: t.cost ? t.revenue / t.cost : null,
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
