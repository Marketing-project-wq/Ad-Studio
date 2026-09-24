import { NextRequest, NextResponse } from 'next/server';
import { generateCopy, isAIConfigured } from '@/lib/ai';
import { cacheGet, cacheSet, hashKey, rateLimit } from '@/lib/server-cache';
import { dbSaveGeneration, isSupabaseServerConfigured } from '@/lib/db/server';
import type { Brief, GenerationOutput, Lang, Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VALID_PLATFORMS: Platform[] = [
  'google_display',
  'google_sem',
  'google_pmax',
  'meta',
];

const RATE_MAX = Number(process.env.AI_RATE_LIMIT_PER_HOUR || 20);

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] || 'anon').trim();
}

export async function POST(req: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error:
          'AI belum dikonfigurasi. Set ANTHROPIC_API_KEY di environment untuk mengaktifkan generate. / AI is not configured. Set ANTHROPIC_API_KEY to enable generation.',
        code: 'ai_not_configured',
      },
      { status: 503 },
    );
  }

  let body: { platform?: Platform; language?: Lang; brief?: Brief };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { platform, language, brief } = body;
  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `Invalid platform: ${platform}` },
      { status: 400 },
    );
  }
  const lang: Lang = language === 'en' ? 'en' : 'id';
  if (!brief || typeof brief !== 'object') {
    return NextResponse.json({ error: 'Missing brief' }, { status: 400 });
  }

  // Rate limit per client per hour.
  const rl = rateLimit(clientKey(req), RATE_MAX);
  if (!rl.ok) {
    const mins = Math.ceil((rl.resetAt - Date.now()) / 60000);
    return NextResponse.json(
      {
        error: `Rate limit tercapai (${RATE_MAX}/jam). Coba lagi dalam ~${mins} menit. / Rate limit reached. Try again in ~${mins} min.`,
        code: 'rate_limited',
      },
      { status: 429 },
    );
  }

  // Cache identical briefs for an hour.
  const cacheKey = hashKey(`${platform}:${lang}:${JSON.stringify(brief)}`);
  const cached = cacheGet<GenerationOutput>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached, cached: true });
  }

  try {
    const data = await generateCopy(platform, brief, lang);
    cacheSet(cacheKey, data);

    // Persist team-wide for the Reports system (best-effort; never blocks).
    let generationId: string | null = null;
    if (isSupabaseServerConfigured()) {
      try {
        generationId = await dbSaveGeneration({
          platform,
          language: lang,
          inputBrief: brief,
          outputData: data,
        });
      } catch (e) {
        console.error('Failed to persist generation:', e);
      }
    }

    return NextResponse.json({ data, cached: false, generationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    // JSON parse failures or upstream API errors land here.
    return NextResponse.json(
      {
        error: `Gagal generate: ${message}. / Generation failed: ${message}.`,
        code: 'generation_failed',
      },
      { status: 502 },
    );
  }
}
