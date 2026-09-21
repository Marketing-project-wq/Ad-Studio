import { NextResponse } from 'next/server';
import { isGoogleAdsConfigured } from '@/lib/integrations/google-ads';
import { isEncryptionConfigured } from '@/lib/integrations/encryption';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getCredentials, toStatus } from '@/lib/integrations/store';
import type { IntegrationStatus } from '@/lib/integrations/types';

export const dynamic = 'force-dynamic';

export interface IntegrationStatusView extends IntegrationStatus {
  configured: boolean; // platform env vars present so a connect can even start
}

// GET → connection status for each integration (no tokens exposed).
export async function GET() {
  const googleRow = await getCredentials('google_ads');
  const statuses: Record<string, IntegrationStatusView> = {
    google_ads: {
      ...toStatus(googleRow, 'google_ads'),
      configured: isGoogleAdsConfigured(),
    },
  };
  // Shared prerequisites both integrations need.
  const prereqs = {
    supabase: isSupabaseServerConfigured(),
    encryption: isEncryptionConfigured(),
  };
  return NextResponse.json({ statuses, prereqs });
}
