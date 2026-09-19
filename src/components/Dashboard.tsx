"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Competitor,
  IntervalHours,
  MonitorSettings,
  Product,
  ScrapeRun,
} from "@/lib/types";
import {
  INTERVAL_OPTIONS,
  intervalLabel,
  intervalShortLabel,
} from "@/lib/types";
import AppSidebar, { type NavKey } from "@/components/AppSidebar";
import { pricingBanner } from "@/lib/pricingBanner";

type PeriodKey = "7" | "30" | "90" | "custom";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Unauthorized");
  }
  return res;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty response from server"
        : `Request failed (${res.status}) with empty body`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid JSON from server"
        : text.slice(0, 180) || `Request failed (${res.status})`,
    );
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildTrendPoints(runs: ScrapeRun[], days = 7) {
  const today = new Date();
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }

  const found = new Map(keys.map((k) => [k, 0]));
  const neu = new Map(keys.map((k) => [k, 0]));
  for (const run of runs) {
    const k = dayKey(run.startedAt);
    if (!found.has(k)) continue;
    found.set(k, (found.get(k) ?? 0) + run.urlsFound);
    neu.set(k, (neu.get(k) ?? 0) + run.newCount);
  }

  return keys.map((k) => ({
    key: k,
    label: new Date(`${k}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    urls: found.get(k) ?? 0,
    neu: neu.get(k) ?? 0,
  }));
}

function TrendChart({
  points,
}: {
  points: Array<{ label: string; urls: number; neu: number }>;
}) {
  const width = 560;
  const height = 220;
  const padX = 28;
  const padY = 18;
  const maxY = Math.max(8, ...points.flatMap((p) => [p.urls, p.neu]));
  const stepX =
    points.length <= 1 ? 0 : (width - padX * 2) / (points.length - 1);

  const toX = (i: number) => padX + i * stepX;
  const toY = (v: number) =>
    height - padY - (v / maxY) * (height - padY * 2);

  const area = (values: number[]) => {
    if (values.length === 0) return "";
    const line = values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`)
      .join(" ");
    return `${line} L ${toX(values.length - 1)} ${height - padY} L ${toX(0)} ${height - padY} Z`;
  };

  const line = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`)
      .join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY * t));

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B59FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2B59FF" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="newFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <g className="trend-grid">
        {ticks.map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={toY(t)}
            y2={toY(t)}
          />
        ))}
      </g>
      <path d={area(points.map((p) => p.urls))} fill="url(#trendFill)" />
      <path d={area(points.map((p) => p.neu))} fill="url(#newFill)" />
      <path
        d={line(points.map((p) => p.urls))}
        fill="none"
        stroke="#2B59FF"
        strokeWidth="2.5"
      />
      <path
        d={line(points.map((p) => p.neu))}
        fill="none"
        stroke="#34d399"
        strokeWidth="2.5"
      />
      {points.map((p, i) => (
        <text
          key={p.label}
          x={toX(i)}
          y={height - 2}
          textAnchor="middle"
          fontSize="12"
          fill="#475569"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect
            x="4"
            y="6"
            width="16"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
      <p className="empty-state-title">{title}</p>
      <p className="empty">{children}</p>
    </div>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

function ProductSkeletons() {
  return (
    <div className="card-grid" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="product-card skeleton-card">
          <div className="skeleton skeleton-chip" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-btn" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [period, setPeriod] = useState<PeriodKey>("7");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [filterCompetitorId, setFilterCompetitorId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [intervalHours, setIntervalHours] = useState<IntervalHours>(5);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [dailyCronEnabled, setDailyCronEnabled] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (!pricingBanner.enabled || pricingBanner.dismissible === false) return;
    const key = pricingBanner.storageKey ?? "cm-pricing-banner-dismissed";
    try {
      if (window.localStorage.getItem(key) === "1") {
        setBannerDismissed(true);
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const showPricingBanner =
    nav === "dashboard" &&
    pricingBanner.enabled &&
    !bannerDismissed;

  function dismissPricingBanner() {
    setBannerDismissed(true);
    if (pricingBanner.dismissible === false) return;
    const key = pricingBanner.storageKey ?? "cm-pricing-banner-dismissed";
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* ignore storage errors */
    }
  }

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cRes, pRes] = await Promise.all([
        apiFetch("/api/competitors"),
        apiFetch(
          `/api/products?newOnly=1${
            filterCompetitorId !== "all"
              ? `&competitorId=${filterCompetitorId}`
              : ""
          }`,
        ),
      ]);
      if (!cRes.ok || !pRes.ok) throw new Error("Failed to load dashboard data");
      const cJson = await readJson<{
        competitors?: Competitor[];
        settings?: MonitorSettings;
      }>(cRes);
      const pJson = await readJson<{ products?: Product[]; runs?: ScrapeRun[] }>(
        pRes,
      );
      setCompetitors(cJson.competitors ?? []);
      setProducts(pJson.products ?? []);
      setRuns(pJson.runs ?? []);
      if (cJson.settings) {
        setDailyCronEnabled(cJson.settings.dailyCronEnabled !== false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [filterCompetitorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCompetitors = useMemo(
    () => competitors.filter((c) => c.enabled).length,
    [competitors],
  );

  const successRuns = useMemo(
    () => runs.filter((r) => r.status === "success" || r.status === "baseline")
      .length,
    [runs],
  );

  const errorRuns = useMemo(
    () => runs.filter((r) => r.status === "error").length,
    [runs],
  );

  const urlsFoundTotal = useMemo(
    () => runs.reduce((sum, r) => sum + r.urlsFound, 0),
    [runs],
  );

  const newCountTotal = useMemo(
    () => runs.reduce((sum, r) => sum + r.newCount, 0),
    [runs],
  );

  const successRate = useMemo(() => {
    if (runs.length === 0) return 0;
    return Math.round((successRuns / runs.length) * 1000) / 10;
  }, [runs.length, successRuns]);

  const trendPoints = useMemo(
    () => buildTrendPoints(runs, period === "7" ? 7 : period === "30" ? 14 : 14),
    [runs, period],
  );

  const lastActivity = useMemo(() => {
    const stamps = competitors
      .map((c) => c.lastScrapedAt)
      .filter(Boolean) as string[];
    if (stamps.length === 0) return null;
    return stamps.sort().at(-1) ?? null;
  }, [competitors]);

  async function onAddCompetitor(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sitemapUrl, intervalHours }),
      });
      const json = await readJson<{ competitor?: Competitor; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(json.error || "Could not add competitor");
      if (!json.competitor) throw new Error("Server did not return competitor");

      const created = json.competitor;
      setCompetitors((prev) => {
        const withoutDup = prev.filter((c) => c.id !== created.id);
        return [created, ...withoutDup];
      });
      setName("");
      setSitemapUrl("");
      setIntervalHours(5);
      setNav("competitors");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onIntervalChange(id: string, value: IntervalHours) {
    const res = await apiFetch("/api/competitors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, intervalHours: value }),
    });
    if (!res.ok) {
      setError("Could not update interval");
      return;
    }
    await load();
  }

  async function onDailyCronToggle() {
    const next = !dailyCronEnabled;
    setDailyCronEnabled(next);
    setSavingSchedule(true);
    setError(null);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyCronEnabled: next }),
      });
      const json = await readJson<{
        settings?: MonitorSettings;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error || "Could not update schedule");
      if (typeof json.settings?.dailyCronEnabled === "boolean") {
        setDailyCronEnabled(json.settings.dailyCronEnabled);
      }
    } catch (err) {
      setDailyCronEnabled(!next);
      setError(
        err instanceof Error ? err.message : "Could not update schedule",
      );
    } finally {
      setSavingSchedule(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Remove this competitor and its products?")) return;
    setError(null);
    try {
      const res = await apiFetch(
        `/api/competitors?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const json = await readJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok) {
        throw new Error(json.error || "Could not delete competitor");
      }
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      setProducts((prev) => prev.filter((p) => p.competitorId !== id));
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete competitor",
      );
    }
  }

  async function onScrapeNow(competitorId?: string) {
    setScraping(true);
    setError(null);
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
      setScraping(false);
    }
  }

  async function markSeen(id: string) {
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
          filterCompetitorId === "all" ? undefined : filterCompetitorId,
      }),
    });
    await load();
  }

  const titles: Record<NavKey, { title: string; subtitle: string }> = {
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

  const competitorForm = (
    <form className="add-form" onSubmit={onAddCompetitor}>
      <label>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Store"
          required
        />
      </label>
      <label>
        Store or sitemap URL
        <input
          value={sitemapUrl}
          onChange={(e) => setSitemapUrl(e.target.value)}
          placeholder="https://example.com or /sitemap.xml"
          required
        />
      </label>
      <label>
        Interval
        <select
          value={intervalHours}
          onChange={(e) =>
            setIntervalHours(Number(e.target.value) as IntervalHours)
          }
        >
          {INTERVAL_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {intervalLabel(h)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn primary" disabled={saving}>
        {saving ? "Adding…" : "Add & baseline"}
      </button>
    </form>
  );

  const competitorList = (
    <div className="competitor-list">
      {loading ? (
        <SkeletonRows count={3} />
      ) : competitors.length === 0 ? (
        <EmptyState title="No competitors yet">
          Add a store URL to start monitoring sitemaps and new product launches.
        </EmptyState>
      ) : (
        competitors.map((c) => (
          <article key={c.id} className="competitor-banner">
            <div className="competitor-banner-left">
              <span className="competitor-avatar" aria-hidden>
                {c.name.trim().charAt(0).toUpperCase() || "C"}
              </span>
              <div>
                <div className="competitor-title-row">
                  <strong>{c.name}</strong>
                  <span className="status-pill">ACTIVE</span>
                </div>
                <p className="url-line">{hostFromUrl(c.sitemapUrl)}</p>
                <p className="muted">
                  Created {formatWhen(c.createdAt)} · Next{" "}
                  {formatWhen(c.nextScrapeAt)}
                </p>
              </div>
            </div>
            <div className="competitor-actions">
              <select
                aria-label={`Interval for ${c.name}`}
                value={c.intervalHours}
                onChange={(e) =>
                  void onIntervalChange(
                    c.id,
                    Number(e.target.value) as IntervalHours,
                  )
                }
              >
                {INTERVAL_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {intervalShortLabel(h)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn ghost"
                onClick={() => void onScrapeNow(c.id)}
                disabled={scraping}
              >
                Scrape
              </button>
              <button
                type="button"
                className="btn danger-outline"
                onClick={() => void onDelete(c.id)}
              >
                Remove
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );

  const productFeed = (
    <>
      <div className="panel-head">
        <div>
          <h2 className="section-title">New product cards</h2>
          <p className="panel-sub">Last scrape {formatWhen(lastActivity)}</p>
        </div>
        <div className="feed-controls">
          <select
            value={filterCompetitorId}
            onChange={(e) => setFilterCompetitorId(e.target.value)}
          >
            <option value="all">All competitors</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn ghost"
            disabled={products.length === 0}
            onClick={() => void markAllSeen()}
          >
            Mark all seen
          </button>
        </div>
      </div>

      {loading ? (
        <ProductSkeletons />
      ) : products.length === 0 ? (
        <EmptyState title="No new products yet">
          After the first baseline scrape, newly appearing sitemap URLs will
          show up here.
        </EmptyState>
      ) : (
        <div className="card-grid">
          {products.map((product) => (
            <article key={product.id} className="product-card">
              <div className="card-top">
                <span className="badge">{product.competitorName}</span>
                <time dateTime={product.firstSeenAt}>
                  {formatWhen(product.firstSeenAt)}
                </time>
              </div>
              <h3>{product.title}</h3>
              <p className="url-line">{hostFromUrl(product.url)}</p>
              <div className="card-actions">
                <a
                  href={product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn primary"
                >
                  Open product
                </a>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void markSeen(product.id)}
                >
                  Mark seen
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );

  const runsList = (
    <div className="runs plain">
      {loading ? (
        <SkeletonRows count={4} />
      ) : runs.length === 0 ? (
        <EmptyState title="No scrape runs yet">
          Runs will appear here after the first competitor scrape.
        </EmptyState>
      ) : (
        <ul>
          {runs.slice(0, 20).map((run) => (
            <li key={run.id} className="run-row">
              <span className={`status status-${run.status}`}>{run.status}</span>
              <span>
                {run.newCount} new / {run.urlsFound} urls ·{" "}
                {formatWhen(run.startedAt)}
              </span>
              {run.error ? (
                <span className="muted"> — {run.error}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppSidebar active={nav} onNavigate={setNav} />

      <main id="main-content" className="main-pane" aria-busy={loading}>
        <div className="page-header">
          <div>
            <h1>{titles[nav].title}</h1>
            <p>{titles[nav].subtitle}</p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => setNav("competitors")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            New Competitor
          </button>
        </div>

        {showPricingBanner ? (
          <aside className="pricing-banner" aria-label="Pricing offer">
            <div className="pricing-banner-copy">
              {pricingBanner.badge ? (
                <span className="pricing-banner-badge">
                  {pricingBanner.badge}
                </span>
              ) : null}
              <p className="pricing-banner-title">{pricingBanner.title}</p>
              <p className="pricing-banner-subtitle">
                {pricingBanner.subtitle}
              </p>
            </div>
            <div className="pricing-banner-actions">
              <span className="pricing-banner-price">
                {pricingBanner.priceLabel}
              </span>
              <a href={pricingBanner.ctaHref} className="btn primary">
                {pricingBanner.ctaText}
              </a>
              {pricingBanner.dismissible !== false ? (
                <button
                  type="button"
                  className="pricing-banner-dismiss"
                  aria-label="Dismiss pricing banner"
                  onClick={dismissPricingBanner}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}

        {nav === "dashboard" ? (
          <>
            <div className="period-tabs" role="tablist" aria-label="Period">
              {(
                [
                  ["7", "Last 7 days"],
                  ["30", "Last 30 days"],
                  ["90", "Last 90 days"],
                  ["custom", "Custom"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`period-tab${period === key ? " active" : ""}`}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <section className="stat-grid">
              <article className="stat-card">
                <div className="stat-icon purple" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 19h16M7 16V8m5 8V5m5 11v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="stat-label">Total Competitors</p>
                <p className="stat-value">
                  {loading ? <span className="skeleton skeleton-stat" /> : competitors.length}
                </p>
                <span className="stat-trend flat">Tracked stores</span>
              </article>
              <article className="stat-card">
                <div className="stat-icon green" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="stat-label">Active Competitors</p>
                <p className="stat-value">
                  {loading ? <span className="skeleton skeleton-stat" /> : activeCompetitors}
                </p>
                <span className="stat-trend up">Enabled monitors</span>
              </article>
              <article className="stat-card">
                <div className="stat-icon blue" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16v12H4V7Zm2-3h12l2 3H4l2-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="stat-label">New Products</p>
                <p className="stat-value">
                  {loading ? <span className="skeleton skeleton-stat" /> : products.length}
                </p>
                <span className="stat-trend flat">Unseen cards</span>
              </article>
              <article className="stat-card">
                <div className="stat-icon orange" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="stat-label">Scrape Success</p>
                <p className="stat-value">
                  {loading ? <span className="skeleton skeleton-stat" /> : `${successRate}%`}
                </p>
                <span className={`stat-trend ${errorRuns > 0 ? "down" : "up"}`}>
                  {successRuns}/{runs.length || 0} recent runs
                </span>
              </article>
              <article className="stat-card">
                <div className="stat-icon indigo" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="stat-label">URLs Found</p>
                <p className="stat-value">
                  {loading ? (
                    <span className="skeleton skeleton-stat" />
                  ) : (
                    urlsFoundTotal.toLocaleString()
                  )}
                </p>
                <span className="stat-trend flat">
                  {newCountTotal} newly detected
                </span>
              </article>
            </section>

            <section className="charts-row">
              <article className="panel-card">
                <h2>Success vs Errors</h2>
                <p className="panel-sub">Scrape delivery breakdown</p>
                <div className="donut-wrap">
                  <div
                    className="donut"
                    style={
                      {
                        "--donut-success": `${successRate}%`,
                      } as React.CSSProperties
                    }
                  >
                    <div className="donut-hole">
                      <strong>{successRate}%</strong>
                      <span>Success Rate</span>
                    </div>
                  </div>
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="dot purple" /> Success ({successRate}%)
                  </span>
                  <span>
                    <i className="dot gray" /> Errors (
                    {Math.max(0, Math.round((100 - successRate) * 10) / 10)}%)
                  </span>
                </div>
              </article>

              <article className="panel-card">
                <div className="panel-head">
                  <div>
                    <h2>Discovery Trend</h2>
                    <p className="panel-sub">URLs found vs newly detected</p>
                  </div>
                  <div className="chart-legend compact">
                    <span>
                      <i className="dot purple" /> Found
                    </span>
                    <span>
                      <i className="dot green" /> New
                    </span>
                  </div>
                </div>
                <TrendChart points={trendPoints} />
              </article>
            </section>

            <section className="panel-card funnel-panel">
              <p className="eyebrow-section">Conversion Funnel</p>
              <h2>Discovery funnel</h2>
              <p className="panel-sub">From scrape volume to new product cards</p>
              <div className="funnel">
                <div className="funnel-step s1">
                  <span>URLs Found</span>
                  <strong>{urlsFoundTotal.toLocaleString()}</strong>
                </div>
                <div className="funnel-step s2">
                  <span>Successful Runs</span>
                  <strong>{successRuns}</strong>
                </div>
                <div className="funnel-step s3">
                  <span>Newly Detected</span>
                  <strong>{newCountTotal}</strong>
                </div>
                <div className="funnel-step s4">
                  <span>Unseen Cards</span>
                  <strong>{products.length}</strong>
                </div>
              </div>
            </section>

            <div className="content-grid">
              <section className="panel-card">
                <div className="panel-head">
                  <h2 className="section-title">Competitors</h2>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={scraping || competitors.length === 0}
                    onClick={() => void onScrapeNow()}
                  >
                    {scraping ? "Scraping…" : "Scrape all"}
                  </button>
                </div>
                {error ? <p className="error">{error}</p> : null}
                {competitorList}
              </section>
              <section className="panel-card">{productFeed}</section>
            </div>
          </>
        ) : null}

        {nav === "competitors" ? (
          <div className="stack">
            <section className="panel-card">
              <div className="panel-head">
                <div>
                  <h2 className="section-title">Add competitor</h2>
                  <p className="panel-sub">Baselines on first scrape · sitemap only</p>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={scraping || competitors.length === 0}
                  onClick={() => void onScrapeNow()}
                >
                  {scraping ? "Scraping…" : "Scrape all now"}
                </button>
              </div>
              {competitorForm}
              {error ? <p className="error">{error}</p> : null}
            </section>

            {competitors.length > 0 ? (
              <>
                <section className="panel-card">
                  <div className="panel-head">
                    <div>
                      <h2 className="section-title analytics-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M4 19h16M7 16V8m5 8V5m5 11v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        Monitor Analytics
                      </h2>
                      <p className="panel-sub">
                        {competitors.length} stores · last scrape{" "}
                        {formatWhen(lastActivity)}
                      </p>
                    </div>
                    <span className="period-chip">Last {period === "custom" ? "7" : period} days</span>
                  </div>
                  <div className="stat-grid four">
                    <article className="stat-card compact">
                      <div className="stat-icon blue" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M4 7h16v12H4V7Zm2-3h12l2 3H4l2-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="stat-label">URLs Found</p>
                      <p className="stat-value">
                        {loading ? (
                          <span className="skeleton skeleton-stat" />
                        ) : (
                          urlsFoundTotal.toLocaleString()
                        )}
                      </p>
                    </article>
                    <article className="stat-card compact">
                      <div className="stat-icon green" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" />
                          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      </div>
                      <p className="stat-label">Success Rate</p>
                      <p className="stat-value">
                        {loading ? <span className="skeleton skeleton-stat" /> : `${successRate}%`}
                      </p>
                    </article>
                    <article className="stat-card compact">
                      <div className="stat-icon purple" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M8 10h8M8 14h5M6 4h12l1 4H5l1-4Zm0 4h12v12H6V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="stat-label">Newly Detected</p>
                      <p className="stat-value">
                        {loading ? <span className="skeleton skeleton-stat" /> : newCountTotal}
                      </p>
                    </article>
                    <article className="stat-card compact">
                      <div className="stat-icon orange" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M12 9v4m0 4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="stat-label">Error Runs</p>
                      <p className="stat-value">
                        {loading ? <span className="skeleton skeleton-stat" /> : errorRuns}
                      </p>
                    </article>
                  </div>
                </section>

                <section className="panel-card funnel-panel">
                  <p className="eyebrow-section">Conversion Funnel</p>
                  <div className="funnel">
                    <div className="funnel-step s1">
                      <span>Found</span>
                      <strong>{urlsFoundTotal.toLocaleString()}</strong>
                    </div>
                    <div className="funnel-step s2">
                      <span>Success</span>
                      <strong>{successRuns}</strong>
                    </div>
                    <div className="funnel-step s3">
                      <span>Detected</span>
                      <strong>{newCountTotal}</strong>
                    </div>
                    <div className="funnel-step s4">
                      <span>Unseen</span>
                      <strong>{products.length}</strong>
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            <section className="panel-card">
              <h2 className="section-title">Monitored stores</h2>
              <p className="panel-sub">
                {competitors.length} competitors · pause/remove anytime
              </p>
              {competitorList}
            </section>
          </div>
        ) : null}

        {nav === "products" ? (
          <section className="panel-card">{productFeed}</section>
        ) : null}

        {nav === "runs" ? (
          <section className="panel-card">
            <h2 className="section-title">Recent runs</h2>
            <p className="panel-sub">Latest scrape outcomes</p>
            {runsList}
          </section>
        ) : null}

        {nav === "settings" ? (
          <section className="panel-card">
            <h2 className="section-title">Workspace</h2>
            <p className="panel-sub">
              Scrapes run when you click Scrape, when a store is first added
              (baseline), and — if enabled below — once daily at 9:00 AM
              Pakistan time. The dashboard does not poll or scrape while it is
              open.
            </p>
            {error ? <p className="error">{error}</p> : null}
            <div className="competitor-list">
              <article className="competitor-row">
                <div>
                  <strong>Daily 9am scrape</strong>
                  <p className="muted">
                    09:00 Asia/Karachi via cron. Turn this off to skip the
                    scheduled run; manual scrape still works.
                  </p>
                </div>
                <div className="schedule-controls">
                  <span
                    className={`status-pill${dailyCronEnabled ? "" : " paused"}`}
                  >
                    {dailyCronEnabled ? "ON" : "OFF"}
                  </span>
                  <button
                    type="button"
                    className={`switch${dailyCronEnabled ? " on" : ""}`}
                    role="switch"
                    aria-checked={dailyCronEnabled}
                    aria-label="Daily 9am scrape schedule"
                    disabled={savingSchedule}
                    onClick={() => void onDailyCronToggle()}
                  />
                </div>
              </article>
              <article className="competitor-row">
                <div>
                  <strong>Session auth</strong>
                  <p className="muted">
                    Sign out from the sidebar profile row when finished.
                  </p>
                </div>
              </article>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
