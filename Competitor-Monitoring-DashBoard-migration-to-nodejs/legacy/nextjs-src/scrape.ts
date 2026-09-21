import {
  countProductsForCompetitor,
  createScrapeRun,
  finishScrapeRun,
  getCompetitor,
  getExistingProductUrls,
  insertProducts,
  scheduleNextScrape,
  updateCompetitor,
} from "./db";
import {
  collectProductUrlsFromSitemap,
  normalizeSitemapUrl,
  titleFromProductUrl,
} from "./sitemap";

export type ScrapeResult = {
  competitorId: string;
  status: "success" | "error" | "baseline";
  urlsFound: number;
  newCount: number;
  error?: string;
};

export async function scrapeCompetitor(
  competitorId: string,
): Promise<ScrapeResult> {
  const competitor = await getCompetitor(competitorId);
  if (!competitor) {
    return {
      competitorId,
      status: "error",
      urlsFound: 0,
      newCount: 0,
      error: "Competitor not found",
    };
  }

  const runId = await createScrapeRun(competitorId);

  try {
    const normalized = normalizeSitemapUrl(competitor.sitemapUrl);
    if (normalized !== competitor.sitemapUrl) {
      await updateCompetitor(competitorId, { sitemapUrl: normalized });
    }

    const { urls, sitemapsFetched } =
      await collectProductUrlsFromSitemap(normalized);

    if (urls.length === 0) {
      const message = `No product URLs found after reading ${sitemapsFetched} sitemap file(s). Check that the store exposes a product sitemap.`;
      await finishScrapeRun(runId, {
        status: "error",
        urlsFound: 0,
        newCount: 0,
        error: message,
      });
      await scheduleNextScrape(competitorId, competitor.intervalHours);
      return {
        competitorId,
        status: "error",
        urlsFound: 0,
        newCount: 0,
        error: message,
      };
    }

    const existingCount = await countProductsForCompetitor(competitorId);
    const isBaseline = existingCount === 0;

    const existing = await getExistingProductUrls(competitorId);
    const fresh = urls
      .filter((url) => !existing.has(url))
      .map((url) => ({ url, title: titleFromProductUrl(url) }));

    const inserted = await insertProducts(
      competitorId,
      fresh,
      /* isNew */ !isBaseline,
    );

    const status = isBaseline ? "baseline" : "success";
    await finishScrapeRun(runId, {
      status,
      urlsFound: urls.length,
      newCount: isBaseline ? 0 : inserted,
    });
    await scheduleNextScrape(competitorId, competitor.intervalHours);

    return {
      competitorId,
      status,
      urlsFound: urls.length,
      newCount: isBaseline ? 0 : inserted,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scrape error";
    await finishScrapeRun(runId, {
      status: "error",
      urlsFound: 0,
      newCount: 0,
      error: message,
    });
    await scheduleNextScrape(competitorId, competitor.intervalHours);
    return {
      competitorId,
      status: "error",
      urlsFound: 0,
      newCount: 0,
      error: message,
    };
  }
}
