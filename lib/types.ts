// Shared types for 20FIT Ad Studio.

export type Lang = 'id' | 'en';
export type Theme = 'light' | 'dark';

export type Platform = 'google_display' | 'google_sem' | 'google_pmax' | 'meta';

export const PLATFORM_LABELS: Record<Platform, string> = {
  google_display: 'Display Ads',
  google_sem: 'Search / SEM',
  google_pmax: 'Performance Max',
  meta: 'Meta Ads',
};

// ---- Generator input briefs (one shape per platform) ----
export interface DisplayBrief {
  product: string;
  audience: string;
  usp: string;
  promo: string;
  url: string;
  format: string;
  notes: string;
}

export interface SemBrief {
  product: string;
  location: string;
  keywords: string;
  competitor: string;
  url: string;
  goal: string;
  notes: string;
}

export interface PmaxBrief {
  product: string;
  audience: string;
  usp: string;
  promo: string;
  url: string;
  goal: string;
  notes: string;
}

export interface MetaBrief {
  product: string;
  audience: string;
  objective: string;
  cta: string;
  usp: string;
  promo: string;
  placement: string;
  url: string;
  notes: string;
}

export type Brief = DisplayBrief | SemBrief | PmaxBrief | MetaBrief;

// ---- Generator output shapes ----
export interface DisplayVariation {
  name: string;
  short_headlines: string[];
  long_headlines: string[];
  descriptions: string[];
  cta: string;
  image_text: string;
}
export interface DisplayOutput {
  variations: DisplayVariation[];
}

export interface SemKeyword {
  keyword: string;
  match: 'exact' | 'phrase' | 'broad';
  intent: 'high' | 'medium' | 'low';
}
export interface SemSitelink {
  title: string;
  desc: string;
}
export interface SemAdGroup {
  name: string;
  keywords: SemKeyword[];
  negative_keywords: string[];
  headlines: string[];
  descriptions: string[];
  sitelinks: SemSitelink[];
}
export interface SemOutput {
  ad_groups: SemAdGroup[];
}

export interface PmaxAssetGroup {
  name: string;
  headlines: string[];
  long_headlines: string[];
  descriptions: string[];
  business_name: string;
  cta: string;
  audience_signals: string[];
  search_themes: string[];
  youtube_headline: string;
  youtube_description: string;
}
export interface PmaxOutput {
  asset_groups: PmaxAssetGroup[];
}

export interface MetaVariation {
  name: string;
  primary_text: string;
  headline: string;
  description: string;
  image_text: string;
  story_text?: string;
}
export interface MetaOutput {
  variations: MetaVariation[];
}

export type GenerationOutput =
  | DisplayOutput
  | SemOutput
  | PmaxOutput
  | MetaOutput;

// ---- Persistence ----
export interface AdGeneration {
  id: string;
  user_id?: string | null;
  platform: Platform;
  language: Lang;
  input_brief: Brief;
  output_data: GenerationOutput;
  is_favorite?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface UtmLink {
  id: string;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term?: string;
  utm_content?: string;
  full_url: string;
  created_at: string;
}

export type AssetType = 'logo' | 'product' | 'lifestyle' | 'background' | 'event';

export interface AdAsset {
  id: string;
  user_id?: string | null;
  file_name: string;
  file_path: string;
  public_url: string;
  file_type: AssetType;
  file_size: number;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  created_at: string;
}

// ---- Campaign performance metrics (reporting) ----
// A metric row is one platform+campaign's numbers for one day. It can be typed
// in by hand or imported from a Google Ads / Meta Ads CSV export.
export type MetricPlatform = Platform | 'other';

export const METRIC_PLATFORMS: MetricPlatform[] = [
  'google_display',
  'google_sem',
  'google_pmax',
  'meta',
  'other',
];

// Where a metric row came from.
export type MetricSourceTag = 'manual' | 'csv_import' | 'google_ads_api' | 'meta_api';

export interface CampaignMetric {
  id: string;
  user_id?: string | null;
  date: string; // yyyy-mm-dd
  platform: MetricPlatform;
  campaign: string;
  impressions: number;
  clicks: number;
  cost: number; // ad spend, in IDR
  conversions: number;
  revenue: number; // conversion value, in IDR (0 when unknown)
  source?: MetricSourceTag; // defaults to 'manual' server-side
  objective?: string | null; // Meta campaign objective (null for other sources)
  created_at: string;
}

/** The raw numbers of a metric row (or an aggregate of rows). */
export interface MetricTotals {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
}

/** KPIs derived from MetricTotals. null means "not computable" (divide-by-zero). */
export interface MetricKpis {
  ctr: number | null; // clicks / impressions
  cpc: number | null; // cost / clicks
  cpm: number | null; // cost / impressions * 1000
  cvr: number | null; // conversions / clicks
  cpa: number | null; // cost / conversions
  roas: number | null; // revenue / cost
}

export interface ApiError {
  error: string;
  code?: string;
}
