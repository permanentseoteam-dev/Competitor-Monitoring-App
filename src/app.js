"use strict";

const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");

const { requireAuth, optionalAuth } = require("./middleware/auth");
const pages = require("./routes/pages");
const authRoutes = require("./routes/auth");
const competitors = require("./routes/competitors");
const products = require("./routes/products");
const scrape = require("./routes/scrape");
const settings = require("./routes/settings");
const cron = require("./routes/cron");
const tick = require("./routes/tick");

function createApp() {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use(authRoutes);
  app.use(cron);
  app.use("/api", requireAuth);
  app.use(competitors);
  app.use(products);
  app.use(scrape);
  app.use(settings);
  app.use(tick);
  app.use(pages);

  app.use((err, _req, res, _next) => {
    console.error("[app]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: err.message || "Server error" });
  });

  return app;
}

module.exports = { createApp };
