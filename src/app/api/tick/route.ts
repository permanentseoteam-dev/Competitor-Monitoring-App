import { requireApiSession } from "@/lib/dal";
import { runDueScrapes } from "@/lib/scheduler";

export const maxDuration = 60;

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const ran = await runDueScrapes();
  return Response.json({
    ok: true,
    ran,
    checkedAt: new Date().toISOString(),
  });
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
