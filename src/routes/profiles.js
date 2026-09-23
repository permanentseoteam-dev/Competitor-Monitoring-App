"use strict";

const express = require("express");
const { z } = require("zod");
const {
  createProfile,
  createInviteLink,
  deleteProfile,
  findProfileById,
  getPlanUsage,
  getRevenueStats,
  listInvites,
  listProfiles,
  revokeInvite,
  updateProfile,
} = require("../lib/db");
const {
  ROLES,
  assignableRolesFor,
  isPlanAdminRole,
  isSuperAdminRole,
  normalizeRole,
} = require("../lib/roles");

const router = express.Router();
const roleEnum = z.enum(ROLES);
const AVATAR_EMOJIS = [
  "👔",
  "💼",
  "👤",
  "📊",
  "📈",
  "📉",
  "🎯",
  "🔍",
  "📝",
  "📋",
  "📁",
  "📌",
  "🏢",
  "🧠",
  "🔬",
  "💻",
  "⚙️",
  "🔑",
  "⭐",
];

function defaultEmojiForRole(role) {
  const key = normalizeRole(role);
  if (key === "super-admin") return "⭐";
  if (key === "admin") return "💼";
  return "👔";
}

function getEffectivePlanUsage(planUsage, role) {
  if (isSuperAdminRole(role) && planUsage) {
    return {
      ...planUsage,
      competitors: planUsage.competitors
        ? {
            ...planUsage.competitors,
            unlimited: true,
            limit: null,
            remaining: null,
          }
        : planUsage.competitors,
      seats: planUsage.seats
        ? {
            ...planUsage.seats,
            unlimited: true,
            limit: null,
            remaining: null,
          }
        : planUsage.seats,
    };
  }
  return planUsage;
}

function requirePlanAdmin(req, res, next) {
  if (!isPlanAdminRole(req.session?.role)) {
    return res.status(403).json({ error: "Admin only" });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminRole(req.session?.role)) {
    return res.status(403).json({ error: "Super Admin only" });
  }
  return next();
}

router.get("/api/profiles", requirePlanAdmin, async (req, res, next) => {
  try {
    const [profiles, planUsage, invites] = await Promise.all([
      listProfiles(),
      getPlanUsage(),
      listInvites(),
    ]);
    res.json({
      profiles,
      invites: invites.filter((inv) => inv.status === "pending"),
      avatarEmojis: AVATAR_EMOJIS,
      planUsage: getEffectivePlanUsage(planUsage, req.session?.role),
    });
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
      role: req.session?.role || "user",
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
    base.role = normalizeRole(base.role);
    if (!base.avatarEmoji) {
      base.avatarEmoji = defaultEmojiForRole(base.role);
    }
    if (base.avatarEmoji === "🛡️" || base.avatarEmoji === "🛡") {
      base.avatarEmoji = "💼";
    }
    res.json({ user: base, avatarEmojis: AVATAR_EMOJIS });
  } catch (error) {
    next(error);
  }
});

router.get("/api/revenue", requireSuperAdmin, async (_req, res, next) => {
  try {
    const revenue = await getRevenueStats();
    res.json({ revenue });
  } catch (error) {
    next(error);
  }
});

router.post("/api/profiles", requirePlanAdmin, async (req, res, next) => {
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

    const actorRole = normalizeRole(req.session?.role);
    const allowed = assignableRolesFor(actorRole);
    let role = normalizeRole(parsed.data.role || "user");
    if (!allowed.includes(role)) {
      if (actorRole === "admin") {
        role = "user";
      } else {
        return res.status(403).json({ error: "Cannot assign that role" });
      }
    }

    const enforceSeatLimit = actorRole !== "super-admin";
    const profile = await createProfile({
      ...parsed.data,
      role,
      enforceSeatLimit,
    });
    const planUsage = await getPlanUsage();
    return res.status(201).json({ profile, planUsage: getEffectivePlanUsage(planUsage, req.session?.role) });
  } catch (error) {
    if (error?.code === "SEAT_LIMIT") {
      return res.status(403).json({
        error: error.message,
        code: "SEAT_LIMIT",
        planUsage: error.planUsage || null,
      });
    }
    return res.status(400).json({ error: error.message || "Could not create profile" });
  }
});

