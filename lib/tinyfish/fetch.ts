import { getTinyfishApiKey } from "@/lib/tinyfish/env";

const FETCH_URL = "https://api.fetch.tinyfish.ai";

export type FetchPageResult = {
  url: string;
  final_url: string;
  title?: string;
  description?: string;
  text?: string;
  format?: string;
};

export type FetchResponse = {
  results: FetchPageResult[];
  errors: { url: string; error: string }[];
};

export async function fetchContents(urls: string[], format: "markdown" | "html" = "markdown") {
  if (urls.length > 10) {
    throw new Error("fetchContents accepts at most 10 URLs per request");
  }
  const res = await fetch(FETCH_URL, {
    method: "POST",
    headers: {
      "X-API-Key": getTinyfishApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ urls, format, links: false, image_links: false }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TinyFish fetch failed ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as FetchResponse;
}
