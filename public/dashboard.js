(() => {
  const state = {
    nav: "dashboard",
    competitors: [],
    products: [],
    runs: [],
    settings: { dailyCronEnabled: true },
    filterCompetitorId: "all",
    loading: true,
    saving: false,
    scraping: false,
    savingSchedule: false,
    error: null,
    bannerDismissed: false,
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
      subtitle: "Fresh sitemap URLs detected after baseline scrapes.",
    },
    runs: {
      title: "Scrape Runs",
      subtitle: "Recent scrape activity across all competitors.",
    },
    settings: {
      title: "Settings",
      subtitle: "Workspace preferences for this monitor.",
    },
  };

  const root = document.getElementById("view-root");
  const titleEl = document.getElementById("page-title");
  const subtitleEl = document.getElementById("page-subtitle");
  const errorEl = document.getElementById("global-error");
  const bannerRoot = document.getElementById("pricing-banner-root");
  const cfg = window.__CM__ || { pricingBanner: { enabled: false }, intervalOptions: [5, 8, 12, 16, 18, 20] };

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

  function intervalOptionsHtml(selected) {
    return (cfg.intervalOptions || [5, 8, 12, 16, 18, 20])
      .map(
        (h) =>
          `<option value="${h}" ${Number(selected) === h ? "selected" : ""}>Every ${h} hours</option>`,
      )
      .join("");
  }

  function competitorListHtml() {
    if (state.loading) {
      return `<div class="skeleton-stack" aria-hidden><div class="skeleton-row"></div><div class="skeleton-row"></div></div>`;
    }
    if (!state.competitors.length) {
      return emptyState(
        "No competitors yet",
        "Add a store URL to start monitoring sitemaps and new product launches.",
      );
    }
    return `
      <div class="competitor-list">
        ${state.competitors
          .map((c) => {
            const initial = (c.name.trim().charAt(0) || "C").toUpperCase();
            return `
              <article class="competitor-banner" data-id="${escapeHtml(c.id)}">
                <div class="competitor-banner-left">
                  <span class="competitor-avatar" aria-hidden>${escapeHtml(initial)}</span>
                  <div>
                    <div class="competitor-title-row">
                      <strong>${escapeHtml(c.name)}</strong>
                      <span class="status-pill">ACTIVE</span>
                    </div>
                    <p class="url-line">${escapeHtml(hostFromUrl(c.sitemapUrl))}</p>
                    <p class="muted">Created ${escapeHtml(formatWhen(c.createdAt))} · Next ${escapeHtml(formatWhen(c.nextScrapeAt))}</p>
                  </div>
                </div>
                <div class="competitor-actions">
                  <select data-action="interval" aria-label="Interval for ${escapeHtml(c.name)}">
                    ${intervalOptionsHtml(c.intervalHours)}
                  </select>
                  <button type="button" class="btn ghost" data-action="scrape" ${state.scraping ? "disabled" : ""}>Scrape</button>
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

    let body = "";
    if (state.loading) {
      body = `<div class="card-grid" aria-hidden>
        <div class="product-card skeleton-card"><div class="skeleton skeleton-chip"></div><div class="skeleton skeleton-title"></div></div>
        <div class="product-card skeleton-card"><div class="skeleton skeleton-chip"></div><div class="skeleton skeleton-title"></div></div>
      </div>`;
    } else if (!state.products.length) {
      body = emptyState(
        "No new products yet",
        "After the first baseline scrape, newly appearing sitemap URLs will show up here.",
      );
    } else {
      body = `
        <div class="card-grid">
          ${state.products
            .map(
              (p) => `
            <article class="product-card" data-id="${escapeHtml(p.id)}">
              <div class="card-top">
                <span class="badge">${escapeHtml(p.competitorName)}</span>
                <time>${escapeHtml(formatWhen(p.firstSeenAt))}</time>
              </div>
              <h3>${escapeHtml(p.title)}</h3>
              <p class="url-line">${escapeHtml(hostFromUrl(p.url))}</p>
              <div class="card-actions">
                <a class="btn primary" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">Open product</a>
                <button type="button" class="btn ghost" data-action="seen">Mark seen</button>
              </div>
            </article>
          `,
            )
            .join("")}
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
          <button type="button" class="btn ghost" id="mark-all-seen" ${
            state.products.length ? "" : "disabled"
          }>Mark all seen</button>
        </div>
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

  function renderDashboard() {
    const s = stats();
    return `
      <section class="stat-grid">
        <article class="stat-card"><p class="stat-label">Total Competitors</p><p class="stat-value">${state.competitors.length}</p><span class="stat-trend flat">Tracked stores</span></article>
        <article class="stat-card"><p class="stat-label">Active Competitors</p><p class="stat-value">${s.active}</p><span class="stat-trend up">Enabled monitors</span></article>
        <article class="stat-card"><p class="stat-label">New Products</p><p class="stat-value">${state.products.length}</p><span class="stat-trend flat">Unseen cards</span></article>
        <article class="stat-card"><p class="stat-label">Scrape Success</p><p class="stat-value">${s.successRate}%</p><span class="stat-trend ${s.errorRuns ? "down" : "up"}">${s.successRuns}/${state.runs.length || 0} recent runs</span></article>
        <article class="stat-card"><p class="stat-label">URLs Found</p><p class="stat-value">${s.urlsFoundTotal.toLocaleString()}</p><span class="stat-trend flat">${s.newCountTotal} newly detected</span></article>
      </section>
      <div class="content-grid">
        <section class="panel-card">
          <div class="panel-head">
            <h2 class="section-title">Competitors</h2>
            <button type="button" class="btn ghost" id="scrape-all" ${
              state.scraping || !state.competitors.length ? "disabled" : ""
            }>${state.scraping ? "Scraping…" : "Scrape all"}</button>
          </div>
          ${competitorListHtml()}
        </section>
        <section class="panel-card">${productFeedHtml()}</section>
      </div>
    `;
  }

  function renderCompetitors() {
    return `
      <div class="stack">
        <section class="panel-card">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Add competitor</h2>
              <p class="panel-sub">Baselines on first scrape · sitemap only</p>
            </div>
            <button type="button" class="btn ghost" id="scrape-all" ${
              state.scraping || !state.competitors.length ? "disabled" : ""
            }>${state.scraping ? "Scraping…" : "Scrape all now"}</button>
          </div>
          <form class="add-form" id="add-form">
            <label>Name<input name="name" value="${escapeHtml(state.form.name)}" placeholder="Acme Store" required /></label>
            <label>Store or sitemap URL<input name="sitemapUrl" value="${escapeHtml(state.form.sitemapUrl)}" placeholder="https://example.com or /sitemap.xml" required /></label>
            <label>Interval<select name="intervalHours">${intervalOptionsHtml(state.form.intervalHours)}</select></label>
            <button type="submit" class="btn primary" ${state.saving ? "disabled" : ""}>${
              state.saving ? "Adding…" : "Add & baseline"
            }</button>
          </form>
        </section>
        <section class="panel-card">
          <h2 class="section-title">Monitored stores</h2>
          <p class="panel-sub">${state.competitors.length} competitors · pause/remove anytime</p>
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
    return `
      <section class="panel-card">
        <h2 class="section-title">Workspace</h2>
        <p class="panel-sub">
          Scrapes run when you click Scrape, when a store is first added (baseline),
          and — if enabled below — once daily at 9:00 AM Pakistan time. The dashboard
          does not poll or scrape while it is open.
        </p>
        <div class="competitor-list">
          <article class="competitor-row">
            <div>
              <strong>Daily 9am scrape</strong>
              <p class="muted">09:00 Asia/Karachi via Hostinger cron hitting /api/cron. Manual scrape still works when off.</p>
            </div>
            <div class="schedule-controls">
              <span class="status-pill${on ? "" : " paused"}">${on ? "ON" : "OFF"}</span>
              <button type="button" class="switch${on ? " on" : ""}" role="switch" aria-checked="${on}" id="daily-cron-toggle" ${
                state.savingSchedule ? "disabled" : ""
              }></button>
            </div>
          </article>
          <article class="competitor-row">
            <div>
              <strong>Session auth</strong>
              <p class="muted">Sign out from the sidebar profile row when finished.</p>
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderBanner() {
    const banner = cfg.pricingBanner;
    if (
      state.nav !== "dashboard" ||
      !banner?.enabled ||
      state.bannerDismissed
    ) {
      bannerRoot.innerHTML = "";
      return;
    }
    bannerRoot.innerHTML = `
      <aside class="pricing-banner" aria-label="Pricing offer">
        <div class="pricing-banner-copy">
          ${banner.badge ? `<span class="pricing-banner-badge">${escapeHtml(banner.badge)}</span>` : ""}
          <p class="pricing-banner-title">${escapeHtml(banner.title)}</p>
          <p class="pricing-banner-subtitle">${escapeHtml(banner.subtitle)}</p>
        </div>
        <div class="pricing-banner-actions">
          <span class="pricing-banner-price">${escapeHtml(banner.priceLabel)}</span>
          <a href="${escapeHtml(banner.ctaHref)}" class="btn primary">${escapeHtml(banner.ctaText)}</a>
          ${
            banner.dismissible !== false
              ? `<button type="button" class="pricing-banner-dismiss" id="dismiss-banner" aria-label="Dismiss pricing banner">×</button>`
              : ""
          }
        </div>
      </aside>
    `;
  }

  function render() {
    const meta = titles[state.nav];
    titleEl.textContent = meta.title;
    subtitleEl.textContent = meta.subtitle;
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.nav === state.nav);
      btn.setAttribute(
        "aria-current",
        btn.dataset.nav === state.nav ? "page" : "false",
      );
    });
    renderBanner();
    root.setAttribute("aria-busy", state.loading ? "true" : "false");

    if (state.nav === "dashboard") root.innerHTML = renderDashboard();
    else if (state.nav === "competitors") root.innerHTML = renderCompetitors();
    else if (state.nav === "products") root.innerHTML = renderProducts();
    else if (state.nav === "runs") root.innerHTML = renderRuns();
    else root.innerHTML = renderSettings();

    bindViewEvents();
  }

  function bindViewEvents() {
    const scrapeAll = document.getElementById("scrape-all");
    if (scrapeAll) {
      scrapeAll.onclick = () => void onScrapeNow();
    }

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

    const filter = document.getElementById("filter-competitor");
    if (filter) {
      filter.onchange = () => {
        state.filterCompetitorId = filter.value;
        void load();
      };
    }

    const markAll = document.getElementById("mark-all-seen");
    if (markAll) {
      markAll.onclick = () => void markAllSeen();
    }

    const cronToggle = document.getElementById("daily-cron-toggle");
    if (cronToggle) {
      cronToggle.onclick = () => void onDailyCronToggle();
    }

    const dismiss = document.getElementById("dismiss-banner");
    if (dismiss) {
      dismiss.onclick = () => {
        state.bannerDismissed = true;
        const key = cfg.pricingBanner?.storageKey || "cm-pricing-banner-dismissed";
        try {
          localStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
        render();
      };
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
      card.querySelector('[data-action="seen"]')?.addEventListener("click", () =>
        void markSeen(id),
      );
    });
  }

  async function load() {
    setError(null);
    try {
      const [cRes, pRes] = await Promise.all([
        apiFetch("/api/competitors"),
        apiFetch(
          `/api/products?newOnly=1${
            state.filterCompetitorId !== "all"
              ? `&competitorId=${encodeURIComponent(state.filterCompetitorId)}`
              : ""
          }`,
        ),
      ]);
      if (!cRes.ok || !pRes.ok) throw new Error("Failed to load dashboard data");
      const cJson = await readJson(cRes);
      const pJson = await readJson(pRes);
      state.competitors = cJson.competitors || [];
      state.products = pJson.products || [];
      state.runs = pJson.runs || [];
      if (cJson.settings) {
        state.settings = {
          dailyCronEnabled: cJson.settings.dailyCronEnabled !== false,
        };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      state.loading = false;
      render();
    }
  }

  async function onAddCompetitor() {
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
      if (!res.ok) throw new Error(json.error || "Could not add competitor");
      state.form = { name: "", sitemapUrl: "", intervalHours: 5 };
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete competitor");
    }
  }

  async function onScrapeNow(competitorId) {
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
      if (!res.ok) throw new Error(json.error || "Scrape failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      state.scraping = false;
      render();
    }
  }

  async function markSeen(id) {
    await apiFetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function markAllSeen() {
    await apiFetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markAll: true,
        competitorId:
          state.filterCompetitorId === "all"
            ? undefined
            : state.filterCompetitorId,
      }),
    });
    await load();
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

  document.getElementById("nav-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav]");
    if (!btn) return;
    state.nav = btn.dataset.nav;
    render();
  });

  document.getElementById("btn-new-competitor")?.addEventListener("click", () => {
    state.nav = "competitors";
    render();
  });

  try {
    const key = cfg.pricingBanner?.storageKey || "cm-pricing-banner-dismissed";
    if (localStorage.getItem(key) === "1") state.bannerDismissed = true;
  } catch {
    /* ignore */
  }

  render();
  void load();
})();
