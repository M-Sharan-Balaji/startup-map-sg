import type { StartupStore } from "@/lib/startup";
import { startupToRow, toStartupStore, type StartupRow } from "@/lib/db/mappers";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const CHUNK = 80;

/**
 * All startup data lives in Supabase. Configure SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 * and SUPABASE_SERVICE_ROLE_KEY (server-only) — never expose the service key to the browser.
 */
export async function readStore(): Promise<StartupStore> {
  const supabase = getSupabaseAdmin();
  const { data: meta, error: metaErr } = await supabase
    .from("store_meta")
    .select("version, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (metaErr) {
    const hint =
      /Invalid API key|invalid api key|JWT|jwt/i.test(metaErr.message) ?
        " Fix: In Render, set SUPABASE_SERVICE_ROLE_KEY to the **Secret** key (or legacy **service_role** JWT `eyJ…` from Project Settings → API), not the publishable key. Then run supabase/migrations SQL if tables are missing."
        : " Run the SQL in supabase/migrations in your Supabase SQL editor if tables are missing.";
    throw new Error(`Supabase store_meta: ${metaErr.message}.${hint}`);
  }
  const { data: rows, error: rowsErr } = await supabase
    .from("startups")
    .select("*")
    .order("name", { ascending: true });
  if (rowsErr) {
    const hint =
      /Invalid API key|invalid api key|JWT|jwt/i.test(rowsErr.message) ?
        " Fix: use the **Secret** key or legacy **service_role** JWT in SUPABASE_SERVICE_ROLE_KEY (see README)."
        : " Run supabase/migrations SQL in Supabase if needed.";
    throw new Error(`Supabase startups: ${rowsErr.message}.${hint}`);
  }
  const version = meta?.version ?? 1;
  const updatedAt = meta?.updated_at ?? new Date().toISOString();
  return toStartupStore(version, updatedAt, (rows as StartupRow[]) || []);
}

/** Replace all rows and bump updated_at. */
export async function writeStore(next: StartupStore): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error: delErr } = await supabase.from("startups").delete().neq("id", "");
  if (delErr) {
    throw new Error(`Supabase clear startups: ${delErr.message}`);
  }
  if (next.startups.length > 0) {
    const rows = next.startups.map(startupToRow);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      const { error: insErr } = await supabase.from("startups").insert(part);
      if (insErr) {
        throw new Error(`Supabase insert startups: ${insErr.message}`);
      }
    }
  }
  const updatedAt = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("store_meta")
    .update({
      version: next.version,
      updated_at: updatedAt,
    })
    .eq("id", 1);
  if (upErr) {
    throw new Error(`Supabase store_meta update: ${upErr.message}`);
  }
}

export { rowToStartup, startupToRow, type StartupRow } from "@/lib/db/mappers";
