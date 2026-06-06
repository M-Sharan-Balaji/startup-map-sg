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

/**
 * Fetches content from multiple URLs using the TinyFish fetch API.
 * Converts pages to markdown or HTML format for processing.
 * @param urls - Array of URLs to fetch (max 10)
 * @param format - Output format: "markdown" or "html" (default: "markdown")
 * @returns FetchResponse with results and any errors
 * @throws Error if more than 10 URLs provided or API request fails
 */
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
