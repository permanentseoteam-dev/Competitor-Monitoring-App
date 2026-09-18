// Scheduling uses Vercel Cron at /api/cron only.
// Dashboard reads never start scrapes; use Scrape now or the daily job.
export async function register() {}
