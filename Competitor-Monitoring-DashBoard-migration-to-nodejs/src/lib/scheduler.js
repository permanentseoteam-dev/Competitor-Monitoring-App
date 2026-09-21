"use strict";

const {
  getSettings,
  listCompetitors,
  listDueCompetitors,
  purgeExpiredProducts,
  updateCompetitor,
} = require("./db");
const { scrapeCompetitor } = require("./scrape");

const RECENT_SCRAPE_MS = 12 * 60 * 60 * 1000;

const scrapeLock = new Set();

async function scrapeClaimed(competitorId, competitorName) {
  if (scrapeLock.has(competitorId)) return false;
  scrapeLock.add(competitorId);
  try {
    await updateCompetitor(competitorId, {
      nextScrapeAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    await scrapeCompetitor(competitorId);
    return true;
  } catch (error) {
    console.error(`[scheduler] scrape failed for ${competitorName}:`, error);
    return false;
  } finally {
    scrapeLock.delete(competitorId);
  }
}

async function runDueScrapes() {
  await purgeExpiredProducts();
  const due = await listDueCompetitors();
  let ran = 0;
  for (const competitor of due) {
    if (await scrapeClaimed(competitor.id, competitor.name)) ran += 1;
  }
  return ran;
}

async function runDailyMorningScrapes() {
  await purgeExpiredProducts();
  if (!(await getSettings()).dailyCronEnabled) return 0;

  const competitors = (await listCompetitors()).filter((c) => c.enabled);
  const now = Date.now();
  let ran = 0;
  for (const competitor of competitors) {
    const last = competitor.lastScrapedAt
      ? new Date(competitor.lastScrapedAt).getTime()
      : 0;
    const due =
      !competitor.nextScrapeAt ||
      new Date(competitor.nextScrapeAt).getTime() <= now;
    const stale = now - last >= RECENT_SCRAPE_MS;
    if (!due && !stale) continue;
    if (await scrapeClaimed(competitor.id, competitor.name)) ran += 1;
  }
  return ran;
}

module.exports = { runDueScrapes, runDailyMorningScrapes };
