import { NextResponse } from 'next/server';
import { deleteCredentials } from '@/lib/integrations/store';

export const dynamic = 'force-dynamic';

// POST → disconnect Meta (remove stored credentials).
export async function POST() {
  await deleteCredentials('meta');
  return NextResponse.json({ ok: true });
}
