"use strict";

const express = require("express");
const { z } = require("zod");
const { getSettings, updateSettings } = require("../lib/db");

const router = express.Router();

const settingsSchema = z.object({
  dailyCronEnabled: z.boolean().optional(),
  brandName: z.string().trim().min(1).max(40).optional(),
  brandTagline: z.string().trim().min(1).max(80).optional(),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  pricingOfferEndsAt: z.string().datetime().optional().nullable(),
});

router.get("/api/settings", async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/settings", async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }
    const settings = await updateSettings(parsed.data);
    return res.json({ settings });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
