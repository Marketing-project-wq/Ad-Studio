import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  fetchAdAccounts,
  isMetaConfigured,
} from '@/lib/integrations/meta';
import {
  appBaseUrl,
  computeRedirectUri,
  stateCookieName,
} from '@/lib/integrations/oauth';
import { saveCredentials } from '@/lib/integrations/store';

export const dynamic = 'force-dynamic';

// GET ← Meta redirects here with ?code & ?state after user consent.
export async function GET(req: NextRequest) {
  const settingsUrl = `${appBaseUrl(req.nextUrl.origin)}/reports/settings`;
  const fail = (reason: string) =>
    NextResponse.redirect(`${settingsUrl}?meta=error&reason=${encodeURIComponent(reason)}`);

  if (!isMetaConfigured()) return fail('not_configured');

  const params = req.nextUrl.searchParams;
  if (params.get('error')) {
    return fail(params.get('error_description') || params.get('error') || 'denied');
  }

  const code = params.get('code');
  const state = params.get('state');
  const cookieState = req.cookies.get(stateCookieName('meta'))?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('invalid_state');
  }

  try {
    const redirectUri = computeRedirectUri(req.nextUrl.origin, 'meta');
    const tokens = await exchangeCodeForToken(code, redirectUri);

    // Default to the first ad account; the user can change it in settings.
    let accountId: string | null = null;
    let accountName: string | null = null;
    try {
      const accounts = await fetchAdAccounts(tokens.access_token);
      if (accounts.length) {
        accountId = accounts[0].id;
        accountName = accounts[0].name;
      }
    } catch {
      /* non-fatal — the account can be picked in settings */
    }

    await saveCredentials({
      platform: 'meta',
      tokens,
      account_id: accountId,
      account_name: accountName,
    });

    const res = NextResponse.redirect(`${settingsUrl}?meta=connected`);
    res.cookies.delete(stateCookieName('meta'));
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'exchange_failed');
  }
}
