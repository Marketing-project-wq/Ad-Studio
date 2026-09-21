import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  METRIC_PLATFORMS,
  type CampaignMetric,
  type MetricPlatform,
  type MetricSourceTag,
} from '@/lib/types';
import { cleanNum, normalizeDate, normalizePlatform } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

const TABLE = 'campaign_metrics';
const MAX_ROWS_PER_POST = 1000;
const SOURCE_TAGS = ['manual', 'csv_import', 'google_ads_api', 'meta_api'];

function normSource(v: unknown): MetricSourceTag {
  const s = String(v ?? 'manual');
  return (SOURCE_TAGS.includes(s) ? s : 'manual') as MetricSourceTag;
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        'Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY. / Supabase is not configured.',
      code: 'supabase_not_configured',
    },
    { status: 503 },
  );
}

interface RawRow {
  date?: unknown;
  platform?: unknown;
  campaign?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  cost?: unknown;
  conversions?: unknown;
  revenue?: unknown;
  source?: unknown;
}

/** Sanitize an untrusted row into a DB-insertable shape. */
function sanitize(raw: RawRow) {
  const platform = normalizePlatform(String(raw.platform ?? ''));
  const safePlatform: MetricPlatform = (METRIC_PLATFORMS as string[]).includes(platform)
    ? platform
    : 'other';
  return {
    date: normalizeDate(String(raw.date ?? '')),
    platform: safePlatform,
    campaign: String(raw.campaign ?? '').trim().slice(0, 200),
    impressions: cleanNum(raw.impressions),
    clicks: cleanNum(raw.clicks),
    cost: cleanNum(raw.cost),
    conversions: cleanNum(raw.conversions),
    revenue: cleanNum(raw.revenue),
    source: normSource(raw.source),
  };
}

function toMetric(row: Record<string, unknown>): CampaignMetric {
  return {
    id: String(row.id),
    date: String(row.date).slice(0, 10),
    platform: row.platform as MetricPlatform,
    campaign: String(row.campaign ?? ''),
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    cost: Number(row.cost) || 0,
    conversions: Number(row.conversions) || 0,
    revenue: Number(row.revenue) || 0,
    source: normSource(row.source),
    created_at: String(row.created_at ?? ''),
  };
}

// ---- GET: list metrics (optional ?platform= & ?from= & ?to=) ----
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return notConfigured();

  const params = req.nextUrl.searchParams;
  let query = supabase.from(TABLE).select('*').order('date', { ascending: false });

  const platform = params.get('platform');
  if (platform && (METRIC_PLATFORMS as string[]).includes(platform)) {
    query = query.eq('platform', platform);
  }
  const from = params.get('from');
  if (from) query = query.gte('date', normalizeDate(from));
  const to = params.get('to');
  if (to) query = query.lte('date', normalizeDate(to));

  const { data, error } = await query.limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const metrics = (data || []).map((row) => toMetric(row as Record<string, unknown>));
  return NextResponse.json({ metrics });
}

// ---- POST: insert one or more rows ({ rows: [...] } or a single object) ----
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return notConfigured();

  let body: { rows?: RawRow[] } & RawRow;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const inputRows: RawRow[] = Array.isArray(body.rows) ? body.rows : [body];
  if (inputRows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (inputRows.length > MAX_ROWS_PER_POST) {
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_ROWS_PER_POST})` },
      { status: 400 },
    );
  }

  const clean = inputRows.map(sanitize);
  // Upsert on the (platform, campaign, date, source) key so re-imports and
  // repeat manual entries update in place instead of duplicating (migration 0005).
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(clean, { onConflict: 'platform,campaign,date,source' })
    .select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Newest first, matching the client's optimistic prepend.
  const metrics = (data || [])
    .map((row) => toMetric(row as Record<string, unknown>))
    .reverse();
  return NextResponse.json({ metrics });
}

// ---- DELETE: remove one row by ?id= ----
export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return notConfigured();

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
