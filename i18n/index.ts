import id, { type Dictionary } from './id';
import en from './en';
import type { Lang } from '@/lib/types';

export const dictionaries: Record<Lang, Dictionary> = { id, en };

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang] ?? id;
}

export type { Dictionary };
