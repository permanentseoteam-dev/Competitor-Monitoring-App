"use strict";

const { pricingPlans, formatMoney } = require("./pricingPlans");
const { normalizeRole, roleLabel } = require("./roles");
const { normalizeSubscriptionPlan } = require("./types");
const { currentScrapePeriod } = require("./planLimits");

/** Assumed gross margin used for profit estimate (numbers-only dashboard). */
const PROFIT_MARGIN = 0.72;

function planMonthlyPrice(planId) {
  const plan = pricingPlans.find((p) => p.id === planId);
  if (!plan) return 0;
  if (typeof plan.monthly === "number") return plan.monthly;
  const tiers = Array.isArray(plan.tiers) ? plan.tiers : [];
  if (!tiers.length) return 0;
  return Math.min(...tiers.map((t) => Number(t.monthly) || 0));
}

/**
 * Build a numbers-only monthly revenue snapshot for Super Admin.
 * Single-workspace store: MRR is derived from the active subscription plan price.
 */
function buildRevenueSnapshot(store) {
  const settings = store.settings || {};
  const plan = normalizeSubscriptionPlan(settings.subscriptionPlan);
  const profiles = Array.isArray(store.profiles) ? store.profiles : [];
  const competitors = Array.isArray(store.competitors) ? store.competitors : [];
  const products = Array.isArray(store.products) ? store.products : [];
  const scrapeRuns = Array.isArray(store.scrapeRuns) ? store.scrapeRuns : [];

  const roleCounts = { "super-admin": 0, admin: 0, user: 0 };
  for (const profile of profiles) {
    const role = normalizeRole(profile.role);
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }

  const period = currentScrapePeriod();
  const periodPrefix = `${period}-`;
  const runsThisMonth = scrapeRuns.filter((run) =>
    String(run.startedAt || run.finishedAt || "").startsWith(periodPrefix),
  );
  const successRuns = runsThisMonth.filter(
    (r) => String(r.status || "").toLowerCase() === "success",
  ).length;
  const errorRuns = runsThisMonth.filter(
    (r) => String(r.status || "").toLowerCase() === "error",
  ).length;
  const newFindsThisMonth = runsThisMonth.reduce(
    (sum, r) => sum + (Number(r.newProducts) || 0),
    0,
  );

  const activeProducts = products.filter((p) => !p.deletedAt).length;
  const recycledProducts = products.filter((p) => p.deletedAt).length;
  const enabledStores = competitors.filter((c) => c.enabled !== false).length;

  const mrr = planMonthlyPrice(plan);
  const estimatedCosts = Math.round(mrr * (1 - PROFIT_MARGIN) * 100) / 100;
  const estimatedProfit = Math.round((mrr - estimatedCosts) * 100) / 100;
  const arpu = profiles.length ? Math.round((mrr / profiles.length) * 100) / 100 : 0;

  return {
    period,
    periodLabel: new Date(`${period}-01T00:00:00.000Z`).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    users: {
      total: profiles.length,
      superAdmins: roleCounts["super-admin"] || 0,
      admins: roleCounts.admin || 0,
      users: roleCounts.user || 0,
    },
    subscription: {
      plan,
      planLabel: plan.charAt(0).toUpperCase() + plan.slice(1),
      mrr,
      mrrLabel: formatMoney(mrr),
      estimatedCosts,
      estimatedCostsLabel: formatMoney(estimatedCosts),
      estimatedProfit,
      estimatedProfitLabel: formatMoney(estimatedProfit),
      profitMarginPct: Math.round(PROFIT_MARGIN * 100),
      arpu,
      arpuLabel: formatMoney(arpu),
    },
    usage: {
      competitors: competitors.length,
      enabledStores,
      products: products.length,
      activeProducts,
      recycledProducts,
      scrapeRunsThisMonth: runsThisMonth.length,
      successfulScrapes: successRuns,
      failedScrapes: errorRuns,
      newFindsThisMonth,
      manualScrapesUsed: Number(settings.manualScrapeUsed) || 0,
    },
  };
}

module.exports = {
  PROFIT_MARGIN,
  planMonthlyPrice,
  buildRevenueSnapshot,
  roleLabel,
};
