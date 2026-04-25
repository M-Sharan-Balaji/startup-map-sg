import { NextRequest } from "next/server";

const FAV_SIZ = 128;

function isPrivateOrLocalHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }
  if (hostname === "0.0.0.0") {
    return true;
  }
  if (hostname === "::1" || hostname === "[::1]") {
    return true;
  }
  if (!hostname.includes(".")) {
    return true;
  }
  const m = hostname.match(
    /^(?:(\d{1,3})\.)((?:\d{1,3})\.)((?:\d{1,3})\.)(\d{1,3})$/,
  );
  if (m) {
    const a = [m[1], m[2], m[3], m[4]].map((s) => parseInt(s.replace(/\D/g, ""), 10));
    if (a[0] === 127 && a[1] === 0 && a[2] === 0 && a[3] === 1) {
      return true;
    }
    if (a[0] === 10) {
      return true;
    }
    if (a[0] === 192 && a[1] === 168) {
      return true;
    }
    if (a[0] === 172 && a[1]! >= 16 && a[1]! <= 31) {
      return true;
    }
    if (a[0] === 0 || a[0] === 127) {
      return true;
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const src = searchParams.get("src");

  let fetchUrl: string;

  if (src) {
    let u: URL;
    try {
      u = new URL(src);
    } catch {
      return new Response("Invalid src", { status: 400 });
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return new Response("Invalid protocol", { status: 400 });
    }
    if (isPrivateOrLocalHost(u.hostname)) {
      return new Response("Host not allowed", { status: 400 });
    }
    fetchUrl = u.toString();
  } else if (domain) {
    const h = domain.replace(/^www\./i, "").toLowerCase().trim();
    if (h.length < 1 || h.length > 200) {
      return new Response("Invalid domain", { status: 400 });
    }
    if (
      !/^[a-z0-9]$/i.test(h) &&
      !/^[a-z0-9][a-z0-9.-]{0,198}[a-z0-9]$/i.test(h)
    ) {
      return new Response("Invalid domain", { status: 400 });
    }
    fetchUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=${FAV_SIZ}`;
  } else {
    return new Response("Need domain or src", { status: 400 });
  }

  const upstream = await fetch(fetchUrl, {
    headers: { Accept: "image/*,*/*" },
    next: { revalidate: 86_400 },
  });

  if (!upstream.ok) {
    return new Response("Upstream error", { status: 502 });
  }

  const buf = await upstream.arrayBuffer();
  const ct = upstream.headers.get("content-type") || "image/png";
  return new Response(buf, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
