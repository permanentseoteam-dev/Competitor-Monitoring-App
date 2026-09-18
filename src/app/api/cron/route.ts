import { runDailyMorningScrapes } from "@/lib/scheduler";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Vercel cron: daily at 09:00 Asia/Karachi (UTC+5) => 04:00 UTC
  const ran = await runDailyMorningScrapes();
  return Response.json({
    ok: true,
    ran,
    mode: "daily-9am",
    ranAt: new Date().toISOString(),
  });
}
