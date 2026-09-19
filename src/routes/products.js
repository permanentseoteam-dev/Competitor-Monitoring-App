"use strict";

const express = require("express");
const {
  listProducts,
  getProductCounts,
  listRecentScrapeRuns,
  markProductNeedsUpload,
  restoreProduct,
  softDeleteProduct,
} = require("../lib/db");

const router = express.Router();

const PRODUCT_VIEWS = new Set(["active", "needs_upload", "recycle"]);

router.get("/api/products", async (req, res, next) => {
  try {
    const competitorId =
      typeof req.query.competitorId === "string"
        ? req.query.competitorId
        : undefined;
    const view =
      typeof req.query.view === "string" && PRODUCT_VIEWS.has(req.query.view)
        ? req.query.view
        : "active";
    const [products, runs, counts] = await Promise.all([
      listProducts({ competitorId, view }),
      listRecentScrapeRuns(12),
      getProductCounts(),
    ]);
    res.json({ products, runs, view, counts });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/products", async (req, res, next) => {
  try {
    const data = req.body || {};
    if (!data.id || typeof data.id !== "string") {
      return res.status(400).json({ error: "Missing id" });
    }

    const action = data.action;
    let ok = false;
    if (action === "needs_upload") {
      ok = await markProductNeedsUpload(data.id);
    } else if (action === "delete") {
      ok = await softDeleteProduct(data.id);
    } else if (action === "restore") {
      ok = await restoreProduct(data.id);
    } else {
      return res.status(400).json({
        error: "Invalid action. Use needs_upload, delete, or restore.",
      });
    }

    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true, action });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
