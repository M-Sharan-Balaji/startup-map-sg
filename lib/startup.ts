export const STAGES = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C+",
  "Public",
  "Acquired",
  "Unknown",
] as const;

export type Stage = (typeof STAGES)[number];

export type Startup = {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string;
  stage: Stage;
  sectors: string[];
  lat: number;
  lng: number;
  sourceUrl: string | null;
  lastEnrichedAt: string | null;
  linkedinUrl?: string;
  hiring?: boolean;
  /** If set, used on the map; otherwise a favicon is derived from `website`. */
  logoUrl?: string | null;
  /** Resolved display address when geocoding succeeded; otherwise null/omitted. */
  addressText?: string | null;
  /**
   * How `lat`/`lng` were chosen: real geocode vs deterministic spread in the SG bbox
   * (see `lib/geocode/resolve.ts`).
   */
  locationSource?:
    | "onemap"
    | "nominatim_address"
    | "nominatim_name"
    | "synthetic_spread"
    /** Set in DB / admin; not overwritten by weaker geocode on merge */
    | "manual"
    | null;
};

export type StartupStore = {
  version: number;
  updatedAt: string;
  startups: Startup[];
};

/**
 * Normalizes a website URL to a consistent format.
 * Removes hash, sets default pathname, and converts to lowercase.
 * @param url - URL to normalize
 * @returns Normalized URL origin in lowercase, or trimmed lowercase input if invalid
 */
export function normalizeWebsiteUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.pathname = u.pathname || "/";
    return u.origin.toLowerCase();
  } catch (error) {
    console.warn(`Failed to normalize URL: ${url}`, error);
    return url.trim().toLowerCase();
  }
}

/**
 * Extracts the hostname key from a URL, removing www prefix and converting to lowercase.
 * Used for deduplication and comparison of startup websites.
 * @param url - URL to extract hostname from
 * @returns Hostname without www prefix in lowercase, or lowercase input if invalid
 */
export function getHostnameKey(url: string): string {
  try {
    return new URL(
      url.startsWith("http") ? url : `https://${url}`,
    ).hostname.replace(/^www\./, "");
  } catch (error) {
    console.warn(`Failed to extract hostname from: ${url}`, error);
    return url.toLowerCase();
  }
}
