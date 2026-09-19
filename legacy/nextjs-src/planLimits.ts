/** Plan caps. `competitors: null` means unlimited. */
export const PLAN_LIMITS = {
  basic: {
    competitors: 2,
    scrapeNow: 4,
  },
  essential: {
    competitors: 4,
    scrapeNow: 8,
  },
  advance: {
    competitors: null as number | null,
    scrapeNow: 12,
  },
} as const;

const PLANS = ["basic", "essential", "advance"] as const;
type PlanId = (typeof PLANS)[number];

export function normalizeSubscriptionPlan(value: unknown): PlanId {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return (PLANS as readonly string[]).includes(key) ? (key as PlanId) : "basic";
}

export function getPlanLimits(plan: string | undefined | null) {
  const key = normalizeSubscriptionPlan(plan);
  return { plan: key, ...PLAN_LIMITS[key] };
}

export function formatCompetitorLimit(limit: number | null | undefined) {
  if (limit == null) return "Unlimited";
  return String(limit);
}

export function competitorLimitReached(
  plan: string | undefined | null,
  competitorCount: number,
) {
  const { competitors } = getPlanLimits(plan);
  if (competitors == null) return false;
  return Number(competitorCount) >= competitors;
}

export function scrapeNowRemaining(
  plan: string | undefined | null,
  used: number,
) {
  const { scrapeNow } = getPlanLimits(plan);
  return Math.max(0, scrapeNow - Number(used || 0));
}

export function scrapeNowLimitReached(
  plan: string | undefined | null,
  used: number,
) {
  return scrapeNowRemaining(plan, used) <= 0;
}
