import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { ASSET_BUCKET } from '@/lib/supabase/config';
import type { AdAsset, AssetType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const TYPES: AssetType[] = [
  'logo',
  'product',
  'lifestyle',
  'background',
  'event',
];

function notConfigured() {
  return NextResponse.json(
    {
      error:
        'Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY. / Supabase is not configured.',
      code: 'supabase_not_configured',
    },
    { status: 503 },
  );
}

function publicUrl(path: string): string {
  const supabase = getSupabaseServer();
  if (!supabase) return '';
  return supabase.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---- GET: list assets (optionally filtered by ?type=) ----
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return notConfigured();

  const type = req.nextUrl.searchParams.get('type');
  let query = supabase
    .from('ad_assets')
    .select('*')
    .order('created_at', { ascending: false });
  if (type && TYPES.includes(type as AssetType)) {
    query = query.eq('file_type', type);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const assets: AdAsset[] = (data || []).map((row) => ({
    ...(row as AdAsset),
    public_url: publicUrl((row as { file_path: string }).file_path),
  }));
  return NextResponse.json({ assets });
}

// ---- POST: upload a new asset ----
export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return notConfigured();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 });
  }

  const file = form.get('file');
  const fileType = String(form.get('file_type') || 'product') as AssetType;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type}` },
      { status: 400 },
    );
  }
  const safeType = TYPES.includes(fileType) ? fileType : 'product';

  const ext = file.name.split('.').pop() || 'png';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${safeType}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: row, error: insErr } = await supabase
    .from('ad_assets')
    .insert({
      file_name: safeName,
      file_path: path,
      file_type: safeType,
      file_size: file.size,
      mime_type: file.type,
    })
    .select('*')
    .single();

  if (insErr) {
    // Roll back the uploaded object if the metadata insert failed.
    await supabase.storage.from(ASSET_BUCKET).remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const asset: AdAsset = { ...(row as AdAsset), public_url: publicUrl(path) };
  return NextResponse.json({ asset });
}

// ---- DELETE: remove an asset by ?id= ----
export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return notConfigured();

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data: row } = await supabase
    .from('ad_assets')
    .select('file_path')
    .eq('id', id)
    .single();

  if (row?.file_path) {
    await supabase.storage.from(ASSET_BUCKET).remove([row.file_path]);
  }
  const { error } = await supabase.from('ad_assets').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
