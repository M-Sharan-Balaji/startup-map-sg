import { randomUUID } from "node:crypto";

import { extractStartupFromPage } from "@/lib/tinyfish/agent";
import { getTinyfishApiKey } from "@/lib/tinyfish/env";
import { fetchContents, type FetchPageResult } from "@/lib/tinyfish/fetch";
import { searchWeb } from "@/lib/tinyfish/search";
import { getHostnameKey, type Stage, type Startup } from "@/lib/startup";
import { makeUniqueSlug, slugify } from "@/lib/slugify";
import { readStore, writeStore } from "@/lib/store";
import { parsePublicWebsiteUrl } from "@/lib/websiteUrl";

const SG_BOX = { south: 1.15, west: 103.6, north: 1.48, east: 104.1 };

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function placeInSingapore(key: string): { lat: number; lng: number } {
  const h = hash32(key);
  const u = h / 4294967295;
  const v = (h % 100000) / 100000;
  const lat = SG_BOX.south + (SG_BOX.north - SG_BOX.south) * (0.2 + 0.8 * u);
  const lng = SG_BOX.west + (SG_BOX.east - SG_BOX.west) * (0.1 + 0.9 * v);
  return { lat, lng };
}

function normalizeStage(s: string | undefined): Stage {
  if (!s) return "Unknown";
  const t = s.toLowerCase();
  if (t.includes("pre-seed") || t.includes("pre seed")) return "Pre-seed";
  if (t.includes("seed") && !t.includes("series")) return "Seed";
  if (t.includes("series a")) return "Series A";
  if (t.includes("series b")) return "Series B";
  if (
    t.includes("series c") ||
    t.includes("series d") ||
    t.includes("series e") ||
    t.includes("late stage")
  ) {
    return "Series C+";
  }
  if (t.includes("ipo") || t.includes("listed") || t.includes("public")) return "Public";
  if (t.includes("acqui")) return "Acquired";
  if (t.includes("unknown")) return "Unknown";
  return "Unknown" as Stage;
}

function domainFromPage(url: string, extracted?: string): string {
  if (extracted) {
    try {
      return toCanonicalOrigin(extracted);
    } catch {
      // fall through
    }
  }
  return toCanonicalOrigin(url);
}

function toCanonicalOrigin(u: string): string {
  const withProto = u.startsWith("http") ? u : `https://${u}`;
  const o = new URL(withProto);
  if (o.hostname === "localhost" || o.hostname.length < 2) {
    throw new Error("invalid");
  }
  return `${o.protocol}//${o.hostname}`.toLowerCase();
}

