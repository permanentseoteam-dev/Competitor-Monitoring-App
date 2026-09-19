"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  DEFAULT_SETTINGS,
  daysLeftInRecycle,
  isRecycleExpired,
  msUntilNextScrape,
  normalizeIntervalHours,
  normalizeSubscriptionPlan,
  recycleExpiresAt,
} = require("./types");
const { normalizeScrapeQuota, buildPlanUsage, scrapeNowLimitReached } = require("./planLimits");
const { hashPassword } = require("./password");
const { normalizeRole } = require("./roles");

const EMPTY_STORE = {
  competitors: [],
  products: [],
  scrapeRuns: [],
  profiles: [],
  settings: { ...DEFAULT_SETTINGS },
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

let storeChain = Promise.resolve();

function normalizeSettings(settings) {
  const accent =
    typeof settings?.accentColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(settings.accentColor.trim())
      ? settings.accentColor.trim()
      : DEFAULT_SETTINGS.accentColor;
  let pricingOfferEndsAt = null;
  if (
    typeof settings?.pricingOfferEndsAt === "string" &&
    settings.pricingOfferEndsAt &&
    !Number.isNaN(Date.parse(settings.pricingOfferEndsAt))
  ) {
    pricingOfferEndsAt = new Date(settings.pricingOfferEndsAt).toISOString();
  }
  return {
    dailyCronEnabled: settings?.dailyCronEnabled !== false,
    brandName:
      typeof settings?.brandName === "string" && settings.brandName.trim()
        ? settings.brandName.trim().slice(0, 40)
        : DEFAULT_SETTINGS.brandName,
    brandTagline:
      typeof settings?.brandTagline === "string" && settings.brandTagline.trim()
        ? settings.brandTagline.trim().slice(0, 80)
        : DEFAULT_SETTINGS.brandTagline,
    accentColor: accent,
    pricingOfferEndsAt,
    subscriptionPlan: normalizeSubscriptionPlan(settings?.subscriptionPlan),
    ...normalizeScrapeQuota(settings),
  };
}

function normalizeProfile(profile) {
  const rawEmoji =
    typeof profile.avatarEmoji === "string" && profile.avatarEmoji.trim()
      ? [...profile.avatarEmoji.trim()].slice(0, 4).join("")
      : "";
  /* Shield emoji renders poorly on Windows — map to a stable admin glyph */
  const avatarEmoji = rawEmoji === "🛡️" || rawEmoji === "🛡" ? "💼" : rawEmoji;
  const avatarImage =
    typeof profile.avatarImage === "string" &&
    profile.avatarImage.startsWith("data:image/") &&
    profile.avatarImage.length < 220000
      ? profile.avatarImage
      : "";
  return {
    id: profile.id,
    username: String(profile.username || "").trim(),
    displayName:
      typeof profile.displayName === "string" && profile.displayName.trim()
        ? profile.displayName.trim().slice(0, 80)
        : String(profile.username || "").trim(),
    role: normalizeRole(profile.role),
    passwordHash: profile.passwordHash || "",
    avatarEmoji,
    avatarImage,
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || profile.createdAt || new Date().toISOString(),
  };
}

function publicProfile(profile) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    role: profile.role,
    avatarEmoji: profile.avatarEmoji || "",
    avatarImage: profile.avatarImage || "",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function normalizeProduct(product) {
  return {
    ...product,
    needsUpload: product.needsUpload === true,
    deletedAt:
      typeof product.deletedAt === "string" && product.deletedAt
        ? product.deletedAt
        : null,
  };
}

function normalizeStore(store) {
  return {
    competitors: store.competitors ?? [],
    products: (store.products ?? []).map(normalizeProduct),
    scrapeRuns: store.scrapeRuns ?? [],
    profiles: (store.profiles ?? []).map(normalizeProfile),
    settings: normalizeSettings(store.settings),
  };
}

function purgeExpiredRecycle(store, now = Date.now()) {
  const before = store.products.length;
  store.products = store.products.filter((p) => {
    if (!p.deletedAt) return true;
    return !isRecycleExpired(p.deletedAt, now);
  });
  return before - store.products.length;
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

  const beforeProfileIds = new Set((before.profiles || []).map((p) => p.id));
  const localProfileIds = new Set((local.profiles || []).map((p) => p.id));
  const deletedProfiles = [...beforeProfileIds].filter(
    (id) => !localProfileIds.has(id),
  );

  const profilesById = new Map();
  for (const p of remote.profiles || []) {
    if (!deletedProfiles.includes(p.id)) profilesById.set(p.id, p);
  }
  for (const p of local.profiles || []) profilesById.set(p.id, p);

  return {
    competitors: [...competitorsById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    products,
    scrapeRuns,
    profiles: [...profilesById.values()].map(normalizeProfile),
    settings: normalizeSettings(local.settings ?? remote.settings),
  };
}

async function mutateStore(mutator) {
  return withStoreLock(async () => {
    const before = await readStoreUnlocked();
    purgeExpiredRecycle(before);
    const local = structuredClone(before);
    const result = await mutator(local);
    purgeExpiredRecycle(local);
    const remote = await readStoreUnlocked();
    purgeExpiredRecycle(remote);
    const merged = mergeMutation(before, local, remote);
    purgeExpiredRecycle(merged);
    await writeStoreUnlocked(merged);
    return result;
  });
}

async function readStore() {
  return withStoreLock(async () => {
    const store = await readStoreUnlocked();
    const purged = purgeExpiredRecycle(store);
    if (purged > 0) await writeStoreUnlocked(store);
    return store;
  });
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
  const competitors = [...store.competitors]
    .map(withNormalizedInterval)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const settings = normalizeSettings(store.settings);
  return {
    competitors,
    settings,
    planUsage: buildPlanUsage({
      plan: settings.subscriptionPlan,
      competitorCount: competitors.length,
      settings,
    }),
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
        needsUpload: false,
        deletedAt: null,
      });
      existing.add(product.url);
      inserted += 1;
    }
    return inserted;
  });
}

