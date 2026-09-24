// Shared types for the DB / reports layer (safe to import from server or client).
import type { Brief, GenerationOutput, Lang, Platform } from '@/lib/types';

export interface DbGeneration {
  id: string;
  platform: Platform;
  language: Lang;
  input_brief: Brief;
  output_data: GenerationOutput;
  is_favorite: boolean;
  copied_fields: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductivityRow {
  week_start: string;
  platform: string;
  gen_count: number;
  est_hours_saved: number;
}

export interface QualityRow {
  platform: string;
  total_generations: number;
  total_fields: number;
  compliant_fields: number;
  compliance_pct: number | null;
  worst_field: string | null;
}

export interface ContentInsights {
  language_split: Record<string, number>;
  platform_distribution: Record<string, number>;
  top_products: Array<{ prod: string; cnt: number }>;
  favorite_count: number;
  copy_engagement: number;
}

export interface DashboardStats {
  total_generations: number;
  this_week: number;
  favorites: number;
  total_utm: number;
  platform_counts: Record<string, number>;
  est_hours_saved: number;
}

export type ReportType = 'productivity' | 'quality' | 'content' | 'dashboard';
