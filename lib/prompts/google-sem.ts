import type { SemBrief, Lang } from '@/lib/types';
import { langDirective, BRAND_CONTEXT } from './shared';

export function semPrompt(b: SemBrief, lang: Lang): string {
  return `You are an SEM (Google Search Ads) specialist for the fitness brand 20FIT.
${BRAND_CONTEXT}
${langDirective(lang)}

Info:
- Product: ${b.product || 'EMS Training'}
- Location: ${b.location || 'Jakarta'}
- Seed keywords: ${b.keywords || 'gym terdekat'}
- Competitors: ${b.competitor || '-'}
- Goal: ${b.goal || 'leads'}
- Notes: ${b.notes || '-'}

Create 3 Ad Groups. Each ad group must have:
- 8 keywords with a match type (broad/phrase/exact) and an intent level (high/medium/low)
- 4 negative_keywords
- 5 headlines (MAX 30 characters each)
- 3 descriptions (MAX 90 characters each)
- 2 sitelinks (title MAX 25 chars, desc MAX 35 chars)

Respect the character limits strictly. Include the main keyword inside at least one headline.
Respond ONLY with JSON in exactly this shape (no markdown, no commentary):
{"ad_groups":[{"name":"...","keywords":[{"keyword":"...","match":"exact","intent":"high"}],"negative_keywords":["..."],"headlines":["..."],"descriptions":["..."],"sitelinks":[{"title":"...","desc":"..."}]}]}`;
}
