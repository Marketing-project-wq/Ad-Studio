// Server-only DB layer for the reports system.
// All access uses the service-role client (bypasses RLS) and operates
// TEAM-WIDE (no per-user filter) since the app has no auth yet.
// Writes go through SECURITY DEFINER RPCs; reports go through report RPCs.
// Import this ONLY from API routes / server code — never a client component.
import { getSupabaseServer, isSupabaseServerConfigured } from '@/lib/supabase/server';
import type { Brief, GenerationOutput, Lang, Platform } from '@/lib/types';
import type {
  ContentInsights,
  DashboardStats,
  DbGeneration,
  ProductivityRow,
  QualityRow,
} from './types';

export { isSupabaseServerConfigured };

function db() {
  const client = getSupabaseServer();
  if (!client) throw new Error('supabase_not_configured');
  return client;
}

// ---- Writes (via SECURITY DEFINER RPC) ----
export async function dbSaveGeneration(input: {
  platform: Platform;
  language: Lang;
  inputBrief: Brief;
  outputData: GenerationOutput;
}): Promise<string> {
  const { data, error } = await db().rpc('ads_save_generation', {
    p_platform: input.platform,
    p_language: input.language,
    p_input_brief: input.inputBrief,
    p_output_data: input.outputData,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function dbToggleFavorite(id: string): Promise<boolean> {
  const { data, error } = await db().rpc('ads_toggle_favorite', {
    p_generation_id: id,
  });
  if (error) throw new Error(error.message);
  return data as boolean;
}

export async function dbTrackCopy(id: string, field: string): Promise<void> {
  const { error } = await db().rpc('ads_track_copy', {
    p_generation_id: id,
    p_field_name: field,
  });
  if (error) throw new Error(error.message);
}

export async function dbSaveUtm(p: {
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string;
  utmContent?: string;
  fullUrl: string;
}): Promise<string> {
  const { data, error } = await db().rpc('ads_save_utm', {
    p_base_url: p.baseUrl,
    p_utm_source: p.utmSource,
    p_utm_medium: p.utmMedium,
    p_utm_campaign: p.utmCampaign,
    p_utm_term: p.utmTerm || '',
    p_utm_content: p.utmContent || '',
    p_full_url: p.fullUrl,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ---- Reads ----
export async function dbListGenerations(opts?: {
  limit?: number;
  platform?: string;
}): Promise<DbGeneration[]> {
  let query = db()
    .from('ad_generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.platform) query = query.eq('platform', opts.platform);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as DbGeneration[]) || [];
}

// ---- Report RPCs ----
export async function dbReportProductivity(
  start: string,
  end: string,
): Promise<ProductivityRow[]> {
  const { data, error } = await db().rpc('ads_report_productivity', {
    p_start_date: start,
    p_end_date: end,
  });
  if (error) throw new Error(error.message);
  return (data as ProductivityRow[]) || [];
}

export async function dbReportQuality(
  start: string,
  end: string,
): Promise<QualityRow[]> {
  const { data, error } = await db().rpc('ads_report_quality', {
    p_start_date: start,
    p_end_date: end,
  });
  if (error) throw new Error(error.message);
  return (data as QualityRow[]) || [];
}

export async function dbReportContent(
  start: string,
  end: string,
): Promise<ContentInsights> {
  const { data, error } = await db().rpc('ads_report_content', {
    p_start_date: start,
    p_end_date: end,
  });
  if (error) throw new Error(error.message);
  return data as ContentInsights;
}

export async function dbDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await db().rpc('ads_dashboard_stats');
  if (error) throw new Error(error.message);
  return data as DashboardStats;
}
