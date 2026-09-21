-- ============================================================
-- 20FIT Ad Studio — ad platform integration credentials
-- Stores OAuth tokens for Google Ads / Meta so /api/integrations/*
-- can pull performance data automatically. Tokens are stored ENCRYPTED
-- (AES-256-GCM, see lib/integrations/encryption.ts) — never plaintext.
--
-- Security: RLS is enabled with NO policies, so anon/authenticated clients
-- can neither read nor write. Only the service role (used by the server
-- routes, which bypasses RLS) can touch this table. Credentials must never
-- be exposed to the browser.
-- ============================================================

create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('google_ads', 'meta')),
  account_id text,
  account_name text,
  -- Ciphertext produced by encryptSecret(): "<ivB64>:<tagB64>:<dataB64>".
  access_token text not null,
  refresh_token text,
  token_expiry timestamptz,
  scope text,
  status text not null default 'connected' check (
    status in ('connected', 'error', 'disconnected')
  ),
  error_message text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One connection per platform for this internal tool (connect / disconnect).
create unique index if not exists integration_credentials_platform_key
  on public.integration_credentials (platform);

-- ---- Row Level Security: locked to the service role -----------------
-- Enabling RLS with no policies denies all anon/authenticated access.
-- The service role bypasses RLS, so only the server routes can read/write.
alter table public.integration_credentials enable row level security;

-- keep updated_at fresh (touch_updated_at() is defined in 0001_init.sql)
drop trigger if exists trg_integration_credentials_touch on public.integration_credentials;
create trigger trg_integration_credentials_touch
  before update on public.integration_credentials
  for each row execute function public.touch_updated_at();
