// Server-only data access for integration_credentials + synced metrics.
// Tokens are encrypted at rest; only the service role can touch these tables.

import { getSupabaseServer } from '@/lib/supabase/server';
import { decryptSecret, encryptSecret } from './encryption';
import type {
  CredentialRow,
  IntegrationPlatform,
  IntegrationStatus,
  OAuthTokens,
  SyncedMetricRow,
} from './types';

const TABLE = 'integration_credentials';
const METRICS = 'campaign_metrics';

function expiryFromNow(expiresIn?: number | null): string | null {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
}

export async function getCredentials(
  platform: IntegrationPlatform,
): Promise<CredentialRow | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase
    .from(TABLE)
    .select('*')
    .eq('platform', platform)
    .maybeSingle();
  return (data as CredentialRow | null) || null;
}

export async function saveCredentials(input: {
  platform: IntegrationPlatform;
  tokens: OAuthTokens;
  account_id?: string | null;
  account_name?: string | null;
}): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error('Supabase not configured');
  const record = {
    platform: input.platform,
    access_token: encryptSecret(input.tokens.access_token),
    refresh_token: input.tokens.refresh_token
      ? encryptSecret(input.tokens.refresh_token)
      : null,
    token_expiry: expiryFromNow(input.tokens.expires_in),
    scope: input.tokens.scope ?? null,
    account_id: input.account_id ?? null,
    account_name: input.account_name ?? null,
    status: 'connected',
    error_message: null,
  };
  const { error } = await supabase.from(TABLE).upsert(record, { onConflict: 'platform' });
  if (error) throw new Error(error.message);
}

async function updateAccessToken(
  platform: IntegrationPlatform,
  accessToken: string,
  tokenExpiry: string | null,
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase
    .from(TABLE)
    .update({
      access_token: encryptSecret(accessToken),
      token_expiry: tokenExpiry,
      status: 'connected',
      error_message: null,
    })
    .eq('platform', platform);
}

export async function deleteCredentials(platform: IntegrationPlatform): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase.from(TABLE).delete().eq('platform', platform);
}

export async function markSynced(platform: IntegrationPlatform): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase
    .from(TABLE)
    .update({ last_synced_at: new Date().toISOString(), status: 'connected', error_message: null })
    .eq('platform', platform);
}

export async function markError(
  platform: IntegrationPlatform,
  message: string,
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase
    .from(TABLE)
    .update({ status: 'error', error_message: message.slice(0, 500) })
    .eq('platform', platform);
}

export function toStatus(
  row: CredentialRow | null,
  platform: IntegrationPlatform,
): IntegrationStatus {
  if (!row) return { platform, connected: false };
  return {
    platform,
    connected: row.status === 'connected',
    account_id: row.account_id,
    account_name: row.account_name,
    status: row.status,
    error_message: row.error_message,
    last_synced_at: row.last_synced_at,
    token_expiry: row.token_expiry,
    scope: row.scope,
  };
}

/** Change the selected ad account for a connected platform. */
export async function updateSelectedAccount(
  platform: IntegrationPlatform,
  accountId: string,
  accountName: string,
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase
    .from(TABLE)
    .update({ account_id: accountId, account_name: accountName })
    .eq('platform', platform);
}

/**
 * Return a currently-valid access token, refreshing first if it is expired
 * (or within 60s of expiring) and a refresh token is available. The refresh
 * function is passed in so this stays platform-agnostic.
 */
export async function getFreshAccessToken(
  platform: IntegrationPlatform,
  refresher: (refreshToken: string) => Promise<OAuthTokens>,
): Promise<{ accessToken: string; row: CredentialRow } | null> {
  const row = await getCredentials(platform);
  if (!row) return null;

  const now = Date.now();
  const expiry = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  const stillValid = expiry && expiry - now > 60_000;
  if (stillValid || !row.refresh_token) {
    return { accessToken: decryptSecret(row.access_token), row };
  }

  const refreshed = await refresher(decryptSecret(row.refresh_token));
  const tokenExpiry = expiryFromNow(refreshed.expires_in);
  await updateAccessToken(platform, refreshed.access_token, tokenExpiry);
  return { accessToken: refreshed.access_token, row: { ...row, token_expiry: tokenExpiry } };
}

/**
 * Meta has no refresh token — a still-valid long-lived token is re-exchanged to
 * extend it. Re-extends when within 7 days of expiry, otherwise returns the
 * stored token as-is. A failed re-extend is non-fatal (the sync then surfaces a
 * clear "reconnect" error).
 */
export async function getFreshMetaToken(
  refresher: (accessToken: string) => Promise<OAuthTokens>,
): Promise<{ accessToken: string; row: CredentialRow } | null> {
  const row = await getCredentials('meta');
  if (!row) return null;
  const accessToken = decryptSecret(row.access_token);
  const now = Date.now();
  const expiry = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  const nearExpiry = expiry > 0 && expiry - now < 7 * 86400000;
  if (!nearExpiry) return { accessToken, row };
  try {
    const refreshed = await refresher(accessToken);
    const tokenExpiry = expiryFromNow(refreshed.expires_in);
    await updateAccessToken('meta', refreshed.access_token, tokenExpiry);
    return { accessToken: refreshed.access_token, row: { ...row, token_expiry: tokenExpiry } };
  } catch {
    return { accessToken, row };
  }
}

/**
 * Idempotent write of API-synced rows via UPSERT on the
 * (platform, campaign, date, source) unique key (migration 0005). Re-syncing
 * updates existing rows in place; `source` is part of the key, so manual and
 * csv_import rows are never overwritten by an API sync.
 */
export async function upsertSyncedMetrics(
  rows: SyncedMetricRow[],
): Promise<{ upserted: number }> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error('Supabase not configured');
  if (rows.length === 0) return { upserted: 0 };

  const { error } = await supabase.from(METRICS).upsert(
    rows.map((r) => ({
      date: r.date,
      platform: r.platform,
      campaign: r.campaign,
      impressions: r.impressions,
      clicks: r.clicks,
      cost: r.cost,
      conversions: r.conversions,
      revenue: r.revenue,
      source: r.source,
      objective: r.objective ?? null,
    })),
    { onConflict: 'platform,campaign,date,source' },
  );
  if (error) throw new Error(error.message);
  return { upserted: rows.length };
}

/** Remove all rows previously synced from a given API source (for a clean re-sync). */
export async function clearSyncedMetrics(
  source: 'google_ads_api' | 'meta_api',
): Promise<number> {
  const supabase = getSupabaseServer();
  if (!supabase) return 0;
  const { data } = await supabase.from(METRICS).delete().eq('source', source).select('id');
  return data?.length || 0;
}
