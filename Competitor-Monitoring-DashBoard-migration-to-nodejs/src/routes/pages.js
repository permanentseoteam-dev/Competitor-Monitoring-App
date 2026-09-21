"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { pricingBanner } = require("../lib/pricingBanner");
const { INTERVAL_OPTIONS } = require("../lib/types");

const router = express.Router();

router.get("/", requireAuth, (_req, res) => {
  res.render("dashboard", {
    title: "Dashboard",
    pricingBanner,
    intervalOptions: INTERVAL_OPTIONS,
  });
});

module.exports = router;
