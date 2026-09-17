/**
 * Pricing / upgrade promo shown on the dashboard.
 * Edit this file to change copy, price, CTA, or turn the banner off.
 */
export type PricingBannerConfig = {
  /** Set false to hide the banner without removing markup. */
  enabled: boolean;
  title: string;
  subtitle: string;
  /** Display price or plan label, e.g. "$29/mo" or "Pro · $49". */
  priceLabel: string;
  ctaText: string;
  /** Link target for the CTA (external URL, path, or mailto:). */
  ctaHref: string;
  /** Optional small pill above/beside the title. */
  badge?: string;
  /** Persist dismiss in localStorage when true (default true). */
  dismissible?: boolean;
  /** localStorage key used when dismissible. */
  storageKey?: string;
};

export const pricingBanner: PricingBannerConfig = {
  enabled: true,
  title: "Unlock Pro monitoring",
  subtitle:
    "Higher scrape limits, priority runs, and longer product history for growing catalogs.",
  priceLabel: "$29/mo",
  ctaText: "View plans",
  ctaHref: "#pricing",
  badge: "Pro",
  dismissible: true,
  storageKey: "cm-pricing-banner-dismissed",
};
