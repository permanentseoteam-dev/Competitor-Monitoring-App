# Hostinger Node.js Migration Plan

**Status:** Plan only — no application rewrite has been started.  
**Date:** 18 September 2026  
**Current app:** Competitor Monitor (Next.js 16 + React 19 + TypeScript on Vercel)  
**Target host:** Hostinger Node.js Web App (Business or Cloud plan)

This document is the downloadable plan. Review it before any code is changed.

---

## 1. What “Node.js language” means here

Hostinger’s Node.js product expects:

| Hostinger field | What we will use |
|---|---|
| Language / runtime | **Node.js 22** (also supports 18, 20, 24) |
| Framework preset | **Express** |
| Entry file | `server.js` (must end in `.js`, `.mjs`, or `.cjs`) |
| Start command | `node server.js` |
| Port | `process.env.PORT` (Hostinger assigns this; fallback `3000` locally) |
| Source | GitHub repo or ZIP with `package.json` at the **project root** |

**Chosen language for the rewrite:** plain **JavaScript (CommonJS or ESM)**, not TypeScript and not Next.js.

Why JavaScript, not TypeScript:

- Hostinger’s Express example is `server.js`.
- An entry file must be `.js` / `.mjs` / `.cjs`. TypeScript would need a `tsc` build step and `dist/server.js`.
- You asked for Node.js language for Hostinger; JavaScript is that language.

**Important:** Hostinger *can* run Next.js too. We are **not** keeping Next.js, because you asked to convert the app to Node.js for Hostinger. The rewrite is Express + HTML + CSS + browser JavaScript.

---

## 2. Current app vs Hostinger app

| Piece | Today (Vercel / Next.js) | After (Hostinger / Express) |
|---|---|---|
| Runtime | Node.js, but as short serverless functions | One long-running Node process |
| UI framework | React (`Dashboard.tsx`, `LoginForm.tsx`) | Server-rendered HTML (EJS) + `public/dashboard.js` |
| Pages / routing | Next App Router (`src/app/.../page.tsx`) | Express routes that `res.render()` templates |
| Auth | Next Server Actions + httpOnly JWT cookie (`jose`) | `POST /login` + same JWT cookie idea via `cookie-parser` |
| Session gate | `src/proxy.ts` (Next middleware) | Express `requireAuth` middleware |
| APIs | `src/app/api/*/route.ts` | `src/routes/*.js` mounted on Express |
| Scraping | `src/lib/scrape.ts` + sitemap fetch | Same logic ported to `src/lib/scrape.js` |
| Storage | Redis or Vercel Blob (required on Vercel) | **Local `data/store.json`** on Hostinger disk |
| Daily 9am job | Vercel Cron → `GET /api/cron` | **hPanel Cron Job** → `GET /api/cron` (in-process cron is unreliable) |
| CSS | `globals.css` | Copied to `public/styles.css` |
| Deploy | `vercel --prod` | hPanel → Node.js Web App → GitHub |

---

## 3. Approach by feature (language + files)

### 3.1 Pages (login + dashboard)

**Language:** HTML templates (EJS) + CSS + browser JavaScript.  
**Server language:** JavaScript (Express).

| Page | Current | New |
|---|---|---|
| Sign in | `src/app/login/page.tsx` + `LoginForm.tsx` | `views/login.ejs` rendered by `GET /login` |
| Dashboard / Competitors / Products / Runs / Settings | One React client (`Dashboard.tsx`) with in-page nav | `views/dashboard.ejs` + `public/dashboard.js` (same in-page nav, `fetch` APIs) |
| Layout / fonts | `src/app/layout.tsx` | `views/layout.ejs` |
| Loading skeleton | `src/app/loading.tsx` | CSS skeleton in `dashboard.js` (already exists conceptually) |

**Why not React on Hostinger?** You can, but then it is still a React app. The Node.js conversion you asked for is: the server sends pages and JSON; the browser runs small JS for buttons and lists.

Local URLs stay the same:

- `http://localhost:3000/login`
- `http://localhost:3000/` (dashboard, login required)

### 3.2 Auth

**Language:** JavaScript on the server.

| Concern | Current | New |
|---|---|---|
| Login submit | Server Action `login()` in `src/app/actions/auth.ts` | `POST /login` (form POST, then redirect) |
| Logout | Server Action `logout()` | `POST /logout` |
| Password check | HMAC compare in `src/lib/credentials.ts` | Port to `src/lib/credentials.js` (same env vars) |
| Session token | `jose` JWT in httpOnly cookie | Keep `jose` **or** signed cookie; still httpOnly, `SameSite=lax`, 7-day expiry |
| Rate limit | In-memory 5 attempts / 15 min | Same in `src/lib/rate-limit.js` (fine on one Hostinger process) |
| Protect pages + APIs | `src/proxy.ts` | `requireAuth` middleware on `/` and `/api/*` except `/login` and `/api/cron` |

**Env vars (set in hPanel, not in git):**

- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `SESSION_SECRET` (32+ characters)
- `CRON_SECRET`

### 3.3 Scrape API + scheduler

**Language:** JavaScript. Outbound HTTP stays `fetch()` (built into Node 22).

