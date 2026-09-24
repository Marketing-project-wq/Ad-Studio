import { NextRequest, NextResponse } from 'next/server';
import { dbTrackCopy, isSupabaseServerConfigured } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

// Fire-and-forget from the client; always resolves 200 so copy UX never breaks.
export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false });
  let body: { id?: string; field?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false });
  }
  if (!body.id || !body.field) return NextResponse.json({ ok: false });
  try {
    await dbTrackCopy(body.id, body.field);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
