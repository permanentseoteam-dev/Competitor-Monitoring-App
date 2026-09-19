"use strict";

const { normalizeSubscriptionPlan } = require("./types");

/** Plan caps. `null` means unlimited. `seats` = login profiles (admin + invited users). */
const PLAN_LIMITS = {
  basic: {
    competitors: 2,
    scrapeNow: 4,
    seats: 2,
  },
  essential: {
    competitors: 4,
    scrapeNow: 8,
    seats: 5,
  },
  advance: {
    competitors: null,
    scrapeNow: 12,
    seats: null,
  },
};

function currentScrapePeriod(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getPlanLimits(plan) {
  const key = normalizeSubscriptionPlan(plan);
  return { plan: key, ...PLAN_LIMITS[key] };
}

function formatCompetitorLimit(limit) {
  if (limit == null) return "Unlimited";
  return String(limit);
}

function formatScrapeNowLimit(limit) {
  return String(limit);
}

function competitorLimitReached(plan, competitorCount) {
  const { competitors } = getPlanLimits(plan);
  if (competitors == null) return false;
  return Number(competitorCount) >= competitors;
}

function scrapeNowRemaining(plan, used) {
  const { scrapeNow } = getPlanLimits(plan);
  return Math.max(0, scrapeNow - Number(used || 0));
}

function scrapeNowLimitReached(plan, used) {
  return scrapeNowRemaining(plan, used) <= 0;
}

function formatSeatLimit(limit) {
  if (limit == null) return "Unlimited";
  return String(limit);
}

function seatRemaining(plan, used) {
  const { seats } = getPlanLimits(plan);
  if (seats == null) return null;
  return Math.max(0, seats - Number(used || 0));
}

function seatLimitReached(plan, used) {
  const { seats } = getPlanLimits(plan);
  if (seats == null) return false;
  return Number(used || 0) >= seats;
}

function normalizeScrapeQuota(settings, now = new Date()) {
  const period = currentScrapePeriod(now);
  const storedPeriod =
    typeof settings?.manualScrapePeriod === "string" &&
    /^\d{4}-\d{2}$/.test(settings.manualScrapePeriod)
      ? settings.manualScrapePeriod
      : period;
  const used =
    storedPeriod === period && Number.isFinite(Number(settings?.manualScrapeUsed))
      ? Math.max(0, Math.floor(Number(settings.manualScrapeUsed)))
      : 0;
  return {
    manualScrapePeriod: period,
    manualScrapeUsed: storedPeriod === period ? used : 0,
  };
}

function buildPlanUsage({ plan, competitorCount, settings, seatCount = 0 }) {
  const limits = getPlanLimits(plan);
  const quota = normalizeScrapeQuota(settings);
  const used = quota.manualScrapeUsed;
  const remaining = scrapeNowRemaining(limits.plan, used);
  const seatUsed = Number(seatCount) || 0;
  const seatsRemaining = seatRemaining(limits.plan, seatUsed);
  return {
    plan: limits.plan,
    competitors: {
      used: Number(competitorCount) || 0,
      limit: limits.competitors,
      remaining:
        limits.competitors == null
          ? null
          : Math.max(0, limits.competitors - (Number(competitorCount) || 0)),
      unlimited: limits.competitors == null,
    },
    scrapeNow: {
      used,
      limit: limits.scrapeNow,
      remaining,
      period: quota.manualScrapePeriod,
    },
    seats: {
      used: seatUsed,
      limit: limits.seats,
      remaining: seatsRemaining,
      unlimited: limits.seats == null,
    },
  };
}

module.exports = {
  PLAN_LIMITS,
  currentScrapePeriod,
  getPlanLimits,
  formatCompetitorLimit,
  formatScrapeNowLimit,
  formatSeatLimit,
  competitorLimitReached,
  scrapeNowRemaining,
  scrapeNowLimitReached,
  seatRemaining,
  seatLimitReached,
  normalizeScrapeQuota,
  buildPlanUsage,
};
