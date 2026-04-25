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

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.join(__dirname, "..", ".env.local") });
config({ path: path.join(__dirname, "..", ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Missing DATABASE_URL. Add it to .env.local (Supabase → Database → Connection string, URI) or run the SQL in supabase/migrations/20260426120000_init_startups.sql in the SQL Editor.",
  );
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
    console.log("Migration applied:", sqlPath);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
