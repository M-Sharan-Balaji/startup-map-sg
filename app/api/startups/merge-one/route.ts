import { NextResponse } from "next/server";

import { mergeOneFromWebsiteUrl } from "@/lib/enrich/pipeline";

export const runtime = "nodejs";

/**
 * Merges one startup into Supabase (Fetch + optional structured extract).
 * If the host is already in the map, returns `alreadyOnMap: true` without calling TinyFish.
 */
export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  let result: Awaited<ReturnType<typeof mergeOneFromWebsiteUrl>>;
  try {
    result = await mergeOneFromWebsiteUrl(body.url);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 503 },
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({
    created: result.created,
    name: result.name,
    alreadyOnMap: result.alreadyOnMap === true,
  });
}
