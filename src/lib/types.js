"use strict";

const INTERVAL_OPTIONS = [5, 8, 12, 16, 18, 20];
const PRODUCT_RECYCLE_DAYS = 10;
const PRODUCT_RECYCLE_MS = PRODUCT_RECYCLE_DAYS * 24 * 60 * 60 * 1000;

const SUBSCRIPTION_PLANS = ["basic", "essential", "advance"];

const DEFAULT_SETTINGS = {
  dailyCronEnabled: true,
  brandName: "Permanent SEO",
  brandTagline: "Competitor intel",
  accentColor: "#2B59FF",
  pricingOfferEndsAt: null,
  /** Active billing tier for the workspace. Defaults to Basic so upgrade nags fire. */
  subscriptionPlan: "basic",
  /** UTC YYYY-MM period for manual Scrape now quota. */
  manualScrapePeriod: null,
  /** Manual Scrape now uses consumed in the current period. */
  manualScrapeUsed: 0,
};

function normalizeSubscriptionPlan(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return SUBSCRIPTION_PLANS.includes(key) ? key : "basic";
}

function isIntervalHours(value) {
  return INTERVAL_OPTIONS.includes(Number(value));
}

function normalizeIntervalHours(value) {
  const n = Number(value);
  return isIntervalHours(n) ? n : 5;
}

function intervalLabel(hours) {
  return `Every ${normalizeIntervalHours(hours)} hours`;
}

function intervalShortLabel(hours) {
  return `${normalizeIntervalHours(hours)}h`;
}

function msUntilNextScrape(hours) {
  return normalizeIntervalHours(hours) * 60 * 60 * 1000;
}

function recycleExpiresAt(deletedAt) {
  const t = new Date(deletedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + PRODUCT_RECYCLE_MS).toISOString();
}

function isRecycleExpired(deletedAt, now = Date.now()) {
  const t = new Date(deletedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return now - t >= PRODUCT_RECYCLE_MS;
}

function daysLeftInRecycle(deletedAt, now = Date.now()) {
  const t = new Date(deletedAt).getTime();
  if (!Number.isFinite(t)) return 0;
  const left = PRODUCT_RECYCLE_MS - (now - t);
  if (left <= 0) return 0;
  return Math.ceil(left / (24 * 60 * 60 * 1000));
}

module.exports = {
  INTERVAL_OPTIONS,
  PRODUCT_RECYCLE_DAYS,
  PRODUCT_RECYCLE_MS,
  SUBSCRIPTION_PLANS,
  DEFAULT_SETTINGS,
  normalizeSubscriptionPlan,
  isIntervalHours,
  normalizeIntervalHours,
  intervalLabel,
  intervalShortLabel,
  msUntilNextScrape,
  recycleExpiresAt,
  isRecycleExpired,
  daysLeftInRecycle,
};
