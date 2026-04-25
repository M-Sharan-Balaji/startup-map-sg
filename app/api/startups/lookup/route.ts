import { NextResponse } from "next/server";

import { findStartupByPublicUrl } from "@/lib/findStartupByUrl";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * GET /api/startups/lookup?url=… — public URL check + whether this company is already on the map.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url?.trim()) {
    return NextResponse.json({ error: "Add a url query" }, { status: 400 });
  }
  let m: ReturnType<typeof findStartupByPublicUrl>;
  try {
    m = findStartupByPublicUrl(await readStore(), url);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, valid: false, exists: false as const },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (m.kind === "invalid") {
    return NextResponse.json(
      { valid: false, error: m.error, exists: false as const },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (m.kind === "found") {
    return NextResponse.json(
      {
        valid: true,
        exists: true,
        name: m.startup.name,
        id: m.startup.id,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { valid: true, exists: false as const },
    { headers: { "Cache-Control": "no-store" } },
  );
}
