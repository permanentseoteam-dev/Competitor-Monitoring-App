# Competitor Monitor (Node.js / Express)

Hostinger-ready **Node.js** app. Language: **JavaScript**. Framework: **Express**.

Tracks competitor **sitemaps** and shows **newly appeared product URLs**.

## Project layout

```text
.
├── server.js              # Entry point
├── src/
│   ├── app.js             # Express app wiring
│   ├── middleware/        # Auth, etc.
│   ├── routes/            # HTTP routes
│   └── lib/               # DB, scrape, session, pricing…
├── views/                 # EJS templates
├── public/
│   ├── css/styles.css
│   ├── js/dashboard.js
│   └── brand/             # Logos & icons
├── data/                  # Runtime store (gitignored)
├── docs/                  # Migration / ops notes
└── legacy/                # Archived Next.js leftovers (not used)
```

## Stack

| Piece | Technology |
|--------|------------|
| Runtime | Node.js 18+ (22 recommended on Hostinger) |
| Server | Express (`server.js`) |
| Pages | EJS (`views/`) |
| Styles | `public/css/styles.css` |
| Browser UI | `public/js/dashboard.js` |
| Storage | `data/store.json` on disk |

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env` if you use one, or set env vars in the shell:

- `AUTH_USERNAME` / `AUTH_PASSWORD` — dashboard login (defaults exist for local use)
- `SESSION_SECRET` — at least 32 characters
- `CRON_SECRET` — optional; required in production for `/api/cron`
- `PORT` — Hostinger sets this; locally defaults to `3000`

## Hostinger deploy

1. Push this branch (`migration-to-nodejs`) to GitHub.
2. hPanel → **Node.js Web App** (Unlimited / Business / Cloud with Node.js).
3. Settings:

| Field | Value |
|--------|--------|
| Framework | Express |
| Node.js | 22 |
| Build command | *(empty)* |
| Output directory | *(empty)* |
| Entry file | `server.js` |
| Start | `npm start` → `node server.js` |

4. Env vars in hPanel: `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, `NODE_ENV=production`.
5. Cron (hPanel → Cron Jobs, Custom, **UTC**):

```text
0 4 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-DOMAIN/api/cron
```

That is **09:00 Asia/Karachi**. Settings can turn the daily scrape **off** without removing the cron.

## Features

- Add competitor store / sitemap URLs
- Baseline on first scrape; later scrapes show new URLs only
- Intervals: **5 / 8 / 12 / 16 / 18 / 20 hours**
- Manual Scrape / Scrape all
- Daily 9am schedule toggle in Settings
- No dashboard polling (does not scrape while the page is open)

## Notes

- Homepage URLs are normalized to `/sitemap.xml` when needed.
- Respect target sites’ terms and robots rules.
- See `docs/` for migration notes; `legacy/` is archived Next.js code only.
