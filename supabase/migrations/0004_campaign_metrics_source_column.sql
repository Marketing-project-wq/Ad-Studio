-- ============================================================
-- 20FIT Ad Studio — track where each metric row came from
-- Adds a `source` column to campaign_metrics so the UI can distinguish
-- manually-entered rows, CSV imports, and rows pulled automatically from
-- the Google Ads / Meta APIs. Existing rows default to 'manual'.
-- ============================================================

alter table public.campaign_metrics
  add column if not exists source text not null default 'manual';

-- Constrain the allowed values (guarded so re-running the file is safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_metrics_source_check'
  ) then
    alter table public.campaign_metrics
      add constraint campaign_metrics_source_check
      check (source in ('manual', 'csv_import', 'google_ads_api', 'meta_api'));
  end if;
end $$;

create index if not exists campaign_metrics_source_idx
  on public.campaign_metrics (source, platform, date desc);
