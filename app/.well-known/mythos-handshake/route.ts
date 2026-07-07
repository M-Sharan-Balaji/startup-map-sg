import { NextResponse, type NextRequest } from "next/server";

import { runHandshake } from "@/lib/mythos";

export const runtime = "nodejs";

/** Lets Mythos ping this app to confirm the SDK is installed and reachable. */
export async function GET(request: NextRequest) {
  const lt = request.nextUrl.searchParams.get("lt");
  const { status, body } = await runHandshake(lt);
  return NextResponse.json(body, { status });
}
