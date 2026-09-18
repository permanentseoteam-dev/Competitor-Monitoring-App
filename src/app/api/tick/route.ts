import { requireApiSession } from "@/lib/dal";
import { runDueScrapes } from "@/lib/scheduler";

export const maxDuration = 60;

/**
 * Explicit due-scrape runner. Not called by the dashboard.
 * Use from a cron (Pro) or a manual request — GET does not scrape.
 */
export async function GET() {
  return Response.json(
    {
      error: "Use POST to run due scrapes",
    },
    {
      status: 405,
      headers: { Allow: "POST" },
    },
  );
}

export async function POST() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const ran = await runDueScrapes();
  return Response.json({
    ok: true,
    ran,
    checkedAt: new Date().toISOString(),
  });
}
