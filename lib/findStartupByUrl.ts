import { getHostnameKey, type Startup, type StartupStore } from "@/lib/startup";
import { parsePublicWebsiteUrl } from "@/lib/websiteUrl";

export type PublicUrlMatch =
  | { kind: "invalid"; error: string }
  | { kind: "not_found" }
  | { kind: "found"; startup: Startup };

/** Match by site host (ignores path), same as enrich merge. */
export function findStartupByPublicUrl(store: StartupStore, rawUrl: string): PublicUrlMatch {
  const p = parsePublicWebsiteUrl(rawUrl);
  if (!p.ok) {
    return { kind: "invalid", error: p.error };
  }
  const want = getHostnameKey(p.normalized);
  for (const s of store.startups) {
    if (getHostnameKey(s.website) === want) {
      return { kind: "found", startup: s };
    }
  }
  return { kind: "not_found" };
}
