import type { PmaxBrief, Lang } from '@/lib/types';
import { langDirective, BRAND_CONTEXT } from './shared';

export function pmaxPrompt(b: PmaxBrief, lang: Lang): string {
  return `You are a Google Performance Max specialist for the fitness brand 20FIT.
${BRAND_CONTEXT}
${langDirective(lang)}

Info:
- Product: ${b.product || 'EMS Training Membership'}
- Audience signals: ${b.audience || 'Fitness enthusiasts'}
- USP: ${b.usp || '20 minutes = 2 hours at the gym'}
- Promo: ${b.promo || 'First session FREE'}
- Goal: ${b.goal || 'leads'}
- Notes: ${b.notes || '-'}

Create 2 Asset Groups. Each asset group must have:
- 5 headlines (MAX 30 characters each)
- 5 long_headlines (MAX 90 characters each)
- 5 descriptions (MAX 90 characters each)
- business_name (MAX 25 characters)
- cta
- 3 audience_signals
- 3 search_themes
- youtube_headline (MAX 40 characters)
- youtube_description (MAX 90 characters)

Respect the character limits strictly.
Respond ONLY with JSON in exactly this shape (no markdown, no commentary):
{"asset_groups":[{"name":"...","headlines":["..."],"long_headlines":["..."],"descriptions":["..."],"business_name":"...","cta":"...","audience_signals":["..."],"search_themes":["..."],"youtube_headline":"...","youtube_description":"..."}]}`;
}
