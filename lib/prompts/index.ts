import type { Brief, Lang, Platform } from '@/lib/types';
import { displayPrompt } from './google-display';
import { semPrompt } from './google-sem';
import { pmaxPrompt } from './google-pmax';
import { metaPrompt } from './meta';
import type { DisplayBrief, SemBrief, PmaxBrief, MetaBrief } from '@/lib/types';

export function buildPrompt(
  platform: Platform,
  brief: Brief,
  lang: Lang,
): string {
  switch (platform) {
    case 'google_display':
      return displayPrompt(brief as DisplayBrief, lang);
    case 'google_sem':
      return semPrompt(brief as SemBrief, lang);
    case 'google_pmax':
      return pmaxPrompt(brief as PmaxBrief, lang);
    case 'meta':
      return metaPrompt(brief as MetaBrief, lang);
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
