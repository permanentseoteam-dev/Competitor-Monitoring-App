"use strict";

const express = require("express");
const { z } = require("zod");
const { getCompetitor, listCompetitors } = require("../lib/db");
const { scrapeCompetitor } = require("../lib/scrape");

const router = express.Router();

const schema = z.object({
  competitorId: z.string().uuid().optional(),
});

router.post("/api/scrape", async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    if (parsed.data.competitorId) {
      if (!(await getCompetitor(parsed.data.competitorId))) {
        return res.status(404).json({ error: "Not found" });
      }
      const result = await scrapeCompetitor(parsed.data.competitorId);
      return res.json({ results: [result] });
    }

    const results = [];
    for (const competitor of (await listCompetitors()).filter((c) => c.enabled)) {
      results.push(await scrapeCompetitor(competitor.id));
    }
    return res.json({ results });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
