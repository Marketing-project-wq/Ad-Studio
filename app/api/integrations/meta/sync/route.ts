import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCampaignInsights,
  isMetaConfigured,
  refreshLongLivedToken,
} from '@/lib/integrations/meta';
import {
  getCredentials,
  getFreshMetaToken,
  markError,
  markSynced,
  upsertSyncedMetrics,
} from '@/lib/integrations/store';
import type { SyncResult } from '@/lib/integrations/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const clampDays = (n: number) =>
  !Number.isFinite(n) || n < 1 ? 30 : Math.min(365, Math.floor(n));

function notConfigured() {
  return NextResponse.json(
    { error: 'Meta belum dikonfigurasi. / Not configured.', code: 'not_configured' },
    { status: 503 },
  );
}

// POST → pull campaign insights for the last `?days=` (default 30) and upsert
// them into campaign_metrics (source='meta_api').
export async function POST(req: NextRequest) {
  if (!isMetaConfigured()) return notConfigured();

  const cred = await getCredentials('meta');
  if (!cred) {
    return NextResponse.json(
      { error: 'Belum terhubung. / Not connected.', code: 'not_connected' },
      { status: 400 },
    );
  }
  if (!cred.account_id) {
    return NextResponse.json(
      { error: 'Pilih ad account dulu. / Select an ad account first.', code: 'no_account' },
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
    const rows = await fetchCampaignInsights(fresh.accessToken, cred.account_id, from, to);
    const { upserted } = await upsertSyncedMetrics(rows);
    await markSynced('meta');

    const result: SyncResult = {
      platform: 'meta',
      upserted,
      from,
      to,
      account_id: cred.account_id,
    };
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sync_failed';
    await markError('meta', msg);
    return NextResponse.json({ error: msg, code: 'sync_failed' }, { status: 502 });
  }
}
