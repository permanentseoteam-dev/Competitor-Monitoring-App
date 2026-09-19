"use strict";

const {
  formatCompetitorLimit,
  formatScrapeNowLimit,
  formatSeatLimit,
  PLAN_LIMITS,
} = require("./planLimits");

/** Monthly list prices. Yearly uses a light ~10% discount. */
const YEARLY_DISCOUNT = 0.1;

/** Shared feature rows for Hostinger-style check / dash lists. */
const FEATURE_SECTIONS = [
  {
    title: "Monitor with:",
    rows: [
      {
        id: "competitors",
        label: "Competitor stores",
        basic: formatCompetitorLimit(PLAN_LIMITS.basic.competitors),
        essential: formatCompetitorLimit(PLAN_LIMITS.essential.competitors),
        advance: formatCompetitorLimit(PLAN_LIMITS.advance.competitors),
      },
      {
        id: "scrapeNow",
        label: "Scrape now / month",
        basic: formatScrapeNowLimit(PLAN_LIMITS.basic.scrapeNow),
        essential: formatScrapeNowLimit(PLAN_LIMITS.essential.scrapeNow),
        advance: formatScrapeNowLimit(PLAN_LIMITS.advance.scrapeNow),
      },
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
      {
        id: "seats",
        label: "Team seats (invite users)",
        basic: formatSeatLimit(PLAN_LIMITS.basic.seats),
        essential: formatSeatLimit(PLAN_LIMITS.essential.seats),
        advance: formatSeatLimit(PLAN_LIMITS.advance.seats),
      },
      { id: "priority", label: "Priority scrape runs", basic: false, essential: false, advance: true },
      { id: "admin", label: "Pricing offer timer controls", basic: false, essential: false, advance: true },
      { id: "revenue", label: "Monthly revenue dashboard", basic: false, essential: false, advance: "Super Admin" },
    ],
  },
];

const PLAN_INCLUDES = [
  "Sitemap scraping",
  "Product cards",
  "Manual scrape runs",
  "Secure team login",
];

const TRUST_BADGES = [
  "7-day launch offer",
  "Cancel anytime",
  "Upgrade in one click",
];

const PRICING_FAQS = [
  {
    q: "Can I change my plan later?",
    a: "Yes. Upgrade from Basic to Essential or Advance anytime from the Pricing page — no downtime to your monitored stores.",
  },
  {
    q: "What does Basic include?",
    a: "Basic covers up to 2 competitor stores, 4 manual Scrape now runs per month, selectable intervals (8h / 12h / 20h), and product cards. Upload queue and daily schedules unlock on Essential+.",
  },
  {
    q: "Why upgrade from Basic?",
    a: "Essential adds 4 competitor slots and 8 Scrape now runs per month, plus upload + recycle and daily automation. Advance unlocks unlimited competitors, 12 Scrape now runs, profiles/roles, team seats, and priority scrapes. Super Admin unlocks the monthly revenue numbers dashboard.",
  },
  {
    q: "How does yearly billing work?",
    a: "Yearly plans are paid upfront at ~10% off the monthly rate. The per-month figure shown is the yearly total divided by 12.",
  },
];

const pricingPlans = [
  {
    id: "basic",
    name: "Basic",
    blurb: "Get started with 2 stores and 4 Scrape now runs each month.",
    competitors: PLAN_LIMITS.basic.competitors,
    scrapeNow: PLAN_LIMITS.basic.scrapeNow,
    highlight: false,
    why: null,
    tiers: [
      { id: "basic-8h", intervalHours: 8, monthly: 6, listMonthly: 9 },
      { id: "basic-12h", intervalHours: 12, monthly: 9, listMonthly: 14 },
      { id: "basic-20h", intervalHours: 20, monthly: 14.99, listMonthly: 22 },
    ],
  },
  {
    id: "essential",
    name: "Essential",
    blurb: "4 stores and 8 Scrape now runs — built for growing catalog teams.",
    competitors: PLAN_LIMITS.essential.competitors,
    scrapeNow: PLAN_LIMITS.essential.scrapeNow,
    highlight: true,
    monthly: 24.99,
    listMonthly: 39.99,
    intervalHours: [5, 8, 12],
    why: "Best balance of competitor slots, scrape quota, and daily automation for growing ops.",
  },
  {
    id: "advance",
    name: "Advance",
    blurb: "Unlimited competitors and 12 Scrape now runs for multi-brand work.",
    competitors: PLAN_LIMITS.advance.competitors,
    scrapeNow: PLAN_LIMITS.advance.scrapeNow,
    highlight: false,
    monthly: 49.99,
    listMonthly: 69.99,
    intervalHours: [5, 8, 12, 16, 18, 20],
    why: "A complete solution for long-term monitoring. Everything included.",
  },
];

function yearlyMonthly(monthly) {
  return Math.round(monthly * (1 - YEARLY_DISCOUNT) * 100) / 100;
}

function yearlyTotal(monthly) {
  return Math.round(yearlyMonthly(monthly) * 12 * 100) / 100;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

function discountPercent(list, sale) {
  if (!list || list <= sale) return 0;
  return Math.round(((list - sale) / list) * 100);
}

module.exports = {
  YEARLY_DISCOUNT,
  FEATURE_SECTIONS,
  PLAN_INCLUDES,
  TRUST_BADGES,
  PRICING_FAQS,
  pricingPlans,
  yearlyMonthly,
  yearlyTotal,
  formatMoney,
  discountPercent,
};
