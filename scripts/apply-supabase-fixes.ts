/**
 * Runs geocode column DDL + delete noisy startups in one transaction (raw Postgres).
 * Needs DATABASE_URL in .env.local (Supabase → Project Settings → Database → URI; use "Session" or "Direct",
 * with the database password — not the anon or service_role JWT).
 *
 * If DATABASE_URL is missing, deletes matching rows via the service-role API and prints the DDL to paste in SQL editor.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local"), override: true });

const SQL_PATH = path.join(
  root,
  "supabase",
  "migrations",
  "20260430160000_add_geocode_columns_and_prune_startups.sql",
);

/** Direct Postgres (not the anon or service_role JWT) — from Supabase → Database. */
function effectiveDatabaseUrl(): string | null {
  const d = process.env.DATABASE_URL?.trim();
  if (d) {
    return d;
  }
  const pw = process.env.SUPABASE_DB_PASSWORD?.trim();
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!pw || !base) {
    return null;
  }
  try {
    const host = new URL(base).hostname;
    const ref = host.split(".")[0];
    return `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`;
  } catch {
    return null;
  }
}

function getAdmin() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(
    /\/+$/,
    "",
  );
  let key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (key.startsWith("Bearer ")) {
    key = key.slice(7).trim();
  }
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  if (!url || !key) {
    throw new Error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local for API fallback");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function shouldPrune(
  r: { name: string; slug: string; website: string },
): boolean {
  const n = r.name.toLowerCase().trim();
  const slug = (r.slug || "").toLowerCase();
  const w = (r.website || "").toLowerCase();
  if (n === "robot company" || n === "the robot company") {
    return true;
  }
  if (w.includes("stickem") || w.includes("stick-em") || w.includes("stick'em")) {
    return true;
  }
  if (w.includes("themeatsg") || slug.includes("themeatsg") || n.includes("themeatsg")) {
    return true;
  }
  if (slug.startsWith("stick-em") || slug.includes("stick-em-")) {
    return true;
  }
  if (slug.includes("robot-company") || (slug.startsWith("robot-") && slug.includes("company"))) {
    return true;
  }
  if (n.replace(/\s/g, "").includes("themeatsg")) {
    return true;
  }
  return false;
}

void (async () => {
  const sql = readFileSync(SQL_PATH, "utf8");
  const databaseUrl = effectiveDatabaseUrl();

  if (databaseUrl) {
    const client = new Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("OK: applied", path.basename(SQL_PATH), "via DATABASE_URL");
    } catch (e) {
      try {
        await client.query("rollback");
      } catch {
        /* ignore */
      }
      console.error("SQL failed:", (e as Error).message);
      process.exit(1);
    } finally {
      await client.end();
    }
    return;
  }

  console.warn(
    "No DATABASE_URL or SUPABASE_DB_PASSWORD — applying only row deletes via API. For ALTER TABLE, add DATABASE_URL or SUPABASE_DB_PASSWORD to .env.local, or run the SQL file in the Supabase SQL editor.\n",
  );

  const supabase = getAdmin();
  const { data: rows, error: selErr } = await supabase
    .from("startups")
    .select("id, name, slug, website");
  if (selErr) {
    console.error("Select failed:", selErr.message);
    console.error("\n--- Paste in Supabase SQL editor ---\n");
    console.error(sql);
    process.exit(1);
  }
  const toRemove = (rows || []).filter((r) => shouldPrune(r as { name: string; slug: string; website: string }));
  if (toRemove.length > 0) {
    const { error: delErr } = await supabase.from("startups").delete().in(
      "id",
      toRemove.map((r) => r.id),
    );
    if (delErr) {
      console.error("Delete failed:", delErr.message);
      process.exit(1);
    }
    console.log("Removed", toRemove.length, "row(s) via API:", toRemove.map((r) => r.name).join(", "));
  } else {
    console.log("No matching rows to delete via API.");
  }
  console.error(
    "\n--- Add DATABASE_URL (or SUPABASE_DB_PASSWORD) to .env.local, or paste in Supabase SQL editor ---\n",
  );
  console.error(sql);
})();
