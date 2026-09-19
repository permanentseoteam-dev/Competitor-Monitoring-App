"use strict";

const express = require("express");
const { z } = require("zod");
const {
  createProfile,
  deleteProfile,
  findProfileById,
  listProfiles,
  updateProfile,
} = require("../lib/db");
const { ROLES } = require("../lib/roles");

const router = express.Router();
const roleEnum = z.enum(ROLES);
const AVATAR_EMOJIS = [
  "👔",
  "🧑‍💼",
  "👨‍💻",
  "👩‍💻",
  "🧑‍🔬",
  "📊",
  "🎯",
  "🚀",
  "⭐",
  "💼",
];

router.get("/api/profiles", async (_req, res, next) => {
  try {
    const profiles = await listProfiles();
    res.json({ profiles, avatarEmojis: AVATAR_EMOJIS });
  } catch (error) {
    next(error);
  }
});

router.get("/api/me", async (req, res, next) => {
  try {
    const base = {
      id: req.session?.userId || null,
      username: req.session?.username || null,
      displayName: req.session?.displayName || null,
      role: req.session?.role || "seo-analystic",
      avatarEmoji: "",
      avatarImage: "",
    };
    if (base.id) {
      const profile = await findProfileById(base.id);
      if (profile) {
        base.displayName = profile.displayName || base.displayName;
        base.avatarEmoji = profile.avatarEmoji || "";
        base.avatarImage = profile.avatarImage || "";
        base.role = profile.role || base.role;
      }
    }
    if (!base.avatarEmoji) {
      const role = String(base.role || "").toLowerCase();
      base.avatarEmoji =
        role === "owner" ? "⭐" : role === "admin" ? "💼" : "👔";
    }
    if (base.avatarEmoji === "🛡️" || base.avatarEmoji === "🛡") {
      base.avatarEmoji = "💼";
    }
    res.json({ user: base, avatarEmojis: AVATAR_EMOJIS });
  } catch (error) {
    next(error);
  }
});

router.post("/api/profiles", async (req, res, next) => {
  try {
    const parsed = z
      .object({
        username: z.string().trim().min(2).max(120),
        password: z.string().min(6).max(200),
        displayName: z.string().trim().min(1).max(80).optional(),
        role: roleEnum.optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid profile payload",
        details: parsed.error.flatten(),
      });
    }
    const profile = await createProfile(parsed.data);
    return res.status(201).json({ profile });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not create profile" });
  }
});

router.patch("/api/profiles", async (req, res, next) => {
  try {
    const parsed = z
      .object({
        id: z.string().uuid(),
        username: z.string().trim().min(2).max(120).optional(),
        password: z.string().min(6).max(200).optional(),
        displayName: z.string().trim().min(1).max(80).optional(),
        role: roleEnum.optional(),
        avatarEmoji: z.string().trim().max(24).optional(),
        avatarImage: z
          .union([
            z.null(),
            z.string().startsWith("data:image/").max(220000),
          ])
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid profile payload",
        details: parsed.error.flatten(),
      });
    }
    const { id, ...patch } = parsed.data;
    const profile = await updateProfile(id, patch);
    if (!profile) return res.status(404).json({ error: "Not found" });
    return res.json({ profile });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not update profile" });
  }
});

router.patch("/api/me/avatar", async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const parsed = z
      .object({
        avatarEmoji: z.string().trim().max(24).optional(),
        avatarImage: z
          .union([
            z.null(),
            z.string().startsWith("data:image/").max(220000),
          ])
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid avatar payload" });
    }
    if (
      parsed.data.avatarEmoji === undefined &&
      parsed.data.avatarImage === undefined
    ) {
      return res.status(400).json({ error: "Nothing to update" });
    }
    const profile = await updateProfile(userId, parsed.data);
    if (!profile) return res.status(404).json({ error: "Not found" });
    return res.json({ profile });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not update avatar" });
  }
});

router.delete("/api/profiles", async (req, res, next) => {
  try {
    const id =
      typeof req.body?.id === "string"
        ? req.body.id
        : typeof req.query.id === "string"
          ? req.query.id
          : "";
    if (!id) return res.status(400).json({ error: "Missing id" });
    const ok = await deleteProfile(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not delete profile" });
  }
});

module.exports = router;
