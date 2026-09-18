"use strict";

const express = require("express");
const {
  listProducts,
  listRecentScrapeRuns,
  markAllProductsSeen,
  markProductSeen,
} = require("../lib/db");

const router = express.Router();

router.get("/api/products", async (req, res, next) => {
  try {
    const competitorId =
      typeof req.query.competitorId === "string"
        ? req.query.competitorId
        : undefined;
    const newOnly = req.query.newOnly !== "0";
    const [products, runs] = await Promise.all([
      listProducts({ competitorId, newOnly }),
      listRecentScrapeRuns(12),
    ]);
    res.json({ products, runs });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/products", async (req, res, next) => {
  try {
    const data = req.body || {};
    if (data.markAll) {
      const updated = await markAllProductsSeen(data.competitorId);
      return res.json({ updated });
    }
    if (!data.id) {
      return res.status(400).json({ error: "Missing id" });
    }
    const ok = await markProductSeen(data.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
