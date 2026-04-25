import { getHostnameKey } from "@/lib/startup";
import type { Startup } from "@/lib/startup";

/**
 * Browser + MapLibre can’t reliably load Google’s favicon URLs in WebGL (`loadImage`)
 * because of CORS. We always load logos through our own `/api/logo` route so the map
 * gets same-origin, CORS-friendly image bytes.
 */
export function resolveLogoUrl(s: Pick<Startup, "website" | "logoUrl">): string {
  if (s.logoUrl && s.logoUrl.trim().length > 0) {
    return `/api/logo?src=${encodeURIComponent(s.logoUrl.trim())}`;
  }
  const host = getHostnameKey(s.website);
  return `/api/logo?domain=${encodeURIComponent(host)}`;
}

/**
 * MapLibre `loadImage` needs an absolute URL in some environments; call from the
 * client with `window.location.origin` when building the string.
 */
export function absoluteLogoUrlForClient(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  if (typeof window === "undefined") {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${window.location.origin}${path}`;
}

/** Safe id for `map.addImage` / GeoJSON (letters, numbers, dash, underscore). */
export function mapIconIdForStartupId(id: string): string {
  return `sg-logo-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
