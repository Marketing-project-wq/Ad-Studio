-- ============================================================
-- 20FIT Ad Studio — campaign performance metrics
-- Adds the table behind the Reports "Performa" tab. One row = one
-- platform+campaign's numbers for one day (typed in or imported from a
-- Google Ads / Meta Ads CSV export). The /api/metrics route writes with the
-- service role, so team-shared reporting works even before end-user auth.
-- ============================================================

create table if not exists public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  date date not null default current_date,
  platform text not null default 'other' check (
    platform in ('google_display', 'google_sem', 'google_pmax', 'meta', 'other')
  ),
  campaign text not null default '',
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost numeric(14, 2) not null default 0,
  conversions numeric(12, 2) not null default 0,
  revenue numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists campaign_metrics_date_idx
  on public.campaign_metrics (date desc);
create index if not exists campaign_metrics_platform_idx
  on public.campaign_metrics (platform, date desc);

-- ---- Row Level Security --------------------------------------------
-- Shared team reporting: any authenticated user can read/write. The API
-- route uses the service role (bypasses RLS) so the tool works before auth.
alter table public.campaign_metrics enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'campaign_metrics_read') then
    create policy campaign_metrics_read on public.campaign_metrics
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'campaign_metrics_write') then
    create policy campaign_metrics_write on public.campaign_metrics
      for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'campaign_metrics_delete') then
    create policy campaign_metrics_delete on public.campaign_metrics
      for delete using (auth.role() = 'authenticated');
  end if;
end $$;
