"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  DEFAULT_SETTINGS,
  msUntilNextScrape,
  normalizeIntervalHours,
} = require("./types");

const EMPTY_STORE = {
  competitors: [],
  products: [],
  scrapeRuns: [],
  settings: { ...DEFAULT_SETTINGS },
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

let storeChain = Promise.resolve();

function normalizeSettings(settings) {
  return {
    dailyCronEnabled: settings?.dailyCronEnabled !== false,
  };
}

function normalizeStore(store) {
  return {
    competitors: store.competitors ?? [],
    products: store.products ?? [],
    scrapeRuns: store.scrapeRuns ?? [],
    settings: normalizeSettings(store.settings),
  };
}

async function readStoreUnlocked() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    if (!raw.trim()) return structuredClone(EMPTY_STORE);
    return normalizeStore(JSON.parse(raw));
  } catch {
    return structuredClone(EMPTY_STORE);
  }
}

async function writeStoreUnlocked(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function withStoreLock(fn) {
  const previous = storeChain;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  storeChain = previous.then(() => gate);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function productKey(p) {
  return `${p.competitorId}::${p.url}`;
}

function mergeMutation(before, local, remote) {
  const beforeCompetitorIds = new Set(before.competitors.map((c) => c.id));
  const localCompetitorIds = new Set(local.competitors.map((c) => c.id));
  const deletedCompetitors = [...beforeCompetitorIds].filter(
    (id) => !localCompetitorIds.has(id),
  );

  const competitorsById = new Map();
  for (const c of remote.competitors) {
    if (!deletedCompetitors.includes(c.id)) competitorsById.set(c.id, c);
  }
  for (const c of local.competitors) competitorsById.set(c.id, c);

  const beforeProductKeys = new Set(before.products.map(productKey));
  const localProductKeys = new Set(local.products.map(productKey));
  const deletedProducts = [...beforeProductKeys].filter(
    (key) => !localProductKeys.has(key),
  );

  const productsByKey = new Map();
  for (const p of remote.products) {
    const key = productKey(p);
    if (!deletedProducts.includes(key)) productsByKey.set(key, p);
  }
  for (const p of local.products) productsByKey.set(productKey(p), p);

  const competitorIds = new Set(competitorsById.keys());
  const products = [...productsByKey.values()].filter((p) =>
    competitorIds.has(p.competitorId),
  );

  const beforeRunIds = new Set(before.scrapeRuns.map((r) => r.id));
  const localRunIds = new Set(local.scrapeRuns.map((r) => r.id));
  const deletedRuns = [...beforeRunIds].filter((id) => !localRunIds.has(id));

  const runsById = new Map();
  for (const r of remote.scrapeRuns) {
    if (!deletedRuns.includes(r.id)) runsById.set(r.id, r);
  }
  for (const r of local.scrapeRuns) runsById.set(r.id, r);

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

async function mutateStore(mutator) {
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

async function readStore() {
  return withStoreLock(() => readStoreUnlocked());
}

function withCompetitorName(store, product) {
  const competitor = store.competitors.find((c) => c.id === product.competitorId);
  return {
    ...product,
    competitorName: competitor?.name ?? "",
  };
}

function withNormalizedInterval(competitor) {
  return {
    ...competitor,
    intervalHours: normalizeIntervalHours(competitor.intervalHours),
  };
}

async function getMonitorSnapshot() {
  const store = await readStore();
  return {
    competitors: [...store.competitors]
      .map(withNormalizedInterval)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    settings: normalizeSettings(store.settings),
  };
}

async function listCompetitors() {
  const snapshot = await getMonitorSnapshot();
  return snapshot.competitors;
}

async function getCompetitor(id) {
  const store = await readStore();
  const competitor = store.competitors.find((c) => c.id === id) ?? null;
  return competitor ? withNormalizedInterval(competitor) : null;
}

async function createCompetitor(input) {
  return mutateStore((store) => {
    const createdAt = new Date().toISOString();
    const competitor = {
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

async function updateCompetitor(id, patch) {
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

    const updated = {
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

async function deleteCompetitor(id) {
  return mutateStore((store) => {
    const before = store.competitors.length;
    store.competitors = store.competitors.filter((c) => c.id !== id);
    store.products = store.products.filter((p) => p.competitorId !== id);
    store.scrapeRuns = store.scrapeRuns.filter((r) => r.competitorId !== id);
    return store.competitors.length < before;
  });
}

async function listDueCompetitors(nowIso = new Date().toISOString()) {
  const store = await readStore();
  return store.competitors
    .filter(
      (c) => c.enabled && (!c.nextScrapeAt || c.nextScrapeAt <= nowIso),
    )
    .map(withNormalizedInterval)
    .sort((a, b) =>
      (a.nextScrapeAt ?? "").localeCompare(b.nextScrapeAt ?? ""),
    );
}

async function countProductsForCompetitor(competitorId) {
  const store = await readStore();
  return store.products.filter((p) => p.competitorId === competitorId).length;
}

async function getExistingProductUrls(competitorId) {
  const store = await readStore();
  return new Set(
    store.products
      .filter((p) => p.competitorId === competitorId)
      .map((p) => p.url),
  );
}

async function insertProducts(competitorId, products, isNew) {
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

async function listProducts(filters = {}) {
  const store = await readStore();
  let rows = store.products;
  if (filters.newOnly !== false) {
    rows = rows.filter((p) => p.isNew);
  }
  if (filters.competitorId) {
    rows = rows.filter((p) => p.competitorId === filters.competitorId);
  }
  return rows
    .map((p) => withCompetitorName(store, p))
    .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
}

async function markProductSeen(id) {
  return mutateStore((store) => {
    const product = store.products.find((p) => p.id === id);
    if (!product) return false;
    product.isNew = false;
    return true;
  });
}

async function markAllProductsSeen(competitorId) {
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

async function createScrapeRun(competitorId) {
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

async function finishScrapeRun(id, data) {
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

async function listRecentScrapeRuns(limit = 20) {
  const store = await readStore();
  return store.scrapeRuns.slice(0, limit);
}

async function scheduleNextScrape(competitorId, intervalHours, from = new Date()) {
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

async function getSettings() {
  const store = await readStore();
  return normalizeSettings(store.settings);
}

async function updateSettings(patch) {
  return mutateStore((store) => {
    store.settings = normalizeSettings({
      ...store.settings,
      ...patch,
    });
    return store.settings;
  });
}

module.exports = {
  getMonitorSnapshot,
  listCompetitors,
  getCompetitor,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
  listDueCompetitors,
  countProductsForCompetitor,
  getExistingProductUrls,
  insertProducts,
  listProducts,
  markProductSeen,
  markAllProductsSeen,
  createScrapeRun,
  finishScrapeRun,
  listRecentScrapeRuns,
  scheduleNextScrape,
  getSettings,
  updateSettings,
};
