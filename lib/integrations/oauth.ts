// Small OAuth helpers shared by the integration routes: redirect URIs and a
// CSRF state nonce carried in an httpOnly cookie (no server-side session store).

import crypto from 'node:crypto';

export function makeStateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * App base URL from NEXT_PUBLIC_APP_URL only. Returns null when it is not set —
 * an OAuth redirect URI must exactly match the value registered with the
 * provider (Google / Meta), so we never fall back to the request origin or
 * localhost.
 */
export function appBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  return url ? url.replace(/\/$/, '') : null;
}

/** The redirect URI registered with the OAuth provider, or null if NEXT_PUBLIC_APP_URL is unset. */
export function computeRedirectUri(platformSlug: string): string | null {
  const base = appBaseUrl();
  return base ? `${base}/api/integrations/${platformSlug}/callback` : null;
}

export function stateCookieName(platformSlug: string): string {
  return `adstudio_oauth_${platformSlug.replace(/-/g, '_')}`;
}
