import { NextRequest, NextResponse } from 'next/server';
import { dbToggleFavorite, isSupabaseServerConfigured } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 });
  }
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const is_favorite = await dbToggleFavorite(body.id);
    return NextResponse.json({ is_favorite });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Toggle failed' },
      { status: 500 },
    );
  }
}
