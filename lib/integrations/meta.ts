// Meta Marketing API helper: OAuth (short- → long-lived token), ad-account
// discovery, and campaign insights. Uses fetch (no SDK). All requests are
// server-side; the access token is passed as a query param so Meta's paging
// `next` URLs stay self-contained.
//
// Graph/Marketing API version is a single constant. Verify the current stable
// version before shipping (it rolls ~quarterly):
// https://developers.facebook.com/docs/graph-api/changelog
// As of 2026-09 the current stable is v26.0. Override via META_GRAPH_VERSION.

import type { OAuthTokens, SyncedMetricRow } from './types';

export const META_API_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
// ads_read is sufficient for the Ads Insights API. (read_insights is for Page/App
// insights, not ad accounts, and is deprecated — don't request it.)
export const META_SCOPE = 'ads_read';
// Long-lived user tokens last ~60 days; Meta does not issue refresh tokens
// (a still-valid long-lived token is re-exchanged to extend it).
const LONG_LIVED_DEFAULT_SECONDS = 60 * 24 * 60 * 60;

function metaBase(): string {
  return `https://graph.facebook.com/${META_API_VERSION}`;
}

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MetaError {
  code?: number;
  message?: string;
  error_subcode?: number;
}

function metaErrText(err: MetaError | undefined, status: number): string {
  if (err?.code === 190) {
    return 'Meta token expired or invalid — please reconnect (code 190).';
  }
  if (err?.code === 10 || err?.code === 200) {
    return `Meta permission error: ${err?.message || 'missing ads_read/read_insights'} (code ${err.code}).`;
  }
  return `Meta API error: ${err?.message || `HTTP ${status}`}${err?.code ? ` (code ${err.code})` : ''}`;
}

/** GET a Graph API URL as JSON, retrying on rate-limit with backoff. */
async function graphGet(url: string, retries = 3): Promise<Record<string, unknown>> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  for (;;) {
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const err = json.error as MetaError | undefined;
    if (res.ok && !err) return json;

    const code = err?.code;
    // 4 = app rate limit, 17 = user rate limit, 32/613 = page/custom limit, 80000 = ads insights throttling.
    const rateLimited =
      res.status === 429 || [4, 17, 32, 613, 80000].includes(code ?? -1);
    if (rateLimited && attempt < retries) {
      await sleep(Math.min(30000, 1000 * 2 ** attempt));
      attempt++;
      continue;
    }
    throw new Error(metaErrText(err, res.status));
  }
}

function nextPage(json: Record<string, unknown>): string | null {
  const paging = json.paging as { next?: string } | undefined;
  return paging?.next || null;
}

// ---- OAuth -----------------------------------------------------------------
export function metaAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID || '',
    redirect_uri: redirectUri,
    state,
    scope: META_SCOPE,
    response_type: 'code',
  });
  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
}

async function exchangeForLongLived(token: string): Promise<OAuthTokens> {
  const url =
    `${metaBase()}/oauth/access_token?` +
    new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID || '',
      client_secret: process.env.META_APP_SECRET || '',
      fb_exchange_token: token,
    }).toString();
  const json = await graphGet(url);
  return {
    access_token: str(json.access_token),
    refresh_token: null,
    expires_in: json.expires_in != null ? num(json.expires_in) : LONG_LIVED_DEFAULT_SECONDS,
    scope: META_SCOPE,
  };
}

/** Authorization code → short-lived token → long-lived (~60d) token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<OAuthTokens> {
  const shortUrl =
    `${metaBase()}/oauth/access_token?` +
    new URLSearchParams({
      client_id: process.env.META_APP_ID || '',
      client_secret: process.env.META_APP_SECRET || '',
      redirect_uri: redirectUri,
      code,
    }).toString();
  const shortJson = await graphGet(shortUrl);
  const shortToken = str(shortJson.access_token);
  if (!shortToken) throw new Error('Meta: no access_token returned from code exchange');
  return exchangeForLongLived(shortToken);
}

/** Extend a still-valid long-lived token (Meta has no refresh token). */
export function refreshLongLivedToken(accessToken: string): Promise<OAuthTokens> {
  return exchangeForLongLived(accessToken);
}

// ---- Ad accounts -----------------------------------------------------------
export interface MetaAdAccount {
  id: string; // e.g. act_366543640038973
  name: string;
  status: number;
}

export async function fetchAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const out: MetaAdAccount[] = [];
  let url: string | null =
    `${metaBase()}/me/adaccounts?` +
    new URLSearchParams({
      fields: 'id,name,account_status',
      limit: '200',
      access_token: accessToken,
    }).toString();
  let guard = 0;
  while (url && guard < 20) {
    const json = await graphGet(url);
    const data = (json.data as Array<Record<string, unknown>>) || [];
    for (const a of data) {
      out.push({ id: str(a.id), name: str(a.name) || str(a.id), status: num(a.account_status) });
    }
    url = nextPage(json);
    guard++;
  }
  return out;
}

// ---- Insights --------------------------------------------------------------
// Which `actions`/`action_values` action_types count as a conversion. This is
// intentionally broad — the right set depends on each campaign's objective, so
// tune this regex (or make it configurable) if 20FIT standardises on specific
// conversion events (e.g. only `purchase` or a custom `offsite_conversion.*`).
const CONVERSION_MATCH =
  /(purchase|lead|complete_registration|offsite_conversion|onsite_conversion|omni_purchase|subscribe|start_trial|submit_application)/i;

function sumMatchingActions(list: unknown, matcher: RegExp): number {
  if (!Array.isArray(list)) return 0;
  let total = 0;
  for (const item of list as Array<Record<string, unknown>>) {
    if (matcher.test(str(item.action_type))) total += num(item.value);
  }
  return total;
}

function normalizeAccountId(adAccountId: string): string {
  return adAccountId.startsWith('act_')
    ? adAccountId
    : `act_${adAccountId.replace(/[^0-9]/g, '')}`;
}

/** Daily campaign insights for [from, to] (yyyy-mm-dd), mapped to metric rows. */
export async function fetchCampaignInsights(
  accessToken: string,
  adAccountId: string,
  from: string,
  to: string,
): Promise<SyncedMetricRow[]> {
  const acct = normalizeAccountId(adAccountId);
  let url: string | null =
    `${metaBase()}/${acct}/insights?` +
    new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_name,impressions,clicks,spend,actions,action_values,date_start',
      time_increment: '1', // one row per day
      time_range: JSON.stringify({ since: from, until: to }),
      limit: '200',
      access_token: accessToken,
    }).toString();

  const rows: SyncedMetricRow[] = [];
  let guard = 0;
  while (url && guard < 200) {
    const json = await graphGet(url);
    const data = (json.data as Array<Record<string, unknown>>) || [];
    for (const row of data) {
      rows.push({
        date: str(row.date_start) || from,
        platform: 'meta',
        campaign: str(row.campaign_name) || '—',
        impressions: num(row.impressions),
        clicks: num(row.clicks),
        cost: num(row.spend), // account-currency amount (IDR for 20FIT)
        conversions: sumMatchingActions(row.actions, CONVERSION_MATCH),
        revenue: sumMatchingActions(row.action_values, CONVERSION_MATCH),
        source: 'meta_api',
      });
    }
    url = nextPage(json);
    guard++;
  }
  return rows;
}
