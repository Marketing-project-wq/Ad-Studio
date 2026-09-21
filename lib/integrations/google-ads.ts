// Google Ads API helper: OAuth 2.0, token refresh, and campaign performance
// via GAQL searchStream. Uses fetch (no SDK) so the API version stays an
// explicit, env-overridable constant.
//
// IMPORTANT (verified 2026-09, but re-check the docs before wiring credentials):
//   - Developer tokens were SUNSET on 2026-09-09. Access now attaches to the
//     Google Cloud project that owns the OAuth client; the `developer-token`
//     header is optional and ignored (a future major version will reject it).
//     So GOOGLE_ADS_DEVELOPER_TOKEN is optional here — sent only if present.
//     https://developers.google.com/google-ads/api/docs/api-policy/developer-token
//   - Current API version is v25 (override via GOOGLE_ADS_API_VERSION):
//     https://developers.google.com/google-ads/api/docs/concepts/versioning

import type { OAuthTokens, SyncedMetricRow } from './types';
import type { MetricPlatform } from '@/lib/types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
export const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v25';

function apiBase(): string {
  return `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
}

export function isGoogleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const digitsOnly = (s: string): string => (s || '').replace(/[^0-9]/g, '');

// ---- OAuth -----------------------------------------------------------------
export function googleAdsAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_ADS_SCOPE,
    access_type: 'offline', // request a refresh token
    include_granted_scopes: 'true',
    prompt: 'consent', // force a refresh token on re-consent
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Google token error: ${str(json.error_description) || str(json.error) || res.status}`,
    );
  }
  return {
    access_token: str(json.access_token),
    refresh_token: json.refresh_token ? str(json.refresh_token) : null,
    expires_in: json.expires_in != null ? num(json.expires_in) : null,
    scope: json.scope != null ? str(json.scope) : null,
  };
}

export function exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
  return tokenRequest({
    code,
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
}

export function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    grant_type: 'refresh_token',
  });
}

// ---- Ads API ---------------------------------------------------------------
function adsHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  // Optional since the 2026-09-09 developer-token sunset (see file header).
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (devToken) headers['developer-token'] = devToken;
  // Needed when accessing client accounts through a manager (MCC) account.
  const loginCid = digitsOnly(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '');
  if (loginCid) headers['login-customer-id'] = loginCid;
  return headers;
}

function errText(json: unknown, status: number): string {
  const j = (json ?? {}) as { error?: { message?: string; status?: string } };
  return j.error?.message || j.error?.status || `HTTP ${status}`;
}

/** Customer IDs (digits, no dashes) the authenticated user can access. */
export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(`${apiBase()}/customers:listAccessibleCustomers`, {
    headers: adsHeaders(accessToken),
  });
  const json = (await res.json().catch(() => ({}))) as { resourceNames?: string[] };
  if (!res.ok) {
    throw new Error(`Google Ads listAccessibleCustomers: ${errText(json, res.status)}`);
  }
  return (json.resourceNames || []).map((n) => n.replace('customers/', ''));
}

function mapChannel(type: string): MetricPlatform {
  switch (type) {
    case 'SEARCH':
      return 'google_sem';
    case 'DISPLAY':
      return 'google_display';
    case 'PERFORMANCE_MAX':
      return 'google_pmax';
    default:
      return 'other';
  }
}

interface GaqlRow {
  campaign?: { name?: string; advertisingChannelType?: string };
  segments?: { date?: string };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    costMicros?: string | number;
    conversions?: number;
    conversionsValue?: number;
  };
}
interface GaqlBatch {
  results?: GaqlRow[];
}

/** Fetch daily campaign performance for [from, to] (yyyy-mm-dd). */
export async function fetchCampaignMetrics(
  accessToken: string,
  customerId: string,
  from: string,
  to: string,
): Promise<SyncedMetricRow[]> {
  const cid = digitsOnly(customerId);
  // cost_micros is in micros of the account currency (1_000_000 = 1 unit).
  const query = `SELECT campaign.name, campaign.advertising_channel_type, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`;

  const res = await fetch(`${apiBase()}/customers/${cid}/googleAds:searchStream`, {
    method: 'POST',
    headers: adsHeaders(accessToken),
    body: JSON.stringify({ query }),
  });
  const json = (await res.json().catch(() => null)) as GaqlBatch[] | GaqlBatch | null;
  if (!res.ok) throw new Error(`Google Ads searchStream: ${errText(json, res.status)}`);

  // searchStream returns an array of batches, each with a `results` array.
  const batches: GaqlBatch[] = Array.isArray(json) ? json : json ? [json] : [];
  const rows: SyncedMetricRow[] = [];
  for (const batch of batches) {
    for (const row of batch.results || []) {
      rows.push({
        date: str(row.segments?.date) || from,
        platform: mapChannel(str(row.campaign?.advertisingChannelType)),
        campaign: str(row.campaign?.name) || '—',
        impressions: num(row.metrics?.impressions),
        clicks: num(row.metrics?.clicks),
        cost: num(row.metrics?.costMicros) / 1_000_000,
        conversions: num(row.metrics?.conversions),
        revenue: num(row.metrics?.conversionsValue),
        source: 'google_ads_api',
      });
    }
  }
  return rows;
}
