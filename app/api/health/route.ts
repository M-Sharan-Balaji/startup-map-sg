import { NextResponse } from "next/server";

import { getTinyfishApiKey } from "@/lib/tinyfish/env";

export const runtime = "nodejs";

/**
 * No secrets. Reports which *names* of env vars the server can see, so you can
 * verify Render (or local) without pasting API keys. Map + Supabase list only need
 * `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. “Add your startup” also needs
 * `TINYFISH_API_KEY` (Fetch + agent run different products than Supabase).
 */
function bool(v: string | undefined): boolean {
  return Boolean(v && String(v).trim().length > 0);
}

function supabaseRef(url: string | undefined): string | null {
  if (!url) return null;
  const m = /https?:\/\/([a-z0-9-]+)\.supabase\.co\/?/i.exec(url.trim());
  return m ? m[1]! : null;
}

export async function GET() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return NextResponse.json(
    {
      ok: true,
      /** Which credentials exist (not their values) */
      env: {
        SUPABASE_URL: bool(process.env.SUPABASE_URL),
        NEXT_PUBLIC_SUPABASE_URL: bool(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasSupabaseUrl: bool(rawUrl),
        supabaseUrlHostRef: supabaseRef(rawUrl),
        SUPABASE_SERVICE_ROLE_KEY: bool(process.env.SUPABASE_SERVICE_ROLE_KEY),
        /** True only if the key is set and not empty after trim / quote strip */
        TINYFISH_API_KEY: (() => {
          try {
            getTinyfishApiKey();
            return true;
          } catch {
            return false;
          }
        })(),
        ENRICH_SECRET: bool(process.env.ENRICH_SECRET),
      },
      hints: {
        readMap:
          "Needs hasSupabaseUrl + SUPABASE_SERVICE_ROLE_KEY. Use the **Secret** (sb_secret_…) or legacy service_role JWT (eyJ…), not the publishable key.",
        addStartup:
          "Also needs TINYFISH_API_KEY. Reading a site uses TinyFish Fetch; the live run uses the agent. That key is not your Supabase key.",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
