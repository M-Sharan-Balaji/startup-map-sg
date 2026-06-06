/**
 * Applies supabase/migrations/20260426120000_init_startups.sql using a direct DB connection.
 * Set DATABASE_URL in .env.local (Supabase → Project Settings → Database → Connection string, URI;
 * use session or direct, replace [YOUR-PASSWORD]).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { logger } from "../lib/logger";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.join(__dirname, "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local"), override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  logger.error("Missing DATABASE_URL. Add it to .env.local (Supabase → Database → Connection string, URI) or run the SQL in supabase/migrations/20260426120000_init_startups.sql in the SQL Editor.");
  process.exit(1);
}

const sqlPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260426120000_init_startups.sql",
);
const sql = readFileSync(sqlPath, "utf8");

const client = new Client({ connectionString: url });
void (async () => {
  try {
    await client.connect();
    await client.query(sql);
    logger.info({ file: sqlPath }, "Migration applied");
  } catch (e) {
    logger.error({ error: e }, "Migration failed");
    process.exit(1);
  } finally {
    await client.end();
  }
})();