async function listProducts(filters = {}) {
  const store = await readStore();
  const view = filters.view || "active";
  let rows = store.products;

  if (view === "recycle") {
    rows = rows.filter((p) => Boolean(p.deletedAt));
  } else if (view === "needs_upload") {
    rows = rows.filter((p) => !p.deletedAt && p.needsUpload);
  } else {
    rows = rows.filter((p) => !p.deletedAt && !p.needsUpload && p.isNew);
  }

  if (filters.competitorId) {
    rows = rows.filter((p) => p.competitorId === filters.competitorId);
  }

  return rows
    .map((p) => {
      const withName = withCompetitorName(store, p);
      if (!p.deletedAt) return withName;
      return {
        ...withName,
        recycleExpiresAt: recycleExpiresAt(p.deletedAt),
        recycleDaysLeft: daysLeftInRecycle(p.deletedAt),
      };
    })
    .sort((a, b) => {
      if (view === "recycle") {
        return String(b.deletedAt || "").localeCompare(String(a.deletedAt || ""));
      }
      return b.firstSeenAt.localeCompare(a.firstSeenAt);
    });
}

async function markProductNeedsUpload(id) {
  return mutateStore((store) => {
    const product = store.products.find((p) => p.id === id);
    if (!product || product.deletedAt) return false;
    product.needsUpload = true;
    product.isNew = false;
    return true;
  });
}

async function softDeleteProduct(id) {
  return mutateStore((store) => {
    const product = store.products.find((p) => p.id === id);
    if (!product || product.deletedAt) return false;
    product.deletedAt = new Date().toISOString();
    product.isNew = false;
    return true;
  });
}

async function restoreProduct(id) {
  return mutateStore((store) => {
    const product = store.products.find((p) => p.id === id);
    if (!product || !product.deletedAt) return false;
    product.deletedAt = null;
    if (product.needsUpload) {
      product.isNew = false;
    } else {
      product.isNew = true;
    }
    return true;
  });
}

