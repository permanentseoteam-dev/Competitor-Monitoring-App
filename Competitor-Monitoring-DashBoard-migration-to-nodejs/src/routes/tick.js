"use strict";

const express = require("express");
const { runDueScrapes } = require("../lib/scheduler");

const router = express.Router();

router.get("/api/tick", (_req, res) => {
  res.status(405).json({ error: "Use POST to run due scrapes" });
});

router.post("/api/tick", async (_req, res, next) => {
  try {
    const ran = await runDueScrapes();
    res.json({
      ok: true,
      ran,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
