-- ============================================================
-- 20FIT Ad Studio — Reports System Migration (team-wide, no-auth model)
-- Jalankan MANUAL di Supabase SQL Editor (copy-paste seluruh file).
--
-- Model: Ad Studio belum punya auth, jadi data bersifat TEAM-WIDE.
--   - Semua WRITE lewat SECURITY DEFINER RPC (konvensi CRM), dipanggil
--     server-side dengan service_role. user_id disimpan NULL (pool tim).
--   - EXECUTE di-revoke dari anon/authenticated → hanya server (service_role)
--     yang boleh memanggil. RLS tetap ketat: anon key publik TIDAK bisa
--     membaca tabel langsung.
--   - Report meng-agregasi SELURUH baris (bukan per-user).
-- Aman untuk shared project: TIDAK menyentuh tabel milik CRM.
-- ============================================================

-- 1. TABEL (idempotent; selaras dengan 0001_init.sql bila sudah ada) -------
CREATE TABLE IF NOT EXISTS public.ad_generations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('google_display','google_sem','google_pmax','meta')),
  language      TEXT NOT NULL DEFAULT 'id' CHECK (language IN ('id','en')),
  input_brief   JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_favorite   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kolom tracking copy — ditambahkan aman walau tabel sudah dibuat 0001.
ALTER TABLE public.ad_generations
  ADD COLUMN IF NOT EXISTS copied_fields TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_adgen_platform  ON public.ad_generations(platform);
CREATE INDEX IF NOT EXISTS idx_adgen_created   ON public.ad_generations(created_at DESC);

