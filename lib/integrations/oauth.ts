// Small OAuth helpers shared by the integration routes: redirect URIs and a
// CSRF state nonce carried in an httpOnly cookie (no server-side session store).

import crypto from 'node:crypto';

export function makeStateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** App base URL — prefer the configured public URL, fall back to the request origin. */
export function appBaseUrl(origin: string): string {
  return (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, '');
}

/** The redirect URI registered with the OAuth provider for a platform. */
export function computeRedirectUri(origin: string, platformSlug: string): string {
  return `${appBaseUrl(origin)}/api/integrations/${platformSlug}/callback`;
}

export function stateCookieName(platformSlug: string): string {
  return `adstudio_oauth_${platformSlug.replace(/-/g, '_')}`;
}
