-- ============================================================
-- 20FIT Ad Studio — idempotent metric writes
-- Adds a unique key on (platform, campaign, date, source) so API syncs and
-- CSV re-imports UPSERT instead of duplicating. `source` is part of the key,
-- so an API sync (source='meta_api'/'google_ads_api') can never overwrite a
-- manual or csv_import row for the same platform/campaign/date.
--
-- Requires 0004 (adds the `source` column). Safe to re-run.
-- ============================================================

-- 1) Collapse any existing duplicates, keeping the most recent row per key.
delete from public.campaign_metrics a
using public.campaign_metrics b
where a.platform = b.platform
  and a.campaign = b.campaign
  and a.date = b.date
  and a.source = b.source
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

-- 2) Add the unique constraint (guarded so re-running the file is safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_metrics_dedup_key'
  ) then
    alter table public.campaign_metrics
      add constraint campaign_metrics_dedup_key
      unique (platform, campaign, date, source);
  end if;
end $$;
