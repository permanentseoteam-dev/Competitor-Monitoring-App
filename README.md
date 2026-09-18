# Competitor Monitor

Always-on dashboard that watches competitor **sitemaps** and shows **newly appeared product URLs** as cards.

## Features

- Start empty — add competitor store or sitemap URLs
- Sitemap-only scraping (follows sitemap indexes; prefers product sitemaps when present)
- First scrape baselines existing URLs (no feed spam)
- Later scrapes surface only new URLs
- Per-competitor interval: **Live (every 5 min)** or **1 / 2 / 3 / 4 / 5 hours**
- Manual “Scrape now” + scheduled checks
- Dashboard-only alerts (mark seen / mark all seen)

## Local development

```bash
cd competitor-monitor
npm install
```

Copy `.env.example` to `.env.local` and set:

- `AUTH_USERNAME` / `AUTH_PASSWORD` — dashboard login
- `SESSION_SECRET` — at least 32 characters (`openssl rand -base64 32`)

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visits go to `/login`. The dashboard, scrape APIs, and product APIs require a valid session. `/api/cron` still uses `CRON_SECRET` so Vercel Cron is unchanged.

Local data is stored in `data/store.json` (no Redis/Blob required).

## Deploy on Vercel

Vercel is serverless, so the app needs **durable storage**:

1. **Preferred:** [Upstash Redis](https://vercel.com/marketplace/upstash) from the Vercel project Storage / Integrations tab  
   - sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. **Alternative:** [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)  
   - sets `BLOB_READ_WRITE_TOKEN`

Optional: set `CRON_SECRET` and Vercel will send it as `Authorization: Bearer …` to `/api/cron`.

Also set `AUTH_USERNAME`, `AUTH_PASSWORD`, and `SESSION_SECRET` on the Vercel project so production login works.

```bash
npx vercel --prod
```

Scheduling on Vercel:

- Daily full scrape at **09:00 Pakistan time (UTC+5)** via `/api/cron` (`0 4 * * *` UTC)
- Dashboard `/api/tick` also runs any **due** scrapes while the page is open
- Hobby plan only allows one cron per day; upgrade to Pro for more frequent platform crons

## Notes

- If you paste a store homepage, the app tries `https://host/sitemap.xml`.
- Product detection is heuristic for mixed e-commerce; dedicated product sitemaps work best.
- Respect target sites’ terms and robots rules; this tool is for monitoring stores you are allowed to check.