function snippetDescription(title: string, text?: string, snippet?: string): string {
  const fromPage = (text || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (fromPage.length > 40) {
    return fromPage;
  }
  return [title, "", snippet || ""]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/**
 * Hiring signal when the enrich pipeline uses Fetch (markdown) only — not the structured Agent.
 * Agent path uses `extracted.hiring` from TinyFish instead.
 */
function inferHiringFromPageText(input: {
  title: string;
  text?: string;
  snippet?: string;
  pageUrl: string;
}): boolean {
  const bundle = [input.title, input.snippet, input.text || ""].join("\n").toLowerCase();
  const t = bundle.replace(/\s+/g, " ");
  const u = input.pageUrl.toLowerCase();

  if (/\bnot\s+(?:actively\s+)?hiring\b|\bno\s+(?:current\s+)?openings?\b/.test(t)) {
    return false;
  }
  if (
    /(?:^|\/)(?:careers?|jobs?|join-?us|hiring|opportunities|open-?(?:roles|positions))(?:\/|\?|#|$|\/)/.test(
      u,
    ) ||
    /\/(careers?|jobs?|life-at-)/.test(u)
  ) {
    return true;
  }
  if (
    /\bwe(?:'|’)?re hiring\b|\bwe are hiring\b|\bnow hiring\b|\bopen positions\b|\bopen roles\b|\bjob openings?\b|\bjoin (?:our|the) team\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bapply (?:for a )?role\b|\bcareer opportunities\b|\bwork with us\b.*\b(open|hiring|roles)\b/.test(t)) {
    return true;
  }
  return false;
}

export type EnrichOptions = {
  query: string;
  maxSearchPages?: number;
  useAgent?: boolean;
  maxFetchUrls?: number;
};

export type EnrichResult = {
  searchHits: number;
  fetched: number;
  added: number;
  updated: number;
  errors: string[];
  agentSkipped: boolean;
};

function collectUniqueUrls(
  results: { url: string }[],
  knownHosts: Set<string>,
): { url: string; source: string }[] {
  const out: { url: string; source: string }[] = [];
  const seenUrl = new Set<string>();
  for (const r of results) {
    try {
      const u = new URL(r.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (
        /(^|\.)((google|facebook|youtube|linkedin|twitter|instagram|tiktok|wikipedia)\.)/.test(
          u.hostname,
        )
      ) {
        continue;
      }
      const host = u.hostname.replace(/^www\./, "");
      if (knownHosts.has(host)) {
        continue;
      }
      if (seenUrl.has(r.url)) continue;
      seenUrl.add(r.url);
      out.push({ url: r.url, source: r.url });
    } catch {
      // skip bad URLs
    }
  }
  return out;
}

function mergeByHostname(startups: Startup[], incoming: Startup): { list: Startup[]; updated: boolean } {
  const key = getHostnameKey(incoming.website);
  const idx = startups.findIndex((s) => getHostnameKey(s.website) === key);
  const now = new Date().toISOString();
  if (idx === -1) {
    return { list: [...startups, { ...incoming, lastEnrichedAt: now }], updated: false };
  }
  const cur = { ...startups[idx] };
  if (incoming.description.length > (cur.description?.length || 0)) {
    cur.description = incoming.description;
  }
  cur.name = cur.name || incoming.name;
  cur.sourceUrl = incoming.sourceUrl || cur.sourceUrl;
  cur.hiring = Boolean(cur.hiring || incoming.hiring);
  cur.lastEnrichedAt = now;
  const next = [...startups];
  next[idx] = cur;
  return { list: next, updated: true };
}

export async function runEnrichPipeline(
  options: EnrichOptions,
): Promise<EnrichResult> {
  const {
    query,
    maxSearchPages = 2,
    useAgent = false,
    maxFetchUrls = 20,
  } = options;
  if (!query.trim()) {
    throw new Error("query is required");
  }
  try {
    getTinyfishApiKey();
  } catch {
    throw new Error("TINYFISH_API_KEY is not set");
  }

  const store = await readStore();
  const knownHosts = new Set<string>();
  for (const s of store.startups) {
    try {
      knownHosts.add(getHostnameKey(s.website));
    } catch {
      // ignore
    }
  }

  const hits: { url: string; title: string; snippet: string }[] = [];
  for (let p = 0; p <= maxSearchPages; p += 1) {
    const res = await searchWeb({
      query,
      location: "SG",
      language: "en",
      page: p,
    });
    for (const r of res.results) {
      hits.push({ url: r.url, title: r.title, snippet: r.snippet });
    }
    if (res.results.length === 0) {
      break;
    }
  }

  const unique = collectUniqueUrls(hits.map((h) => ({ url: h.url })), knownHosts);
  const limited = unique.slice(0, maxFetchUrls);
  const errors: string[] = [];
  let agentSkipped = false;
  let added = 0;
  let updated = 0;
  let fetchCount = 0;
  const hitByUrl = new Map(hits.map((h) => [h.url, h] as const));

  let list = store.startups;

  for (let i = 0; i < limited.length; i += 10) {
    const batch = limited.slice(i, i + 10);
    if (batch.length === 0) break;
    if (useAgent) {
      for (const b of batch) {
        let extracted = null;
        try {
          extracted = await extractStartupFromPage(b.url);
        } catch (e) {
          errors.push(`agent ${b.url}: ${(e as Error).message}`);
        }
        if (extracted === null && i === 0 && batch[0] === b) {
          agentSkipped = true;
        }
        if (extracted) {
          const website = domainFromPage(b.url, extracted.website);
          const { lat, lng } = placeInSingapore(website);
          const id = makeUniqueSlug(
            slugify(extracted.name),
            new Set(list.map((s) => s.slug)),
          );
          const sectors = extracted.sector_hint
            ? [extracted.sector_hint]
            : ["Unknown"];
          const st: Startup = {
            id: id + "-" + randomUUID().slice(0, 6),
            name: extracted.name,
            slug: id,
            description: extracted.description,
            website,
            stage: normalizeStage(extracted.stage),
            sectors,
            lat,
            lng,
            sourceUrl: b.url,
            lastEnrichedAt: null,
            hiring: Boolean(extracted.hiring),
          };
          const m = mergeByHostname(list, st);
          list = m.list;
          if (m.updated) {
            updated += 1;
          } else {
            added += 1;
          }
        }
      }
      continue;
    }

    const urls = batch.map((b) => b.url);
    let resp;
    try {
      resp = await fetchContents(urls, "markdown");
    } catch (e) {
      errors.push(`fetch: ${(e as Error).message}`);
      break;
    }
    fetchCount += resp.results.length;
    for (const page of resp.results) {
      const h = hitByUrl.get(page.url) || { title: page.title || "", snippet: "" };
      const name = (page.title || h.title || "Unknown company").split("|")[0].trim() || "Unknown company";
      const text = page.text;
      const desc = snippetDescription(
        name,
        text,
        h.snippet,
      );
      const siteUrl = (page.final_url || page.url) as string;
      let website: string;
      try {
        website = toCanonicalOrigin(siteUrl);
      } catch {
        continue;
      }
      const { lat, lng } = placeInSingapore(website);
      const slug = makeUniqueSlug(
        slugify(name),
        new Set(list.map((s) => s.slug)),
      );
      const st: Startup = {
        id: slug + "-" + randomUUID().slice(0, 6),
        name,
        slug,
        description: desc,
        website,
        stage: "Unknown" as const,
        sectors: ["Unknown"],
        lat,
        lng,
        sourceUrl: page.url,
        lastEnrichedAt: null,
        hiring: inferHiringFromPageText({
          title: name,
          text,
          snippet: h.snippet,
          pageUrl: `${page.url} ${page.final_url}`,
        }),
      };
      const m = mergeByHostname(list, st);
      list = m.list;
      if (m.updated) {
        updated += 1;
      } else {
        added += 1;
      }
    }
    for (const e of resp.errors) {
      errors.push(`${e.url}: ${e.error}`);
    }
  }

  const next: typeof store = {
    ...store,
    version: 1,
    startups: list,
  };
  await writeStore(next);

  return {
    searchHits: hits.length,
    fetched: fetchCount,
    added,
    updated,
    errors,
    agentSkipped,
  };
}

export type MergeOneResult =
  | { ok: true; created: boolean; name: string; alreadyOnMap?: boolean }
  | { ok: false; error: string };

/**
 * Fetches a single public URL and merges a startup into the JSON store (same heuristics as enrich Fetch path).
 * If Fetch returns nothing, falls back to a structured `extractStartupFromPage` run.
 * Used by “Add your startup” after the live agent completes so the map actually updates.
 */
export async function mergeOneFromWebsiteUrl(raw: string): Promise<MergeOneResult> {
  const p = parsePublicWebsiteUrl(raw);
  if (!p.ok) {
    return { ok: false, error: p.error };
  }
  const fullUrl = p.normalized;

  const store = await readStore();
  const want = getHostnameKey(fullUrl);
  for (const s of store.startups) {
    if (getHostnameKey(s.website) === want) {
      return {
        ok: true,
        created: false,
        name: s.name,
        alreadyOnMap: true,
      };
    }
  }

  try {
    getTinyfishApiKey();
  } catch {
    return {
      ok: false,
      error:
        "TINYFISH_API_KEY is not set (or is only whitespace) on the server. Adding a company uses TinyFish (Fetch API) to read the public page—this is separate from Supabase. Set TINYFISH_API_KEY in Render → Environment and redeploy, like local .env. GET /api/health shows which keys the server can see (names only).",
    };
  }

  let list = store.startups;

  const fromExtracted = async (): Promise<MergeOneResult | null> => {
    let extracted;
    try {
      extracted = await extractStartupFromPage(fullUrl);
    } catch (e) {
      /* Caller may try fetch-only path; surface error only if everything else fails */
      return { ok: false, error: (e as Error).message };
    }
    if (!extracted) {
      return null;
    }
    const website = domainFromPage(fullUrl, extracted.website);
    const { lat, lng } = placeInSingapore(website);
    const slug = makeUniqueSlug(
      slugify(extracted.name),
      new Set(list.map((s) => s.slug)),
    );
    const sectors = extracted.sector_hint ? [extracted.sector_hint] : ["Unknown"];
    const st: Startup = {
      id: slug + "-" + randomUUID().slice(0, 6),
      name: extracted.name,
      slug,
      description: extracted.description,
      website,
      stage: normalizeStage(extracted.stage),
      sectors,
      lat,
      lng,
      sourceUrl: fullUrl,
      lastEnrichedAt: null,
      hiring: Boolean(extracted.hiring),
    };
    const m = mergeByHostname(list, st);
    list = m.list;
    await writeStore({ ...store, version: 1, startups: list });
    return { ok: true, created: !m.updated, name: st.name };
  };

  const fromFetchPage = async (page: FetchPageResult): Promise<MergeOneResult | null> => {
    const h = { title: page.title || "", snippet: page.description || "" };
    const name = (page.title || h.title || "Unknown company").split("|")[0].trim() || "Unknown company";
    const text = page.text;
    const desc = snippetDescription(name, text, h.snippet);
    const siteUrl = (page.final_url || page.url) as string;
    let website: string;
    try {
      website = toCanonicalOrigin(siteUrl);
    } catch {
      return null;
    }
    if (desc.replace(/\s/g, "").length < 4 && (text || "").replace(/\s/g, "").length < 8) {
      return null;
    }
    const { lat, lng } = placeInSingapore(website);
    const slug = makeUniqueSlug(
      slugify(name),
      new Set(list.map((s) => s.slug)),
    );
    const st: Startup = {
      id: slug + "-" + randomUUID().slice(0, 6),
      name,
      slug,
      description: desc,
      website,
      stage: "Unknown" as const,
      sectors: ["Unknown"],
      lat,
      lng,
      sourceUrl: page.url,
      lastEnrichedAt: null,
      hiring: inferHiringFromPageText({
        title: name,
        text,
        snippet: h.snippet,
        pageUrl: `${page.url} ${page.final_url}`,
      }),
    };
    const m = mergeByHostname(list, st);
    list = m.list;
    await writeStore({ ...store, version: 1, startups: list });
    return { ok: true, created: !m.updated, name: st.name };
  };

  let resp: Awaited<ReturnType<typeof fetchContents>>;
  try {
    resp = await fetchContents([fullUrl], "markdown");
  } catch (e) {
    const fallback = await fromExtracted();
    if (fallback) {
      return fallback;
    }
    return { ok: false, error: (e as Error).message };
  }

  if (resp.results[0]) {
    const r = await fromFetchPage(resp.results[0]);
    if (r) {
      return r;
    }
  }

  const fallback = await fromExtracted();
  if (fallback) {
    return fallback;
  }
  if (resp.errors[0]) {
    return { ok: false, error: resp.errors[0].error };
  }
  return { ok: false, error: "Could not add this page — try again or use admin enrich with a search query." };
}
