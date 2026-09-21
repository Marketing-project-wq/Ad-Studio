import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCampaignMetrics,
  isGoogleAdsConfigured,
  refreshAccessToken,
} from '@/lib/integrations/google-ads';
import {
  deleteCredentials,
  getCredentials,
  getFreshAccessToken,
  markError,
  markSynced,
  replaceSyncedMetrics,
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
    { error: 'Google Ads belum dikonfigurasi. / Not configured.', code: 'not_configured' },
    { status: 503 },
  );
}

// POST → pull campaign performance for the last `?days=` (default 30) and
// upsert it into campaign_metrics (idempotent: replaces prior API rows).
export async function POST(req: NextRequest) {
  if (!isGoogleAdsConfigured()) return notConfigured();

  const cred = await getCredentials('google_ads');
  if (!cred) {
    return NextResponse.json(
      { error: 'Belum terhubung. / Not connected.', code: 'not_connected' },
      { status: 400 },
    );
  }

  const days = clampDays(Number(req.nextUrl.searchParams.get('days')) || 30);
  const to = todayStr();
  const from = daysAgoStr(days - 1);

  try {
    const fresh = await getFreshAccessToken('google_ads', refreshAccessToken);
    if (!fresh) {
      return NextResponse.json(
        { error: 'Belum terhubung. / Not connected.', code: 'not_connected' },
        { status: 400 },
      );
    }
    const accountId =
      cred.account_id ||
      (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/[^0-9]/g, '');
    if (!accountId) {
      throw new Error(
        'Tidak ada Google Ads account id. Set GOOGLE_ADS_LOGIN_CUSTOMER_ID atau hubungkan ulang. / Missing account id.',
      );
    }

    const rows = await fetchCampaignMetrics(fresh.accessToken, accountId, from, to);
    const { imported, deleted } = await replaceSyncedMetrics('google_ads_api', from, to, rows);
    await markSynced('google_ads');

    const result: SyncResult = {
      platform: 'google_ads',
      imported,
      deleted,
      from,
      to,
      account_id: accountId,
    };
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sync_failed';
    await markError('google_ads', msg);
    return NextResponse.json({ error: msg, code: 'sync_failed' }, { status: 502 });
  }
}

// DELETE → disconnect (remove stored credentials).
export async function DELETE() {
  await deleteCredentials('google_ads');
  return NextResponse.json({ ok: true });
}
