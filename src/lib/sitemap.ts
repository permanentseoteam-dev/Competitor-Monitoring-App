import { XMLParser } from "fast-xml-parser";

const USER_AGENT =
  "Mozilla/5.0 (compatible; CompetitorMonitor/1.1; +https://vercel.com)";

const NON_PRODUCT_HINTS = [
  "/cart",
  "/checkout",
  "/account",
  "/login",
  "/search",
  "/wishlist",
  "/blogs/",
  "/blog/",
  "/news/",
  "/tag/",
  "/tags/",
  "/author/",
  "/wp-content/",
  "/cdn-cgi/",
  "/policies/",
  "/policy/",
];

const PRODUCT_HINTS = [
  "/product/",
  "/products/",
  "/product-",
  "/p/",
  "/shop/",
  "/item/",
  "/dp/",
  "/goods/",
];

const MAX_SITEMAPS = 25;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractLoc(entry: unknown): string | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    return trimmed ? trimmed : null;
  }
  if (!entry || typeof entry !== "object") return null;
  const loc = (entry as { loc?: unknown }).loc;
  if (typeof loc === "string") return loc.trim();
  if (loc && typeof loc === "object" && "#text" in (loc as object)) {
    return String((loc as { "#text": string })["#text"]).trim();
  }
  return null;
}

export function normalizeSitemapUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);

  const path = url.pathname.replace(/\/+$/, "") || "";
  if (/sitemap/i.test(path) || path.endsWith(".xml") || path.endsWith(".gz")) {
    return url.toString();
  }

  url.pathname = "/sitemap.xml";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function titleFromProductUrl(productUrl: string): string {
  try {
    const { pathname } = new URL(productUrl);
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] || productUrl;
    return decodeURIComponent(slug)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return productUrl;
  }
}

function isJunkUrl(productUrl: string): boolean {
  let pathname = "";
  try {
    pathname = new URL(productUrl).pathname.toLowerCase();
  } catch {
    return true;
  }

  if (
    pathname.endsWith(".xml") ||
    pathname.endsWith(".gz") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  ) {
    return true;
  }

  return NON_PRODUCT_HINTS.some((hint) => pathname.includes(hint));
}

function looksLikeProductUrl(productUrl: string): boolean {
  if (isJunkUrl(productUrl)) return false;

  let pathname = "";
  try {
    pathname = new URL(productUrl).pathname.toLowerCase();
  } catch {
    return false;
  }

  if (PRODUCT_HINTS.some((hint) => pathname.includes(hint))) {
    return true;
  }

  const depth = pathname.split("/").filter(Boolean).length;
  return depth >= 1 && pathname !== "/";
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (
    contentType.includes("text/html") &&
    /<!doctype html|<html/i.test(text.slice(0, 300))
  ) {
    throw new Error(
      `Expected XML sitemap but got HTML from ${url}. Check the store/sitemap URL.`,
    );
  }

  return text;
}

function parseXml(xml: string): Record<string, unknown> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
    isArray: (name) => ["sitemap", "url"].includes(name),
  });
  return parser.parse(xml) as Record<string, unknown>;
}

function childSitemapUrls(doc: Record<string, unknown>): string[] {
  const index = doc.sitemapindex as Record<string, unknown> | undefined;
  if (!index) return [];
  return asArray(index.sitemap)
    .map(extractLoc)
    .filter((loc): loc is string => Boolean(loc));
}

function urlsetLocs(doc: Record<string, unknown>): string[] {
  const urlset = doc.urlset as Record<string, unknown> | undefined;
  if (!urlset) return [];
  return asArray(urlset.url)
    .map(extractLoc)
    .filter((loc): loc is string => Boolean(loc));
}

function rankSitemap(url: string): number {
  if (/product/i.test(url)) return 0;
  if (/shop|item|catalog|goods/i.test(url)) return 1;
  if (/page|post|blog|image|video/i.test(url)) return 3;
  return 2;
}

function sortSitemaps(urls: string[]): string[] {
  return [...urls].sort((a, b) => rankSitemap(a) - rankSitemap(b) || a.localeCompare(b));
}

async function discoverSitemapsFromRobots(origin: string): Promise<string[]> {
  try {
    const robots = await fetchText(new URL("/robots.txt", origin).toString());
    return robots
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^sitemap:\s+/i.test(line))
      .map((line) => line.replace(/^sitemap:\s+/i, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function pickUrlsFromLocs(locs: string[], fromProductSitemap: boolean): string[] {
  const products = locs.filter(looksLikeProductUrl);
  if (products.length > 0) return products;
  if (fromProductSitemap) {
    return locs.filter((loc) => !isJunkUrl(loc));
  }
  return locs.filter((loc) => !isJunkUrl(loc) && looksLikeProductUrl(loc));
}

export async function collectProductUrlsFromSitemap(
  sitemapUrlInput: string,
): Promise<{ sitemapUrl: string; urls: string[]; sitemapsFetched: number }> {
  const sitemapUrl = normalizeSitemapUrl(sitemapUrlInput);
  const origin = new URL(sitemapUrl).origin;

  const visited = new Set<string>();
  const queue: string[] = [sitemapUrl];
  const discovered = new Set<string>();
  let sitemapsFetched = 0;

  // Also seed from robots.txt when possible.
  for (const extra of await discoverSitemapsFromRobots(origin)) {
    if (!queue.includes(extra)) queue.push(extra);
  }

  while (queue.length > 0 && sitemapsFetched < MAX_SITEMAPS) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    let xml: string;
    try {
      xml = await fetchText(current);
    } catch (error) {
      // Skip missing child sitemaps; fail only if the root sitemap fails.
      if (current === sitemapUrl && discovered.size === 0 && queue.length === 0) {
        throw error;
      }
      continue;
    }

    sitemapsFetched += 1;
    const doc = parseXml(xml);
    const children = sortSitemaps(childSitemapUrls(doc));

    if (children.length > 0) {
      for (const child of children) {
        if (!visited.has(child) && !queue.includes(child)) queue.push(child);
      }
      continue;
    }

    const locs = urlsetLocs(doc);
    const fromProductSitemap = /product/i.test(current);
    for (const loc of pickUrlsFromLocs(locs, fromProductSitemap)) {
      discovered.add(loc);
    }
  }

  return {
    sitemapUrl,
    urls: [...discovered],
    sitemapsFetched,
  };
}
