import { runDueScrapes } from "@/lib/scheduler";

export const maxDuration = 60;

export async function GET() {
  const ran = await runDueScrapes();
  return Response.json({
    ok: true,
    ran,
    checkedAt: new Date().toISOString(),
  });
}

export async function POST() {
  const ran = await runDueScrapes();
  return Response.json({
    ok: true,
    ran,
    checkedAt: new Date().toISOString(),
  });
}
