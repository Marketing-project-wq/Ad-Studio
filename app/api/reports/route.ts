import { NextRequest, NextResponse } from 'next/server';
import {
  dbDashboardStats,
  dbReportContent,
  dbReportProductivity,
  dbReportQuality,
  isSupabaseServerConfigured,
} from '@/lib/db/server';

export const dynamic = 'force-dynamic';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Supabase belum dikonfigurasi. / Supabase not configured.', code: 'supabase_not_configured' },
      { status: 503 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const report = sp.get('report') || 'dashboard';
  const start = sp.get('start') || daysAgo(30);
  const end = sp.get('end') || today();

  try {
    switch (report) {
      case 'productivity':
        return NextResponse.json({ data: await dbReportProductivity(start, end) });
      case 'quality':
        return NextResponse.json({ data: await dbReportQuality(start, end) });
      case 'content':
        return NextResponse.json({ data: await dbReportContent(start, end) });
      case 'dashboard':
        return NextResponse.json({ data: await dbDashboardStats() });
      default:
        return NextResponse.json({ error: `Unknown report: ${report}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Report failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