| Endpoint | Current | New | When it scrapes |
|---|---|---|---|
| `POST /api/scrape` | `src/app/api/scrape/route.ts` | `src/routes/scrape.js` | User clicked Scrape / Scrape all |
| `POST /api/competitors` | create + baseline `after()` | `src/routes/competitors.js` | One baseline scrape after add |
| `GET /api/competitors` | list + settings | same, **read only** | never |
| `GET /api/products` | products + runs | same, **read only** | never |
| `PATCH /api/settings` | daily cron toggle | `src/routes/settings.js` | never (only saves the flag) |
| `GET /api/cron` | Vercel Cron | same path, Hostinger Cron hits it | only if toggle is ON |
| `POST /api/tick` | optional due scrapes | keep or drop | not called by the UI |

**Ported libraries (logic stays, file type changes `.ts` → `.js`):**

- `src/lib/sitemap.js` — fetch sitemap XML, follow indexes, max 12 files
- `src/lib/scrape.js` — baseline vs new URLs, write scrape runs
- `src/lib/scheduler.js` — due scrapes + daily job (skips if toggle off; skips stores scraped in last 12 hours)
- `src/lib/db.js` — JSON store
- Intervals remain **5 / 8 / 12 / 16 / 18 / 20 hours**

The dashboard will **not** poll and will **not** scrape on page load (same as now).

### 3.4 Daily 9am schedule (critical Hostinger difference)

Hostinger **stops idle Node processes**. An in-process `node-cron` timer **dies when the app sleeps**, so 9:00 AM can be missed.

**Plan:** keep `GET /api/cron` and add an **hPanel Cron Job** (Custom, UTC):

```text
0 4 * * *   curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-DOMAIN/api/cron
```

`0 4 * * *` UTC = **09:00 Asia/Karachi**.  
If Settings toggle is OFF, the endpoint returns `{ skipped: true }` and scrapes nothing.

Manual scrape is unchanged either way.

### 3.5 Storage

On Vercel, serverless disk is ephemeral, so the app uses Redis or Blob.

On Hostinger the process has disk:

- Default: `data/store.json` (same shape: competitors, products, scrapeRuns, settings)
- Create `data/` on first write
- No Redis/Blob required unless you later want shared storage

---

## 4. Proposed folder layout (after rewrite)

```text
server.js                 ← Hostinger entry file (app.listen(process.env.PORT))
package.json              ← "start": "node server.js"
src/
  app.js                  ← Express app: middleware + routes
  middleware/auth.js      ← cookie session gate
  routes/pages.js         ← GET /  GET /login
  routes/auth.js          ← POST /login  POST /logout
  routes/competitors.js
  routes/products.js
  routes/scrape.js
  routes/settings.js
  routes/cron.js
  lib/db.js
  lib/scrape.js
  lib/sitemap.js
  lib/scheduler.js
  lib/credentials.js
  lib/session.js
  lib/types.js            ← interval helpers (plain JS)
views/
  layout.ejs
  login.ejs
  dashboard.ejs
public/
  styles.css              ← current globals.css
  dashboard.js            ← UI behaviour (nav, fetch, toggle)
data/
  store.json              ← created at runtime, gitignored
```

**Removed after rewrite:** `src/app/`, `src/proxy.ts`, `next.config.ts`, React components, `vercel.json` crons.

---

## 5. Hostinger hPanel settings (when we deploy)

| Setting | Value |
|---|---|
| Framework | Express |
| Node.js version | 22 |
| Build command | *(leave empty — no build)* |
| Output directory | *(leave empty)* |
| Entry file | `server.js` |
| Package manager | npm |

Environment variables in hPanel: `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, `NODE_ENV=production`.

---

## 6. What stays the same for you as a user

- Login with username/password
- Dashboard, competitors, product cards, scrape runs, settings
- Add store → baseline scrape
- Scrape / Scrape all buttons
- Interval dropdown 5h–20h
- Daily 9am toggle in Settings
- Same visual layout (CSS reused)

## 7. What must change under the hood

- Next.js / React / TypeScript / Vercel functions → **Express + JS + HTML**
- Vercel Cron → **Hostinger Cron hitting `/api/cron`**
- Redis/Blob → **`data/store.json`**
- `after()` background scrape on Vercel → `setImmediate` / await in the same Node process

---

## 8. Implementation order (only after you approve)

1. Scaffold `server.js` + Express + `package.json` start script; listen on `PORT`.
2. Port `lib/*` (db, sitemap, scrape, scheduler, auth helpers) from TypeScript to JavaScript.
3. Port API routes; keep URLs so the UI can stay familiar.
4. Rebuild login + dashboard as EJS + `public/dashboard.js` + existing CSS.
5. Wire Hostinger cron instructions and the Settings toggle.
6. Run locally at `http://localhost:3000`, then deploy from GitHub in hPanel.

**Estimated size:** a full rewrite of the UI layer + a mechanical port of the backend. Business rules (what gets scraped, when, intervals, toggle) stay as they are now.

---

## 9. Decision needed from you

Reply with one of:

1. **Approve this Express + JavaScript plan** — I will start the rewrite (no Next.js).
2. **Keep Next.js** — Hostinger also supports Next.js; smaller change, still Node, but not a “plain Node” app.
3. **Change something** — e.g. TypeScript+Express, or SQLite instead of JSON.

No application code will be converted until you choose.
