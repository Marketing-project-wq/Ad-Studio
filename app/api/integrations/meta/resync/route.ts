import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCampaignInsights,
  isMetaConfigured,
  refreshLongLivedToken,
} from '@/lib/integrations/meta';
import {
  clearSyncedMetrics,
  getCredentials,
  getFreshMetaToken,
  markError,
  markSynced,
  upsertSyncedMetrics,
} from '@/lib/integrations/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const clampDays = (n: number) =>
  !Number.isFinite(n) || n < 1 ? 30 : Math.min(365, Math.floor(n));

// POST → CLEAR all meta_api rows, then re-fetch from scratch. Use this after a
// mapping change so stale conversions/revenue are fully recomputed (a normal
// sync only upserts the keys the new fetch returns).
export async function POST(req: NextRequest) {
  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: 'Meta belum dikonfigurasi. / Not configured.', code: 'not_configured' },
      { status: 503 },
    );
  }
  const cred = await getCredentials('meta');
  if (!cred?.account_id) {
    return NextResponse.json(
      { error: 'Belum terhubung / belum pilih akun. / Not connected.', code: 'not_connected' },
      { status: 400 },
    );
  }

  const days = clampDays(Number(req.nextUrl.searchParams.get('days')) || 30);
  const to = todayStr();
  const from = daysAgoStr(days - 1);

  try {
    const fresh = await getFreshMetaToken(refreshLongLivedToken);
    if (!fresh) {
      return NextResponse.json(
        { error: 'Belum terhubung. / Not connected.', code: 'not_connected' },
        { status: 400 },
      );
    }
    const cleared = await clearSyncedMetrics('meta_api');
    const rows = await fetchCampaignInsights(fresh.accessToken, cred.account_id, from, to);
    const { upserted } = await upsertSyncedMetrics(rows);
    await markSynced('meta');

    return NextResponse.json({
      result: { platform: 'meta', cleared, upserted, from, to, account_id: cred.account_id },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'resync_failed';
    await markError('meta', msg);
    return NextResponse.json({ error: msg, code: 'resync_failed' }, { status: 502 });
  }
}
