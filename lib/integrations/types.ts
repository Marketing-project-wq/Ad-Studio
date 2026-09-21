// Shared types for the ad-platform integrations (Google Ads, Meta).

import type { MetricPlatform } from '@/lib/types';

export type IntegrationPlatform = 'google_ads' | 'meta';

/** Public-safe connection status (no tokens) returned to the settings UI. */
export interface IntegrationStatus {
  platform: IntegrationPlatform;
  connected: boolean;
  account_id?: string | null;
  account_name?: string | null;
  status?: 'connected' | 'error' | 'disconnected';
  error_message?: string | null;
  last_synced_at?: string | null;
  scope?: string | null;
}

/** Tokens returned by an OAuth token exchange / refresh. */
export interface OAuthTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null; // seconds until access_token expiry
  scope?: string | null;
}

/** Result summary returned by a sync run. */
export interface SyncResult {
  platform: IntegrationPlatform;
  imported: number;
  deleted: number;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  account_id?: string | null;
}

/** A metric row ready to insert into campaign_metrics. */
export interface SyncedMetricRow {
  date: string; // yyyy-mm-dd
  platform: MetricPlatform;
  campaign: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  source: 'google_ads_api' | 'meta_api';
}

/** Raw credentials row as stored in Supabase (tokens are ciphertext). */
export interface CredentialRow {
  id: string;
  platform: IntegrationPlatform;
  account_id: string | null;
  account_name: string | null;
  access_token: string; // ciphertext
  refresh_token: string | null; // ciphertext
  token_expiry: string | null;
  scope: string | null;
  status: 'connected' | 'error' | 'disconnected';
  error_message: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
