"use strict";

/**
 * Upgrade nag for Basic plan users.
 * Dismiss only snoozes briefly — reminders keep coming back.
 */
const pricingBanner = {
  enabled: true,
  title: "You're on Basic — unlock more stores",
  subtitle:
    "Essential & Advance add competitor slots, upload queue, daily scrapes, and priority runs.",
  priceLabel: "From $24.99/mo",
  ctaText: "Upgrade plan",
  ctaHref: "#",
  badge: "Upgrade",
  /** Soft snooze only — never permanently dismiss for Basic users */
  dismissible: true,
  snoozeMs: 45 * 60 * 1000,
  storageKey: "cm-upgrade-snooze-until",
  adminOnly: false,
  /** Show only while workspace subscription is Basic */
  basicOnly: true,
};

module.exports = { pricingBanner };
