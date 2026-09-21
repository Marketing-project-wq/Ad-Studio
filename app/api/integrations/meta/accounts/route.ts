import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAdAccounts,
  isMetaConfigured,
  refreshLongLivedToken,
} from '@/lib/integrations/meta';
import { getFreshMetaToken, updateSelectedAccount } from '@/lib/integrations/store';

export const dynamic = 'force-dynamic';

function notConfigured() {
  return NextResponse.json(
    { error: 'Meta belum dikonfigurasi. / Not configured.', code: 'not_configured' },
    { status: 503 },
  );
}

// GET → the ad accounts the connected user can access, plus the selected one.
export async function GET() {
  if (!isMetaConfigured()) return notConfigured();
  const fresh = await getFreshMetaToken(refreshLongLivedToken);
  if (!fresh) {
    return NextResponse.json(
      { error: 'Belum terhubung. / Not connected.', code: 'not_connected' },
      { status: 400 },
    );
  }
  try {
    const accounts = await fetchAdAccounts(fresh.accessToken);
    return NextResponse.json({ accounts, selected: fresh.row.account_id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed', code: 'fetch_failed' },
      { status: 502 },
    );
  }
}

// POST → set the selected ad account ({ accountId, accountName }).
export async function POST(req: NextRequest) {
  if (!isMetaConfigured()) return notConfigured();
  let body: { accountId?: string; accountName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }
  await updateSelectedAccount('meta', body.accountId, body.accountName || body.accountId);
  return NextResponse.json({ ok: true });
}
