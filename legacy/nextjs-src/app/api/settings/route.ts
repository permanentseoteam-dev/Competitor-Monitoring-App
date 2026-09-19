import { z } from "zod";
import { getSettings, updateSettings } from "@/lib/db";
import { requireApiSession } from "@/lib/dal";

const patchSchema = z.object({
  dailyCronEnabled: z.boolean(),
});

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const settings = await getSettings();
  return Response.json({ settings });
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const settings = await updateSettings(parsed.data);
  return Response.json({ settings });
}
