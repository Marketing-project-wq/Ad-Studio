'use client';

import type { AdGeneration, Brief, GenerationOutput, Lang, Platform } from './types';

const HISTORY_KEY = '20fit_ad_history';
const UTM_KEY = '20fit_utm_links';

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode / quota) — silently skip.
  }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveGeneration(params: {
  platform: Platform;
  language: Lang;
  input_brief: Brief;
  output_data: GenerationOutput;
}): AdGeneration {
  const record: AdGeneration = {
    id: uid(),
    platform: params.platform,
    language: params.language,
    input_brief: params.input_brief,
    output_data: params.output_data,
    is_favorite: false,
    created_at: new Date().toISOString(),
  };
  const all = readArray<AdGeneration>(HISTORY_KEY);
  all.unshift(record);
  // Keep the most recent 100.
  writeArray(HISTORY_KEY, all.slice(0, 100));
  return record;
}

export function listGenerations(): AdGeneration[] {
  return readArray<AdGeneration>(HISTORY_KEY);
}

export function deleteGeneration(id: string): void {
  const all = readArray<AdGeneration>(HISTORY_KEY).filter((g) => g.id !== id);
  writeArray(HISTORY_KEY, all);
}

export function clearGenerations(): void {
  writeArray(HISTORY_KEY, []);
}

// ---- UTM links ----
export interface StoredUtm {
  id: string;
  full_url: string;
  utm_campaign: string;
  created_at: string;
}

export function saveUtmLink(fullUrl: string, campaign: string): void {
  const all = readArray<StoredUtm>(UTM_KEY);
  all.unshift({
    id: uid(),
    full_url: fullUrl,
    utm_campaign: campaign,
    created_at: new Date().toISOString(),
  });
  writeArray(UTM_KEY, all.slice(0, 100));
}

export function listUtmLinks(): StoredUtm[] {
  return readArray<StoredUtm>(UTM_KEY);
}

/** Aggregate counts for the dashboard stat cards. */
export function getStats(): {
  totalGenerated: number;
  activeCampaigns: number;
  utmLinks: number;
} {
  const gens = listGenerations();
  const campaigns = new Set(
    gens
      .map((g) => {
        const brief = g.input_brief as { product?: string };
        return brief.product?.trim().toLowerCase();
      })
      .filter(Boolean),
  );
  return {
    totalGenerated: gens.length,
    activeCampaigns: campaigns.size,
    utmLinks: listUtmLinks().length,
  };
}
