"use strict";

const express = require("express");
const { getSettings } = require("../lib/db");
const { runDailyMorningScrapes } = require("../lib/scheduler");

const router = express.Router();

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.authorization;
  return header === `Bearer ${secret}`;
}

router.get("/api/cron", async (req, res, next) => {
  try {
    if (!authorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const settings = await getSettings();
    if (!settings.dailyCronEnabled) {
      return res.json({
        ok: true,
        ran: 0,
        skipped: true,
        reason: "disabled",
        mode: "daily-8am",
        ranAt: new Date().toISOString(),
      });
    }

    const ran = await runDailyMorningScrapes();
    return res.json({
      ok: true,
      ran,
      skipped: false,
      mode: "daily-8am",
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
