"use strict";

const express = require("express");
const {
  YEARLY_DISCOUNT,
  FEATURE_SECTIONS,
  PLAN_INCLUDES,
  TRUST_BADGES,
  PRICING_FAQS,
  pricingPlans,
} = require("../lib/pricingPlans");
const { getSettings, updateSettings, getPlanUsage } = require("../lib/db");
const { PLAN_LIMITS } = require("../lib/planLimits");
const { isPrivilegedRole, isSuperAdminRole } = require("../lib/roles");
const { normalizeSubscriptionPlan } = require("../lib/types");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!isPrivilegedRole(req.session?.role)) {
    return res.status(403).json({ error: "Admin only" });
  }
  return next();
}

router.get("/api/pricing", async (req, res, next) => {
  try {
    const settings = await getSettings();
    const planUsage = await getPlanUsage();
    const isSuperAdmin = isSuperAdminRole(req.session?.role);
    const effectiveUsage =
      isSuperAdmin && planUsage?.competitors
        ? {
            ...planUsage,
            competitors: {
              ...planUsage.competitors,
              unlimited: true,
              limit: null,
              remaining: null,
            },
          }
        : planUsage;
    res.json({
      plans: pricingPlans,
      featureSections: FEATURE_SECTIONS,
      planIncludes: PLAN_INCLUDES,
      trustBadges: TRUST_BADGES,
      faqs: PRICING_FAQS,
      yearlyDiscount: YEARLY_DISCOUNT,
      offerEndsAt: settings.pricingOfferEndsAt,
      subscriptionPlan: settings.subscriptionPlan || "basic",
      planLimits: PLAN_LIMITS,
      planUsage: effectiveUsage,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/pricing/plan", async (req, res, next) => {
  try {
    const plan = normalizeSubscriptionPlan(req.body?.plan);
    const settings = await updateSettings({ subscriptionPlan: plan });
    return res.json({ subscriptionPlan: settings.subscriptionPlan });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/pricing/timer", requireAdmin, async (req, res, next) => {
  try {
    const raw = req.body?.pricingOfferEndsAt;
    let pricingOfferEndsAt = null;
    if (typeof raw === "string" && raw && !Number.isNaN(Date.parse(raw))) {
      pricingOfferEndsAt = new Date(raw).toISOString();
    } else if (raw === null) {
      pricingOfferEndsAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
    } else {
      return res.status(400).json({ error: "Invalid offer end time" });
    }
    const settings = await updateSettings({ pricingOfferEndsAt });
    return res.json({ offerEndsAt: settings.pricingOfferEndsAt });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
