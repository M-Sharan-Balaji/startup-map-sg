import { NextResponse } from "next/server";

import { runEnrichPipeline } from "@/lib/enrich/pipeline";
import { getTinyfishApiKey } from "@/lib/tinyfish/env";

function authorize(request: Request): boolean {
  const required = process.env.ENRICH_SECRET;
  if (!required) {
    return false;
  }
  const h = request.headers.get("x-enrich-secret");
  const auth = request.headers.get("authorization");
  if (h && h === required) return true;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7) === required;
  }
  return false;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json(
      { error: "Set ENRICH_SECRET and send x-enrich-secret or Authorization: Bearer" },
      { status: 401 },
    );
  }
  try {
    getTinyfishApiKey();
  } catch {
    return NextResponse.json(
      { error: "TINYFISH_API_KEY is not set on the server" },
      { status: 503 },
    );
  }

  let body: {
    query?: string;
    maxSearchPages?: number;
    useAgent?: boolean;
    maxFetchUrls?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const result = await runEnrichPipeline({
      query: body.query,
      maxSearchPages: body.maxSearchPages,
      useAgent: body.useAgent,
      maxFetchUrls: body.maxFetchUrls,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
