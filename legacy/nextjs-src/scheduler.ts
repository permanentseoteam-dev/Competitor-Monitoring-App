import {
  getSettings,
  listCompetitors,
  listDueCompetitors,
  updateCompetitor,
} from "@/lib/db";
import { scrapeCompetitor } from "@/lib/scrape";

/** Skip the daily job for stores scraped this recently (avoids double work). */
const RECENT_SCRAPE_MS = 12 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __competitorMonitorScrapeLock: Set<string> | undefined;
}

function getLock(): Set<string> {
  if (!globalThis.__competitorMonitorScrapeLock) {
    globalThis.__competitorMonitorScrapeLock = new Set();
  }
  return globalThis.__competitorMonitorScrapeLock;
}

async function scrapeClaimed(
  competitorId: string,
  competitorName: string,
): Promise<boolean> {
  const lock = getLock();
  if (lock.has(competitorId)) return false;
  lock.add(competitorId);
  try {
    // Soft claim so a overlapping invocation won't pick the same store.
    await updateCompetitor(competitorId, {
      nextScrapeAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    await scrapeCompetitor(competitorId);
    return true;
  } catch (error) {
    console.error(`[scheduler] scrape failed for ${competitorName}:`, error);
    return false;
  } finally {
    lock.delete(competitorId);
  }
}

/**
 * Scrape competitors whose nextScrapeAt is due. Used by explicit POST /api/tick.
 */
export async function runDueScrapes(): Promise<number> {
  const due = await listDueCompetitors();
  let ran = 0;
  for (const competitor of due) {
    if (await scrapeClaimed(competitor.id, competitor.name)) ran += 1;
  }
  return ran;
}

/**
 * Daily 9am job: scrape enabled stores that are due or have gone stale.
 * Skips stores scraped within the last 12 hours.
 */
export async function runDailyMorningScrapes(): Promise<number> {
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
