export type IntervalHours = 0 | 1 | 2 | 3 | 4 | 5;

/** 0 = Live mode (scrape every few minutes). */
export const LIVE_INTERVAL_MINUTES = 5;

export interface Competitor {
  id: string;
  name: string;
  sitemapUrl: string;
  intervalHours: IntervalHours;
  enabled: boolean;
  lastScrapedAt: string | null;
  nextScrapeAt: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  competitorId: string;
  competitorName: string;
  url: string;
  title: string;
  firstSeenAt: string;
  isNew: boolean;
}

export interface ScrapeRun {
  id: string;
  competitorId: string;
  startedAt: string;
  finishedAt: string | null;
  status: "success" | "error" | "baseline";
  urlsFound: number;
  newCount: number;
  error: string | null;
}

export const INTERVAL_OPTIONS: IntervalHours[] = [0, 1, 2, 3, 4, 5];

export function intervalLabel(hours: IntervalHours): string {
  if (hours === 0) return `Live (every ${LIVE_INTERVAL_MINUTES} min)`;
  return hours === 1 ? "Every 1 hour" : `Every ${hours} hours`;
}

export function intervalShortLabel(hours: IntervalHours): string {
  if (hours === 0) return "Live";
  return `${hours}h`;
}

export function msUntilNextScrape(hours: IntervalHours): number {
  if (hours === 0) return LIVE_INTERVAL_MINUTES * 60 * 1000;
  return hours * 60 * 60 * 1000;
}
