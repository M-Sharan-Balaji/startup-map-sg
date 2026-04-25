import type { Startup, StartupStore } from "@/lib/startup";

/** Row as returned/inserted by Supabase (snake_case). */
export type StartupRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string;
  stage: string;
  sectors: string[] | null;
  lat: number;
  lng: number;
  source_url: string | null;
  last_enriched_at: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
  hiring: boolean | null;
  address_text: string | null;
  location_source: string | null;
};

export function rowToStartup(r: StartupRow): Startup {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    website: r.website,
    stage: r.stage as Startup["stage"],
    sectors: Array.isArray(r.sectors) ? (r.sectors as string[]) : [],
    lat: r.lat,
    lng: r.lng,
    sourceUrl: r.source_url,
    lastEnrichedAt: r.last_enriched_at,
    linkedinUrl: r.linkedin_url ?? undefined,
    logoUrl: r.logo_url ?? null,
    hiring: r.hiring ?? undefined,
    addressText: r.address_text ?? null,
    locationSource: (r.location_source as Startup["locationSource"]) ?? null,
  };
}

export function startupToRow(s: Startup): StartupRow {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    website: s.website,
    stage: s.stage,
    sectors: s.sectors,
    lat: s.lat,
    lng: s.lng,
    source_url: s.sourceUrl,
    last_enriched_at: s.lastEnrichedAt,
    linkedin_url: s.linkedinUrl ?? null,
    logo_url: s.logoUrl ?? null,
    hiring: s.hiring ?? null,
    address_text: s.addressText ?? null,
    location_source: s.locationSource ?? null,
  };
}

export function toStartupStore(
  version: number,
  updatedAt: string,
  rows: StartupRow[],
): StartupStore {
  return {
    version,
    updatedAt,
    startups: rows.map(rowToStartup),
  };
}
