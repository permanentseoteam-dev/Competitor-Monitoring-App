import { listProducts, listRecentScrapeRuns, markAllProductsSeen, markProductSeen } from "@/lib/db";
import { requireApiSession } from "@/lib/dal";

export async function GET(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const competitorId = searchParams.get("competitorId") ?? undefined;
  const newOnly = searchParams.get("newOnly") !== "0";

  const [products, runs] = await Promise.all([
    listProducts({ competitorId, newOnly }),
    listRecentScrapeRuns(12),
  ]);

  return Response.json({ products, runs });
}

export async function PATCH(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as {
    id?: string;
    markAll?: boolean;
    competitorId?: string;
  };

  if (data.markAll) {
    const updated = await markAllProductsSeen(data.competitorId);
    return Response.json({ updated });
  }

  if (!data.id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const ok = await markProductSeen(data.id);
  if (!ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
