import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import type {
  Competitor,
  IntervalHours,
  MonitorSettings,
  Product,
  ScrapeRun,
} from "./types";
import {
  DEFAULT_SETTINGS,
  msUntilNextScrape,
  normalizeIntervalHours,
} from "./types";

type Store = {
  competitors: Competitor[];
  products: Array<Omit<Product, "competitorName">>;
  scrapeRuns: ScrapeRun[];
  settings: MonitorSettings;
};

type ProductRow = Omit<Product, "competitorName">;

const EMPTY_STORE: Store = {
  competitors: [],
  products: [],
  scrapeRuns: [],
  settings: { ...DEFAULT_SETTINGS },
};

function normalizeSettings(
  settings?: Partial<MonitorSettings> | null,
): MonitorSettings {
  return {
    dailyCronEnabled: settings?.dailyCronEnabled !== false,
  };
}

function normalizeStore(store: Store): Store {
  return {
    competitors: store.competitors ?? [],
    products: store.products ?? [],
    scrapeRuns: store.scrapeRuns ?? [],
    settings: normalizeSettings(store.settings),
  };
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const REDIS_KEY = "competitor-monitor:store";
const BLOB_PATHNAME = "monitor/store.json";

declare global {
  // eslint-disable-next-line no-var
  var __competitorMonitorStoreChain: Promise<unknown> | undefined;
}

function hasRedis(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function hasBlob(): boolean {
  if (!process.env.VERCEL && process.env.FORCE_BLOB_STORAGE !== "1") {
    return false;
  }
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
  );
}

function getRedis(): Redis {
  return Redis.fromEnv();
}

function assertDurableStorage(): void {
  if (process.env.VERCEL && !hasRedis() && !hasBlob()) {
    throw new Error(
      "Vercel deploy needs storage. Connect Vercel Blob or Upstash Redis to this project.",
    );
  }
}

async function readStoreUnlocked(): Promise<Store> {
  assertDurableStorage();

  if (hasRedis()) {
    const data = await getRedis().get<Store>(REDIS_KEY);
    return normalizeStore(data ?? structuredClone(EMPTY_STORE));
  }

  if (hasBlob()) {
    try {
      const result = await get(BLOB_PATHNAME, {
        access: "private",
        useCache: false,
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return structuredClone(EMPTY_STORE);
      }
      const text = await new Response(result.stream).text();
      if (!text.trim()) return structuredClone(EMPTY_STORE);
      return normalizeStore(JSON.parse(text) as Store);
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    if (!raw.trim()) return structuredClone(EMPTY_STORE);
    return normalizeStore(JSON.parse(raw) as Store);
  } catch {
    return structuredClone(EMPTY_STORE);
  }
}

async function writeStoreUnlocked(store: Store): Promise<void> {
  assertDurableStorage();
  const payload = JSON.stringify(store);

  if (hasRedis()) {
    await getRedis().set(REDIS_KEY, store);
    return;
  }

  if (hasBlob()) {
    // No ifMatch. Short cache + useCache:false on reads avoids stale overwrites.
    await put(BLOB_PATHNAME, payload, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, payload, "utf8");
}

async function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalThis.__competitorMonitorStoreChain ?? Promise.resolve();
  let release!: (value?: unknown) => void;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  globalThis.__competitorMonitorStoreChain = previous.then(() => gate);

  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function productKey(p: ProductRow): string {
  return `${p.competitorId}::${p.url}`;
}

/** Merge local mutation onto the latest remote store so concurrent writes don't wipe rows. */
function mergeMutation(before: Store, local: Store, remote: Store): Store {
  const beforeCompetitorIds = new Set(before.competitors.map((c) => c.id));
  const localCompetitorIds = new Set(local.competitors.map((c) => c.id));
  const deletedCompetitors = [...beforeCompetitorIds].filter(
    (id) => !localCompetitorIds.has(id),
  );

  const competitorsById = new Map<string, Competitor>();
  for (const c of remote.competitors) {
    if (!deletedCompetitors.includes(c.id)) competitorsById.set(c.id, c);
  }
  for (const c of local.competitors) {
    competitorsById.set(c.id, c);
  }

  const beforeProductKeys = new Set(before.products.map(productKey));
  const localProductKeys = new Set(local.products.map(productKey));
  const deletedProducts = [...beforeProductKeys].filter(
    (key) => !localProductKeys.has(key),
  );

  const productsByKey = new Map<string, ProductRow>();
  for (const p of remote.products) {
    const key = productKey(p);
    if (!deletedProducts.includes(key)) productsByKey.set(key, p);
  }
  for (const p of local.products) {
    productsByKey.set(productKey(p), p);
  }

  // Drop products whose competitor was deleted.
  const competitorIds = new Set(competitorsById.keys());
  const products = [...productsByKey.values()].filter((p) =>
    competitorIds.has(p.competitorId),
  );

  const beforeRunIds = new Set(before.scrapeRuns.map((r) => r.id));
  const localRunIds = new Set(local.scrapeRuns.map((r) => r.id));
  const deletedRuns = [...beforeRunIds].filter((id) => !localRunIds.has(id));

  const runsById = new Map<string, ScrapeRun>();
  for (const r of remote.scrapeRuns) {
    if (!deletedRuns.includes(r.id)) runsById.set(r.id, r);
  }
  for (const r of local.scrapeRuns) {
    runsById.set(r.id, r);
  }

  const scrapeRuns = [...runsById.values()]
    .filter((r) => competitorIds.has(r.competitorId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 100);

  return {
    competitors: [...competitorsById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    products,
    scrapeRuns,
    settings: normalizeSettings(local.settings ?? remote.settings),
  };
}

async function mutateStore<T>(
  mutator: (store: Store) => T | Promise<T>,
): Promise<T> {
  return withStoreLock(async () => {
    const before = await readStoreUnlocked();
    const local = structuredClone(before);
    const result = await mutator(local);
    const remote = await readStoreUnlocked();
    const merged = mergeMutation(before, local, remote);
    await writeStoreUnlocked(merged);
    return result;
  });
}

async function readStore(): Promise<Store> {
  return withStoreLock(() => readStoreUnlocked());
}

function withCompetitorName(store: Store, product: ProductRow): Product {
  const competitor = store.competitors.find((c) => c.id === product.competitorId);
  return {
    ...product,
    competitorName: competitor?.name ?? "",
  };
}

function withNormalizedInterval(competitor: Competitor): Competitor {
  return {
    ...competitor,
    intervalHours: normalizeIntervalHours(competitor.intervalHours),
  };
}

export async function listCompetitors(): Promise<Competitor[]> {
  const snapshot = await getMonitorSnapshot();
  return snapshot.competitors;
}

export async function getMonitorSnapshot(): Promise<{
  competitors: Competitor[];
  settings: MonitorSettings;
}> {
  const store = await readStore();
  return {
    competitors: [...store.competitors]
      .map(withNormalizedInterval)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    settings: normalizeSettings(store.settings),
  };
}

export async function getCompetitor(id: string): Promise<Competitor | null> {
  const store = await readStore();
  const competitor = store.competitors.find((c) => c.id === id) ?? null;
  return competitor ? withNormalizedInterval(competitor) : null;
}

export async function createCompetitor(input: {
  name: string;
  sitemapUrl: string;
  intervalHours: IntervalHours;
}): Promise<Competitor> {
  return mutateStore((store) => {
    const createdAt = new Date().toISOString();
    const competitor: Competitor = {
      id: randomUUID(),
      name: input.name,
      sitemapUrl: input.sitemapUrl,
      intervalHours: normalizeIntervalHours(input.intervalHours),
      enabled: true,
      lastScrapedAt: null,
      nextScrapeAt: createdAt,
      createdAt,
    };
    store.competitors.unshift(competitor);
    return competitor;
  });
}

export async function updateCompetitor(
  id: string,
  patch: Partial<{
    name: string;
    sitemapUrl: string;
    intervalHours: IntervalHours;
    enabled: boolean;
    lastScrapedAt: string | null;
    nextScrapeAt: string | null;
  }>,
): Promise<Competitor | null> {
  return mutateStore((store) => {
    const index = store.competitors.findIndex((c) => c.id === id);
    if (index < 0) return null;

    const existing = store.competitors[index];
    const intervalHours = normalizeIntervalHours(
      patch.intervalHours ?? existing.intervalHours,
    );
    const intervalChanged = intervalHours !== existing.intervalHours;

    let nextScrapeAt =
      patch.nextScrapeAt === undefined
        ? existing.nextScrapeAt
        : patch.nextScrapeAt;

    if (intervalChanged && patch.nextScrapeAt === undefined) {
      const from = existing.lastScrapedAt
        ? new Date(existing.lastScrapedAt)
        : new Date();
      nextScrapeAt = new Date(
        from.getTime() + msUntilNextScrape(intervalHours),
      ).toISOString();
    }

    const updated: Competitor = {
      ...existing,
      name: patch.name ?? existing.name,
      sitemapUrl: patch.sitemapUrl ?? existing.sitemapUrl,
      intervalHours,
      enabled: patch.enabled === undefined ? existing.enabled : patch.enabled,
      lastScrapedAt:
        patch.lastScrapedAt === undefined
          ? existing.lastScrapedAt
          : patch.lastScrapedAt,
      nextScrapeAt,
    };

    store.competitors[index] = updated;
    return withNormalizedInterval(updated);
  });
}

export async function deleteCompetitor(id: string): Promise<boolean> {
  return mutateStore((store) => {
    const before = store.competitors.length;
    store.competitors = store.competitors.filter((c) => c.id !== id);
    store.products = store.products.filter((p) => p.competitorId !== id);
    store.scrapeRuns = store.scrapeRuns.filter((r) => r.competitorId !== id);
    return store.competitors.length < before;
  });
}

export async function listDueCompetitors(
  nowIso = new Date().toISOString(),
): Promise<Competitor[]> {
  const store = await readStore();
  return store.competitors
    .filter(
      (c) =>
        c.enabled && (!c.nextScrapeAt || c.nextScrapeAt <= nowIso),
    )
    .map(withNormalizedInterval)
    .sort((a, b) =>
      (a.nextScrapeAt ?? "").localeCompare(b.nextScrapeAt ?? ""),
    );
}

export async function countProductsForCompetitor(
  competitorId: string,
): Promise<number> {
  const store = await readStore();
  return store.products.filter((p) => p.competitorId === competitorId).length;
}

export async function getExistingProductUrls(
  competitorId: string,
): Promise<Set<string>> {
  const store = await readStore();
  return new Set(
    store.products
      .filter((p) => p.competitorId === competitorId)
      .map((p) => p.url),
  );
}

export async function insertProducts(
  competitorId: string,
  products: Array<{ url: string; title: string }>,
  isNew: boolean,
): Promise<number> {
  if (products.length === 0) return 0;
  return mutateStore((store) => {
    const existing = new Set(
      store.products
        .filter((p) => p.competitorId === competitorId)
        .map((p) => p.url),
    );
    const now = new Date().toISOString();
    let inserted = 0;
    for (const product of products) {
      if (existing.has(product.url)) continue;
      store.products.push({
        id: randomUUID(),
        competitorId,
        url: product.url,
        title: product.title,
        firstSeenAt: now,
        isNew,
      });
      existing.add(product.url);
      inserted += 1;
    }
    return inserted;
  });
}

export async function listProducts(filters?: {
  competitorId?: string;
  newOnly?: boolean;
}): Promise<Product[]> {
  const store = await readStore();
  let rows = store.products;
  if (filters?.newOnly !== false) {
    rows = rows.filter((p) => p.isNew);
  }
  if (filters?.competitorId) {
    rows = rows.filter((p) => p.competitorId === filters.competitorId);
  }
  return rows
    .map((p) => withCompetitorName(store, p))
    .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
}

export async function markProductSeen(id: string): Promise<boolean> {
  return mutateStore((store) => {
    const product = store.products.find((p) => p.id === id);
    if (!product) return false;
    product.isNew = false;
    return true;
  });
}

export async function markAllProductsSeen(
  competitorId?: string,
): Promise<number> {
  return mutateStore((store) => {
    let updated = 0;
    for (const product of store.products) {
      if (!product.isNew) continue;
      if (competitorId && product.competitorId !== competitorId) continue;
      product.isNew = false;
      updated += 1;
    }
    return updated;
  });
}

export async function createScrapeRun(competitorId: string): Promise<string> {
  return mutateStore((store) => {
    const id = randomUUID();
    store.scrapeRuns.unshift({
      id,
      competitorId,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: "success",
      urlsFound: 0,
      newCount: 0,
      error: null,
    });
    store.scrapeRuns = store.scrapeRuns.slice(0, 100);
    return id;
  });
}

export async function finishScrapeRun(
  id: string,
  data: {
    status: ScrapeRun["status"];
    urlsFound: number;
    newCount: number;
    error?: string | null;
  },
): Promise<void> {
  await mutateStore((store) => {
    const run = store.scrapeRuns.find((r) => r.id === id);
    if (!run) return;
    run.finishedAt = new Date().toISOString();
    run.status = data.status;
    run.urlsFound = data.urlsFound;
    run.newCount = data.newCount;
    run.error = data.error ?? null;
  });
}

export async function listRecentScrapeRuns(limit = 20): Promise<ScrapeRun[]> {
  const store = await readStore();
  return store.scrapeRuns.slice(0, limit);
}

export async function scheduleNextScrape(
  competitorId: string,
  intervalHours: IntervalHours,
  from = new Date(),
): Promise<string> {
  const interval = normalizeIntervalHours(intervalHours);
  const nextIso = new Date(
    from.getTime() + msUntilNextScrape(interval),
  ).toISOString();
  await updateCompetitor(competitorId, {
    lastScrapedAt: from.toISOString(),
    nextScrapeAt: nextIso,
    intervalHours: interval,
  });
  return nextIso;
}

export async function getSettings(): Promise<MonitorSettings> {
  const store = await readStore();
  return normalizeSettings(store.settings);
}

export async function updateSettings(
  patch: Partial<MonitorSettings>,
): Promise<MonitorSettings> {
  return mutateStore((store) => {
    store.settings = normalizeSettings({
      ...store.settings,
      ...patch,
    });
    return store.settings;
  });
}
