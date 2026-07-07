/**
 * Client-side Mythos session handling: reads `?lt=` off the URL once on load,
 * exchanges it for a verified session via /api/mythos/session, then exposes a
 * `reportMythosUsage` helper for billable actions. No-ops entirely if the app
 * wasn't opened from Mythos (no `lt` param) — normal direct visits are unaffected.
 */

export interface MythosClientSession {
  userId: string;
  email: string;
  displayName: string;
  listingId: string;
  sessionJti: string;
}

let session: MythosClientSession | null = null;
let initPromise: Promise<void> | null = null;

export function getMythosSession(): MythosClientSession | null {
  return session;
}

export function initMythosFromUrl(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const params = new URLSearchParams(window.location.search);
    const lt = params.get("lt");
    if (!lt) return;

    try {
      const res = await fetch(`/api/mythos/session?lt=${encodeURIComponent(lt)}`);
      if (res.ok) {
        const data = (await res.json()) as { session: MythosClientSession };
        session = data.session;
      }
    } catch {
      // Not launched from Mythos, or Mythos is unreachable — fall back to normal browsing.
    } finally {
      // The token is single-use and already consumed server-side; drop it from the URL.
      params.delete("lt");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", clean);
    }
  })();

  return initPromise;
}

export async function reportMythosUsage(credits: number, reason?: string): Promise<void> {
  if (!session) return;
  try {
    await fetch("/api/mythos/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionJti: session.sessionJti, credits, reason }),
    });
  } catch {
    // Non-fatal — never block the user's flow because usage reporting failed.
  }
}
