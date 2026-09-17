import { listDueCompetitors } from "./db";
import { scrapeCompetitor } from "./scrape";

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

export async function runDueScrapes(): Promise<void> {
  const due = await listDueCompetitors();
  const lock = getLock();

  for (const competitor of due) {
    if (lock.has(competitor.id)) continue;
    lock.add(competitor.id);
    try {
      await scrapeCompetitor(competitor.id);
    } catch (error) {
      console.error(
        `[scheduler] scrape failed for ${competitor.name}:`,
        error,
      );
    } finally {
      lock.delete(competitor.id);
    }
  }
}
