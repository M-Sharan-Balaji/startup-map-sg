import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

import { writeStore } from "../lib/store";

config({ path: path.join(process.cwd(), ".env") });
config({ path: path.join(process.cwd(), ".env.local"), override: true });
import type { StartupStore } from "../lib/startup";

/**
 * One-time: load `data/startups.json` into Supabase (requires SUPABASE_* env and SQL migration applied).
 */
async function main() {
  const p = path.join(process.cwd(), "data", "startups.json");
  if (!fs.existsSync(p)) {
    console.error("Missing data/startups.json");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, "utf-8")) as StartupStore;
  await writeStore(data);
  console.log("Seeded", data.startups.length, "startups to Supabase.");
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