router.get("/api/invites", requirePlanAdmin, async (_req, res, next) => {
  try {
    const [invites, planUsage] = await Promise.all([listInvites(), getPlanUsage()]);
    res.json({
      invites: invites.filter((inv) => inv.status === "pending"),
      planUsage: getEffectivePlanUsage(planUsage, req.session?.role),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/api/invites/generate", requirePlanAdmin, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        role: z.enum(["user", "admin"]).optional(),
        note: z.string().trim().max(120).optional(),
      })
      .safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid invite payload" });
    }

    const actorRole = normalizeRole(req.session?.role);
    let role = parsed.data.role || "user";
    if (actorRole === "admin") role = "user";
    if (role === "admin" && actorRole !== "super-admin") {
      return res.status(403).json({ error: "Only Super Admin can invite Admins" });
    }

    const invite = await createInviteLink({
      role,
      note: parsed.data.note || "",
      createdBy: req.session?.userId || null,
      enforceSeatLimit: actorRole !== "super-admin",
    });
    const planUsage = await getPlanUsage();
    const origin =
      `${req.protocol}://${req.get("host")}` || "http://localhost:3000";
    return res.status(201).json({
      invite,
      inviteUrl: `${origin}/invite/${invite.token}`,
      planUsage,
    });
  } catch (error) {
    if (error?.code === "SEAT_LIMIT") {
      return res.status(403).json({
        error: error.message,
        code: "SEAT_LIMIT",
        planUsage: error.planUsage || null,
      });
    }
    return res.status(400).json({ error: error.message || "Could not generate invite" });
  }
});

/** Direct create still available for Super Admin “Add Admin” form. */
router.post("/api/invites", requirePlanAdmin, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        username: z.string().trim().min(2).max(120),
        password: z.string().min(6).max(200),
        displayName: z.string().trim().min(1).max(80).optional(),
        role: z.enum(["user", "admin"]).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid invite payload",
        details: parsed.error.flatten(),
      });
    }

    const actorRole = normalizeRole(req.session?.role);
    let role = parsed.data.role || "user";
    if (actorRole === "admin") role = "user";
    if (role === "admin" && actorRole !== "super-admin") {
      return res.status(403).json({ error: "Only Super Admin can add Admins" });
    }

    const profile = await createProfile({
      username: parsed.data.username,
      password: parsed.data.password,
      displayName: parsed.data.displayName,
      role,
      enforceSeatLimit: actorRole !== "super-admin",
    });
    const planUsage = await getPlanUsage();
    return res.status(201).json({ profile, planUsage: getEffectivePlanUsage(planUsage, req.session?.role) });
  } catch (error) {
    if (error?.code === "SEAT_LIMIT") {
      return res.status(403).json({
        error: error.message,
        code: "SEAT_LIMIT",
        planUsage: error.planUsage || null,
      });
    }
    return res.status(400).json({ error: error.message || "Could not invite user" });
  }
});

router.delete("/api/invites", requirePlanAdmin, async (req, res, next) => {
  try {
    const id =
      typeof req.body?.id === "string"
        ? req.body.id
        : typeof req.query.id === "string"
          ? req.query.id
          : "";
    if (!id) return res.status(400).json({ error: "Missing id" });
    const ok = await revokeInvite(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    const planUsage = await getPlanUsage();
    return res.json({ ok: true, planUsage: getEffectivePlanUsage(planUsage, req.session?.role) });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not revoke invite" });
  }
});

router.patch("/api/profiles", requirePlanAdmin, async (req, res, next) => {
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

    const actorRole = normalizeRole(req.session?.role);
    if (parsed.data.role) {
      const allowed = assignableRolesFor(actorRole);
      if (!allowed.includes(normalizeRole(parsed.data.role))) {
        return res.status(403).json({ error: "Cannot assign that role" });
      }
      if (actorRole === "admin" && normalizeRole(parsed.data.role) !== "user") {
        return res.status(403).json({ error: "Admins can only manage Users" });
      }
    }

    const { id, ...patch } = parsed.data;
    if (actorRole === "admin") {
      const target = await findProfileById(id);
      if (!target) return res.status(404).json({ error: "Not found" });
      if (normalizeRole(target.role) !== "user") {
        return res.status(403).json({ error: "Admins can only manage Users" });
      }
    }

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

router.delete("/api/profiles", requirePlanAdmin, async (req, res, next) => {
  try {
    const id =
      typeof req.body?.id === "string"
        ? req.body.id
        : typeof req.query.id === "string"
          ? req.query.id
          : "";
    if (!id) return res.status(400).json({ error: "Missing id" });

    const actorRole = normalizeRole(req.session?.role);
    if (actorRole === "admin") {
      const target = await findProfileById(id);
      if (!target) return res.status(404).json({ error: "Not found" });
      if (normalizeRole(target.role) !== "user") {
        return res.status(403).json({ error: "Admins can only remove Users" });
      }
    }

    const ok = await deleteProfile(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    const planUsage = await getPlanUsage();
    return res.json({ ok: true, planUsage: getEffectivePlanUsage(planUsage, req.session?.role) });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Could not delete profile" });
  }
});

module.exports = router;
