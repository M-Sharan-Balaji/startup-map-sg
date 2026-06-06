/**
 * Deletes known noise rows from public.startups (robot company, Stick 'Em, themeatsg).
 * Uses Supabase service role (same as the app) — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Alternatively run supabase/migrations/20260429120000_delete_robot_themeat_stickem.sql in the SQL editor.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import pg from "pg";
import { logger } from "../lib/logger";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local"), override: true });

function getAdmin(): SupabaseClient {
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
    throw new Error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function shouldDelete(
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

const sqlFile = path.join(
  root,
  "supabase",
  "migrations",
  "20260429120000_delete_robot_themeat_stickem.sql",
);
const deleteSql = readFileSync(sqlFile, "utf8").split("notify pgrst")[0].trim();

void (async () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const client = new Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      const { rowCount } = await client.query(deleteSql);
      logger.info(`Applied DELETE via DATABASE_URL, rows removed: ${rowCount}`);
    } catch (e) {
      logger.error("DATABASE_URL run failed:", e);
      process.exit(1);
    } finally {
      await client.end();
    }
    return;
  }

  try {
    const supabase = getAdmin();
    const { data: rows, error: selErr } = await supabase
      .from("startups")
      .select("id, name, slug, website");
    if (selErr) {
      throw new Error(selErr.message);
    }
    const toRemove = (rows || []).filter((r) => shouldDelete(r as { name: string; slug: string; website: string }));
    if (toRemove.length === 0) {
      logger.info("No matching startups to remove.");
      return;
    }
    logger.info({ count: toRemove.length }, "Deleting startups");
    const { error: delErr } = await supabase.from("startups").delete().in(
      "id",
      toRemove.map((r) => r.id),
    );
    if (delErr) {
      throw new Error(delErr.message);
    }
    logger.info({ count: toRemove.length }, "Removed startups");
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Cleanup failed - set DATABASE_URL or run SQL manually");
    process.exit(1);
  }
})();
