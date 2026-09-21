import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCode,
  isGoogleAdsConfigured,
  listAccessibleCustomers,
} from '@/lib/integrations/google-ads';
import {
  appBaseUrl,
  computeRedirectUri,
  stateCookieName,
} from '@/lib/integrations/oauth';
import { saveCredentials } from '@/lib/integrations/store';

export const dynamic = 'force-dynamic';

// GET ← Google redirects here with ?code & ?state after user consent.
export async function GET(req: NextRequest) {
  const settingsUrl = `${appBaseUrl(req.nextUrl.origin)}/reports/settings`;
  const fail = (reason: string) =>
    NextResponse.redirect(`${settingsUrl}?google=error&reason=${encodeURIComponent(reason)}`);

  if (!isGoogleAdsConfigured()) return fail('not_configured');

  const params = req.nextUrl.searchParams;
  if (params.get('error')) return fail(params.get('error') || 'denied');

  const code = params.get('code');
  const state = params.get('state');
  const cookieState = req.cookies.get(stateCookieName('google-ads'))?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('invalid_state');
  }

  try {
    const redirectUri = computeRedirectUri(req.nextUrl.origin, 'google-ads');
    const tokens = await exchangeCode(code, redirectUri);

    // Best-effort account discovery (non-fatal — can be set via env / reconnect).
    let accountId: string | null =
      (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/[^0-9]/g, '') || null;
    if (!accountId) {
      try {
        const customers = await listAccessibleCustomers(tokens.access_token);
        if (customers.length) accountId = customers[0];
      } catch {
        /* ignore — user can set the account later */
      }
    }

    await saveCredentials({ platform: 'google_ads', tokens, account_id: accountId });

    const res = NextResponse.redirect(`${settingsUrl}?google=connected`);
    res.cookies.delete(stateCookieName('google-ads'));
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'exchange_failed');
  }
}