async function purgeExpiredProducts() {
  return mutateStore((store) => purgeExpiredRecycle(store));
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
  const settings = normalizeSettings(store.settings);
  if (!settings.pricingOfferEndsAt) {
    const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return updateSettings({ pricingOfferEndsAt: ends });
  }
  return settings;
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

/**
 * Atomically consume one manual Scrape now credit for the current plan period.
 * @returns {{ ok: true, settings, planUsage } | { ok: false, error, code, planUsage }}
 */
async function consumeManualScrape() {
  return mutateStore((store) => {
    const settings = normalizeSettings(store.settings);
    const quota = normalizeScrapeQuota(settings);
    const planUsage = buildPlanUsage({
      plan: settings.subscriptionPlan,
      competitorCount: store.competitors.length,
      settings: { ...settings, ...quota },
    });

    if (scrapeNowLimitReached(settings.subscriptionPlan, quota.manualScrapeUsed)) {
      return {
        ok: false,
        code: "SCRAPE_QUOTA",
        error: `Scrape now limit reached (${planUsage.scrapeNow.limit}/month on your plan). Upgrade for more runs.`,
        settings,
        planUsage,
      };
    }

    store.settings = normalizeSettings({
      ...settings,
      manualScrapePeriod: quota.manualScrapePeriod,
      manualScrapeUsed: quota.manualScrapeUsed + 1,
    });

    return {
      ok: true,
      settings: store.settings,
      planUsage: buildPlanUsage({
        plan: store.settings.subscriptionPlan,
        competitorCount: store.competitors.length,
        settings: store.settings,
      }),
    };
  });
}

async function getPlanUsage() {
  const store = await readStore();
  const settings = normalizeSettings(store.settings);
  return buildPlanUsage({
    plan: settings.subscriptionPlan,
    competitorCount: store.competitors.length,
    settings,
  });
}

async function ensureDefaultProfile() {
  return mutateStore(async (store) => {
    if ((store.profiles || []).length > 0) return store.profiles.length;
    const username = (process.env.AUTH_USERNAME || "Admin").trim();
    const password = process.env.AUTH_PASSWORD || "royalvapery";
    const now = new Date().toISOString();
    store.profiles = [
      {
        id: randomUUID(),
        username,
        displayName: username,
        role: "owner",
        passwordHash: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      },
    ];
    return store.profiles.length;
  });
}

async function listProfiles() {
  await ensureDefaultProfile();
  const store = await readStore();
  return store.profiles.map((p) => publicProfile(normalizeProfile(p)));
}

async function findProfileByUsername(username) {
  await ensureDefaultProfile();
  const store = await readStore();
  const needle = String(username || "").trim().toLowerCase();
  const profile =
    store.profiles.find((p) => p.username.toLowerCase() === needle) || null;
  return profile ? normalizeProfile(profile) : null;
}

async function findProfileById(id) {
  await ensureDefaultProfile();
  const store = await readStore();
  const profile = store.profiles.find((p) => p.id === id) || null;
  return profile ? normalizeProfile(profile) : null;
}

async function createProfile(input) {
  await ensureDefaultProfile();
  const username = String(input.username || "").trim();
  const password = String(input.password || "");
  if (!username || username.length < 2) {
    throw new Error("Username must be at least 2 characters");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  return mutateStore(async (store) => {
    if (
      store.profiles.some(
        (p) => p.username.toLowerCase() === username.toLowerCase(),
      )
    ) {
      throw new Error("Username already exists");
    }
    const now = new Date().toISOString();
    const profile = normalizeProfile({
      id: randomUUID(),
      username,
      displayName: input.displayName || username,
      role: normalizeRole(input.role),
      passwordHash: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    });
    store.profiles.push(profile);
    return publicProfile(profile);
  });
}

async function updateProfile(id, patch) {
  await ensureDefaultProfile();
  return mutateStore(async (store) => {
    const index = store.profiles.findIndex((p) => p.id === id);
    if (index < 0) return null;
    const existing = store.profiles[index];
    let username = existing.username;
    if (typeof patch.username === "string" && patch.username.trim()) {
      username = patch.username.trim();
      const clash = store.profiles.some(
        (p) =>
          p.id !== id && p.username.toLowerCase() === username.toLowerCase(),
      );
      if (clash) throw new Error("Username already exists");
    }
    let passwordHash = existing.passwordHash;
    if (typeof patch.password === "string" && patch.password) {
      if (patch.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      passwordHash = await hashPassword(patch.password);
    }
    const updated = normalizeProfile({
      ...existing,
      username,
      displayName:
        typeof patch.displayName === "string"
          ? patch.displayName
          : existing.displayName,
      role:
        typeof patch.role === "string" && patch.role
          ? normalizeRole(patch.role)
          : existing.role,
      passwordHash,
      avatarEmoji:
        typeof patch.avatarEmoji === "string"
          ? patch.avatarEmoji
          : existing.avatarEmoji,
      avatarImage:
        patch.avatarImage === null
          ? ""
          : typeof patch.avatarImage === "string"
            ? patch.avatarImage
            : existing.avatarImage,
      updatedAt: new Date().toISOString(),
    });
    store.profiles[index] = updated;
    return publicProfile(updated);
  });
}

async function deleteProfile(id) {
  await ensureDefaultProfile();
  return mutateStore((store) => {
    if (store.profiles.length <= 1) {
      throw new Error("Cannot delete the last login profile");
    }
    const before = store.profiles.length;
    store.profiles = store.profiles.filter((p) => p.id !== id);
    return store.profiles.length < before;
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
  markProductNeedsUpload,
  softDeleteProduct,
  restoreProduct,
  purgeExpiredProducts,
  createScrapeRun,
  finishScrapeRun,
  listRecentScrapeRuns,
  scheduleNextScrape,
  getSettings,
  updateSettings,
  consumeManualScrape,
  getPlanUsage,
  ensureDefaultProfile,
  listProfiles,
  findProfileByUsername,
  findProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
};
