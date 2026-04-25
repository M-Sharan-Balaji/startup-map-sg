import { NextResponse } from "next/server";

import { readStore } from "@/lib/store";

function matchesQuery(
  s: { name: string; description: string; website: string; sectors: string[] },
  q: string,
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const bucket = [s.name, s.description, s.website, ...s.sectors]
    .join(" ")
    .toLowerCase();
  return bucket.includes(t) || t.split(/\s+/).every((w) => bucket.includes(w));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const stage = searchParams.get("stage") || "";
  const sector = searchParams.get("sector") || "";
  const hiring = searchParams.get("hiring");

  let data: Awaited<ReturnType<typeof readStore>>;
  try {
    data = await readStore();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  let startups = data.startups;

  if (q) {
    startups = startups.filter((s) => matchesQuery(s, q));
  }
  if (stage) {
    startups = startups.filter((s) => s.stage === stage);
  }
  if (sector) {
    startups = startups.filter((s) =>
      s.sectors.map((x) => x.toLowerCase()).includes(sector.toLowerCase()),
    );
  }
  if (hiring === "1" || hiring === "true") {
    startups = startups.filter((s) => s.hiring === true);
  } else if (hiring === "0" || hiring === "false") {
    startups = startups.filter((s) => s.hiring !== true);
  }

  return NextResponse.json(
    { ...data, startups },
    { headers: { "Cache-Control": "no-store" } },
  );
}
