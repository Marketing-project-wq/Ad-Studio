-- ============================================================
-- 20FIT Ad Studio — initial schema
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- Tables follow the PRD. RLS restricts rows to their owner, while
-- ad_assets is a shared library (readable by any authenticated user).
-- The /api/assets route writes with the service role (bypasses RLS),
-- so the tool works even before end-user auth is wired in.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---- ad_generations -------------------------------------------------
create table if not exists public.ad_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  platform text not null check (
    platform in ('google_display', 'google_sem', 'google_pmax', 'meta')
  ),
  language text not null default 'id' check (language in ('id', 'en')),
  input_brief jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_generations_user_idx
  on public.ad_generations (user_id, created_at desc);

-- ---- utm_links ------------------------------------------------------
create table if not exists public.utm_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  base_url text not null,
  utm_source text not null,
  utm_medium text not null,
  utm_campaign text not null,
  utm_term text,
  utm_content text,
  full_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists utm_links_user_idx
  on public.utm_links (user_id, created_at desc);

-- ---- ad_assets (shared library) ------------------------------------
create table if not exists public.ad_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text not null default 'product' check (
    file_type in ('logo', 'product', 'lifestyle', 'background', 'event')
  ),
  file_size bigint not null default 0,
  mime_type text not null default 'image/png',
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index if not exists ad_assets_type_idx
  on public.ad_assets (file_type, created_at desc);

-- ---- banner_projects ------------------------------------------------
create table if not exists public.banner_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null default 'Untitled banner',
  canvas_width int not null default 1200,
  canvas_height int not null default 628,
  config jsonb not null default '{}'::jsonb,
  thumbnail_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists banner_projects_user_idx
  on public.banner_projects (user_id, updated_at desc);

-- ---- Row Level Security --------------------------------------------
alter table public.ad_generations enable row level security;
alter table public.utm_links enable row level security;
alter table public.ad_assets enable row level security;
alter table public.banner_projects enable row level security;

-- Owner-only access for personal data.
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'ad_generations_owner') then
    create policy ad_generations_owner on public.ad_generations
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'utm_links_owner') then
    create policy utm_links_owner on public.utm_links
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'banner_projects_owner') then
    create policy banner_projects_owner on public.banner_projects
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  -- Shared asset library: any authenticated user can read + write.
  if not exists (select 1 from pg_policies where policyname = 'ad_assets_read') then
    create policy ad_assets_read on public.ad_assets
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'ad_assets_write') then
    create policy ad_assets_write on public.ad_assets
      for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'ad_assets_delete') then
    create policy ad_assets_delete on public.ad_assets
      for delete using (auth.role() = 'authenticated');
  end if;
end $$;

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_ad_generations_touch on public.ad_generations;
create trigger trg_ad_generations_touch before update on public.ad_generations
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_banner_projects_touch on public.banner_projects;
create trigger trg_banner_projects_touch before update on public.banner_projects
  for each row execute function public.touch_updated_at();

-- ---- Storage bucket -------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ad-assets', 'ad-assets', true)
on conflict (id) do nothing;

-- Public read; authenticated write for the shared library.
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'ad_assets_public_read') then
    create policy ad_assets_public_read on storage.objects
      for select using (bucket_id = 'ad-assets');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'ad_assets_auth_write') then
    create policy ad_assets_auth_write on storage.objects
      for insert with check (bucket_id = 'ad-assets' and auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'ad_assets_auth_delete') then
    create policy ad_assets_auth_delete on storage.objects
      for delete using (bucket_id = 'ad-assets' and auth.role() = 'authenticated');
  end if;
end $$;
