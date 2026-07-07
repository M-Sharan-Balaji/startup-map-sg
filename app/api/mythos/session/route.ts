import { NextResponse, type NextRequest } from "next/server";

import { verifyAndConsumeLaunchToken } from "@/lib/mythos";

export const runtime = "nodejs";

/**
 * Called once by the client when it sees `?lt=` in the URL. Verifies the token's
 * signature/audience and marks it consumed (single-use, per ADR-0003) before
 * handing back the user's Mythos session.
 */
export async function GET(request: NextRequest) {
  const lt = request.nextUrl.searchParams.get("lt");
  if (!lt) {
    return NextResponse.json({ error: "Missing launch token" }, { status: 401 });
  }
  const { status, body } = await verifyAndConsumeLaunchToken(lt);
  return NextResponse.json(body, { status });
}
