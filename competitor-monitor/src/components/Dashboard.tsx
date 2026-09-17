"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Competitor, IntervalHours, Product, ScrapeRun } from "@/lib/types";
import {
  INTERVAL_OPTIONS,
  intervalLabel,
  intervalShortLabel,
} from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";

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

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
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

export default function Dashboard() {
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
  const [intervalHours, setIntervalHours] = useState<IntervalHours>(3);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Explicitly run due scrapes, then refresh data.
      await apiFetch("/api/tick", { method: "POST" }).catch(() => null);

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
      const cJson = await readJson<{ competitors?: Competitor[] }>(cRes);
      const pJson = await readJson<{ products?: Product[]; runs?: ScrapeRun[] }>(
        pRes,
      );
      setCompetitors(cJson.competitors ?? []);
      setProducts(pJson.products ?? []);
      setRuns(pJson.runs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [filterCompetitorId]);

  const pollMs = useMemo(() => {
    const now = Date.now();
    const dueOrSoon = competitors.some((c) => {
      if (!c.enabled || !c.nextScrapeAt) return false;
      return new Date(c.nextScrapeAt).getTime() <= now + 60_000;
    });
    // Poll faster around / after Next time so auto-scrape actually fires.
    return dueOrSoon ? 15_000 : 30_000;
  }, [competitors]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

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
      setIntervalHours(3);
      // Give baseline scrape a moment, then refresh.
      window.setTimeout(() => void load(), 2500);
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

  async function onDelete(id: string) {
    if (!window.confirm("Remove this competitor and its products?")) return;
    setError(null);
    try {
      const res = await apiFetch(`/api/competitors?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await readJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok) {
        throw new Error(json.error || "Could not delete competitor");
      }
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      setProducts((prev) => prev.filter((p) => p.competitorId !== id));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete competitor");
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

  return (
    <div className="page-shell">
      <header className="hero-band">
        <div className="hero-inner">
          <p className="eyebrow">Always-on monitor</p>
          <h1>Competitor Monitor</h1>
          <p className="lede">
            Add store sitemap URLs. Auto-scrape runs when <em>Next</em> is due
            while this dashboard is open, plus a full scrape every day at{" "}
            <strong>9:00 AM</strong> (Pakistan time).
          </p>
          <div className="hero-meta-row">
            <div className="hero-meta">
              <span>{competitors.length} competitors</span>
              <span>{products.length} new products</span>
              <span>Last scrape {formatWhen(lastActivity)}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Add competitor</h2>
            <button
              type="button"
              className="btn ghost"
              disabled={scraping || competitors.length === 0}
              onClick={() => void onScrapeNow()}
            >
              {scraping ? "Scraping…" : "Scrape all now"}
            </button>
          </div>

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

          {error ? <p className="error">{error}</p> : null}

          <div className="competitor-list">
            {competitors.length === 0 ? (
              <p className="empty">
                No competitors yet. Add a store URL to start monitoring.
              </p>
            ) : (
              competitors.map((c) => (
                <article key={c.id} className="competitor-row">
                  <div>
                    <strong>{c.name}</strong>
                    <p>{hostFromUrl(c.sitemapUrl)}</p>
                    <p className="muted">
                      Next: {formatWhen(c.nextScrapeAt)} · Last:{" "}
                      {formatWhen(c.lastScrapedAt)}
                    </p>
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
                      className="btn danger"
                      onClick={() => void onDelete(c.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {runs.length > 0 ? (
            <div className="runs">
              <h3>Recent runs</h3>
              <ul>
                {runs.slice(0, 6).map((run) => (
                  <li key={run.id}>
                    <span className={`status status-${run.status}`}>
                      {run.status}
                    </span>
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
            </div>
          ) : null}
        </section>

        <section className="panel feed">
          <div className="panel-head">
            <h2>New product cards</h2>
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
            <p className="empty">Loading…</p>
          ) : products.length === 0 ? (
            <p className="empty">
              No new products yet. After the first baseline scrape, newly
              appearing sitemap URLs will show up here.
            </p>
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
        </section>
      </main>
    </div>
  );
}
