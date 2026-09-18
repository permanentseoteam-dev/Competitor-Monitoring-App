export type IntervalHours = 5 | 8 | 12 | 16 | 18 | 20;

export type MonitorSettings = {
  dailyCronEnabled: boolean;
};

export const DEFAULT_SETTINGS: MonitorSettings = {
  dailyCronEnabled: true,
};

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

export const INTERVAL_OPTIONS: IntervalHours[] = [5, 8, 12, 16, 18, 20];

export function isIntervalHours(value: number): value is IntervalHours {
  return (INTERVAL_OPTIONS as number[]).includes(value);
}

/** Map legacy live/1–4h values to the new 5h minimum. */
export function normalizeIntervalHours(value: number): IntervalHours {
  return isIntervalHours(value) ? value : 5;
}

export function intervalLabel(hours: IntervalHours): string {
  return `Every ${hours} hours`;
}

export function intervalShortLabel(hours: IntervalHours): string {
  return `${hours}h`;
}

export function msUntilNextScrape(hours: IntervalHours): number {
  return normalizeIntervalHours(hours) * 60 * 60 * 1000;
}