CREATE TABLE IF NOT EXISTS public.utm_links (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url      TEXT NOT NULL,
  utm_source    TEXT NOT NULL DEFAULT '',
  utm_medium    TEXT NOT NULL DEFAULT '',
  utm_campaign  TEXT NOT NULL DEFAULT '',
  utm_term      TEXT DEFAULT '',
  utm_content   TEXT DEFAULT '',
  full_url      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_utm_created ON public.utm_links(created_at DESC);

-- 2. RLS: aktif + ketat. Tidak ada policy untuk anon → anon key publik tak
--    bisa baca/tulis. Server memakai service_role (bypass RLS). ------------
ALTER TABLE public.ad_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utm_links      ENABLE ROW LEVEL SECURITY;

-- Bila nanti auth ditambah, baris ber-user hanya boleh dibaca pemiliknya.
DROP POLICY IF EXISTS "own_generations_read" ON public.ad_generations;
CREATE POLICY "own_generations_read" ON public.ad_generations
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "own_utm_read" ON public.utm_links;
CREATE POLICY "own_utm_read" ON public.utm_links
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ============================================================
-- 3. WRITE RPCs (SECURITY DEFINER, team-wide) — user_id = NULL
-- ============================================================
CREATE OR REPLACE FUNCTION public.ads_save_generation(
  p_platform    TEXT,
  p_language    TEXT,
  p_input_brief JSONB,
  p_output_data JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO ad_generations (platform, language, input_brief, output_data)
  VALUES (p_platform, p_language, coalesce(p_input_brief,'{}'::jsonb), coalesce(p_output_data,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.ads_toggle_favorite(p_generation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new BOOLEAN;
BEGIN
  UPDATE ad_generations
     SET is_favorite = NOT is_favorite, updated_at = now()
   WHERE id = p_generation_id
  RETURNING is_favorite INTO v_new;
  IF NOT FOUND THEN RAISE EXCEPTION 'Generation % not found', p_generation_id; END IF;
  RETURN v_new;
END; $$;

CREATE OR REPLACE FUNCTION public.ads_track_copy(p_generation_id UUID, p_field_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE ad_generations
     SET copied_fields = array_append(copied_fields, p_field_name),
         updated_at = now()
   WHERE id = p_generation_id
     AND NOT (p_field_name = ANY(copied_fields));
END; $$;

CREATE OR REPLACE FUNCTION public.ads_save_utm(
  p_base_url TEXT, p_utm_source TEXT, p_utm_medium TEXT, p_utm_campaign TEXT,
  p_utm_term TEXT DEFAULT '', p_utm_content TEXT DEFAULT '', p_full_url TEXT DEFAULT ''
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO utm_links (base_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, full_url)
  VALUES (p_base_url, p_utm_source, p_utm_medium, p_utm_campaign, coalesce(p_utm_term,''), coalesce(p_utm_content,''), p_full_url)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ============================================================
-- 4. REPORT RPCs (read-only aggregations, team-wide)
-- ============================================================

-- 4a. Produktivitas: generation per minggu per platform + estimasi jam hemat
CREATE OR REPLACE FUNCTION public.ads_report_productivity(
  p_start_date DATE DEFAULT (now() - interval '30 days')::date,
  p_end_date   DATE DEFAULT now()::date
) RETURNS TABLE (week_start DATE, platform TEXT, gen_count BIGINT, est_hours_saved NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT date_trunc('week', ag.created_at)::date, ag.platform,
         count(*)::bigint, round(count(*) * 2.5, 1)
  FROM ad_generations ag
  WHERE ag.created_at >= p_start_date
    AND ag.created_at < p_end_date + interval '1 day'
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
END; $$;

-- 4b. Quality/Compliance: kepatuhan batas karakter, sesuai BENTUK OUTPUT ASLI
--     (Display=variations dgn array; SEM=ad_groups; PMax=asset_groups; Meta=variations skalar)
CREATE OR REPLACE FUNCTION public.ads_report_quality(
  p_start_date DATE DEFAULT (now() - interval '30 days')::date,
  p_end_date   DATE DEFAULT now()::date
) RETURNS TABLE (
  platform TEXT, total_generations BIGINT, total_fields BIGINT,
  compliant_fields BIGINT, compliance_pct NUMERIC, worst_field TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH gens AS (
    SELECT id, platform, output_data FROM ad_generations
    WHERE created_at >= p_start_date AND created_at < p_end_date + interval '1 day'
  ),
  checks AS (
    -- jsonb_array_elements dibungkus CASE → '[]' agar aman walau field bukan array.
    -- DISPLAY (variations[].short_headlines/long_headlines/descriptions/image_text)
    SELECT g.id gen_id, g.platform, 'short_headline' field_name, length(h) len, 30 max_chars
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'variations')='array' THEN g.output_data->'variations' ELSE '[]'::jsonb END) v,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(v->'short_headlines')='array' THEN v->'short_headlines' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_display'
    UNION ALL
    SELECT g.id, g.platform, 'long_headline', length(h), 90
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'variations')='array' THEN g.output_data->'variations' ELSE '[]'::jsonb END) v,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(v->'long_headlines')='array' THEN v->'long_headlines' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_display'
    UNION ALL
    SELECT g.id, g.platform, 'description', length(h), 90
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'variations')='array' THEN g.output_data->'variations' ELSE '[]'::jsonb END) v,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(v->'descriptions')='array' THEN v->'descriptions' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_display'
    UNION ALL
    SELECT g.id, g.platform, 'image_text', length(v->>'image_text'), 20
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'variations')='array' THEN g.output_data->'variations' ELSE '[]'::jsonb END) v
    WHERE g.platform='google_display' AND v ? 'image_text' AND v->>'image_text' <> ''
    -- SEM (ad_groups[].headlines/descriptions + sitelinks)
    UNION ALL
    SELECT g.id, g.platform, 'headline', length(h), 30
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'ad_groups')='array' THEN g.output_data->'ad_groups' ELSE '[]'::jsonb END) ag,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(ag->'headlines')='array' THEN ag->'headlines' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_sem'
    UNION ALL
    SELECT g.id, g.platform, 'description', length(h), 90
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'ad_groups')='array' THEN g.output_data->'ad_groups' ELSE '[]'::jsonb END) ag,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(ag->'descriptions')='array' THEN ag->'descriptions' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_sem'
    -- PMAX (asset_groups[].headlines/long_headlines/descriptions + youtube)
    UNION ALL
    SELECT g.id, g.platform, 'headline', length(h), 30
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'asset_groups')='array' THEN g.output_data->'asset_groups' ELSE '[]'::jsonb END) ag,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(ag->'headlines')='array' THEN ag->'headlines' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_pmax'
    UNION ALL
    SELECT g.id, g.platform, 'long_headline', length(h), 90
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'asset_groups')='array' THEN g.output_data->'asset_groups' ELSE '[]'::jsonb END) ag,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(ag->'long_headlines')='array' THEN ag->'long_headlines' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_pmax'
    UNION ALL
    SELECT g.id, g.platform, 'description', length(h), 90
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'asset_groups')='array' THEN g.output_data->'asset_groups' ELSE '[]'::jsonb END) ag,
      LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(ag->'descriptions')='array' THEN ag->'descriptions' ELSE '[]'::jsonb END) h
    WHERE g.platform='google_pmax'
    -- META (variations[] skalar: primary_text/headline/description/image_text)
    UNION ALL
    SELECT g.id, g.platform, 'primary_text', length(v->>'primary_text'), 125
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'variations')='array' THEN g.output_data->'variations' ELSE '[]'::jsonb END) v
    WHERE g.platform='meta' AND v ? 'primary_text'
    UNION ALL
    SELECT g.id, g.platform, 'headline', length(v->>'headline'), 40
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'variations')='array' THEN g.output_data->'variations' ELSE '[]'::jsonb END) v
    WHERE g.platform='meta' AND v ? 'headline'
    UNION ALL
    SELECT g.id, g.platform, 'description', length(v->>'description'), 30
    FROM gens g,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.output_data->'variations')='array' THEN g.output_data->'variations' ELSE '[]'::jsonb END) v
    WHERE g.platform='meta' AND v ? 'description'
  )
  SELECT c.platform,
         count(DISTINCT c.gen_id)::bigint,
         count(*)::bigint,
         count(*) FILTER (WHERE c.len <= c.max_chars)::bigint,
         round(count(*) FILTER (WHERE c.len <= c.max_chars)::numeric / NULLIF(count(*),0) * 100, 1),
         (SELECT c2.field_name FROM checks c2
           WHERE c2.platform = c.platform AND c2.len > c2.max_chars
           GROUP BY c2.field_name ORDER BY count(*) DESC LIMIT 1)
  FROM checks c
  GROUP BY c.platform
  ORDER BY c.platform;
