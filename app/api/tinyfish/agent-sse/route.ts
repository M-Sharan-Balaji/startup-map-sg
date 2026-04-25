import { NextRequest } from "next/server";

import { tinyfishAutomationFields } from "@/lib/tinyfish/automationPayload";
import { getTinyfishApiKey } from "@/lib/tinyfish/env";
import { parsePublicWebsiteUrl } from "@/lib/websiteUrl";

export const runtime = "nodejs";
export const maxDuration = 300;

const TINYFISH_RUN_SSE = "https://agent.tinyfish.ai/v1/automation/run-sse";

const DEFAULT_GOAL = `You are a startup analyst. On this public website, explore the main content and:
1) State the company or product name.
2) In 2–4 sentences, describe what they do, who it is for, and the main value proposition.
3) Note any visible signals: funding, investors, team size, hiring, or location—only if clearly stated.
4) List the primary product areas or industry tags in a short line.
If something is not visible, say "not shown on the site" for that part. Be factual and avoid guessing.`;


export async function POST(request: NextRequest) {
  let key: string;
  try {
    key = getTinyfishApiKey();
  } catch {
    return new Response(
      JSON.stringify({ error: "TINYFISH_API_KEY is not configured on the server" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const p = parsePublicWebsiteUrl(String(body.url || ""));
  if (!p.ok) {
    return new Response(JSON.stringify({ error: p.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const targetUrl = p.normalized;

  // Fixed founder-focused profile — clients cannot override (website URL only in UI).
  const goal = DEFAULT_GOAL;

  const upstream = await fetch(TINYFISH_RUN_SSE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-API-Key": key,
    },
    // Match Propelix run-sse payload (main.py tinyfish_stream_proxy): url, goal,
    // browser_profile, proxy_config, api_integration — not only agent_config.
    body: JSON.stringify({
      url: targetUrl,
      goal,
      ...tinyfishAutomationFields(),
    }),
  });

  if (!upstream.ok && upstream.headers.get("content-type")?.includes("application/json")) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(
      JSON.stringify({ error: "TinyFish request failed", detail: errText.slice(0, 2000) }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!upstream.body) {
    return new Response(
      JSON.stringify({ error: "No response body from TinyFish" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
