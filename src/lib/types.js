"use strict";

const INTERVAL_OPTIONS = [5, 8, 12, 16, 18, 20];

const DEFAULT_SETTINGS = {
  dailyCronEnabled: true,
};

function isIntervalHours(value) {
  return INTERVAL_OPTIONS.includes(Number(value));
}

function normalizeIntervalHours(value) {
  const n = Number(value);
  return isIntervalHours(n) ? n : 5;
}

function intervalLabel(hours) {
  return `Every ${normalizeIntervalHours(hours)} hours`;
}

function intervalShortLabel(hours) {
  return `${normalizeIntervalHours(hours)}h`;
}

function msUntilNextScrape(hours) {
  return normalizeIntervalHours(hours) * 60 * 60 * 1000;
}

module.exports = {
  INTERVAL_OPTIONS,
  DEFAULT_SETTINGS,
  isIntervalHours,
  normalizeIntervalHours,
  intervalLabel,
  intervalShortLabel,
  msUntilNextScrape,
};
