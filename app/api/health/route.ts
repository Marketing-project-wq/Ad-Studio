import { NextResponse } from 'next/server';
import { isAIConfigured } from '@/lib/ai';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: '20fit-ad-studio',
    time: new Date().toISOString(),
    integrations: {
      ai: isAIConfigured(),
      supabase: isSupabaseServerConfigured(),
    },
  });
}
