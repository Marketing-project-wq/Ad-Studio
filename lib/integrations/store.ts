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
    scope: row.scope,
  };
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
 * Idempotent write of API-synced rows: delete any previously-synced rows of
 * this `source` within [from, to], then insert the fresh set. Manual and
 * CSV-imported rows (other sources) are never touched.
 */
export async function replaceSyncedMetrics(
  source: 'google_ads_api' | 'meta_api',
  from: string,
  to: string,
  rows: SyncedMetricRow[],
): Promise<{ imported: number; deleted: number }> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: del, error: delErr } = await supabase
    .from(METRICS)
    .delete()
    .eq('source', source)
    .gte('date', from)
    .lte('date', to)
    .select('id');
  if (delErr) throw new Error(delErr.message);
  const deleted = del?.length || 0;

  if (rows.length === 0) return { imported: 0, deleted };

  const { error: insErr } = await supabase.from(METRICS).insert(
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
    })),
  );
  if (insErr) throw new Error(insErr.message);
  return { imported: rows.length, deleted };
}
