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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local data is stored in `data/store.json` (no Redis/Blob required).

## Deploy on Vercel

Vercel is serverless, so the app needs **durable storage**:

1. **Preferred:** [Upstash Redis](https://vercel.com/marketplace/upstash) from the Vercel project Storage / Integrations tab  
   - sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. **Alternative:** [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)  
   - sets `BLOB_READ_WRITE_TOKEN`

Optional: set `CRON_SECRET` and Vercel will send it as `Authorization: Bearer …` to `/api/cron`.

```bash
npx vercel --prod
```

Scheduling on Vercel:

- `vercel.json` cron hits `/api/cron` once per day on Hobby (Vercel limit)
- Dashboard API reads also run any **due** scrapes, so opening/using the app keeps Live/hourly intervals working
- Upgrade to Pro if you want platform cron every 5 minutes without opening the app

## Notes

- If you paste a store homepage, the app tries `https://host/sitemap.xml`.
- Product detection is heuristic for mixed e-commerce; dedicated product sitemaps work best.
- Respect target sites’ terms and robots rules; this tool is for monitoring stores you are allowed to check.
