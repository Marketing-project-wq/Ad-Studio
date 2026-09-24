'use client';

import { listGenerations } from '@/lib/history';
import { saveGenerationToServer } from './generations';

const MIGRATED_FLAG = '20fit_history_migrated';

/**
 * One-time migration of localStorage history (key 20fit_ad_history, written by
 * lib/history.ts) into Supabase. Safe to call repeatedly — it no-ops once done,
 * and aborts (without setting the flag) if Supabase isn't configured yet.
 */
export async function migrateLocalHistory(): Promise<{
  migrated: number;
  errors: number;
  skipped: boolean;
}> {
  if (typeof window === 'undefined') return { migrated: 0, errors: 0, skipped: true };
  try {
    if (localStorage.getItem(MIGRATED_FLAG) === 'true') {
      return { migrated: 0, errors: 0, skipped: true };
    }
  } catch {
    return { migrated: 0, errors: 0, skipped: true };
  }

  const items = listGenerations();
  if (items.length === 0) {
    try {
      localStorage.setItem(MIGRATED_FLAG, 'true');
    } catch {
      /* ignore */
    }
    return { migrated: 0, errors: 0, skipped: false };
  }

  let migrated = 0;
  let errors = 0;

  // Oldest first so created_at order stays natural.
  for (const item of [...items].reverse()) {
    try {
      const id = await saveGenerationToServer({
        platform: item.platform,
        language: item.language,
        inputBrief: item.input_brief,
        outputData: item.output_data,
      });
      if (id === null) {
        // Supabase not configured — abort without marking migrated.
        return { migrated, errors, skipped: true };
      }
      migrated++;
    } catch {
      errors++;
    }
  }

  if (errors === 0) {
    try {
      localStorage.setItem(MIGRATED_FLAG, 'true');
    } catch {
      /* ignore */
    }
  }
  return { migrated, errors, skipped: false };
}
