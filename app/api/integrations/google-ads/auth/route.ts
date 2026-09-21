import { NextRequest, NextResponse } from 'next/server';
import { googleAdsAuthUrl, isGoogleAdsConfigured } from '@/lib/integrations/google-ads';
import {
  computeRedirectUri,
  makeStateNonce,
  stateCookieName,
} from '@/lib/integrations/oauth';

export const dynamic = 'force-dynamic';

// GET → start the Google Ads OAuth flow (redirects to Google's consent screen).
export async function GET(req: NextRequest) {
  if (!isGoogleAdsConfigured()) {
    return NextResponse.json(
      {
        error:
          'Google Ads belum dikonfigurasi. Set GOOGLE_ADS_CLIENT_ID dan GOOGLE_ADS_CLIENT_SECRET. / Google Ads is not configured.',
        code: 'not_configured',
      },
      { status: 503 },
    );
  }

  const redirectUri = computeRedirectUri(req.nextUrl.origin, 'google-ads');
  const state = makeStateNonce();
  const res = NextResponse.redirect(googleAdsAuthUrl(redirectUri, state));
  res.cookies.set(stateCookieName('google-ads'), state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
