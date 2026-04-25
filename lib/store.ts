import type { StartupStore } from "@/lib/startup";
import { startupToRow, toStartupStore, type StartupRow } from "@/lib/db/mappers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";

const CHUNK = 80;

function isMissingGeocodeColumnError(err: PostgrestError | null): boolean {
  const m = (err?.message || "").toLowerCase();
  return (
    m.includes("address_text") ||
    m.includes("location_source") ||
    m.includes("schema cache")
  );
}

function withoutGeocodeColumns(
  rows: StartupRow[],
): Omit<StartupRow, "address_text" | "location_source">[] {
  return rows.map(({ address_text: _a, location_source: _l, ...rest }) => rest);
}

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

/**
 * Writes the next store snapshot. Uses upsert by `id` then deletes rows that are
 * no longer in `next` — we **do not** clear the table first, so a failed write cannot
 * wipe all startups (unlike delete-then-insert).
 * If the DB has not had migration `20260427120000_startups_address_geocode.sql` applied,
 * we retry without `address_text` / `location_source` when PostgREST complains.
 */
export async function writeStore(next: StartupStore): Promise<void> {
  const supabase = getSupabaseAdmin();
  const newIds = new Set(next.startups.map((s) => s.id));
  const { data: currentRows, error: curErr } = await supabase
    .from("startups")
    .select("id");
  if (curErr) {
    throw new Error(`Supabase list startup ids: ${curErr.message}`);
  }
  const currentIds = (currentRows || []).map((r) => r.id as string);

  const rows = next.startups.map(startupToRow);
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const { error: upErr } = await supabase.from("startups").upsert(part, { onConflict: "id" });
    if (upErr && isMissingGeocodeColumnError(upErr)) {
      const { error: leanErr } = await supabase
        .from("startups")
        .upsert(withoutGeocodeColumns(part), { onConflict: "id" });
      if (leanErr) {
        throw new Error(`Supabase upsert startups: ${leanErr.message}`);
      }
    } else if (upErr) {
      throw new Error(`Supabase upsert startups: ${upErr.message}`);
    }
  }

  const toDelete = currentIds.filter((id) => !newIds.has(id));
  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const part = toDelete.slice(i, i + CHUNK);
      const { error: delErr } = await supabase.from("startups").delete().in("id", part);
      if (delErr) {
        throw new Error(`Supabase delete removed startups: ${delErr.message}`);
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
