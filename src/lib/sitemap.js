"use strict";

const { XMLParser } = require("fast-xml-parser");

const USER_AGENT =
  "Mozilla/5.0 (compatible; CompetitorMonitor/1.1; +https://hostinger.com)";

const NON_PRODUCT_HINTS = [
  "/cart", "/checkout", "/account", "/login", "/search", "/wishlist",
  "/blogs/", "/blog/", "/news/", "/tag/", "/tags/", "/author/",
  "/wp-content/", "/cdn-cgi/", "/policies/", "/policy/",
];

const PRODUCT_HINTS = [
  "/product/", "/products/", "/product-", "/p/", "/shop/", "/item/", "/dp/", "/goods/",
];

const MAX_SITEMAPS = 12;

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractLoc(entry) {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    return trimmed || null;
  }
  if (!entry || typeof entry !== "object") return null;
  const loc = entry.loc;
  if (typeof loc === "string") return loc.trim();
  if (loc && typeof loc === "object" && "#text" in loc) {
    return String(loc["#text"]).trim();
  }
  return null;
}

function normalizeSitemapUrl(input) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);
  const pathname = url.pathname.replace(/\/+$/, "") || "";
  if (/sitemap/i.test(pathname) || pathname.endsWith(".xml") || pathname.endsWith(".gz")) {
    return url.toString();
  }
  url.pathname = "/sitemap.xml";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function titleFromProductUrl(productUrl) {
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

function isJunkUrl(productUrl) {
  let pathname = "";
  try {
    pathname = new URL(productUrl).pathname.toLowerCase();
  } catch {
    return true;
  }
  if (
    pathname.endsWith(".xml") || pathname.endsWith(".gz") ||
    pathname.endsWith(".jpg") || pathname.endsWith(".jpeg") ||
    pathname.endsWith(".png") || pathname.endsWith(".webp") ||
    pathname.endsWith(".gif") || pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  ) {
    return true;
  }
  return NON_PRODUCT_HINTS.some((hint) => pathname.includes(hint));
}

function looksLikeProductUrl(productUrl) {
  if (isJunkUrl(productUrl)) return false;
  let pathname = "";
  try {
    pathname = new URL(productUrl).pathname.toLowerCase();
  } catch {
    return false;
  }
  if (PRODUCT_HINTS.some((hint) => pathname.includes(hint))) return true;
  const depth = pathname.split("/").filter(Boolean).length;
  return depth >= 1 && pathname !== "/";
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
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

function parseXml(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
    isArray: (name) => ["sitemap", "url"].includes(name),
  });
  return parser.parse(xml);
}

function childSitemapUrls(doc) {
  const index = doc.sitemapindex;
  if (!index) return [];
  return asArray(index.sitemap).map(extractLoc).filter(Boolean);
}

function urlsetLocs(doc) {
  const urlset = doc.urlset;
  if (!urlset) return [];
  return asArray(urlset.url).map(extractLoc).filter(Boolean);
}

function rankSitemap(url) {
  if (/product/i.test(url)) return 0;
  if (/shop|item|catalog|goods/i.test(url)) return 1;
  if (/page|post|blog|image|video/i.test(url)) return 3;
  return 2;
}

function sortSitemaps(urls) {
  return [...urls].sort(
    (a, b) => rankSitemap(a) - rankSitemap(b) || a.localeCompare(b),
  );
}

async function discoverSitemapsFromRobots(origin) {
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

function pickUrlsFromLocs(locs, fromProductSitemap) {
  const products = locs.filter(looksLikeProductUrl);
  if (products.length > 0) return products;
  if (fromProductSitemap) return locs.filter((loc) => !isJunkUrl(loc));
  return locs.filter((loc) => !isJunkUrl(loc) && looksLikeProductUrl(loc));
}

async function collectProductUrlsFromSitemap(sitemapUrlInput) {
  const sitemapUrl = normalizeSitemapUrl(sitemapUrlInput);
  const origin = new URL(sitemapUrl).origin;
  const visited = new Set();
  const queue = [sitemapUrl];
  const discovered = new Set();
  let sitemapsFetched = 0;

  for (const extra of await discoverSitemapsFromRobots(origin)) {
    if (!queue.includes(extra)) queue.push(extra);
  }

  while (queue.length > 0 && sitemapsFetched < MAX_SITEMAPS) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    let xml;
    try {
      xml = await fetchText(current);
    } catch (error) {
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

module.exports = {
  normalizeSitemapUrl,
  titleFromProductUrl,
  collectProductUrlsFromSitemap,
};
