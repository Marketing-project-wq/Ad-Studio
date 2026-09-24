import { NextRequest, NextResponse } from 'next/server';
import {
  dbListGenerations,
  dbSaveGeneration,
  isSupabaseServerConfigured,
} from '@/lib/db/server';
import type { Brief, GenerationOutput, Lang, Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID: Platform[] = ['google_display', 'google_sem', 'google_pmax', 'meta'];

function notConfigured() {
  return NextResponse.json(
    { error: 'Supabase belum dikonfigurasi. / Supabase not configured.', code: 'supabase_not_configured' },
    { status: 503 },
  );
}

// GET: list team-wide generation history (optional ?platform=&limit=)
export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured()) return notConfigured();
  const sp = req.nextUrl.searchParams;
  const platform = sp.get('platform') || undefined;
  const limit = Number(sp.get('limit') || 100);
  try {
    const data = await dbListGenerations({ platform, limit });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'List failed' },
      { status: 500 },
    );
  }
}

// POST: persist a generation (used for the one-time localStorage migration).
export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured()) return notConfigured();
  let body: {
    platform?: Platform;
    language?: Lang;
    inputBrief?: Brief;
    outputData?: GenerationOutput;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.platform || !VALID.includes(body.platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }
  try {
    const id = await dbSaveGeneration({
      platform: body.platform,
      language: body.language === 'en' ? 'en' : 'id',
      inputBrief: (body.inputBrief || {}) as Brief,
      outputData: (body.outputData || {}) as GenerationOutput,
    });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    );
  }
}
