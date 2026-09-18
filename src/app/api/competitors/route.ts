import { after } from "next/server";
import { z } from "zod";
import {
  createCompetitor,
  deleteCompetitor,
  getCompetitor,
  listCompetitors,
  updateCompetitor,
} from "@/lib/db";
import { scrapeCompetitor } from "@/lib/scrape";
import { INTERVAL_OPTIONS } from "@/lib/types";
import { requireApiSession } from "@/lib/dal";

export const maxDuration = 60;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sitemapUrl: z.string().trim().min(1).max(2000),
  intervalHours: z.coerce
    .number()
    .refine((n): n is (typeof INTERVAL_OPTIONS)[number] =>
      (INTERVAL_OPTIONS as number[]).includes(n),
    ),
});

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const competitors = await listCompetitors();
  return Response.json({ competitors });
}

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const competitor = await createCompetitor(parsed.data);

    // Confirm the write is readable before responding (Blob can be briefly stale).
    let saved = await getCompetitor(competitor.id);
    if (!saved) {
      await new Promise((r) => setTimeout(r, 250));
      saved = (await getCompetitor(competitor.id)) ?? competitor;
    }

    after(async () => {
      try {
        // Small delay so the create write is visible to the scrape invocation.
        await new Promise((r) => setTimeout(r, 400));
        await scrapeCompetitor(competitor.id);
      } catch (error) {
        console.error("[competitors] baseline scrape failed:", error);
      }
    });

    return Response.json({ competitor: saved }, { status: 201 });
  } catch (error) {
    console.error("[competitors] create failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not add competitor",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const schema = createSchema.partial().extend({
    id: z.string().uuid(),
    enabled: z.boolean().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, ...patch } = parsed.data;
  if (!(await getCompetitor(id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const competitor = await updateCompetitor(id, patch);
    return Response.json({ competitor });
  } catch (error) {
    console.error("[competitors] update failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update competitor",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const ok = await deleteCompetitor(id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[competitors] delete failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not delete competitor",
      },
      { status: 500 },
    );
  }
}
