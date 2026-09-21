import { NextRequest, NextResponse } from 'next/server';
import { isMetaConfigured, metaAuthUrl } from '@/lib/integrations/meta';
import {
  computeRedirectUri,
  makeStateNonce,
  stateCookieName,
} from '@/lib/integrations/oauth';

export const dynamic = 'force-dynamic';

// GET → start the Meta OAuth flow (redirects to Facebook's consent dialog).
export async function GET(req: NextRequest) {
  if (!isMetaConfigured()) {
    return NextResponse.json(
      {
        error:
          'Meta belum dikonfigurasi. Set META_APP_ID dan META_APP_SECRET. / Meta is not configured.',
        code: 'not_configured',
      },
      { status: 503 },
    );
  }

  const redirectUri = computeRedirectUri(req.nextUrl.origin, 'meta');
  const state = makeStateNonce();
  const res = NextResponse.redirect(metaAuthUrl(redirectUri, state));
  res.cookies.set(stateCookieName('meta'), state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
