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
    throw new Error(
      `Supabase store_meta: ${metaErr.message}. Run the SQL in supabase/migrations in your project.`,
    );
  }
  const { data: rows, error: rowsErr } = await supabase
    .from("startups")
    .select("*")
    .order("name", { ascending: true });
  if (rowsErr) {
    throw new Error(
      `Supabase startups: ${rowsErr.message}. Run the SQL in supabase/migrations in your project.`,
    );
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
