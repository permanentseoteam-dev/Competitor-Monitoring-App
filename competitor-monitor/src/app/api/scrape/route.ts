import { z } from "zod";
import { getCompetitor, listCompetitors } from "@/lib/db";
import { scrapeCompetitor } from "@/lib/scrape";

const schema = z.object({
  competitorId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (parsed.data.competitorId) {
    if (!(await getCompetitor(parsed.data.competitorId))) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const result = await scrapeCompetitor(parsed.data.competitorId);
    return Response.json({ results: [result] });
  }

  const results = [];
  for (const competitor of (await listCompetitors()).filter((c) => c.enabled)) {
    results.push(await scrapeCompetitor(competitor.id));
  }
  return Response.json({ results });
}
