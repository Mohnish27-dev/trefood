/**
 * Runs once when the server boots.
 *
 * Starts the in-process scheduler for the sweeps and the nightly settlement —
 * see `src/server/scheduler.ts`. Node runtime only, and never on Vercel, where
 * there is no long-lived process and `vercel.json` crons do the job instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL) return;
  if (process.env.DISABLE_SCHEDULER === "1") return;

  const { startScheduler } = await import("@/server/scheduler");
  startScheduler();
}
