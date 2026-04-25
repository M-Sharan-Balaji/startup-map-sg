import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Pasted keys often have quotes, spaces, or a `Bearer` prefix (especially from hosting UIs).
 */
function normalizeServiceKey(raw: string): string {
  let k = raw.trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  return k;
}

/**
 * Service-role client: server only. Bypasses RLS; never import in client components.
 * Uses SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 *
 * **Key:** Use the **Secret** under “Secret keys” in the dashboard, *or* the **legacy**
 * `service_role` JWT (`eyJ…`) from **Project Settings → API** if you see "Invalid API key"
 * with new `sb_secret_` keys. Never use the **Publishable** key (`sb_publishable_…`) here.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) {
    return cached;
  }
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = rawUrl ? normalizeSupabaseUrl(rawUrl) : "";
  const key = rawKey ? normalizeServiceKey(rawKey) : "";
  if (!url || !key) {
    const need: string[] = [];
    if (!url) {
      need.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL with your project https://…supabase.co URL)");
    }
    if (!key) {
      need.push("SUPABASE_SERVICE_ROLE_KEY (Secret key or legacy service_role JWT — never the publishable key)");
    }
    throw new Error(
      `Missing: ${need.join(" ")}. For Render: Dashboard → your Web Service → Environment → add both, then clear build cache or redeploy if values were added after the first failed deploy.`,
    );
  }
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is a publishable (browser) key. Use the Secret key under “Secret keys”, or the legacy service_role JWT (eyJ…) from Project Settings → API.",
    );
  }
  if (key.length < 20) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks truncated. Copy the full secret from Supabase; Redeploy on Render after saving.",
    );
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return cached;
}
