import { MythosError, reportUsage } from "@mythos/sdk";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Debits the Mythos wallet for a session after a billable action (e.g. a TinyFish enrich run). */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { sessionJti?: string; credits?: number; reason?: string }
    | null;

  if (!body?.sessionJti || typeof body.credits !== "number") {
    return NextResponse.json({ error: "sessionJti and credits are required" }, { status: 400 });
  }

  try {
    await reportUsage(body.sessionJti, { credits: body.credits, reason: body.reason });
  } catch (err) {
    if (err instanceof MythosError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    return NextResponse.json({ error: "Failed to report usage" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
