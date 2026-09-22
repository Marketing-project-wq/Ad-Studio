-- ============================================================
-- 20FIT Ad Studio — campaign objective (Meta ROAS accuracy)
-- Adds a nullable `objective` column to campaign_metrics. The Meta sync stores
-- each campaign's objective (e.g. OUTCOME_SALES, OUTCOME_LEADS) so revenue can
-- be gated: only sales/conversion campaigns keep purchase revenue, everything
-- else shows ROAS "—" instead of cross-attributed values.
--
-- Additive and nullable: manual / CSV / Google Ads rows simply leave it null,
-- and it is not part of the (platform, campaign, date, source) unique key.
-- Safe to re-run.
-- ============================================================

alter table public.campaign_metrics
  add column if not exists objective text;