END; $$;

-- 4c. Content Insights (team-wide). Baca input_brief->>'product' (field asli).
CREATE OR REPLACE FUNCTION public.ads_report_content(
  p_start_date DATE DEFAULT (now() - interval '30 days')::date,
  p_end_date   DATE DEFAULT now()::date
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'language_split', (
      SELECT coalesce(jsonb_object_agg(lang, cnt), '{}'::jsonb) FROM (
        SELECT language lang, count(*)::int cnt FROM ad_generations
        WHERE created_at >= p_start_date AND created_at < p_end_date + interval '1 day'
        GROUP BY language) x),
    'platform_distribution', (
      SELECT coalesce(jsonb_object_agg(plat, cnt), '{}'::jsonb) FROM (
        SELECT platform plat, count(*)::int cnt FROM ad_generations
        WHERE created_at >= p_start_date AND created_at < p_end_date + interval '1 day'
        GROUP BY platform) x),
    'top_products', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('prod', prod, 'cnt', cnt) ORDER BY cnt DESC), '[]'::jsonb) FROM (
        SELECT input_brief->>'product' prod, count(*)::int cnt FROM ad_generations
        WHERE created_at >= p_start_date AND created_at < p_end_date + interval '1 day'
          AND coalesce(input_brief->>'product','') <> ''
        GROUP BY input_brief->>'product' ORDER BY cnt DESC LIMIT 10) x),
    'favorite_count', (
      SELECT count(*)::int FROM ad_generations
      WHERE is_favorite AND created_at >= p_start_date AND created_at < p_end_date + interval '1 day'),
    'copy_engagement', (
      SELECT count(*)::int FROM ad_generations
      WHERE coalesce(array_length(copied_fields,1),0) > 0
        AND created_at >= p_start_date AND created_at < p_end_date + interval '1 day')
  ) INTO v_result;
  RETURN v_result;
END; $$;

-- 4d. Dashboard stats (team-wide)
CREATE OR REPLACE FUNCTION public.ads_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_generations', (SELECT count(*)::int FROM ad_generations),
    'this_week', (SELECT count(*)::int FROM ad_generations WHERE created_at >= date_trunc('week', now())),
    'favorites', (SELECT count(*)::int FROM ad_generations WHERE is_favorite),
    'total_utm', (SELECT count(*)::int FROM utm_links),
    'platform_counts', (
      SELECT coalesce(jsonb_object_agg(platform, cnt), '{}'::jsonb) FROM (
        SELECT platform, count(*)::int cnt FROM ad_generations GROUP BY platform) x),
    'est_hours_saved', (SELECT round(count(*) * 2.5, 1) FROM ad_generations)
  ) INTO v_result;
  RETURN v_result;
END; $$;

-- ============================================================
-- 5. GRANTS: hanya server (service_role) yang boleh memanggil RPC.
--    Cabut dari anon/authenticated (defense-in-depth di shared project).
-- ============================================================
DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN
    SELECT unnest(ARRAY[
      'ads_save_generation(text,text,jsonb,jsonb)',
      'ads_toggle_favorite(uuid)',
      'ads_track_copy(uuid,text)',
      'ads_save_utm(text,text,text,text,text,text,text)',
      'ads_report_productivity(date,date)',
      'ads_report_quality(date,date)',
      'ads_report_content(date,date)',
      'ads_dashboard_stats()'
    ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role;', fn);
  END LOOP;
END $$;

-- ============================================================
-- 6. Refresh PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
