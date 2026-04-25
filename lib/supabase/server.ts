import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role client: server only. Bypasses RLS; never import in client components.
 * Uses SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) {
    return cached;
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const need: string[] = [];
    if (!url) {
      need.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL with your project https://…supabase.co URL)");
    }
    if (!key) {
      need.push("SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service role secret, never the anon key)");
    }
    throw new Error(
      `Missing: ${need.join(" ")}. For Render: Dashboard → your Web Service → Environment → add both, then clear build cache or redeploy if values were added after the first failed deploy.`,
    );
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return cached;
}
