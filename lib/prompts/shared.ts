import type { Lang } from '@/lib/types';

export const BRAND_CONTEXT = `20FIT is an EMS (Electro Muscle Stimulation) fitness studio in Indonesia. Its core promise: the results of a 2-hour gym session in a supervised 20-minute EMS workout, guided by a personal trainer, using German EMS technology. Brand voice: bold, energetic, premium yet approachable. Avoid the word "cheap".`;

export function langDirective(lang: Lang): string {
  return lang === 'id'
    ? 'Write ALL ad copy in Bahasa Indonesia.'
    : 'Write ALL ad copy in English.';
}
