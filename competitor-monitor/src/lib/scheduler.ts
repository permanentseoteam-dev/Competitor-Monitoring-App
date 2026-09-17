import { after } from "next/server";
import {
  listCompetitors,
  listDueCompetitors,
  updateCompetitor,
} from "@/lib/db";
import { scrapeCompetitor } from "@/lib/scrape";

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
    // Soft claim (~10 min) so another tick won't pick the same store.
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
 * Scrape any competitor whose nextScrapeAt is due.
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
 * Daily 9am job: scrape every enabled competitor, whether due or not.
 */
export async function runDailyMorningScrapes(): Promise<number> {
  const competitors = (await listCompetitors()).filter((c) => c.enabled);
  let ran = 0;
  for (const competitor of competitors) {
    if (await scrapeClaimed(competitor.id, competitor.name)) ran += 1;
  }
  return ran;
}

export function scheduleDueScrapes(): void {
  after(() => {
    void runDueScrapes().catch((error) => {
      console.error("[scheduler] due scrapes failed:", error);
    });
  });
}
