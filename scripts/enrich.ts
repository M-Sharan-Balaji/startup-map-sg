import "dotenv/config";

import { runEnrichPipeline } from "../lib/enrich/pipeline";
import { getTinyfishApiKey } from "../lib/tinyfish/env";

function main() {
  const args = process.argv.slice(2);
  const useAgent = args.includes("--use-agent");
  let query = "Singapore fintech startup";
  const qi = args.indexOf("--query");
  if (qi >= 0 && args[qi + 1]) {
    query = args[qi + 1]!;
  } else {
    const pos = args.filter((a) => !a.startsWith("-"));
    if (pos[0]) query = pos[0]!;
  }
  try {
    getTinyfishApiKey();
  } catch {
    console.error("Set TINYFISH_API_KEY in the environment (or .env).");
    process.exit(1);
  }
  void runEnrichPipeline({ query, useAgent })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((e) => {
      console.error((e as Error).message);
      process.exit(1);
    });
}

main();
