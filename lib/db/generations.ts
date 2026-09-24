// Client-side helpers for generation writes/reads (call server API routes).
import type { Brief, GenerationOutput, Lang, Platform } from '@/lib/types';
import type { DbGeneration } from './types';

export type { DbGeneration } from './types';

/** Fire-and-forget: record that a field was copied. Never throws. */
export function trackCopy(generationId: string, field: string): void {
  try {
    fetch('/api/generations/track-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: generationId, field }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function toggleFavorite(generationId: string): Promise<boolean> {
  const res = await fetch('/api/generations/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: generationId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Toggle failed');
  return json.is_favorite as boolean;
}

export async function saveUtm(p: {
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string;
  utmContent?: string;
  fullUrl: string;
}): Promise<string | null> {
  const res = await fetch('/api/utm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  if (res.status === 503) return null; // Supabase off — caller falls back
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Save failed');
  return json.id as string;
}

/** Returns null when Supabase is not configured (caller uses localStorage). */
export async function fetchServerHistory(opts?: {
  platform?: string;
  limit?: number;
}): Promise<DbGeneration[] | null> {
  const qs = new URLSearchParams();
  if (opts?.platform) qs.set('platform', opts.platform);
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const res = await fetch(`/api/generations?${qs.toString()}`);
  if (res.status === 503) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'List failed');
  return json.data as DbGeneration[];
}

/** Persist one generation (used by the localStorage → Supabase migration). */
export async function saveGenerationToServer(input: {
  platform: Platform;
  language: Lang;
  inputBrief: Brief;
  outputData: GenerationOutput;
}): Promise<string | null> {
  const res = await fetch('/api/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.status === 503) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Save failed');
  return json.id as string;
}
