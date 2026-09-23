(() => {
  const state = {
    nav: "dashboard",
    competitors: [],
    products: [],
    productCounts: {
      active: 0,
      needs_upload: 0,
      recycle: 0,
      total: 0,
    },
    activityMetric: "scrapes",
    runs: [],
    settings: {
      dailyCronEnabled: true,
      brandName: "Permanent SEO",
      brandTagline: "Competitor intel",
      accentColor: "#2B59FF",
      pricingOfferEndsAt: null,
      subscriptionPlan: "basic",
      manualScrapePeriod: null,
      manualScrapeUsed: 0,
    },
    planUsage: null,
    profiles: [],
    user: {
      id: null,
      username: null,
      displayName: null,
      role: "user",
      avatarEmoji: "👔",
      avatarImage: "",
    },
    avatarEmojis: [
      "👔",
      "💼",
      "👤",
      "📊",
      "📈",
      "📉",
      "🎯",
      "🔍",
      "📝",
      "📋",
      "📁",
      "📌",
      "🏢",
      "🧠",
      "🔬",
      "💻",
      "⚙️",
      "🔑",
      "⭐",
    ],
    savingAvatar: false,
    savingCustomization: false,
    savingProfile: false,
    invitingUser: false,
    generatingInvite: false,
    inviteError: "",
    lastInviteUrl: "",
    invites: [],
    revenue: null,
    billingCycle: "monthly",
    basicTierId: "basic-8h",
    pricingPlans: null,
    featureSections: null,
    planIncludes: null,
    trustBadges: null,
    pricingFaqs: null,
    yearlyDiscount: 0.1,
    pricingTimerId: null,
    showTimerEditor: false,
    choosingPlan: false,
    helpOption: "ticket",
    competitorRange: "7d",
    filterCompetitorId: "all",
    productView: "active",
    loading: true,
    saving: false,
    scraping: false,
    savingSchedule: false,
    error: null,
    bannerSnoozed: false,
    nagNavCount: 0,
    showAddForm: false,
    form: { name: "", sitemapUrl: "", intervalHours: 5 },
  };

  const titles = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Welcome back! Here's your competitor monitoring overview.",
    },
    competitors: {
      title: "Competitors",
      subtitle: "Add stores, set intervals, and scrape sitemaps.",
    },
    products: {
      title: "New Products",
      subtitle: "Review new finds, flag uploads, or move items to the recycle bin.",
    },
    runs: {
      title: "Scrape Runs",
      subtitle: "Recent scrape activity across all competitors.",
    },
    settings: {
      title: "Settings",
      subtitle: "Login profiles, invites, customization, and daily scrape schedule.",
    },
    revenue: {
      title: "Monthly revenue",
      subtitle: "Numbers-only snapshot of users, plan revenue, and usage for this month.",
    },
    pricing: {
      title: "Plans & pricing",
      subtitle: "Compare plans, switch billing term, and upgrade when you outgrow Basic.",
    },
    help: {
      title: "Help Centre",
      subtitle: "Open a ticket, chat on WhatsApp, or email the support team.",
    },
  };

  const HELP_WHATSAPP = "+44 7400 736827";
  const HELP_WHATSAPP_LINK = "https://wa.me/447400736827";
  const HELP_EMAIL = "admin@permanentseo.com";
  const DEFAULT_FEATURE_SECTIONS = [
    {
      title: "Monitor with:",
      rows: [
        { id: "competitors", label: "Competitor stores", basic: "2", essential: "4", advance: "Unlimited" },
        { id: "scrapeNow", label: "Scrape now / month", basic: "4", essential: "8", advance: "12" },
        { id: "intervals", label: "Scrape interval options", basic: "3", essential: "3", advance: "All" },
        { id: "manual", label: "Manual scrape anytime", basic: true, essential: true, advance: true },
        { id: "cards", label: "New product cards", basic: true, essential: true, advance: true },
      ],
    },
    {
      title: "Operate & grow:",
      rows: [
        { id: "upload", label: "Upload queue + 10-day recycle", basic: false, essential: true, advance: true },
        { id: "daily", label: "Daily 8am scrape schedule", basic: false, essential: true, advance: true },
        { id: "profiles", label: "Login profiles & roles", basic: false, essential: false, advance: true },
        { id: "seats", label: "Team seats (invite users)", basic: "2", essential: "5", advance: "Unlimited" },
        { id: "priority", label: "Priority scrape runs", basic: false, essential: false, advance: true },
        { id: "admin", label: "Pricing offer timer controls", basic: false, essential: false, advance: true },
        { id: "revenue", label: "Monthly revenue dashboard", basic: false, essential: false, advance: "Super Admin" },
      ],
    },
  ];

  const FALLBACK_PLAN_LIMITS = {
    basic: { competitors: 2, scrapeNow: 4, seats: 2 },
    essential: { competitors: 4, scrapeNow: 8, seats: 5 },
    advance: { competitors: null, scrapeNow: 12, seats: null },
  };

  const root = document.getElementById("view-root");
  const titleEl = document.getElementById("page-title");
  const subtitleEl = document.getElementById("page-subtitle");
  const errorEl = document.getElementById("global-error");
  const bannerRoot = document.getElementById("pricing-banner-root");
  const upgradeNagRoot = document.getElementById("upgrade-nag-root");
  const upgradeToast = document.getElementById("upgrade-toast");
  const cfg = window.__CM__ || { pricingBanner: { enabled: false }, intervalOptions: [5, 8, 12, 16, 18, 20] };
  const UPGRADE_SNOOZE_KEY = cfg.pricingBanner?.storageKey || "cm-upgrade-snooze-until";
  const UPGRADE_SNOOZE_MS = Number(cfg.pricingBanner?.snoozeMs) || 45 * 60 * 1000;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhen(iso) {
    if (!iso) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  }

  function hostFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function faviconUrl(url) {
    const host = hostFromUrl(url);
    if (!host || host === url) return "";
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  }

  function previewImageUrl(url) {
    return `https://image.thum.io/get/width/640/crop/400/noanimate/${url}`;
  }

  function productCardHtml(p, view) {
    const favicon = faviconUrl(p.url);
    const preview = previewImageUrl(p.url);
    const timeLabel = formatWhen(p.firstSeenAt);
    const actions =
      view === "recycle"
        ? `
          <button type="button" class="btn primary" data-action="restore">Restore</button>
          <span class="recycle-meta">${escapeHtml(String(p.recycleDaysLeft ?? 0))} day(s) left</span>
        `
        : `
          <button type="button" class="btn primary" data-action="needs_upload">Upload</button>
          <button type="button" class="btn scrape-all" data-action="delete" title="Mark as deleted">
            <span class="btn-label-full">Mark as deleted</span>
            <span class="btn-label-short">Delete</span>
          </button>
        `;

    return `
      <article class="product-card" data-id="${escapeHtml(p.id)}">
        <div class="product-card-head">
          <span class="product-favicon-wrap" aria-hidden>
            ${
              favicon
                ? `<img class="product-favicon" src="${escapeHtml(favicon)}" alt="" width="20" height="20" loading="lazy" />`
                : `<span class="product-favicon-fallback"></span>`
            }
          </span>
          <div class="product-card-head-copy">
            <span class="product-store">${escapeHtml(p.competitorName || hostFromUrl(p.url))}</span>
            <time class="product-time" datetime="${escapeHtml(p.firstSeenAt || "")}">${escapeHtml(timeLabel)}</time>
          </div>
        </div>
        <a class="product-image-link" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer" aria-label="Open ${escapeHtml(p.title)}">
          <img
            class="product-image"
            src="${escapeHtml(preview)}"
            alt=""
            loading="lazy"
            data-fallback="1"
          />
        </a>
        <h3 class="product-title">${escapeHtml(p.title)}</h3>
        <div class="card-actions">
          ${actions}
        </div>
      </article>
    `;
  }

  async function apiFetch(url, init) {
    const res = await fetch(url, init);
    if (res.status === 401) {
      window.location.assign("/login");
      throw new Error("Unauthorized");
    }
    return res;
  }

  async function readJson(res) {
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(
        res.ok
          ? "Empty response from server"
          : `Request failed (${res.status}) with empty body`,
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Invalid JSON from server"
          : text.slice(0, 180) || `Request failed (${res.status})`,
      );
    }
  }

  function setError(message) {
    state.error = message;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function emptyState(title, body) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8" />
            <path d="M4 10h16" stroke="currentColor" stroke-width="1.8" />
          </svg>
        </div>
        <p class="empty-state-title">${escapeHtml(title)}</p>
        <p class="empty">${escapeHtml(body)}</p>
      </div>
    `;
  }

  function competitorRangeMs(range) {
    if (range === "1m") return 30 * 24 * 60 * 60 * 1000;
    if (range === "3m") return 90 * 24 * 60 * 60 * 1000;
    return 7 * 24 * 60 * 60 * 1000;
  }

  function competitorsInRange() {
    const windowMs = competitorRangeMs(state.competitorRange || "7d");
    const cutoff = Date.now() - windowMs;
    return state.competitors.filter((c) => {
      const stamp = Date.parse(c.lastScrapedAt || c.createdAt || "");
      if (!Number.isFinite(stamp)) return true;
      return stamp >= cutoff;
    });
  }

  function competitorRangeSelectHtml() {
    const current = state.competitorRange || "7d";
    const options = [
      { id: "7d", label: "7 days" },
      { id: "1m", label: "1 month" },
      { id: "3m", label: "3 months" },
    ];
    return `
      <label class="range-filter">
        <span>Range</span>
        <select id="competitor-range" aria-label="Competitor activity range">
          ${options
            .map(
              (o) =>
                `<option value="${o.id}" ${o.id === current ? "selected" : ""}>${o.label}</option>`,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  function intervalOptionsHtml(selected) {
    return (cfg.intervalOptions || [5, 8, 12, 16, 18, 20])
      .map(
        (h) =>
          `<option value="${h}" ${Number(selected) === h ? "selected" : ""}>Every ${h} hours</option>`,
      )
      .join("");
  }

  function competitorListHtml() {
    const list = competitorsInRange();
    if (state.loading) {
      return `<div class="skeleton-stack" aria-hidden><div class="skeleton-row"></div><div class="skeleton-row"></div></div>`;
    }
    if (!state.competitors.length) {
      return emptyState(
        "No competitors yet",
        "Add a store URL to start monitoring sitemaps and new product launches.",
      );
    }
    if (!list.length) {
      return emptyState(
        "No activity in this range",
        "Try a wider window, or scrape a competitor to refresh activity.",
      );
    }
    return `
      <div class="competitor-list">
        ${list
          .map((c) => {
            const initial = (c.name.trim().charAt(0) || "C").toUpperCase();
            const sampleProducts = state.products
              .filter((p) => p.competitorId === c.id && !p.deletedAt)
              .slice(0, 3);
            const sampleHtml = sampleProducts.length
              ? `
                <div class="competitor-sample-products">
                  ${sampleProducts
                    .map(
                      (p) => `
                    <a class="competitor-sample-chip" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">
                      ${escapeHtml(p.title)}
                    </a>
                  `,
                    )
                    .join("")}
                </div>
              `
              : `<p class="muted competitor-sample-empty">No sample products yet for this store.</p>`;
            return `
              <article class="competitor-banner" data-id="${escapeHtml(c.id)}">
                <div class="competitor-banner-main">
                  <div class="competitor-banner-left">
                    <span class="competitor-avatar" aria-hidden>${escapeHtml(initial)}</span>
                    <div class="competitor-copy">
                      <div class="competitor-title-row">
                        <strong>${escapeHtml(c.name)}</strong>
                        <span class="status-pill">ACTIVE</span>
                      </div>
                      <p class="url-line">${escapeHtml(hostFromUrl(c.sitemapUrl))}</p>
                      <p class="muted competitor-meta">Created ${escapeHtml(formatWhen(c.createdAt))} · Next ${escapeHtml(formatWhen(c.nextScrapeAt))}</p>
                    </div>
                  </div>
                  ${sampleHtml}
                </div>
                <div class="competitor-actions">
                  <select data-action="interval" aria-label="Interval for ${escapeHtml(c.name)}">
                    ${intervalOptionsHtml(c.intervalHours)}
                  </select>
                  <button type="button" class="btn ghost" data-action="scrape" ${
                    state.scraping || !canScrapeNow() ? "disabled" : ""
                  } title="${
                    canScrapeNow()
                      ? escapeHtml(scrapeQuotaLabel())
                      : "Scrape now limit reached — upgrade for more"
                  }">Scrape</button>
                  <button type="button" class="btn danger-outline" data-action="delete">Remove</button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function productFeedHtml() {
    const options = [
      `<option value="all">All competitors</option>`,
      ...state.competitors.map(
        (c) =>
          `<option value="${escapeHtml(c.id)}" ${
            state.filterCompetitorId === c.id ? "selected" : ""
          }>${escapeHtml(c.name)}</option>`,
      ),
    ].join("");

    const view = state.productView || "active";
    const emptyCopy = {
      active: [
        "No new products yet",
        "After the first baseline scrape, newly appearing sitemap URLs will show up here.",
      ],
      needs_upload: [
        "Nothing flagged for upload",
        "Use Upload on a product card to move it here.",
      ],
      recycle: [
        "Recycle bin is empty",
        "Deleted products stay here for 10 days, then are permanently removed.",
      ],
    };

    let body = "";
    if (state.loading) {
      body = `<div class="card-grid" aria-hidden>
        <div class="product-card skeleton-card">
          <div class="skeleton skeleton-chip"></div>
          <div class="skeleton product-image-skeleton"></div>
          <div class="skeleton skeleton-title"></div>
        </div>
        <div class="product-card skeleton-card">
          <div class="skeleton skeleton-chip"></div>
          <div class="skeleton product-image-skeleton"></div>
          <div class="skeleton skeleton-title"></div>
        </div>
      </div>`;
    } else if (!state.products.length) {
      body = emptyState(emptyCopy[view][0], emptyCopy[view][1]);
    } else {
      body = `
        <div class="card-grid">
          ${state.products.map((p) => productCardHtml(p, view)).join("")}
        </div>
      `;
    }

    const lastActivity = state.competitors
      .map((c) => c.lastScrapedAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    return `
      <div class="panel-head">
        <div>
          <h2 class="section-title">New product cards</h2>
          <p class="panel-sub">Last scrape ${escapeHtml(formatWhen(lastActivity || null))}</p>
        </div>
        <div class="feed-controls">
          <select id="filter-competitor">${options}</select>
        </div>
      </div>
      <div class="product-view-tabs" role="tablist" aria-label="Product lists">
        <button type="button" class="product-view-tab ${view === "active" ? "active" : ""}" data-product-view="active">Active (${productCount("active")})</button>
        <button type="button" class="product-view-tab ${view === "needs_upload" ? "active" : ""}" data-product-view="needs_upload">Need to upload (${productCount("needs_upload")})</button>
        <button type="button" class="product-view-tab ${view === "recycle" ? "active" : ""}" data-product-view="recycle">Recycle bin (${productCount("recycle")})</button>
      </div>
      ${body}
    `;
  }

  function stats() {
    const active = state.competitors.filter((c) => c.enabled).length;
    const successRuns = state.runs.filter(
      (r) => r.status === "success" || r.status === "baseline",
    ).length;
    const errorRuns = state.runs.filter((r) => r.status === "error").length;
    const urlsFoundTotal = state.runs.reduce((s, r) => s + r.urlsFound, 0);
    const newCountTotal = state.runs.reduce((s, r) => s + r.newCount, 0);
    const successRate =
      state.runs.length === 0
        ? 0
        : Math.round((successRuns / state.runs.length) * 1000) / 10;
    return {
      active,
      successRuns,
      errorRuns,
      urlsFoundTotal,
      newCountTotal,
      successRate,
    };
  }

  function sparklinePath(values, width = 120, height = 36, padX = 0, padY = 2) {
    if (!values.length) return "";
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, 1);
    const innerW = Math.max(width - padX * 2, 1);
    const innerH = Math.max(height - padY * 2, 1);
    return values
      .map((v, i) => {
        const x = padX + (i / Math.max(values.length - 1, 1)) * innerW;
        const y = padY + innerH - ((v - min) / span) * innerH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function formatChartAxisTime(iso) {
    if (!iso) return "--:--";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function niceAxisMax(max) {
    if (max <= 10) return 10;
    if (max <= 50) return Math.ceil(max / 10) * 10;
    if (max <= 100) return Math.ceil(max / 25) * 25;
    if (max <= 250) return Math.ceil(max / 50) * 50;
    if (max <= 1000) return Math.ceil(max / 250) * 250;
    return Math.ceil(max / 500) * 500;
  }

  function formatAxisTick(n) {
    if (n >= 1000) {
      const k = n / 1000;
      return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
    }
    return String(n);
  }

  function activitySeries() {
    const metric = state.activityMetric || "scrapes";
    const runs = state.runs.slice(0, 12).reverse();
    if (!runs.length) {
      return {
        points: [2, 5, 4, 8, 6, 10, 7, 12, 9, 11, 8, 14],
        times: ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"],
        tooltips: [],
        demo: true,
      };
    }
    const points = runs.map((r) => {
      if (metric === "new") return Number(r.newCount || 0);
      if (metric === "urls") return Number(r.urlsFound || 0);
      return (
        Number(r.newCount || 0) +
        Math.max(1, Math.round((r.urlsFound || 0) / 80))
      );
    });
    const times = runs.map((r) => formatChartAxisTime(r.finishedAt || r.createdAt));
    const tooltips = runs.map((r, i) => ({
      value: points[i],
      time: times[i],
      newCount: Number(r.newCount || 0),
      urlsFound: Number(r.urlsFound || 0),
    }));
    return { points, times, tooltips, demo: false };
  }

  function areaChartSvg() {
    const series = activitySeries();
    const vals = series.points;
    const width = 640;
    const height = 260;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 36;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const maxVal = niceAxisMax(Math.max(...vals, 1));
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxVal * t));
    const line = vals
      .map((v, i) => {
        const x = padL + (i / Math.max(vals.length - 1, 1)) * plotW;
        const y = padT + plotH - (v / maxVal) * plotH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    const area = `${line} L${(padL + plotW).toFixed(1)} ${(padT + plotH).toFixed(1)} L${padL} ${(padT + plotH).toFixed(1)} Z`;
    const grid = yTicks
      .map((tick) => {
        const y = padT + plotH - (tick / maxVal) * plotH;
        return `
          <line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" stroke="#E8ECF1" stroke-width="1" />
          <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#94A3B8" font-size="11">${escapeHtml(formatAxisTick(tick))}</text>
        `;
      })
      .join("");
    const xLabelIdx = Array.from(
      new Set(
        [0, Math.floor((vals.length - 1) / 3), Math.floor(((vals.length - 1) * 2) / 3), vals.length - 1].filter(
          (i) => i >= 0 && i < vals.length,
        ),
      ),
    );
    const xLabels = xLabelIdx
      .map((i) => {
        const x = padL + (i / Math.max(vals.length - 1, 1)) * plotW;
        return `<text x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle" fill="#94A3B8" font-size="11">${escapeHtml(series.times[i] || "")}</text>`;
      })
      .join("");
    const hitPoints = vals
      .map((v, i) => {
        const x = padL + (i / Math.max(vals.length - 1, 1)) * plotW;
        const y = padT + plotH - (v / maxVal) * plotH;
        const tip = series.tooltips[i];
        const label = tip
          ? `${tip.value} · ${tip.newCount} new · ${tip.urlsFound} urls · ${tip.time}`
          : `${v}`;
        return `<circle class="activity-hit" data-tip="${escapeHtml(label)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="transparent" />`;
      })
      .join("");

    return `
      <div class="activity-chart" data-activity-chart>
        <svg class="area-chart activity-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Real-time scrape activity">
          <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2B59FF" stop-opacity="0.38" />
              <stop offset="100%" stop-color="#2B59FF" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          ${grid}
          <path d="${area}" fill="url(#activityFill)" />
          <path d="${line}" fill="none" stroke="#2B59FF" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" />
          ${xLabels}
          ${hitPoints}
        </svg>
        <div class="activity-tooltip" hidden></div>
      </div>
    `;
  }

  function donutSvg(parts) {
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    const r = 54;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const rings = parts
      .map((p) => {
        const len = (p.value / total) * c;
        const dash = `${len} ${c - len}`;
        const el = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)" />`;
        offset += len;
        return el;
      })
      .join("");
    return `
      <div class="donut-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>${rings}</svg>
        <div class="donut-center">
          <strong>${total}</strong>
          <span>items</span>
        </div>
      </div>
    `;
  }

  function userInitials() {
    const name = String(
      state.user?.displayName || state.user?.username || "PS",
    ).trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "PS";
  }

  function planDisplayName(plan) {
    const key = plan || currentPlanId();
    if (key === "essential") return "Essential";
    if (key === "advance") return "Advance";
    return "Basic";
  }

  function renderDashboard() {
    const s = stats();
    const firstName = (
      state.user.displayName ||
      state.user.username ||
      "there"
    )
      .split(/\s+/)[0];
    const activeProducts = productCount("active");
    const uploadProducts = productCount("needs_upload");
    const recycleProducts = productCount("recycle");
    const donutParts = [
      {
        label: "Active new",
        value: Math.max(activeProducts, 0),
        color: "#2B59FF",
      },
      {
        label: "Need upload",
        value: Math.max(uploadProducts, 0),
        color: "#4D78FF",
      },
      {
        label: "Recycle",
        value: Math.max(recycleProducts, 0),
        color: "#152A5C",
      },
    ].filter((part) => part.value > 0);
    if (!donutParts.length) {
      donutParts.push({
        label: "No products yet",
        value: 1,
        color: "#CBD5E1",
      });
    }

    const laneSparks = [
      [3, 5, 4, 7, 6, 9, 8],
      [2, 3, 6, 5, 8, 7, 10],
      [4, 4, 5, 6, 7, 8, 9],
      [3, 4, 6, 5, 7, 8, 9],
      [2, 4, 5, 7, 6, 8, 10],
      [4, 5, 5, 6, 8, 7, 9],
    ];
    const planName = planDisplayName();
    const cUsed = state.planUsage?.competitors?.used ?? state.competitors.length;
    const cLimit = isSuperAdmin() ? null : state.planUsage?.competitors?.limit;
    const laneCount =
      cLimit == null
        ? Math.min(6, Math.max(3, state.competitors.length + 1))
        : Math.min(6, Math.max(state.competitors.length + 1, Number(cLimit) || 0));
    const canOpenSlot = canAddCompetitor();
    const lanes = Array.from({ length: Math.max(laneCount, 1) }, (_, i) => {
      const c = state.competitors[i];
      const empty = !c;
      return {
        competitorId: c?.id || "",
        empty,
        title: c?.name || (i === 0 || canOpenSlot ? (state.competitors.length === 0 && i === 0 ? "Add a store" : "Open slot") : "Locked slot"),
        meta: c
          ? `Next ${formatWhen(c.nextScrapeAt)}`
          : canOpenSlot
            ? "Click to add a competitor"
            : "Upgrade to unlock this slot",
        live: Boolean(c?.enabled),
        spark: laneSparks[i % laneSparks.length],
        stroke: ["#2B59FF", "#1A3FD9", "#60A5FA", "#3B82F6", "#2563EB", "#93C5FD"][
          i % 6
        ],
        action: empty
          ? canOpenSlot
            ? "new-competitor"
            : "pricing"
          : "competitors",
      };
    });
    const sUsed = state.planUsage?.scrapeNow?.used ?? 0;
    const sLimit =
      state.planUsage?.scrapeNow?.limit ?? planLimitsFor().scrapeNow;
    const scrapePct = sLimit
      ? Math.min(100, Math.round((sUsed / sLimit) * 100))
      : 0;
    const slotLabel =
      cLimit == null ? `${cUsed} stores · Unlimited` : `${cUsed} / ${cLimit} stores`;

    return `
      <div class="dash-layout dash-v2">
        <section class="welcome-banner welcome-banner-v2">
          <div class="welcome-copy">
            <p class="welcome-kicker">Competitor monitor</p>
            <h2>Welcome back, ${escapeHtml(firstName)}! 👋</h2>
            <p>Catch new rival products early, scrape on demand, and keep Permanent SEO ahead of every catalog shift.</p>
            <div class="welcome-actions">
              <button type="button" class="btn primary" data-dash-action="new-competitor">Add competitor</button>
              <button type="button" class="btn ghost" data-dash-action="products">Review products</button>
            </div>
          </div>
          <div class="welcome-visual" aria-hidden="true">
            <img src="/brand/icon.jpg" alt="" width="88" height="88" />
            <span class="welcome-visual-glow"></span>
          </div>
        </section>

        <section class="lane-grid" aria-label="Store lanes">
          ${lanes
            .map(
              (lane) => `
            <button
              type="button"
              class="lane-card${lane.empty ? " is-empty" : ""}${lane.action === "pricing" ? " is-locked" : ""}"
              data-dash-action="${escapeHtml(lane.action)}"
              ${lane.competitorId ? `data-competitor-id="${escapeHtml(lane.competitorId)}"` : ""}
              aria-label="${escapeHtml(lane.empty ? lane.title : `Open ${lane.title}`)}"
            >
              <div class="lane-card-top">
                <div>
                  <strong>${escapeHtml(lane.title)}</strong>
                  <p class="muted">${escapeHtml(lane.meta)}</p>
                </div>
                <span class="lane-status ${lane.live ? "is-live" : "is-idle"}">
                  ${lane.live ? "● Live" : lane.empty ? (lane.action === "pricing" ? "○ Locked" : "○ Open") : "○ Idle"}
                </span>
              </div>
              ${
                lane.empty
                  ? `
                <div class="lane-empty-placeholder" aria-hidden="true">
                  <span class="lane-add-icon">${lane.action === "pricing" ? "🔒" : "+"}</span>
                  <span class="lane-add-label">${lane.action === "pricing" ? "Upgrade to unlock" : "Add competitor to slot"}</span>
                </div>
              `
                  : `
                <svg width="140" height="40" viewBox="0 0 140 40" aria-hidden>
                  <path d="${sparklinePath(lane.spark, 140, 40)}" fill="none" stroke="${lane.stroke}" stroke-width="2.5" stroke-linecap="round" />
                </svg>
              `
              }
            </button>
          `,
            )
            .join("")}
        </section>

        <section class="analytics-strip" aria-label="Analytics overview">
          <div class="analytics-item">
            <span class="analytics-icon" aria-hidden>🏪</span>
            <div>
              <p class="analytics-label">Competitors</p>
              <strong>${state.competitors.length}</strong>
              <span class="metric-delta up">${s.active} active</span>
            </div>
          </div>
          <div class="analytics-item">
            <span class="analytics-icon" aria-hidden>🆕</span>
            <div>
              <p class="analytics-label">New products</p>
              <strong>${productCount("active")}</strong>
              <span class="metric-delta flat">${productCount("total")} live cards</span>
            </div>
          </div>
          <div class="analytics-item">
            <span class="analytics-icon" aria-hidden>✓</span>
            <div>
              <p class="analytics-label">Success rate</p>
              <strong>${s.successRate}%</strong>
              <span class="metric-delta ${s.errorRuns ? "down" : "up"}">${s.successRuns}/${state.runs.length || 0} runs</span>
            </div>
          </div>
          <div class="analytics-item">
            <span class="analytics-icon" aria-hidden>🔗</span>
            <div>
              <p class="analytics-label">URLs found</p>
              <strong>${s.urlsFoundTotal.toLocaleString()}</strong>
              <span class="metric-delta flat">${s.newCountTotal} new hits</span>
            </div>
          </div>
          <div class="analytics-item">
            <span class="analytics-icon" aria-hidden>⚠</span>
            <div>
              <p class="analytics-label">Errors</p>
              <strong>${s.errorRuns}</strong>
              <span class="metric-delta ${s.errorRuns ? "down" : "up"}">${s.errorRuns ? "Needs attention" : "All clear"}</span>
            </div>
          </div>
        </section>

        <div class="dash-main-grid">
          <div class="dash-main-left">
            <article class="chart-card chart-card-wide activity-card">
              <div class="activity-head">
                <div class="activity-title">
                  <span class="activity-live-dot" aria-hidden></span>
                  <h3>Real-time Activity</h3>
                </div>
                <div class="activity-controls">
                  <span class="activity-live-label">Live</span>
                  <label class="activity-metric">
                    <span class="visually-hidden">Metric</span>
                    <select id="activity-metric" aria-label="Activity metric">
                      <option value="scrapes" ${state.activityMetric === "scrapes" ? "selected" : ""}>Scrapes</option>
                      <option value="new" ${state.activityMetric === "new" ? "selected" : ""}>New finds</option>
                      <option value="urls" ${state.activityMetric === "urls" ? "selected" : ""}>URLs</option>
                    </select>
                  </label>
                </div>
              </div>
              ${areaChartSvg()}
            </article>
            <article class="chart-card">
              <div class="panel-head">
                <div>
                  <h3>Pipeline mix</h3>
                  <p class="panel-sub">Where products sit right now</p>
                </div>
              </div>
              <div class="pipeline-row">
                ${donutSvg(donutParts)}
                <ul class="legend-list">
                  ${donutParts
                    .map(
                      (p) => `
                    <li>
                      <span><span class="legend-swatch" style="background:${p.color}"></span>${escapeHtml(p.label)}</span>
                      <strong>${p.value}</strong>
                    </li>
                  `,
                    )
                    .join("")}
                </ul>
              </div>
            </article>
          </div>

          <aside class="dash-main-right">
            <article class="chart-card quick-panel">
              <h3>Quick actions</h3>
              <p class="panel-sub">Jump into the workflows you use most</p>
              <div class="quick-actions quick-actions-grid">
                <button type="button" class="quick-action" data-dash-action="new-competitor">
                  <span class="quick-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                  </span>
                  <strong>New competitor</strong>
                </button>
                <button type="button" class="quick-action" data-dash-action="scrape">
                  <span class="quick-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.2-5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <strong>Scrape all</strong>
                </button>
                <button type="button" class="quick-action" data-dash-action="products">
                  <span class="quick-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v12H4V7Zm2-3h12l2 3H4l2-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  </span>
                  <strong>Product inbox</strong>
                </button>
                <button type="button" class="quick-action" data-dash-action="runs">
                  <span class="quick-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5m4 14V9m4 10V7m4 12v-6m4 6V4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                  </span>
                  <strong>Scrape runs</strong>
                </button>
                <button type="button" class="quick-action" data-dash-action="settings">
                  <span class="quick-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" stroke-width="2"/><path d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.4-2.3.6a7.6 7.6 0 0 0-1.7-1L15 4h-6l-.5 2.2a7.6 7.6 0 0 0-1.7 1L4.5 6.6l-2 3.4 2 1.2a7.8 7.8 0 0 0 0 2l-2 1.2 2 3.4 2.3-.6a7.6 7.6 0 0 0 1.7 1L9 20h6l.5-2.2a7.6 7.6 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                  </span>
                  <strong>Settings</strong>
                </button>
                ${
                  isSuperAdmin()
                    ? `<button type="button" class="quick-action" data-dash-action="revenue">
                  <span class="quick-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5m4 14V9m4 10V7m4 12v-6m4 6V4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 19h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                  </span>
                  <strong>Revenue</strong>
                </button>`
                    : ""
                }
                <button type="button" class="quick-action" data-dash-action="pricing">
                  <span class="quick-ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M7 8h7.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                  </span>
                  <strong>Upgrade</strong>
                </button>
              </div>
            </article>

            <article class="plan-card">
              <div class="plan-card-head">
                <div>
                  <p class="plan-card-label">Current plan</p>
                  <h3>${escapeHtml(planName)} <span class="plan-active-pill">Active</span></h3>
                </div>
              </div>
              <p class="plan-card-meta">${escapeHtml(slotLabel)}</p>
              <p class="plan-card-meta">Scrape now ${escapeHtml(String(sUsed))} / ${escapeHtml(String(sLimit))} this month</p>
              <div class="plan-progress" role="progressbar" aria-valuenow="${scrapePct}" aria-valuemin="0" aria-valuemax="100">
                <span style="width:${scrapePct}%"></span>
              </div>
              <button type="button" class="btn plan-manage-btn" data-dash-action="pricing">Manage subscription</button>
            </article>
          </aside>
        </div>
      </div>
    `;
  }

  function renderCompetitors() {
    const slotsLeft = competitorSlotsLeft();
    const scrapeLeft = scrapeNowLeft();
    const addBlocked = !canAddCompetitor();
    const addSection = state.showAddForm
      ? `
        <section class="panel-card" id="add-competitor-panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Add competitor</h2>
              <p class="panel-sub">Baselines on first scrape · sitemap only</p>
            </div>
            <button type="button" class="btn ghost" id="btn-cancel-add">Cancel</button>
          </div>
          ${
            addBlocked
              ? `<p class="plan-limit-banner" role="status">Competitor limit reached on your plan. <button type="button" class="linkish" data-open-pricing>Upgrade</button> to add more stores.</p>`
              : `<p class="muted plan-limit-hint">${
                  Number.isFinite(slotsLeft)
                    ? `${slotsLeft} competitor slot${slotsLeft === 1 ? "" : "s"} left`
                    : "Unlimited competitor slots"
                } · ${Number.isFinite(scrapeLeft) ? `${scrapeLeft} Scrape now left this month` : "Unlimited Scrape now"}</p>`
          }
          <form class="add-form" id="add-form">
            <label>Name<input name="name" value="${escapeHtml(state.form.name)}" placeholder="Acme Store" required ${addBlocked ? "disabled" : ""} /></label>
            <label>Store or sitemap URL<input name="sitemapUrl" value="${escapeHtml(state.form.sitemapUrl)}" placeholder="https://example.com or /sitemap.xml" required ${addBlocked ? "disabled" : ""} /></label>
            <label>Interval<select name="intervalHours" ${addBlocked ? "disabled" : ""}>${intervalOptionsHtml(state.form.intervalHours)}</select></label>
            <button type="submit" class="btn primary" ${state.saving || addBlocked ? "disabled" : ""}>${
              state.saving ? "Adding…" : addBlocked ? "Limit reached" : "Add & baseline"
            }</button>
          </form>
        </section>
      `
      : "";

    return `
      <div class="stack">
        ${addSection}
        <section class="panel-card">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Monitored stores</h2>
              <p class="panel-sub">${competitorsInRange().length} of ${state.competitors.length} competitors in range</p>
            </div>
            ${competitorRangeSelectHtml()}
          </div>
          ${competitorListHtml()}
        </section>
      </div>
    `;
  }

  function renderProducts() {
    return `<section class="panel-card">${productFeedHtml()}</section>`;
  }

  function renderRuns() {
    let body = "";
    if (state.loading) {
      body = `<div class="skeleton-stack"><div class="skeleton-row"></div><div class="skeleton-row"></div></div>`;
    } else if (!state.runs.length) {
      body = emptyState(
        "No scrape runs yet",
        "Runs will appear here after the first competitor scrape.",
      );
    } else {
      body = `
        <div class="runs plain">
          <ul>
            ${state.runs
              .slice(0, 20)
              .map(
                (run) => `
              <li class="run-row">
                <span class="status status-${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
                <span>${run.newCount} new / ${run.urlsFound} urls · ${escapeHtml(formatWhen(run.startedAt))}</span>
                ${run.error ? `<span class="muted"> — ${escapeHtml(run.error)}</span>` : ""}
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `;
    }
    return `
      <section class="panel-card">
        <h2 class="section-title">Recent runs</h2>
        <p class="panel-sub">Latest scrape outcomes</p>
        ${body}
      </section>
    `;
  }

  function renderSettings() {
    const on = state.settings.dailyCronEnabled !== false;
    const brandName = state.settings.brandName || "Permanent SEO";
    const brandTagline = state.settings.brandTagline || "Competitor intel";
    const accentColor = state.settings.accentColor || "#2B59FF";
    const currentEmoji = sanitizeAvatarEmoji(
      state.user.avatarEmoji,
      state.user.role,
    );
    const emojis = state.avatarEmojis?.length
      ? state.avatarEmojis
      : [
          "👔",
          "💼",
          "👤",
          "📊",
          "📈",
          "📉",
          "🎯",
          "🔍",
          "📝",
          "📋",
          "📁",
          "📌",
          "🏢",
          "🧠",
          "🔬",
          "💻",
          "⚙️",
          "🔑",
          "⭐",
        ];

    const profiles = state.profiles.length
      ? state.profiles
          .map((p) => {
            const role = normalizeRole(p.role);
            const canManage =
              isSuperAdmin() || (isPlanAdmin() && role === "user");
            return `
          <article class="competitor-row profile-row-card" data-profile-id="${escapeHtml(p.id)}">
            <div class="profile-row-identity">
              ${
                p.avatarImage
                  ? `<span class="avatar has-image" aria-hidden><img src="${escapeHtml(p.avatarImage)}" alt="" /></span>`
                  : `<span class="avatar is-emoji" aria-hidden>${escapeHtml(sanitizeAvatarEmoji(p.avatarEmoji, p.role))}</span>`
              }
              <div>
                <strong>${escapeHtml(p.displayName || p.username)}</strong>
                <p class="muted">@${escapeHtml(p.username)} · ${escapeHtml(formatRoleLabel(p.role))} · updated ${escapeHtml(formatWhen(p.updatedAt))}</p>
              </div>
            </div>
            <div class="profile-row-actions">
              <button type="button" class="btn ghost" data-profile-action="edit" ${
                canManage ? "" : "disabled"
              }>Edit</button>
              <button type="button" class="btn danger-outline" data-profile-action="delete" ${
                !canManage || state.profiles.length <= 1 ? "disabled" : ""
              }>Remove</button>
            </div>
          </article>
        `;
          })
          .join("")
      : `<p class="muted">No login profiles yet. The default Super Admin account is created on first use.</p>`;

    if (!isPlanAdmin()) {
      return `
      <div class="stack settings-stack">
        <section class="panel-card">
          <h2 class="section-title">Your avatar</h2>
          <p class="panel-sub">Pick a professional emoji or upload a profile image for the sidebar and top bar.</p>
          <div class="avatar-settings">
            <div class="avatar-preview-wrap">
              ${avatarMarkup("avatar-preview")}
              <div>
                <strong>${escapeHtml(state.user.displayName || state.user.username || "You")}</strong>
                <p class="muted">${escapeHtml(formatRoleLabel(state.user.role))}</p>
              </div>
            </div>
            <div class="emoji-picker" role="listbox" aria-label="Avatar emoji">
              ${emojis
                .map(
                  (emo) => `
                <button
                  type="button"
                  class="emoji-option${emo === currentEmoji && !state.user.avatarImage ? " active" : ""}"
                  data-avatar-emoji="${escapeHtml(emo)}"
                  aria-label="Use ${escapeHtml(emo)} avatar"
                >${escapeHtml(emo)}</button>
              `,
                )
                .join("")}
            </div>
            <div class="avatar-upload-row">
              <label class="btn ghost avatar-upload-btn">
                Upload image
                <input id="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
              </label>
              ${
                state.user.avatarImage
                  ? `<button type="button" class="btn danger-outline" id="avatar-clear-image">Remove photo</button>`
                  : ""
              }
            </div>
            <p class="muted avatar-hint">PNG, JPG, or WebP · max about 150KB</p>
          </div>
        </section>
        <section class="panel-card">
          <h2 class="section-title">Team access</h2>
          <p class="panel-sub">Your role is <strong>${escapeHtml(formatRoleLabel(state.user.role))}</strong>. Only Admins can invite users within plan seat limits.</p>
        </section>
      </div>
    `;
    }

    return `
      <div class="stack settings-stack">
        <section class="panel-card">
          <h2 class="section-title">Your avatar</h2>
          <p class="panel-sub">Pick a professional emoji or upload a profile image for the sidebar and top bar.</p>
          <div class="avatar-settings">
            <div class="avatar-preview-wrap">
              ${avatarMarkup("avatar-preview")}
              <div>
                <strong>${escapeHtml(state.user.displayName || state.user.username || "You")}</strong>
                <p class="muted">${escapeHtml(formatRoleLabel(state.user.role))}</p>
              </div>
            </div>
            <div class="emoji-picker" role="listbox" aria-label="Avatar emoji">
              ${emojis
                .map(
                  (emo) => `
                <button
                  type="button"
                  class="emoji-option${emo === currentEmoji && !state.user.avatarImage ? " active" : ""}"
                  data-avatar-emoji="${escapeHtml(emo)}"
                  aria-label="Use ${escapeHtml(emo)} avatar"
                >${escapeHtml(emo)}</button>
              `,
                )
                .join("")}
            </div>
            <div class="avatar-upload-row">
              <label class="btn ghost avatar-upload-btn">
                Upload image
                <input id="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
              </label>
              ${
                state.user.avatarImage
                  ? `<button type="button" class="btn danger-outline" id="avatar-clear-image">Remove photo</button>`
                  : ""
              }
            </div>
            <p class="muted avatar-hint">PNG, JPG, or WebP · max about 150KB</p>
          </div>
        </section>

        <section class="panel-card">
          <h2 class="section-title">Team members</h2>
          <p class="panel-sub">
            Seats on your plan: <strong id="team-seats-usage">${escapeHtml(seatUsageLabel())}</strong>
            ${
              state.planUsage?.seats && !state.planUsage.seats.unlimited
                ? ` · pending invites count toward the limit`
                : ""
            }
          </p>
          <div class="competitor-list">${profiles}</div>
        </section>

        ${
          isSuperAdmin()
            ? `
        <section class="panel-card">
          <h2 class="section-title">Add Admin</h2>
          <p class="panel-sub">Create an Admin account directly. Admins can invite Users within plan seat limits.</p>
          <form class="add-form settings-form" id="add-admin-form">
            <label>Display name<input name="displayName" placeholder="Ops lead" /></label>
            <label>Username<input name="username" placeholder="ops-admin" required minlength="2" /></label>
            <label>Password<input name="password" type="password" placeholder="At least 6 characters" required minlength="6" /></label>
            <input type="hidden" name="role" value="admin" />
            <button type="submit" class="btn primary" ${
              state.savingProfile ? "disabled" : ""
            }>${state.savingProfile ? "Saving…" : "Add Admin"}</button>
          </form>
        </section>
        `
            : ""
        }

        <section class="panel-card" id="invite-user-section">
          <h2 class="section-title">Invite User</h2>
          <p class="panel-sub">
            Generate a shareable invite link. The recipient opens it, picks a username and password, and joins as a User.
            Links expire in 7 days and reserve one seat until used or revoked.
          </p>
          ${
            state.inviteError
              ? `
            <p class="error invite-card-error" id="invite-card-error" style="margin-bottom:var(--space-3);">
              ${escapeHtml(state.inviteError)}
            </p>
          `
              : ""
          }
          <form class="add-form settings-form invite-generate-form" id="generate-invite-form">
            <label>Optional note
              <input name="note" id="invite-note-input" placeholder="e.g. Catalog analyst — March hire" maxlength="120" />
            </label>
            <button type="submit" class="btn primary" id="generate-invite-btn" ${
              state.generatingInvite || !canInviteMoreUsers() ? "disabled" : ""
            }>
              ${
                state.generatingInvite
                  ? "Generating…"
                  : canInviteMoreUsers()
                    ? "Generate invite link"
                    : "Seat limit reached"
              }
            </button>
          </form>
          ${
            state.lastInviteUrl
              ? `
            <div class="invite-link-box" id="invite-link-box">
              <p class="invite-link-label">Latest invite link</p>
              <div class="invite-link-row">
                <input type="text" readonly value="${escapeHtml(state.lastInviteUrl)}" id="invite-link-input" />
                <button type="button" class="btn ghost" id="copy-invite-link">Copy</button>
              </div>
              <p class="muted">Share this link securely. It works once.</p>
            </div>
          `
              : ""
          }
          <div class="pending-invites">
            <h3 class="invite-list-title">Pending invites</h3>
            ${
              (state.invites || []).length
                ? state.invites
                    .map(
                      (inv) => `
              <article class="competitor-row invite-row" data-invite-id="${escapeHtml(inv.id)}">
                <div>
                  <strong>${escapeHtml(formatRoleLabel(inv.role))} invite</strong>
                  <p class="muted">
                    ${inv.note ? `${escapeHtml(inv.note)} · ` : ""}expires ${escapeHtml(formatWhen(inv.expiresAt))}
                  </p>
                  <code class="invite-token-chip">${escapeHtml(inv.token.slice(0, 8))}…</code>
                </div>
                <div class="profile-row-actions">
                  <button type="button" class="btn ghost" data-invite-action="copy">Copy link</button>
                  <button type="button" class="btn danger-outline" data-invite-action="revoke">Revoke</button>
                </div>
              </article>
            `,
                    )
                    .join("")
                : `<p class="muted">No pending invites yet.</p>`
            }
          </div>
        </section>

        <section class="panel-card">
          <h2 class="section-title">Customization</h2>
          <p class="panel-sub">Accent color used across primary actions. Sidebar title follows the signed-in role.</p>
          <form class="add-form settings-form" id="customization-form">
            <label>Workspace label<input name="brandName" value="${escapeHtml(brandName)}" required maxlength="40" /></label>
            <label>Tagline<input name="brandTagline" value="${escapeHtml(brandTagline)}" required maxlength="80" /></label>
            <label>Accent color<input name="accentColor" type="color" value="${escapeHtml(accentColor)}" /></label>
            <button type="submit" class="btn primary" ${state.savingCustomization ? "disabled" : ""}>${
              state.savingCustomization ? "Saving…" : "Save customization"
            }</button>
          </form>
        </section>

        <section class="panel-card">
          <h2 class="section-title">Schedule</h2>
          <p class="panel-sub">
            Scrapes run when you click Scrape, when a store is first added (baseline),
            and — if enabled below — once daily at 8:00 AM Pakistan time. The dashboard
            does not poll or scrape while it is open.
          </p>
          <div class="competitor-list">
            <article class="competitor-row">
              <div>
                <strong>Daily 8am scrape</strong>
                <p class="muted">08:00 Asia/Karachi via Hostinger cron hitting /api/cron (03:00 UTC). Manual scrape still works when off.</p>
              </div>
              <div class="schedule-controls">
                <span class="status-pill${on ? "" : " paused"}">${on ? "ON" : "OFF"}</span>
                <button type="button" class="switch${on ? " on" : ""}" role="switch" aria-checked="${on}" id="daily-cron-toggle" ${
                  state.savingSchedule ? "disabled" : ""
                }></button>
              </div>
            </article>
          </div>
        </section>
      </div>
    `;
  }

  function renderRevenue() {
    if (!isSuperAdmin()) {
      return `
        <section class="panel-card">
          <h2 class="section-title">Monthly revenue</h2>
          <p class="panel-sub">Super Admin access required.</p>
        </section>
      `;
    }
    const rev = state.revenue;
    if (!rev) {
      return `
        <section class="panel-card">
          <h2 class="section-title">Monthly revenue</h2>
          <p class="muted">Loading numbers…</p>
        </section>
      `;
    }
    const users = rev.users || {};
    const sub = rev.subscription || {};
    const usage = rev.usage || {};
    const cards = [
      { label: "Total users", value: users.total ?? 0 },
      { label: "Super Admins", value: users.superAdmins ?? 0 },
      { label: "Admins", value: users.admins ?? 0 },
      { label: "Users", value: users.users ?? 0 },
      { label: "Active plan", value: sub.planLabel || "—" },
      { label: "Monthly revenue (MRR)", value: sub.mrrLabel || "$0" },
      { label: "Estimated costs", value: sub.estimatedCostsLabel || "$0" },
      { label: "Estimated profit", value: sub.estimatedProfitLabel || "$0" },
      { label: "Profit margin", value: `${sub.profitMarginPct ?? 0}%` },
      { label: "ARPU", value: sub.arpuLabel || "$0" },
      { label: "Competitor stores", value: usage.competitors ?? 0 },
      { label: "Enabled stores", value: usage.enabledStores ?? 0 },
      { label: "Active products", value: usage.activeProducts ?? 0 },
      { label: "Recycled products", value: usage.recycledProducts ?? 0 },
      { label: "Scrapes this month", value: usage.scrapeRunsThisMonth ?? 0 },
      { label: "Successful scrapes", value: usage.successfulScrapes ?? 0 },
      { label: "Failed scrapes", value: usage.failedScrapes ?? 0 },
      { label: "New finds this month", value: usage.newFindsThisMonth ?? 0 },
      { label: "Manual scrapes used", value: usage.manualScrapesUsed ?? 0 },
    ];

    return `
      <div class="stack revenue-stack">
        <section class="panel-card">
          <h2 class="section-title">${escapeHtml(rev.periodLabel || "This month")}</h2>
          <p class="panel-sub">Numbers only — users, revenue, profit, and usage for ${escapeHtml(rev.period || "current period")}.</p>
          <div class="revenue-number-grid">
            ${cards
              .map(
                (card) => `
              <article class="revenue-number-card">
                <p class="revenue-number-label">${escapeHtml(card.label)}</p>
                <p class="revenue-number-value">${escapeHtml(String(card.value))}</p>
              </article>
            `,
              )
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderHelp() {
    const option = state.helpOption || "ticket";
    const channels = [
      {
        id: "ticket",
        label: "Support ticket",
        blurb: "Describe an issue and open it with the team.",
        meta: "Best for bugs & account help",
        icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 8h10M7 12h6M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4l-4 3v-3H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        blurb: "Chat with support for quicker answers.",
        meta: HELP_WHATSAPP,
        icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3.5a8.2 8.2 0 0 0-7 12.5L4 21l5.2-1.4A8.2 8.2 0 1 0 12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.2 9.4c.3-.5.6-.5.9-.5h.3c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.1-.2.3 0 .5.3.5.9 1.2 1.6 1.7.4.3.6.3.8.2l.7-.4c.2-.1.4 0 .5.1l1.5.9c.2.1.3.3.2.5-.3.7-1.2 1.2-2 1.1-1.7-.1-3.7-1.5-5-3.1-1.1-1.4-1.7-2.9-1.7-4.1 0-.7.4-1.4 1-1.6Z" fill="currentColor"/></svg>`,
      },
      {
        id: "email",
        label: "Email",
        blurb: "Send details and we’ll follow up by email.",
        meta: HELP_EMAIL,
        icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 7.5 12 13l8-5.5M5.5 6h13A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9A1.5 1.5 0 0 1 5.5 6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
      },
    ];

    const channelCards = channels
      .map(
        (c) => `
        <button
          type="button"
          class="help-channel${option === c.id ? " active" : ""}"
          data-help-option="${c.id}"
          role="tab"
          aria-selected="${option === c.id ? "true" : "false"}"
        >
          <span class="help-channel-icon">${c.icon}</span>
          <span class="help-channel-copy">
            <strong>${escapeHtml(c.label)}</strong>
            <span>${escapeHtml(c.blurb)}</span>
            <em>${escapeHtml(c.meta)}</em>
          </span>
        </button>
      `,
      )
      .join("");

    let panel = "";
    if (option === "whatsapp") {
      panel = `
        <section class="panel-card help-panel">
          <div class="help-panel-head">
            <div>
              <h2 class="section-title">WhatsApp support</h2>
              <p class="panel-sub">Message the team directly for quick help with scrapes, plans, or account access.</p>
            </div>
            <span class="help-response-pill">Typical reply · under 1 hour</span>
          </div>
          <div class="help-contact-card">
            <p class="help-contact-label">WhatsApp number</p>
            <p class="help-contact-value">${escapeHtml(HELP_WHATSAPP)}</p>
          </div>
          <div class="help-panel-actions">
            <a class="btn primary" href="${HELP_WHATSAPP_LINK}" target="_blank" rel="noopener noreferrer">
              Open WhatsApp chat
            </a>
          </div>
        </section>
      `;
    } else if (option === "email") {
      panel = `
        <section class="panel-card help-panel">
          <div class="help-panel-head">
            <div>
              <h2 class="section-title">Email support</h2>
              <p class="panel-sub">Send us the details and we will get back to you with next steps.</p>
            </div>
            <span class="help-response-pill">Typical reply · within 1 business day</span>
          </div>
          <div class="help-contact-card">
            <p class="help-contact-label">Support email</p>
            <p class="help-contact-value">${escapeHtml(HELP_EMAIL)}</p>
          </div>
          <div class="help-panel-actions">
            <a class="btn primary" href="mailto:${escapeHtml(HELP_EMAIL)}?subject=${encodeURIComponent("Competitor Monitor support")}">
              Compose email
            </a>
          </div>
        </section>
      `;
    } else {
      panel = `
        <section class="panel-card help-panel">
          <div class="help-panel-head">
            <div>
              <h2 class="section-title">Support ticket</h2>
              <p class="panel-sub">Describe the issue clearly so we can open it with the support team.</p>
            </div>
            <span class="help-response-pill">Opens in your email client</span>
          </div>
          <form class="add-form settings-form help-ticket-form" id="help-ticket-form">
            <label>Subject
              <input name="subject" required maxlength="120" placeholder="Brief summary" />
            </label>
            <label>Message
              <textarea name="message" required rows="7" maxlength="2000" placeholder="What happened, and what did you expect?"></textarea>
            </label>
            <div class="help-panel-actions">
              <button type="submit" class="btn primary">Submit ticket</button>
            </div>
          </form>
        </section>
      `;
    }

    return `
      <div class="help-centre">
        <div class="help-centre-inner">
          <header class="help-hero">
            <p class="help-kicker">Support</p>
            <h2 class="help-hero-title">How can we help?</h2>
            <p class="help-hero-sub">
              Pick a channel below — ticket, WhatsApp, or email — and we’ll get you unblocked on monitoring, scrapes, and billing.
            </p>
          </header>
          <div class="help-channel-grid" role="tablist" aria-label="Help Centre options">
            ${channelCards}
          </div>
          <div class="help-detail">
            ${panel}
          </div>
        </div>
      </div>
    `;
  }

  function normalizeRole(role) {
    const value = String(role || "")
      .trim()
      .toLowerCase();
    if (value === "owner") return "super-admin";
    if (value === "operator" || value === "seo-analystic") return "user";
    if (value === "super-admin" || value === "admin" || value === "user") {
      return value;
    }
    return "user";
  }

  function formatRoleLabel(role) {
    const map = {
      "super-admin": "Super Admin",
      admin: "Admin",
      user: "User",
    };
    return map[normalizeRole(role)] || "User";
  }

  function isSuperAdmin() {
    return normalizeRole(state.user?.role) === "super-admin";
  }

  function isPlanAdmin() {
    const role = normalizeRole(state.user?.role);
    return role === "admin" || role === "super-admin";
  }

  function isAdmin() {
    return isPlanAdmin();
  }

  function assignableRoleOptions() {
    if (isSuperAdmin()) {
      return [
        { value: "user", label: "User" },
        { value: "admin", label: "Admin" },
        { value: "super-admin", label: "Super Admin" },
      ];
    }
    if (isPlanAdmin()) {
      return [{ value: "user", label: "User" }];
    }
    return [];
  }

  function seatUsageLabel() {
    const seats = state.planUsage?.seats;
    if (!seats) {
      const limit = planLimitsFor().seats;
      const used = state.profiles.length;
      if (limit == null) return `${used} seats · Unlimited`;
      return `${used} / ${limit} seats`;
    }
    if (seats.unlimited || seats.limit == null) {
      return `${seats.used} seats · Unlimited`;
    }
    return `${seats.used} / ${seats.limit} seats`;
  }

  function canInviteMoreUsers() {
    if (isSuperAdmin()) return true;
    const seats = state.planUsage?.seats;
    if (!seats) {
      const limit = planLimitsFor().seats;
      if (limit == null) return true;
      const pendingCount = (state.invites || []).filter(
        (inv) => !inv.usedAt && Date.parse(inv.expiresAt) > Date.now(),
      ).length;
      return (state.profiles.length + pendingCount) < limit;
    }
    if (seats.unlimited || seats.limit == null) return true;
    return seats.used < seats.limit;
  }

  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "$0";
    return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
  }

  function yearlyMonthly(monthly) {
    return Math.round(monthly * (1 - state.yearlyDiscount) * 100) / 100;
  }

  function displayPrice(monthly) {
    return state.billingCycle === "yearly" ? yearlyMonthly(monthly) : monthly;
  }

  function pricePeriodLabel() {
    return state.billingCycle === "yearly" ? "/mo · billed yearly" : "/month";
  }

  function formatDatetimeLocal(isoString) {
    let d = isoString ? new Date(isoString) : null;
    if (!d || Number.isNaN(d.getTime())) {
      d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function formatCountdown(ms) {
    if (ms <= 0) return { d: "00", h: "00", m: "00", s: "00", expired: true };
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return { d: pad(d), h: pad(h), m: pad(m), s: pad(s), expired: false };
  }

  function syncPricingTimer() {
    const rootTimer = document.getElementById("pricing-timer");
    if (!rootTimer) return;
    const ends = state.settings.pricingOfferEndsAt
      ? Date.parse(state.settings.pricingOfferEndsAt)
      : NaN;
    const parts = formatCountdown(Number.isFinite(ends) ? ends - Date.now() : 0);
    rootTimer.querySelector('[data-unit="d"]').textContent = parts.d;
    rootTimer.querySelector('[data-unit="h"]').textContent = parts.h;
    rootTimer.querySelector('[data-unit="m"]').textContent = parts.m;
    rootTimer.querySelector('[data-unit="s"]').textContent = parts.s;
    rootTimer.classList.toggle("is-expired", parts.expired);
    const label = document.getElementById("pricing-timer-label");
    if (label) {
      label.textContent = parts.expired
        ? "Launch offer ended"
        : "Launch offer ends in";
    }
  }

  function startPricingTimer() {
    if (state.pricingTimerId) {
      clearInterval(state.pricingTimerId);
      state.pricingTimerId = null;
    }
    if (state.nav !== "pricing") return;
    syncPricingTimer();
    state.pricingTimerId = setInterval(syncPricingTimer, 1000);
  }

  function isBasicPlan() {
    return (state.settings.subscriptionPlan || "basic") === "basic";
  }

  function currentPlanId() {
    return state.settings.subscriptionPlan || "basic";
  }

  function planLimitsFor(plan) {
    const key = plan || currentPlanId();
    return FALLBACK_PLAN_LIMITS[key] || FALLBACK_PLAN_LIMITS.basic;
  }

  function applyPlanUsage(usage) {
    if (!usage || typeof usage !== "object") return;
    state.planUsage = usage;
  }

  function competitorSlotsLeft() {
    if (isSuperAdmin()) return Infinity;
    const usage = state.planUsage?.competitors;
    if (usage) {
      if (usage.unlimited) return Infinity;
      return Number(usage.remaining ?? 0);
    }
    const limit = planLimitsFor().competitors;
    if (limit == null) return Infinity;
    return Math.max(0, limit - state.competitors.length);
  }

  function canAddCompetitor() {
    if (isSuperAdmin()) return true;
    return competitorSlotsLeft() > 0;
  }

  function scrapeNowLeft() {
    if (isSuperAdmin()) return Infinity;
    const usage = state.planUsage?.scrapeNow;
    if (usage) return Number(usage.remaining ?? 0);
    const limit = planLimitsFor().scrapeNow;
    const used = Number(state.settings.manualScrapeUsed || 0);
    return Math.max(0, limit - used);
  }

  function canScrapeNow() {
    if (isSuperAdmin()) return true;
    return scrapeNowLeft() > 0;
  }

  function enabledCompetitors() {
    return state.competitors.filter((c) => c.enabled);
  }

  function enabledCompetitorCount() {
    return enabledCompetitors().length;
  }

  function productCount(view) {
    const counts = state.productCounts || {};
    if (view === "needs_upload") return Number(counts.needs_upload || 0);
    if (view === "recycle") return Number(counts.recycle || 0);
    if (view === "total") return Number(counts.total || 0);
    return Number(counts.active || 0);
  }

  function scrapeQuotaLabel() {
    const left = scrapeNowLeft();
    return left === 1
      ? "1 scrape run left this month"
      : `${left} scrape runs left this month`;
  }

  function scrapeAllButtonLabel() {
    if (state.scraping) return "Scraping…";
    if (!canScrapeNow()) return "Scrape limit reached";
    const stores = enabledCompetitorCount();
    if (!stores) return "Scrape All Now";
    return stores === 1
      ? "Scrape All Now (1 store)"
      : `Scrape All Now (${stores} stores)`;
  }

  function scrapeAllButtonTitle() {
    const stores = enabledCompetitorCount();
    if (!canScrapeNow()) {
      return "Monthly Scrape now limit reached — upgrade for more";
    }
    if (!stores) return "Add an enabled store to scrape";
    const storeLabel = stores === 1 ? "1 store" : `${stores} stores`;
    return `Scrapes ${storeLabel} · ${scrapeQuotaLabel()}`;
  }

  function promptPlanUpgrade(message) {
    setError(message);
    showUpgradeToast(message);
  }

  function isUpgradeSnoozed() {
    try {
      const until = Number(localStorage.getItem(UPGRADE_SNOOZE_KEY) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }

  function snoozeUpgradeReminders() {
    try {
      localStorage.setItem(UPGRADE_SNOOZE_KEY, String(Date.now() + UPGRADE_SNOOZE_MS));
    } catch {
      /* ignore */
    }
    state.bannerSnoozed = true;
  }

  function clearUpgradeSnooze() {
    try {
      localStorage.removeItem(UPGRADE_SNOOZE_KEY);
    } catch {
      /* ignore */
    }
    state.bannerSnoozed = false;
  }

  function goToPricing() {
    state.nav = "pricing";
    render();
    scrollPageToTop();
    void loadPricing().then(() => render());
  }

  function scrollPageToTop() {
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? "auto" : "smooth" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelector(".workspace")?.scrollTo?.({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    document.querySelector(".main-pane")?.scrollTo?.({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  function showUpgradeToast(message) {
    if (!upgradeToast) return;
    upgradeToast.hidden = false;
    upgradeToast.innerHTML = `
      <div class="upgrade-toast-inner">
        <p>${escapeHtml(message)}</p>
        <button type="button" class="btn primary" id="toast-upgrade-cta">View plans</button>
        <button type="button" class="upgrade-toast-dismiss" id="toast-upgrade-dismiss" aria-label="Dismiss">×</button>
      </div>
    `;
    document.getElementById("toast-upgrade-cta")?.addEventListener("click", () => {
      upgradeToast.hidden = true;
      goToPricing();
    });
    document.getElementById("toast-upgrade-dismiss")?.addEventListener("click", () => {
      upgradeToast.hidden = true;
      snoozeUpgradeReminders();
      renderUpgradeNag();
    });
  }

  function maybeNagOnNav() {
    if (!isBasicPlan()) {
      if (upgradeToast) upgradeToast.hidden = true;
      return;
    }
    state.nagNavCount += 1;
    if (state.nagNavCount % 4 === 0 && !isUpgradeSnoozed()) {
      showUpgradeToast(
        "Still on Basic? Essential unlocks 4 stores and 8 Scrape now runs per month.",
      );
    }
  }

  function discountPercent(list, sale) {
    if (!list || list <= sale) return 0;
    return Math.round(((list - sale) / list) * 100);
  }

  function planSalePrice(monthly) {
    return displayPrice(monthly);
  }

  function planListPrice(listMonthly, monthly) {
    return Number(listMonthly || monthly);
  }

  function featureCell(value) {
    if (value === true) {
      return `<span class="pricing-check" aria-label="Included">✓</span>`;
    }
    if (value === false || value == null) {
      return `<span class="pricing-dash" aria-label="Not included">–</span>`;
    }
    return `<strong class="pricing-feature-value">${escapeHtml(String(value))}</strong>`;
  }

  function renderFeatureSections(planId) {
    const sections = state.featureSections?.length
      ? state.featureSections
      : DEFAULT_FEATURE_SECTIONS;
    return sections
      .map((section) => {
        const rows = (section.rows || [])
          .map((row) => {
            const value = row[planId];
            const detail =
              typeof value === "string" || typeof value === "number"
                ? ` <strong>${escapeHtml(String(value))}</strong>`
                : "";
            return `
              <li>
                ${featureCell(typeof value === "boolean" ? value : true)}
                <span>${escapeHtml(row.label)}${typeof value === "boolean" ? "" : detail}</span>
              </li>
            `;
          })
          .join("");
        return `
          <div class="pricing-feature-block">
            <p class="pricing-feature-heading">${escapeHtml(section.title)}</p>
            <ul class="pricing-features">${rows}</ul>
          </div>
        `;
      })
      .join("");
  }

  function renderPricingCard(plan) {
    const basic = plan.id === "basic";
    const current = (state.settings.subscriptionPlan || "basic") === plan.id;
    const selectedTier = basic
      ? plan.tiers?.find((t) => t.id === state.basicTierId) || plan.tiers?.[0]
      : null;
    const monthly = basic ? selectedTier?.monthly ?? 6 : plan.monthly;
    const listMonthly = basic
      ? selectedTier?.listMonthly ?? monthly
      : plan.listMonthly ?? monthly;
    const list = planListPrice(listMonthly, monthly);
    const yearlySale = yearlyMonthly(monthly);
    const showStrike =
      state.billingCycle === "yearly" ? list > yearlySale : list > monthly;
    const shownSale = state.billingCycle === "yearly" ? yearlySale : monthly;
    const shownList = list;
    const badgeOff =
      state.billingCycle === "yearly"
        ? Math.max(
            discountPercent(list, yearlySale),
            Math.round(state.yearlyDiscount * 100),
          )
        : discountPercent(list, monthly);

    const renewNote =
      state.billingCycle === "yearly"
        ? `Get 12 months for <strong>${money(yearlySale * 12)}</strong> (regular ${money(list * 12)}). Renews at ${money(monthly)}/mo.`
        : `Billed monthly. Renews at ${money(monthly)}/mo. Cancel anytime.`;

    const tierSlider = basic
      ? `
        <div class="pricing-customize">
          <p class="pricing-customize-label">Customize scrape interval</p>
          <input
            type="range"
            class="pricing-tier-range"
            id="basic-tier-range"
            min="0"
            max="${(plan.tiers || []).length - 1}"
            step="1"
            value="${Math.max(
              0,
              (plan.tiers || []).findIndex((t) => t.id === (selectedTier?.id || state.basicTierId)),
            )}"
            aria-label="Basic scrape interval"
          />
          <div class="pricing-tier-labels">
            ${(plan.tiers || [])
              .map(
                (t) => `
              <button type="button" class="pricing-tier-label${
                t.id === (selectedTier?.id || state.basicTierId) ? " active" : ""
              }" data-basic-tier="${escapeHtml(t.id)}">${t.intervalHours}h</button>
            `,
              )
              .join("")}
          </div>
        </div>
      `
      : "";

    const featured = plan.highlight;
    const badge = featured
      ? `<span class="pricing-special-badge">Special offer${
          badgeOff ? ` · ${badgeOff}% off` : ""
        }</span>`
      : badgeOff
        ? `<span class="pricing-off-badge">${badgeOff}% off</span>`
        : "";

    const ctaLabel = current
      ? "Current plan"
      : plan.id === "basic"
        ? "Choose plan"
        : "Upgrade";

    return `
      <article class="pricing-card${featured ? " is-featured" : ""}${
        current ? " is-current" : ""
      }">
        ${badge}
        <div class="pricing-card-top">
          <h3 class="pricing-plan-name">${escapeHtml(plan.name)}</h3>
          <p class="pricing-plan-blurb">${escapeHtml(plan.blurb)}</p>
          <p class="pricing-plan-limits muted">
            ${
              plan.competitors == null
                ? "Unlimited competitors"
                : `${escapeHtml(String(plan.competitors))} competitors`
            }
            · ${escapeHtml(String(plan.scrapeNow ?? planLimitsFor(plan.id).scrapeNow))} Scrape now / mo
          </p>
          <div class="pricing-price-block">
            ${
              showStrike
                ? `<p class="pricing-was">${money(shownList)}</p>`
                : ""
            }
            <p class="pricing-amount">
              <span>${money(shownSale)}</span><small>/mo</small>
            </p>
          </div>
          <button
            type="button"
            class="btn pricing-cta${featured ? " primary" : " pricing-cta-outline"}"
            data-choose-plan="${escapeHtml(plan.id)}"
            ${current || state.choosingPlan ? "disabled" : ""}
          >${state.choosingPlan ? "Saving…" : ctaLabel}</button>
          <p class="pricing-renew">${renewNote}</p>
          ${tierSlider}
        </div>
        ${renderFeatureSections(plan.id)}
        ${
          plan.why
            ? `<div class="pricing-why"><strong>Why this plan?</strong><p>${escapeHtml(plan.why)}</p></div>`
            : ""
        }
      </article>
    `;
  }

  function renderCompareTable() {
    const plans = state.pricingPlans || [];
    if (!plans.length) return "";
    const sections = state.featureSections?.length
      ? state.featureSections
      : DEFAULT_FEATURE_SECTIONS;
    const rows = sections
      .flatMap((section) =>
        (section.rows || []).map(
          (row) => `
            <tr>
              <th scope="row">${escapeHtml(row.label)}</th>
              ${plans
                .map((plan) => `<td>${featureCell(row[plan.id])}</td>`)
                .join("")}
            </tr>
          `,
        ),
      )
      .join("");

    return `
      <section class="pricing-compare" id="compare-table">
        <div class="pricing-compare-head">
          <h3>Compare our plans</h3>
          <p>See at a glance what each plan costs and what you get.</p>
        </div>
        <div class="pricing-compare-scroll">
          <table class="pricing-compare-table">
            <thead>
              <tr>
                <th scope="col">Top features</th>
                ${plans.map((p) => `<th scope="col">${escapeHtml(p.name)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderPricingFaqs() {
    const faqs = state.pricingFaqs?.length
      ? state.pricingFaqs
      : [
          {
            q: "Can I change my plan later?",
            a: "Yes. Upgrade from Basic anytime from this page.",
          },
        ];
    return `
      <section class="pricing-faq">
        <h3>Pricing FAQs</h3>
        <div class="pricing-faq-list">
          ${faqs
            .map(
              (item, i) => `
            <details class="pricing-faq-item"${i === 0 ? " open" : ""}>
              <summary>${escapeHtml(item.q)}</summary>
              <p>${escapeHtml(item.a)}</p>
            </details>
          `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderPricing() {
    const plans = state.pricingPlans || [];
    const cards = plans.map((plan) => renderPricingCard(plan)).join("");
    const yearly = state.billingCycle === "yearly";
    const includes = state.planIncludes?.length
      ? state.planIncludes
      : ["Sitemap scraping", "Product cards", "Manual runs", "Secure login"];
    const trust = state.trustBadges?.length
      ? state.trustBadges
      : ["7-day launch offer", "Cancel anytime", "Upgrade in one click"];
    const currentPlan = state.settings.subscriptionPlan || "basic";
    const currentLabel =
      currentPlan === "essential"
        ? "Essential"
        : currentPlan === "advance"
          ? "Advance"
          : "Basic";

    return `
      <div class="pricing-hostinger">
        <ul class="pricing-trust" aria-label="Plan assurances">
          ${trust.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>

        <header class="pricing-hero">
          <div class="pricing-hero-copy">
            <p class="pricing-kicker">Monitoring</p>
            <h2 class="pricing-hero-title">Plans &amp; pricing</h2>
            <p class="pricing-hero-sub">
              Current plan: <strong>${escapeHtml(currentLabel)}</strong>
              ${
                isBasicPlan()
                  ? ` · <span class="pricing-upgrade-hint">Upgrade to unlock more competitor slots</span>`
                  : ""
              }
            </p>
            <div class="pricing-includes">
              <span class="pricing-includes-label">All plans include:</span>
              <ul>
                ${includes
                  .map((item) => `<li><span aria-hidden>✓</span> ${escapeHtml(item)}</li>`)
                  .join("")}
              </ul>
            </div>
          </div>
        </header>

        <div class="pricing-controls">
          <div class="pricing-timer-compact">
            <p class="pricing-timer-label" id="pricing-timer-label">Launch offer ends in</p>
            <div class="pricing-timer" id="pricing-timer" aria-live="polite">
              <div><strong data-unit="d">00</strong><span>Days</span></div>
              <div><strong data-unit="h">00</strong><span>Hours</span></div>
              <div><strong data-unit="m">00</strong><span>Mins</span></div>
              <div><strong data-unit="s">00</strong><span>Secs</span></div>
            </div>
            ${
              isAdmin()
                ? `<button type="button" class="btn ghost" id="pricing-reset-timer">Reset timer</button>`
                : ""
            }
          </div>
          <div class="pricing-toolbar">
            <div class="pricing-segment" role="group" aria-label="Billing cycle">
              <button type="button" class="pricing-segment-btn${
                !yearly ? " active" : ""
              }" data-billing="monthly">Monthly</button>
              <button type="button" class="pricing-segment-btn${
                yearly ? " active" : ""
              }" data-billing="yearly">Yearly · save ${Math.round(state.yearlyDiscount * 100)}%</button>
            </div>
            <label class="pricing-term">
              <span class="visually-hidden">Plan term</span>
              <select id="billing-term-select" aria-label="Plan term">
                <option value="monthly" ${!yearly ? "selected" : ""}>1 month plan</option>
                <option value="yearly" ${yearly ? "selected" : ""}>12 months plan · ${Math.round(state.yearlyDiscount * 100)}% off</option>
              </select>
            </label>
          </div>
        </div>

        <div class="pricing-grid">
          ${cards || `<p class="muted">Loading plans…</p>`}
        </div>

        <p class="pricing-footnote">
          All plans can be changed anytime. The monthly rate on yearly billing is the total divided by 12.
          <a href="#compare-table">Compare plans</a>
        </p>

        ${renderCompareTable()}
        ${renderPricingFaqs()}
      </div>
    `;
  }


  function defaultAvatarEmoji(role) {
    const key = normalizeRole(role);
    if (key === "super-admin") return "⭐";
    if (key === "admin") return "💼";
    return "👔";
  }

  function sanitizeAvatarEmoji(emoji, role) {
    const value = String(emoji || "").trim();
    // Drop broken / multi-part (ZWJ) glyphs that clash on Windows emoji fonts
    const hasZwj = value.includes("\u200D");
    const blocked = new Set([
      "🛡️",
      "🛡",
      "\uFFFD",
      "🧑‍💼",
      "👨‍💻",
      "👩‍💻",
      "🧑‍🔬",
      "👨‍🔬",
      "👩‍🔬",
      "🧑‍💻",
    ]);
    if (!value || hasZwj || blocked.has(value)) {
      return defaultAvatarEmoji(role);
    }
    return value;
  }

  function avatarMarkup(extraClass = "") {
    const img = state.user?.avatarImage;
    const emoji = sanitizeAvatarEmoji(
      state.user?.avatarEmoji,
      state.user?.role,
    );
    const cls = ["avatar", extraClass].filter(Boolean).join(" ");
    if (img) {
      return `<span class="${cls} has-image" aria-hidden><img src="${escapeHtml(img)}" alt="" /></span>`;
    }
    return `<span class="${cls} is-emoji" aria-hidden>${escapeHtml(emoji)}</span>`;
  }

  function applyAvatarElements() {
    const initials = userInitials();
    const img = state.user?.avatarImage || "";
    const emoji = sanitizeAvatarEmoji(
      state.user?.avatarEmoji,
      state.user?.role,
    );
    const paint = (el) => {
      if (!el) return;
      el.classList.add("avatar");
      el.classList.toggle("has-image", Boolean(img));
      el.classList.toggle("is-emoji", !img && Boolean(emoji));
      el.classList.toggle("is-initials", !img && !emoji);
      if (img) {
        el.innerHTML = `<img src="${escapeHtml(img)}" alt="" />`;
        const image = el.querySelector("img");
        if (image) {
          image.addEventListener(
            "error",
            () => {
              el.classList.remove("has-image");
              if (emoji) {
                el.classList.add("is-emoji");
                el.classList.remove("is-initials");
                el.textContent = emoji;
              } else {
                el.classList.add("is-initials");
                el.classList.remove("is-emoji");
                el.textContent = initials;
              }
            },
            { once: true },
          );
        }
      } else if (emoji) {
        el.textContent = emoji;
      } else {
        el.textContent = initials;
      }
    };
    paint(document.getElementById("sidebar-avatar"));
    paint(document.getElementById("topbar-avatar"));
  }

  function applyCustomization() {
    const accent = state.settings.accentColor || "#2B59FF";
    document.documentElement.style.setProperty("--primary", accent);
    document.documentElement.style.setProperty("--primary-deep", accent);
    document.documentElement.style.setProperty("--blue", accent);

    const roleKey = normalizeRole(state.user?.role);
    const roleName = formatRoleLabel(roleKey);
    const userName = state.user.displayName || state.user.username || "Signed in";

    const brand = document.querySelector(".brand");
    if (brand) brand.setAttribute("aria-label", "Permanent SEO");

    const userEl = document.getElementById("sidebar-user-name");
    const roleEl = document.getElementById("sidebar-user-role");
    if (userEl) userEl.textContent = userName;
    if (roleEl) roleEl.textContent = roleName;

    const topName = document.getElementById("topbar-user-name");
    const topRole = document.getElementById("topbar-user-role");
    if (topName) topName.textContent = userName;
    if (topRole) topRole.textContent = roleName;

    const menuName = document.getElementById("profile-menu-name");
    const menuRole = document.getElementById("profile-menu-role");
    if (menuName) menuName.textContent = userName;
    if (menuRole) menuRole.textContent = roleName;

    const revenueItem = document.getElementById("profile-menu-revenue");
    if (revenueItem) revenueItem.hidden = !isSuperAdmin();

    applyAvatarElements();

    const pricingNav = document.getElementById("nav-pricing-item");
    if (pricingNav) pricingNav.hidden = false;
    const revenueNav = document.getElementById("nav-revenue-item");
    if (revenueNav) revenueNav.hidden = !isSuperAdmin();
  }

  function renderBanner() {
    const banner = cfg.pricingBanner;
    const showForBasic = !banner?.basicOnly || isBasicPlan();
    const snoozed = state.bannerSnoozed || isUpgradeSnoozed();
    if (
      state.nav !== "dashboard" ||
      !banner?.enabled ||
      snoozed ||
      !showForBasic ||
      (banner.adminOnly && !isAdmin())
    ) {
      bannerRoot.innerHTML = "";
      return;
    }
    bannerRoot.innerHTML = `
      <aside class="pricing-banner" aria-label="Upgrade reminder">
        <div class="pricing-banner-copy">
          ${banner.badge ? `<span class="pricing-banner-badge">${escapeHtml(banner.badge)}</span>` : ""}
          <p class="pricing-banner-title">${escapeHtml(banner.title)}</p>
          <p class="pricing-banner-subtitle">${escapeHtml(banner.subtitle)}</p>
        </div>
        <div class="pricing-banner-actions">
          <span class="pricing-banner-price">${escapeHtml(banner.priceLabel)}</span>
          <button type="button" class="btn primary" id="banner-view-plans">${escapeHtml(banner.ctaText)}</button>
          ${
            banner.dismissible !== false
              ? `<button type="button" class="pricing-banner-dismiss" id="dismiss-banner" aria-label="Snooze upgrade reminder">×</button>`
              : ""
          }
        </div>
      </aside>
    `;
  }

  function renderUpgradeNag() {
    if (!upgradeNagRoot) return;
    const hideOn = state.nav === "pricing" || state.nav === "dashboard";
    if (!isBasicPlan() || hideOn || isUpgradeSnoozed()) {
      upgradeNagRoot.hidden = true;
      upgradeNagRoot.innerHTML = "";
      return;
    }
    upgradeNagRoot.hidden = false;
    upgradeNagRoot.innerHTML = `
      <div class="upgrade-nag-bar" role="region" aria-label="Upgrade reminder">
        <div class="upgrade-nag-copy">
          <strong>Basic plan limit</strong>
          <span>Upgrade for more stores (Essential 4 · Advance unlimited) and more Scrape now runs (8 · 12).</span>
        </div>
        <div class="upgrade-nag-actions">
          <button type="button" class="btn primary nag-cta" id="nag-upgrade-cta">View plans</button>
          <button type="button" class="btn nag-snooze" id="nag-upgrade-snooze">Remind me later</button>
        </div>
      </div>
    `;
    document.getElementById("nag-upgrade-cta")?.addEventListener("click", () => goToPricing());
    document.getElementById("nag-upgrade-snooze")?.addEventListener("click", () => {
      snoozeUpgradeReminders();
      renderUpgradeNag();
      renderBanner();
    });
  }

  function syncHeaderActions() {
    const scrapeBtn = document.getElementById("btn-scrape-all");
    const newBtn = document.getElementById("btn-new-competitor");
    const onCompetitors = state.nav === "competitors";
    const scrapeOk = canScrapeNow();
    const stores = enabledCompetitorCount();
    if (scrapeBtn) {
      scrapeBtn.hidden = !onCompetitors;
      scrapeBtn.disabled = state.scraping || !stores || !scrapeOk;
      scrapeBtn.textContent = scrapeAllButtonLabel();
      scrapeBtn.title = scrapeAllButtonTitle();
    }
    if (newBtn) {
      newBtn.hidden = !onCompetitors;
    }
  }

  function render() {
    const meta = titles[state.nav];
    titleEl.textContent = meta.title;
    subtitleEl.textContent = meta.subtitle;
    const pageHeader = document.querySelector(".page-header");
    if (pageHeader) {
      pageHeader.hidden = state.nav === "dashboard";
    }
    const mainPane = document.getElementById("main-content");
    if (mainPane) {
      mainPane.classList.toggle("is-dashboard", state.nav === "dashboard");
    }
    document.querySelectorAll(".nav-item").forEach((btn) => {
      const on = btn.dataset.nav === state.nav;
      btn.classList.toggle("active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    const helpBtn = document.getElementById("help-centre-btn");
    if (helpBtn) {
      const on = state.nav === "help";
      helpBtn.classList.toggle("active", on);
      if (on) helpBtn.setAttribute("aria-current", "page");
      else helpBtn.removeAttribute("aria-current");
    }
    renderBanner();
    renderUpgradeNag();
    syncHeaderActions();
    applyCustomization();
    root.setAttribute("aria-busy", state.loading ? "true" : "false");

    if (state.nav === "dashboard") root.innerHTML = renderDashboard();
    else if (state.nav === "competitors") root.innerHTML = renderCompetitors();
    else if (state.nav === "products") root.innerHTML = renderProducts();
    else if (state.nav === "runs") root.innerHTML = renderRuns();
    else if (state.nav === "pricing") root.innerHTML = renderPricing();
    else if (state.nav === "revenue") root.innerHTML = renderRevenue();
    else if (state.nav === "help") root.innerHTML = renderHelp();
    else root.innerHTML = renderSettings();

    bindViewEvents();
    startPricingTimer();
  }

  function bindViewEvents() {
    const addForm = document.getElementById("add-form");
    if (addForm) {
      addForm.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(addForm);
        state.form = {
          name: String(data.get("name") || ""),
          sitemapUrl: String(data.get("sitemapUrl") || ""),
          intervalHours: Number(data.get("intervalHours") || 5),
        };
        void onAddCompetitor();
      };
    }

    const cancelAdd = document.getElementById("btn-cancel-add");
    if (cancelAdd) {
      cancelAdd.onclick = () => {
        state.showAddForm = false;
        render();
      };
    }

    const filter = document.getElementById("filter-competitor");
    if (filter) {
      filter.onchange = () => {
        state.filterCompetitorId = filter.value;
        void load();
      };
    }

    const competitorRange = document.getElementById("competitor-range");
    if (competitorRange) {
      competitorRange.onchange = () => {
        state.competitorRange = competitorRange.value || "7d";
        render();
      };
    }

    root.querySelectorAll("[data-product-view]").forEach((btn) => {
      btn.onclick = () => {
        state.productView = btn.getAttribute("data-product-view") || "active";
        void load();
      };
    });

    const cronToggle = document.getElementById("daily-cron-toggle");
    if (cronToggle) {
      cronToggle.onclick = () => void onDailyCronToggle();
    }

    const customizationForm = document.getElementById("customization-form");
    if (customizationForm) {
      customizationForm.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(customizationForm);
        void onSaveCustomization({
          brandName: String(data.get("brandName") || ""),
          brandTagline: String(data.get("brandTagline") || ""),
          accentColor: String(data.get("accentColor") || ""),
        });
      };
    }

    const addAdminForm = document.getElementById("add-admin-form");
    if (addAdminForm) {
      addAdminForm.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(addAdminForm);
        void onAddAdmin({
          displayName: String(data.get("displayName") || ""),
          username: String(data.get("username") || ""),
          password: String(data.get("password") || ""),
        });
      };
    }

    const generateInviteForm = document.getElementById("generate-invite-form");
    if (generateInviteForm) {
      generateInviteForm.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(generateInviteForm);
        void onGenerateInvite({
          note: String(data.get("note") || ""),
        });
      };
    }

    const copyInviteBtn = document.getElementById("copy-invite-link");
    if (copyInviteBtn) {
      copyInviteBtn.onclick = () => {
        void copyText(state.lastInviteUrl || document.getElementById("invite-link-input")?.value || "");
      };
    }

    root.querySelectorAll("[data-invite-id]").forEach((row) => {
      const id = row.getAttribute("data-invite-id");
      row
        .querySelector('[data-invite-action="copy"]')
        ?.addEventListener("click", () => {
          const inv = state.invites.find((i) => i.id === id);
          if (!inv) return;
          void copyText(`${window.location.origin}/invite/${inv.token}`);
        });
      row
        .querySelector('[data-invite-action="revoke"]')
        ?.addEventListener("click", () => void onRevokeInvite(id));
    });

    const inviteForm = document.getElementById("invite-form");
    if (inviteForm) {
      inviteForm.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(inviteForm);
        void onInviteUser({
          displayName: String(data.get("displayName") || ""),
          username: String(data.get("username") || ""),
          password: String(data.get("password") || ""),
          role: String(data.get("role") || "user"),
        });
      };
    }

    const profileForm = document.getElementById("profile-form");
    if (profileForm) {
      profileForm.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(profileForm);
        void onInviteUser({
          displayName: String(data.get("displayName") || ""),
          username: String(data.get("username") || ""),
          password: String(data.get("password") || ""),
          role: String(data.get("role") || "user"),
        });
      };
    }

    root.querySelectorAll("[data-profile-id]").forEach((row) => {
      const id = row.getAttribute("data-profile-id");
      row
        .querySelector('[data-profile-action="edit"]')
        ?.addEventListener("click", () => void onEditProfile(id));
      row
        .querySelector('[data-profile-action="delete"]')
        ?.addEventListener("click", () => void onDeleteProfile(id));
    });

    root.querySelectorAll("[data-avatar-emoji]").forEach((btn) => {
      btn.addEventListener("click", () => {
        void onSaveAvatar({
          avatarEmoji: btn.getAttribute("data-avatar-emoji") || "👔",
          avatarImage: null,
        });
      });
    });

    const avatarInput = document.getElementById("avatar-file-input");
    if (avatarInput) {
      avatarInput.onchange = () => {
        const file = avatarInput.files?.[0];
        if (!file) return;
        if (file.size > 180000) {
          setError("Image is too large. Please use a file under ~150KB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          if (!result.startsWith("data:image/")) {
            setError("Could not read that image file.");
            return;
          }
          void onSaveAvatar({ avatarImage: result });
        };
        reader.onerror = () => setError("Could not read that image file.");
        reader.readAsDataURL(file);
      };
    }

    const clearAvatar = document.getElementById("avatar-clear-image");
    if (clearAvatar) {
      clearAvatar.onclick = () => void onSaveAvatar({ avatarImage: null });
    }

    const dismiss = document.getElementById("dismiss-banner");
    if (dismiss) {
      dismiss.onclick = () => {
        snoozeUpgradeReminders();
        render();
      };
    }

    const viewPlans = document.getElementById("banner-view-plans");
    if (viewPlans) {
      viewPlans.onclick = () => {
        goToPricing();
      };
    }

    const billingToggle = document.getElementById("billing-cycle-toggle");
    if (billingToggle) {
      billingToggle.onchange = () => {
        state.billingCycle = billingToggle.checked ? "yearly" : "monthly";
        render();
      };
    }

    root.querySelectorAll("[data-billing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.billingCycle =
          btn.getAttribute("data-billing") === "yearly" ? "yearly" : "monthly";
        render();
      });
    });

    const termSelect = document.getElementById("billing-term-select");
    if (termSelect) {
      termSelect.onchange = () => {
        state.billingCycle = termSelect.value === "yearly" ? "yearly" : "monthly";
        render();
      };
    }

    const setBasicTierByIndex = (index) => {
      const basic = (state.pricingPlans || []).find((p) => p.id === "basic");
      const tier = basic?.tiers?.[Number(index)];
      if (tier) {
        state.basicTierId = tier.id;
        render();
      }
    };

    const tierRange = document.getElementById("basic-tier-range");
    if (tierRange) {
      tierRange.oninput = () => setBasicTierByIndex(tierRange.value);
    }

    root.querySelectorAll("[data-basic-tier]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.basicTierId = btn.getAttribute("data-basic-tier") || "basic-8h";
        render();
      });
    });

    root.querySelectorAll("[data-open-pricing]").forEach((btn) => {
      btn.addEventListener("click", () => goToPricing());
    });

    root.querySelectorAll("[data-dash-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-dash-action");
        if (action === "new-competitor") {
          if (!canAddCompetitor()) {
            promptPlanUpgrade(
              "Competitor limit reached on your plan. Upgrade to add more stores.",
            );
            goToPricing();
            return;
          }
          state.nav = "competitors";
          state.showAddForm = true;
          render();
          scrollPageToTop();
          requestAnimationFrame(() => {
            const addPanel = document.getElementById("add-competitor-panel");
            if (addPanel) {
              addPanel.scrollIntoView({ behavior: "smooth", block: "start" });
              addPanel.classList.add("highlight-panel");
              setTimeout(() => addPanel.classList.remove("highlight-panel"), 1500);
            }
            document.querySelector("#add-form input[name='name']")?.focus();
          });
          return;
        }
        if (action === "competitors") {
          const competitorId = btn.getAttribute("data-competitor-id") || "";
          if (competitorId) state.filterCompetitorId = competitorId;
          state.nav = "competitors";
          state.showAddForm = false;
          render();
          scrollPageToTop();
          return;
        }
        if (action === "products") {
          state.nav = "products";
          render();
          scrollPageToTop();
          return;
        }
        if (action === "help") {
          state.nav = "help";
          state.helpOption = "ticket";
          render();
          scrollPageToTop();
          return;
        }
        if (action === "settings") {
          state.nav = "settings";
          render();
          scrollPageToTop();
          return;
        }
        if (action === "revenue") {
          if (!isSuperAdmin()) return;
          state.nav = "revenue";
          void loadRevenue().then(() => {
            render();
            scrollPageToTop();
          });
          return;
        }
        if (action === "runs") {
          state.nav = "runs";
          render();
          scrollPageToTop();
          return;
        }
        if (action === "pricing") {
          goToPricing();
          return;
        }
        if (action === "scrape") {
          void onScrapeNow();
        }
      });
    });

    const resetTimer = document.getElementById("pricing-reset-timer");
    if (resetTimer) {
      resetTimer.onclick = () => void onResetPricingTimer();
    }

    root.querySelectorAll("[data-choose-plan]").forEach((btn) => {
      btn.addEventListener("click", () => {
        void onChoosePlan(btn.getAttribute("data-choose-plan"));
      });
    });

    root.querySelectorAll("[data-help-option]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.helpOption = btn.getAttribute("data-help-option") || "ticket";
        render();
      });
    });

    const ticketForm = document.getElementById("help-ticket-form");
    if (ticketForm) {
      ticketForm.onsubmit = (e) => {
        e.preventDefault();
        const data = new FormData(ticketForm);
        const subject = String(data.get("subject") || "").trim();
        const message = String(data.get("message") || "").trim();
        if (!subject || !message) return;
        const body = [
          message,
          "",
          `—`,
          `From: ${state.user.displayName || state.user.username || "Dashboard user"}`,
          `Role: ${formatRoleLabel(state.user.role)}`,
        ].join("\n");
        const mailto = `mailto:${HELP_EMAIL}?subject=${encodeURIComponent(
          `[Ticket] ${subject}`,
        )}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      };
    }

    const activityMetric = document.getElementById("activity-metric");
    if (activityMetric) {
      activityMetric.onchange = () => {
        state.activityMetric = activityMetric.value || "scrapes";
        render();
      };
    }

    const activityChart = root.querySelector("[data-activity-chart]");
    if (activityChart) {
      const tip = activityChart.querySelector(".activity-tooltip");
      activityChart.querySelectorAll(".activity-hit").forEach((hit) => {
        hit.addEventListener("mouseenter", (e) => {
          if (!tip) return;
          tip.hidden = false;
          tip.textContent = hit.getAttribute("data-tip") || "";
          const rect = activityChart.getBoundingClientRect();
          tip.style.left = `${e.clientX - rect.left}px`;
          tip.style.top = `${e.clientY - rect.top - 12}px`;
        });
        hit.addEventListener("mousemove", (e) => {
          if (!tip || tip.hidden) return;
          const rect = activityChart.getBoundingClientRect();
          tip.style.left = `${e.clientX - rect.left}px`;
          tip.style.top = `${e.clientY - rect.top - 12}px`;
        });
        hit.addEventListener("mouseleave", () => {
          if (tip) tip.hidden = true;
        });
      });
    }

    root.querySelectorAll(".competitor-banner").forEach((row) => {
      const id = row.getAttribute("data-id");
      row.querySelector('[data-action="scrape"]')?.addEventListener("click", () =>
        void onScrapeNow(id),
      );
      row.querySelector('[data-action="delete"]')?.addEventListener("click", () =>
        void onDelete(id),
      );
      row.querySelector('[data-action="interval"]')?.addEventListener("change", (e) =>
        void onIntervalChange(id, Number(e.target.value)),
      );
    });

    root.querySelectorAll(".product-card").forEach((card) => {
      const id = card.getAttribute("data-id");
      card
        .querySelector('[data-action="needs_upload"]')
        ?.addEventListener("click", () => void updateProduct(id, "needs_upload"));
      card
        .querySelector('[data-action="delete"]')
        ?.addEventListener("click", () => void updateProduct(id, "delete"));
      card
        .querySelector('[data-action="restore"]')
        ?.addEventListener("click", () => void updateProduct(id, "restore"));
      card.querySelectorAll("img[data-fallback]").forEach((img) => {
        img.addEventListener("error", () => {
          img.classList.add("is-broken");
          img.removeAttribute("src");
        });
      });
    });
  }

  async function load() {
    setError(null);
    try {
      const [cRes, pRes, sRes, profilesRes, meRes] = await Promise.all([
        apiFetch("/api/competitors"),
        apiFetch((() => {
          const onProducts = state.nav === "products";
          const view = onProducts ? state.productView || "active" : "active";
          const competitorId =
            onProducts && state.filterCompetitorId !== "all"
              ? state.filterCompetitorId
              : null;
          let url = `/api/products?view=${encodeURIComponent(view)}`;
          if (competitorId) {
            url += `&competitorId=${encodeURIComponent(competitorId)}`;
          }
          return url;
        })()),
        apiFetch("/api/settings"),
        apiFetch("/api/profiles"),
        apiFetch("/api/me"),
      ]);
      if (!cRes.ok || !pRes.ok) throw new Error("Failed to load dashboard data");
      const cJson = await readJson(cRes);
      const pJson = await readJson(pRes);
      state.competitors = cJson.competitors || [];
      state.products = pJson.products || [];
      state.runs = pJson.runs || [];
      if (pJson.counts && typeof pJson.counts === "object") {
        state.productCounts = {
          active: Number(pJson.counts.active || 0),
          needs_upload: Number(pJson.counts.needs_upload || 0),
          recycle: Number(pJson.counts.recycle || 0),
          total: Number(pJson.counts.total || 0),
        };
      } else {
        const n = state.products.length;
        const next = { ...state.productCounts };
        if (state.productView === "needs_upload") next.needs_upload = n;
        else if (state.productView === "recycle") next.recycle = n;
        else next.active = n;
        next.total = next.active + next.needs_upload;
        state.productCounts = next;
      }
      if (cJson.planUsage) applyPlanUsage(cJson.planUsage);
      if (pJson.view) state.productView = pJson.view;
      if (sRes.ok) {
        const sJson = await readJson(sRes);
        if (sJson.settings) {
          state.settings = {
            dailyCronEnabled: sJson.settings.dailyCronEnabled !== false,
            brandName: sJson.settings.brandName || "Permanent SEO",
            brandTagline: sJson.settings.brandTagline || "Competitor intel",
            accentColor: sJson.settings.accentColor || "#2B59FF",
            pricingOfferEndsAt: sJson.settings.pricingOfferEndsAt || null,
            subscriptionPlan: sJson.settings.subscriptionPlan || "basic",
            manualScrapePeriod: sJson.settings.manualScrapePeriod || null,
            manualScrapeUsed: Number(sJson.settings.manualScrapeUsed || 0),
          };
        }
      } else if (cJson.settings) {
        state.settings = {
          ...state.settings,
          dailyCronEnabled: cJson.settings.dailyCronEnabled !== false,
          subscriptionPlan: cJson.settings.subscriptionPlan || state.settings.subscriptionPlan,
          manualScrapePeriod: cJson.settings.manualScrapePeriod || null,
          manualScrapeUsed: Number(cJson.settings.manualScrapeUsed || 0),
        };
      }
      if (profilesRes.ok) {
        const profilesJson = await readJson(profilesRes);
        state.profiles = profilesJson.profiles || [];
        state.invites = profilesJson.invites || [];
        if (profilesJson.planUsage) applyPlanUsage(profilesJson.planUsage);
        if (Array.isArray(profilesJson.avatarEmojis) && profilesJson.avatarEmojis.length) {
          state.avatarEmojis = profilesJson.avatarEmojis;
        }
      } else {
        state.profiles = [];
        state.invites = [];
      }
      if (meRes.ok) {
        const meJson = await readJson(meRes);
        if (Array.isArray(meJson.avatarEmojis) && meJson.avatarEmojis.length) {
          state.avatarEmojis = meJson.avatarEmojis;
        }
        if (meJson.user) {
          state.user = {
            ...meJson.user,
            role: normalizeRole(meJson.user.role),
            avatarEmoji: sanitizeAvatarEmoji(
              meJson.user.avatarEmoji,
              meJson.user.role,
            ),
            avatarImage: meJson.user.avatarImage || "",
          };
        }
      }
      if (!isPlanAdmin()) {
        state.profiles = [];
      }
      await loadPricing();
      if (isSuperAdmin() && state.nav === "revenue") {
        await loadRevenue();
      }
      if (isBasicPlan() && !isUpgradeSnoozed() && state.nav === "dashboard") {
        /* banner + sticky bar render via render() */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadPricing() {
    try {
      const res = await apiFetch("/api/pricing");
      if (!res.ok) return;
      const json = await readJson(res);
      state.pricingPlans = json.plans || [];
      state.featureSections = json.featureSections || [];
      state.planIncludes = json.planIncludes || [];
      state.trustBadges = json.trustBadges || [];
      state.pricingFaqs = json.faqs || [];
      if (typeof json.yearlyDiscount === "number") {
        state.yearlyDiscount = json.yearlyDiscount;
      }
      if (json.offerEndsAt) {
        state.settings.pricingOfferEndsAt = json.offerEndsAt;
      }
      if (json.subscriptionPlan) {
        state.settings.subscriptionPlan = json.subscriptionPlan;
      }
      if (json.planUsage) applyPlanUsage(json.planUsage);
    } catch {
      /* ignore — page still renders with empty plans */
    }
  }

  async function onChoosePlan(planId) {
    const plan = String(planId || "").toLowerCase();
    if (!["basic", "essential", "advance"].includes(plan)) return;
    state.choosingPlan = true;
    render();
    setError(null);
    try {
      const res = await apiFetch("/api/pricing/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not update plan");
      state.settings.subscriptionPlan = json.subscriptionPlan || plan;
      if (plan !== "basic") clearUpgradeSnooze();
      if (upgradeToast) upgradeToast.hidden = true;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update plan");
    } finally {
      state.choosingPlan = false;
      render();
    }
  }

  async function onResetPricingTimer() {
    if (!isAdmin()) return;
    setError(null);
    try {
      const res = await apiFetch("/api/pricing/timer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricingOfferEndsAt: null }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not reset timer");
      state.settings.pricingOfferEndsAt = json.offerEndsAt;
      render();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset timer");
      render();
    }
  }

  async function onAddCompetitor() {
    if (!canAddCompetitor()) {
      promptPlanUpgrade(
        "Competitor limit reached on your plan. Upgrade to add more stores.",
      );
      goToPricing();
      return;
    }
    state.saving = true;
    setError(null);
    render();
    try {
      const res = await apiFetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.form),
      });
      const json = await readJson(res);
      if (json.planUsage) applyPlanUsage(json.planUsage);
      if (!res.ok) {
        if (json.code === "COMPETITOR_LIMIT") {
          promptPlanUpgrade(json.error || "Competitor limit reached.");
          goToPricing();
          return;
        }
        throw new Error(json.error || "Could not add competitor");
      }
      state.form = { name: "", sitemapUrl: "", intervalHours: 5 };
      state.showAddForm = false;
      state.nav = "competitors";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      state.saving = false;
      render();
    } finally {
      state.saving = false;
    }
  }

  async function onIntervalChange(id, intervalHours) {
    const res = await apiFetch("/api/competitors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, intervalHours }),
    });
    if (!res.ok) {
      setError("Could not update interval");
      return;
    }
    await load();
  }

  async function onDelete(id) {
    if (!window.confirm("Remove this competitor and its products?")) return;
    setError(null);
    try {
      const res = await apiFetch(
        `/api/competitors?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not delete competitor");
      if (json.planUsage) applyPlanUsage(json.planUsage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete competitor");
    }
  }

  async function onScrapeNow(competitorId) {
    if (!canScrapeNow()) {
      promptPlanUpgrade(
        "Scrape now limit reached for this month. Upgrade for more manual runs.",
      );
      goToPricing();
      return;
    }
    state.scraping = true;
    setError(null);
    render();
    try {
      const res = await apiFetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(competitorId ? { competitorId } : {}),
      });
      const json = await res.json();
      if (json.planUsage) applyPlanUsage(json.planUsage);
      if (!res.ok) {
        if (json.code === "SCRAPE_QUOTA") {
          promptPlanUpgrade(json.error || "Scrape now limit reached.");
          goToPricing();
          return;
        }
        throw new Error(json.error || "Scrape failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      state.scraping = false;
      render();
    }
  }

  async function updateProduct(id, action) {
    setError(null);
    try {
      const res = await apiFetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not update product");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update product");
      render();
    }
  }

  async function onDailyCronToggle() {
    const next = !(state.settings.dailyCronEnabled !== false);
    state.settings.dailyCronEnabled = next;
    state.savingSchedule = true;
    setError(null);
    render();
    try {
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyCronEnabled: next }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not update schedule");
      if (typeof json.settings?.dailyCronEnabled === "boolean") {
        state.settings.dailyCronEnabled = json.settings.dailyCronEnabled;
      }
    } catch (err) {
      state.settings.dailyCronEnabled = !next;
      setError(err instanceof Error ? err.message : "Could not update schedule");
    } finally {
      state.savingSchedule = false;
      render();
    }
  }

  async function onSaveAvatar(patch) {
    state.savingAvatar = true;
    setError(null);
    try {
      const res = await apiFetch("/api/me/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not update avatar");
      if (json.profile) {
        state.user = {
          ...state.user,
          avatarEmoji: sanitizeAvatarEmoji(
            json.profile.avatarEmoji ||
              defaultAvatarEmoji(json.profile.role || state.user.role),
            json.profile.role || state.user.role,
          ),
          avatarImage: json.profile.avatarImage || "",
        };
      }
      applyAvatarElements();
      render();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update avatar");
      render();
    } finally {
      state.savingAvatar = false;
    }
  }

  async function onSaveCustomization(patch) {
    state.savingCustomization = true;
    setError(null);
    render();
    try {
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not save customization");
      state.settings = {
        ...state.settings,
        ...json.settings,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save customization");
    } finally {
      state.savingCustomization = false;
      render();
    }
  }

  async function loadRevenue() {
    if (!isSuperAdmin()) {
      state.revenue = null;
      return;
    }
    try {
      const res = await apiFetch("/api/revenue");
      if (!res.ok) {
        state.revenue = null;
        return;
      }
      const json = await readJson(res);
      state.revenue = json.revenue || null;
    } catch {
      state.revenue = null;
    }
  }

  function showInlineInviteError(msg) {
    let errEl = document.getElementById("invite-card-error");
    if (!errEl) {
      errEl = document.createElement("p");
      errEl.className = "error invite-card-error";
      errEl.id = "invite-card-error";
      errEl.style.marginBottom = "var(--space-3)";
      const form = document.getElementById("generate-invite-form");
      if (form && form.parentNode) {
        form.parentNode.insertBefore(errEl, form);
      }
    }
    if (errEl) {
      errEl.textContent = msg;
    }
  }

  function removeInlineInviteError() {
    const errEl = document.getElementById("invite-card-error");
    if (errEl) errEl.remove();
  }

  function updateSeatsCounterInPlace() {
    const seatEl = document.getElementById("team-seats-usage");
    if (seatEl) {
      seatEl.textContent = seatUsageLabel();
    }
  }

  function renderPendingInvitesHtml(invites) {
    if (!invites || !invites.length) {
      return `<p class="muted">No pending invites yet.</p>`;
    }
    return invites
      .map(
        (inv) => `
        <article class="competitor-row invite-row" data-invite-id="${escapeHtml(inv.id)}">
          <div>
            <strong>${escapeHtml(formatRoleLabel(inv.role))} invite</strong>
            <p class="muted">
              ${inv.note ? `${escapeHtml(inv.note)} · ` : ""}expires ${escapeHtml(formatWhen(inv.expiresAt))}
            </p>
            <code class="invite-token-chip">${escapeHtml(inv.token.slice(0, 8))}…</code>
          </div>
          <div class="profile-row-actions">
            <button type="button" class="btn ghost" data-invite-action="copy">Copy link</button>
            <button type="button" class="btn danger-outline" data-invite-action="revoke">Revoke</button>
          </div>
        </article>
      `,
      )
      .join("");
  }

  function bindPendingInvitesEvents(container) {
    if (!container) return;
    container.querySelectorAll("[data-invite-id]").forEach((row) => {
      const id = row.getAttribute("data-invite-id");
      row
        .querySelector('[data-invite-action="copy"]')
        ?.addEventListener("click", () => {
          const inv = state.invites.find((i) => i.id === id);
          if (!inv) return;
          void copyText(`${window.location.origin}/invite/${inv.token}`);
        });
      row
        .querySelector('[data-invite-action="revoke"]')
        ?.addEventListener("click", () => void onRevokeInvite(id));
    });
  }

  function updateInviteSectionInPlace(newInvite, inviteUrl) {
    const noteInput = document.getElementById("invite-note-input");
    if (noteInput) noteInput.value = "";

    if (inviteUrl) {
      let box = document.getElementById("invite-link-box");
      if (!box) {
        box = document.createElement("div");
        box.className = "invite-link-box";
        box.id = "invite-link-box";
        box.innerHTML = `
          <p class="invite-link-label">Latest invite link</p>
          <div class="invite-link-row">
            <input type="text" readonly value="${escapeHtml(inviteUrl)}" id="invite-link-input" />
            <button type="button" class="btn ghost" id="copy-invite-link">Copy</button>
          </div>
          <p class="muted">Share this link securely. It works once.</p>
        `;
        const form = document.getElementById("generate-invite-form");
        if (form && form.parentNode) {
          form.parentNode.insertBefore(box, form.nextSibling);
        }
        const copyBtn = box.querySelector("#copy-invite-link");
        if (copyBtn) {
          copyBtn.onclick = () => {
            void copyText(state.lastInviteUrl || inviteUrl);
          };
        }
      } else {
        const input = box.querySelector("#invite-link-input");
        if (input) input.value = inviteUrl;
      }
    }

    const pendingWrap = document.querySelector("#invite-user-section .pending-invites");
    if (pendingWrap) {
      pendingWrap.innerHTML = `
        <h3 class="invite-list-title">Pending invites</h3>
        ${renderPendingInvitesHtml(state.invites)}
      `;
      bindPendingInvitesEvents(pendingWrap);
    }
  }

  async function copyText(text) {
    const value = String(text || "");
    if (!value) return;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      /* Fallback to execCommand */
    }
    if (!copied) {
      try {
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        input.style.pointerEvents = "none";
        document.body.appendChild(input);
        input.select();
        copied = document.execCommand("copy");
        input.remove();
      } catch {
        copied = false;
      }
    }
    if (copied && upgradeToast) {
      upgradeToast.hidden = false;
      upgradeToast.textContent = "Invite link copied to clipboard";
      setTimeout(() => {
        upgradeToast.hidden = true;
      }, 2000);
    }
  }

  async function onGenerateInvite({ note = "" } = {}) {
    if (!isPlanAdmin() || state.generatingInvite) return;
    if (!canInviteMoreUsers()) {
      state.inviteError = "Seat limit reached on your plan. Upgrade or revoke a pending invite to invite more users.";
      showInlineInviteError(state.inviteError);
      return;
    }

    state.generatingInvite = true;
    state.inviteError = "";
    removeInlineInviteError();

    const btn = document.getElementById("generate-invite-btn") ||
      document.querySelector("#generate-invite-form button[type='submit']");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>Generating…</span>';
    }

    let inviteUrl = "";
    try {
      const res = await apiFetch("/api/invites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", note }),
      });
      const json = await readJson(res);
      if (json.planUsage) applyPlanUsage(json.planUsage);
      if (!res.ok) throw new Error(json.error || "Could not generate invite");

      inviteUrl = json.inviteUrl || "";
      state.lastInviteUrl = inviteUrl;
      state.inviteError = "";

      if (json.invite) {
        state.invites = [
          json.invite,
          ...(state.invites || []).filter((inv) => inv.id !== json.invite.id),
        ];
      }

      // Smooth in-place DOM update (no full-page destruction / fluctuation)
      updateInviteSectionInPlace(json.invite, inviteUrl);
      updateSeatsCounterInPlace();

      // Background sync profiles without tearing down view
      try {
        const pRes = await apiFetch("/api/profiles");
        if (pRes.ok) {
          const pJson = await readJson(pRes);
          if (pJson.invites) state.invites = pJson.invites;
          if (pJson.profiles) state.profiles = pJson.profiles;
          if (pJson.planUsage) applyPlanUsage(pJson.planUsage);
          updateSeatsCounterInPlace();
        }
      } catch {
        /* ignore background refresh */
      }

      if (inviteUrl) {
        void copyText(inviteUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not generate invite";
      state.inviteError = msg;
      showInlineInviteError(msg);
    } finally {
      state.generatingInvite = false;
      const finalBtn = document.getElementById("generate-invite-btn");
      if (finalBtn) {
        const canInvite = canInviteMoreUsers();
        finalBtn.disabled = !canInvite;
        finalBtn.innerHTML = canInvite ? "Generate invite link" : "Seat limit reached";
      }
    }
  }

  async function onRevokeInvite(id) {
    if (!id || !window.confirm("Revoke this invite link?")) return;
    setError(null);
    state.inviteError = "";
    removeInlineInviteError();
    try {
      const res = await apiFetch("/api/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await readJson(res);
      if (json.planUsage) applyPlanUsage(json.planUsage);
      if (!res.ok) throw new Error(json.error || "Could not revoke invite");
      if (state.lastInviteUrl && state.invites.some((i) => i.id === id)) {
        state.lastInviteUrl = "";
        document.getElementById("invite-link-box")?.remove();
      }
      state.invites = (state.invites || []).filter((i) => i.id !== id);

      const pendingWrap = document.querySelector("#invite-user-section .pending-invites");
      if (pendingWrap) {
        pendingWrap.innerHTML = `
          <h3 class="invite-list-title">Pending invites</h3>
          ${renderPendingInvitesHtml(state.invites)}
        `;
        bindPendingInvitesEvents(pendingWrap);
      }
      updateSeatsCounterInPlace();

      const btn = document.getElementById("generate-invite-btn");
      if (btn) {
        const canInvite = canInviteMoreUsers();
        btn.disabled = !canInvite;
        btn.innerHTML = canInvite ? "Generate invite link" : "Seat limit reached";
      }
    } catch (err) {
      state.inviteError = err instanceof Error ? err.message : "Could not revoke invite";
      showInlineInviteError(state.inviteError);
    }
  }

  async function onInviteUser(input) {
    if (!isPlanAdmin()) return;
    state.invitingUser = true;
    state.savingProfile = true;
    setError(null);
    render();
    try {
      const role = isSuperAdmin() ? normalizeRole(input.role || "user") : "user";
      const res = await apiFetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: input.displayName,
          username: input.username,
          password: input.password,
          role,
        }),
      });
      const json = await readJson(res);
      if (json.planUsage) applyPlanUsage(json.planUsage);
      if (!res.ok) throw new Error(json.error || "Could not invite user");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite user");
      state.invitingUser = false;
      state.savingProfile = false;
      render();
    } finally {
      state.invitingUser = false;
      state.savingProfile = false;
    }
  }

  async function onCreateProfile(input) {
    return onInviteUser(input);
  }

  async function onEditProfile(id) {
    const profile = state.profiles.find((p) => p.id === id);
    if (!profile) return;
    if (!isSuperAdmin() && normalizeRole(profile.role) !== "user") {
      setError("Admins can only manage Users");
      return;
    }
    const displayName = window.prompt("Display name", profile.displayName || "");
    if (displayName === null) return;
    const username = window.prompt("Username", profile.username || "");
    if (username === null) return;
    const password = window.prompt(
      "New password (leave blank to keep current)",
      "",
    );
    if (password === null) return;
    let role = normalizeRole(profile.role);
    if (isSuperAdmin()) {
      const prompted = window.prompt(
        "Role (super-admin, admin, or user)",
        role,
      );
      if (prompted === null) return;
      role = normalizeRole(prompted);
    } else {
      role = "user";
    }
    setError(null);
    try {
      const body = {
        id,
        displayName: displayName.trim() || profile.displayName,
        username: username.trim() || profile.username,
        role,
      };
      if (password.trim()) body.password = password.trim();
      const res = await apiFetch("/api/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not update profile");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
      render();
    }
  }

  async function onDeleteProfile(id) {
    if (!window.confirm("Remove this login profile?")) return;
    setError(null);
    try {
      const res = await apiFetch("/api/profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not remove profile");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove profile");
      render();
    }
  }

  document.getElementById("nav-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav]");
    if (!btn) return;
    const next = btn.dataset.nav;
    state.nav = next;
    if (state.nav !== "competitors") state.showAddForm = false;
    if (state.nav === "help") state.helpOption = "ticket";
    maybeNagOnNav();
    render();
    scrollPageToTop();
    if (state.nav === "pricing") void loadPricing().then(() => render());
    if (state.nav === "revenue") void loadRevenue().then(() => render());
  });

  document.getElementById("help-centre-btn")?.addEventListener("click", () => {
    state.nav = "help";
    state.helpOption = "ticket";
    render();
    scrollPageToTop();
  });

  document.getElementById("sidebar-upgrade-cta")?.addEventListener("click", () => {
    goToPricing();
  });

  document.getElementById("global-search")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = e.currentTarget.value.trim().toLowerCase();
    if (!q) return;
    const competitor = state.competitors.find(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.sitemapUrl || "").toLowerCase().includes(q),
    );
    if (competitor) {
      state.nav = "competitors";
      render();
      scrollPageToTop();
      return;
    }
    state.nav = "products";
    render();
    scrollPageToTop();
  });

  document.getElementById("btn-new-competitor")?.addEventListener("click", () => {
    if (!canAddCompetitor()) {
      promptPlanUpgrade(
        "Competitor limit reached on your plan. Upgrade to add more stores.",
      );
      goToPricing();
      return;
    }
    state.nav = "competitors";
    state.showAddForm = true;
    render();
    requestAnimationFrame(() => {
      document.getElementById("add-competitor-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      document.querySelector("#add-form input[name='name']")?.focus();
    });
  });

  document.getElementById("btn-scrape-all")?.addEventListener("click", () => {
    void onScrapeNow();
  });

  function setProfileMenuOpen(open) {
    const trigger = document.getElementById("profile-menu-trigger");
    const dropdown = document.getElementById("profile-menu-dropdown");
    if (!trigger || !dropdown) return;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    dropdown.hidden = !open;
  }

  document.getElementById("profile-menu-trigger")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const trigger = document.getElementById("profile-menu-trigger");
    const open = trigger?.getAttribute("aria-expanded") === "true";
    setProfileMenuOpen(!open);
  });

  document.getElementById("profile-menu-dropdown")?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-profile-nav]");
    if (!item) return;
    const nav = item.getAttribute("data-profile-nav");
    setProfileMenuOpen(false);
    if (nav === "settings") {
      state.nav = "settings";
      render();
      scrollPageToTop();
      return;
    }
    if (nav === "revenue") {
      if (!isSuperAdmin()) return;
      state.nav = "revenue";
      void loadRevenue().then(() => {
        render();
        scrollPageToTop();
      });
      return;
    }
    if (nav === "pricing") {
      goToPricing();
    }
  });

  document.addEventListener("click", (e) => {
    const menu = document.getElementById("profile-menu");
    if (!menu || menu.contains(e.target)) return;
    setProfileMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setProfileMenuOpen(false);
  });

  try {
    state.bannerSnoozed = isUpgradeSnoozed();
  } catch {
    /* ignore */
  }

  // Re-surface upgrade reminders for Basic users every 12 minutes.
  setInterval(() => {
    if (!isBasicPlan()) return;
    if (isUpgradeSnoozed()) return;
    showUpgradeToast(
      "Reminder: you're still on Basic. Upgrade for more competitor slots and automation.",
    );
    renderUpgradeNag();
    if (state.nav === "dashboard") renderBanner();
  }, 12 * 60 * 1000);

  render();
  void load();
})();
