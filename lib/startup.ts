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
};

export type StartupStore = {
  version: number;
  updatedAt: string;
  startups: Startup[];
};

export function normalizeWebsiteUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.pathname = u.pathname || "/";
    return u.origin.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function getHostnameKey(url: string): string {
  try {
    return new URL(
      url.startsWith("http") ? url : `https://${url}`,
    ).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase();
  }
}
