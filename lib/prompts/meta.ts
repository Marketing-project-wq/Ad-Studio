import type { MetaBrief, Lang } from '@/lib/types';
import { langDirective, BRAND_CONTEXT } from './shared';

export function metaPrompt(b: MetaBrief, lang: Lang): string {
  const stories = b.placement === 'stories';
  return `You are a Meta Ads (Facebook & Instagram) specialist for the fitness brand 20FIT.
${BRAND_CONTEXT}
${langDirective(lang)}

Info:
- Product: ${b.product || 'EMS Training 20 menit'}
- Audience: ${b.audience || 'Women 25-35'}
- Objective: ${b.objective || 'leads'}
- CTA button: ${b.cta || 'Daftar Sekarang'}
- USP: ${b.usp || 'German EMS technology'}
- Promo: ${b.promo || 'Free trial'}
- Placement: ${b.placement || 'feed'}
- Tone/notes: ${b.notes || 'Engaging'}

Create 3 variations. Each variation must have:
- primary_text (a strong hook, 2-4 sentences; the first sentence is the most important)
- headline (MAX 40 characters)
- description (MAX 30 characters)
- image_text (MAX 20 characters)${stories ? '\n- story_text (MAX 50 characters)' : ''}

Respect the character limits strictly.
Respond ONLY with JSON in exactly this shape (no markdown, no commentary):
{"variations":[{"name":"...","primary_text":"...","headline":"...","description":"...","image_text":"..."${
    stories ? ',"story_text":"..."' : ''
  }}]}`;
}
