# 20FIT Ad Studio

AI-powered ad copy, banner, and campaign-tracking tool for the 20FIT digital
marketing team. Built to the [PRD](#) — Next.js 14 (App Router) · Supabase ·
Claude API · deployed on Railway at **ads.20fit.id**.

Design follows the **20FIT Design System v1.0 (Glass Minimalist)** — the same
tokens, fonts (Barlow Condensed / JetBrains Mono / Manrope), and glass surfaces
as crm.20fit.id, with light + dark modes.

---

## Features

| Module | What it does |
| --- | --- |
| **Dashboard** | Stat cards, platform grid, recent generations |
| **Reports** | Two tabs: **Ad Performance** (manual entry + CSV import of impressions/clicks/spend/conversions/revenue → CTR, CPC, CPM, CVR, CPA, ROAS, with trends, platform comparison, CSV export) and **Copy Production** (analytics over generation history) |
| **Google Display Ads** | 3 variations: short/long headlines, descriptions, CTA, image text |
| **Google Search / SEM** | 3 ad groups: keywords (match + intent), negatives, headlines, descriptions, sitelinks |
| **Google Performance Max** | 2 asset groups: headlines, long headlines, descriptions, signals, themes, YouTube assets |
| **Meta Ads** | 3 variations with a live Facebook/Instagram feed preview |
| **UTM Builder** | Preset sources/mediums, custom values, naming-convention guide, save links |
| **Banner Maker** | Canvas editor, 5 template sizes, logo/background upload, styles, PNG export (html2canvas) |
| **Asset Library** | Upload + browse brand assets (Supabase Storage) |
| **History** | Local record of generated copy |
| **Bilingual** | Full ID / EN toggle, persisted per browser |

Every AI call runs **server-side** through `/api/generate` (the Claude API key
never reaches the browser), with per-user hourly rate limiting and a 1-hour
response cache for identical briefs.

> The app **boots and renders with zero configuration** (demo mode). Each
> integration lights up as its keys are provided — so the first Railway deploy
> succeeds before Supabase or the Claude key are wired in.

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in what you have (all optional to start)
npm run dev                  # http://localhost:3000
```

Useful scripts: `npm run build`, `npm run start`, `npm run lint`,
`npm run typecheck`.

---

## Environment variables

See `.env.example`. Summary:

| Variable | Required for | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | AI copy generation | Server-only |
| `ANTHROPIC_MODEL` | (optional) | Defaults to `claude-sonnet-4-5`. Set to the model your account uses (e.g. `claude-sonnet-5`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Assets / data | Client-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Assets / data | Client-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Asset upload API | **Server-only — never expose** |
| `NEXT_PUBLIC_APP_URL` | Absolute links | e.g. `https://ads.20fit.id` |
| `AI_RATE_LIMIT_PER_HOUR` | (optional) | Defaults to 20 |

---

## Supabase setup

1. Create (or reuse the CRM's) Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor. It creates the
   `ad_generations`, `utm_links`, `ad_assets`, `banner_projects` tables with
   RLS, and the public **`ad-assets`** storage bucket + policies.
3. Run `supabase/migrations/0002_campaign_metrics.sql` to add the
   **`campaign_metrics`** table behind the Reports "Ad Performance" tab. When
   present, `/api/metrics` persists performance rows server-side (shared across
   the team); without it the tab falls back to this browser's localStorage.
4. Copy the project URL + anon key + service-role key into your env.

Asset uploads are written by the server route with the service-role key, so the
shared asset library works immediately. History currently persists in the
browser (localStorage); the schema is ready for per-user sync once Supabase Auth
(shared CRM user pool) is enabled.

---

## Deploy to Railway

1. **New Project → Deploy from GitHub repo** → select `Ad-Studio`.
2. Railway auto-detects Next.js (Nixpacks). `railway.json` pins:
   - Build: `npm run build`
   - Start: `npm run start` (Next binds to `$PORT` automatically)
   - Healthcheck: `/api/health`
3. Add the environment variables above under **Variables**.
4. **Settings → Networking → Custom Domain** → add `ads.20fit.id`.
5. In **Cloudflare DNS**: `CNAME ads → <railway-provided-domain>`, proxy **ON**
   (orange cloud), SSL **Full (strict)**.

`GET /api/health` returns service + integration status for uptime checks.

---

## Project structure

```
app/                       # App Router pages + API routes
  page.tsx                 # Dashboard
  reports/                 # Reports module (Ad Performance + Copy Production)
  google/{display,sem,pmax}/  Meta at meta/, plus utm, banner, assets, history, settings
  api/{generate,assets,metrics,health}/
components/{layout,ads,banner,utm,assets,reports}/
lib/                       # ai.ts, prompts/, utm.ts, history.ts, metrics.ts, report.ts, supabase/, types.ts
i18n/                      # id.ts, en.ts
styles → app/globals.css   # 20FIT design tokens + component CSS
supabase/migrations/       # 0001_init.sql, 0002_campaign_metrics.sql
```

See `docs/reporting-evaluation.md` for the analysis of the reporting surface
and the prioritized roadmap for enriching it.

Prompt templates live in `lib/prompts/` (one per platform) so copy quality can
be tuned without touching the UI.
