// No long-lived process on Vercel. Scheduling uses:
// 1) /api/cron (Vercel Cron)
// 2) due-scrape checks on dashboard API reads
export async function register() {}
