import { getTinyfishApiKey } from "@/lib/tinyfish/env";

const SEARCH_URL = "https://api.search.tinyfish.ai/";

export type SearchHit = {
  position: number;
  site_name: string;
  snippet: string;
  title: string;
  url: string;
};

export type SearchResponse = {
  query: string;
  results: SearchHit[];
  total_results: number;
  page: number;
};

export async function searchWeb(params: {
  query: string;
  location?: string;
  language?: string;
  page?: number;
}): Promise<SearchResponse> {
  const u = new URL(SEARCH_URL);
  u.searchParams.set("query", params.query);
  if (params.location) u.searchParams.set("location", params.location);
  if (params.language) u.searchParams.set("language", params.language);
  if (params.page != null) u.searchParams.set("page", String(params.page));

  const res = await fetch(u, {
    headers: { "X-API-Key": getTinyfishApiKey() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TinyFish search failed ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as SearchResponse;
}
