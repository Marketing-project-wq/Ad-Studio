// Production analytics: aggregate the local generation history into the numbers
// the Reports "Produksi" tab shows. Pure functions over AdGeneration[] so they
// are easy to reason about and reuse.

import type { AdGeneration, Platform } from './types';
import { PLATFORM_LABELS } from './types';

export interface Bucket {
  label: string;
  value: number;
}

export interface ProductionSummary {
  total: number;
  thisWeek: number;
  thisMonth: number;
  activeCampaigns: number;
  byPlatform: { platform: Platform; label: string; count: number }[];
  byLanguage: Bucket[];
  weekly: Bucket[]; // last 8 ISO weeks, oldest → newest
  topProducts: Bucket[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 of the week containing `d` (local time). */
function weekStart(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - day);
  return copy;
}

function productOf(g: AdGeneration): string {
  const brief = g.input_brief as { product?: string };
  return (brief.product || '').trim();
}

export function summarizeProduction(gens: AdGeneration[]): ProductionSummary {
  const now = new Date();
  const weekAgo = now.getTime() - WEEK_MS;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let thisWeek = 0;
  let thisMonth = 0;
  const platformCounts = new Map<Platform, number>();
  const langCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();

  for (const g of gens) {
    const ts = new Date(g.created_at).getTime();
    if (ts >= weekAgo) thisWeek++;
    if (ts >= monthStart) thisMonth++;
    platformCounts.set(g.platform, (platformCounts.get(g.platform) || 0) + 1);
    langCounts.set(g.language, (langCounts.get(g.language) || 0) + 1);
    const p = productOf(g).toLowerCase();
    if (p) productCounts.set(p, (productCounts.get(p) || 0) + 1);
  }

  // Weekly buckets: 8 weeks ending this week.
  const thisWeekStart = weekStart(now);
  const weekly: Bucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(thisWeekStart.getTime() - i * WEEK_MS);
    const end = start.getTime() + WEEK_MS;
    const count = gens.filter((g) => {
      const ts = new Date(g.created_at).getTime();
      return ts >= start.getTime() && ts < end;
    }).length;
    weekly.push({
      label: `${String(start.getDate()).padStart(2, '0')}/${String(
        start.getMonth() + 1,
      ).padStart(2, '0')}`,
      value: count,
    });
  }

  const byPlatform = (Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => ({
    platform: p,
    label: PLATFORM_LABELS[p],
    count: platformCounts.get(p) || 0,
  }));

  const byLanguage: Bucket[] = Array.from(langCounts.entries())
    .map(([label, value]) => ({ label: label.toUpperCase(), value }))
    .sort((a, b) => b.value - a.value);

  const topProducts: Bucket[] = Array.from(productCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    total: gens.length,
    thisWeek,
    thisMonth,
    activeCampaigns: productCounts.size,
    byPlatform,
    byLanguage,
    weekly,
    topProducts,
  };
}

export function generationsToCsv(gens: AdGeneration[]): string {
  const head = 'date,platform,language,product';
  const body = gens
    .map((g) => {
      const product = (g.input_brief as { product?: string }).product || '';
      return [
        new Date(g.created_at).toISOString().slice(0, 10),
        g.platform,
        g.language,
        `"${product.replace(/"/g, '""')}"`,
      ].join(',');
    })
    .join('\n');
  return `${head}\n${body}`;
}
