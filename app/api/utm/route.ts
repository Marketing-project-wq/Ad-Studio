import { NextRequest, NextResponse } from 'next/server';
import { dbSaveUtm, isSupabaseServerConfigured } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 });
  }
  let body: {
    baseUrl?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    fullUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.fullUrl || !body.baseUrl) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  try {
    const id = await dbSaveUtm({
      baseUrl: body.baseUrl,
      utmSource: body.utmSource || '',
      utmMedium: body.utmMedium || '',
      utmCampaign: body.utmCampaign || '',
      utmTerm: body.utmTerm,
      utmContent: body.utmContent,
      fullUrl: body.fullUrl,
    });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    );
  }
}
