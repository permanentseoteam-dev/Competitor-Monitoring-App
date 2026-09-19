"use strict";

const express = require("express");
const { z } = require("zod");
const {
  createCompetitor,
  deleteCompetitor,
  getCompetitor,
  getMonitorSnapshot,
  getPlanUsage,
  updateCompetitor,
} = require("../lib/db");
const { scrapeCompetitor } = require("../lib/scrape");
const { isIntervalHours } = require("../lib/types");
const {
  competitorLimitReached,
  formatCompetitorLimit,
  getPlanLimits,
} = require("../lib/planLimits");

const router = express.Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sitemapUrl: z.string().trim().min(1).max(2000),
  intervalHours: z.coerce
    .number()
    .refine((n) => isIntervalHours(n)),
});

router.get("/api/competitors", async (_req, res, next) => {
  try {
    const { competitors, settings, planUsage } = await getMonitorSnapshot();
    res.json({ competitors, settings, planUsage });
  } catch (error) {
    next(error);
  }
});

router.post("/api/competitors", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const snapshot = await getMonitorSnapshot();
    const plan = snapshot.settings.subscriptionPlan || "basic";
    const limits = getPlanLimits(plan);

    if (competitorLimitReached(plan, snapshot.competitors.length)) {
      return res.status(403).json({
        error: `Competitor limit reached (${formatCompetitorLimit(
          limits.competitors,
        )} on your ${limits.plan} plan). Upgrade to add more stores.`,
        code: "COMPETITOR_LIMIT",
        planUsage: snapshot.planUsage,
      });
    }

    const competitor = await createCompetitor(parsed.data);
    setImmediate(() => {
      scrapeCompetitor(competitor.id).catch((error) => {
        console.error("[competitors] baseline scrape failed:", error);
      });
    });

    const planUsage = await getPlanUsage();
    return res.status(201).json({ competitor, planUsage });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/competitors", async (req, res, next) => {
  try {
    const schema = createSchema.partial().extend({
      id: z.string().uuid(),
      enabled: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const { id, ...patch } = parsed.data;
    if (!(await getCompetitor(id))) {
      return res.status(404).json({ error: "Not found" });
    }

    const competitor = await updateCompetitor(id, patch);
    return res.json({ competitor });
  } catch (error) {
    next(error);
  }
});

router.delete("/api/competitors", async (req, res, next) => {
  try {
    const id = req.query.id;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing id" });
    }
    const ok = await deleteCompetitor(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    const planUsage = await getPlanUsage();
    return res.json({ ok: true, planUsage });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
