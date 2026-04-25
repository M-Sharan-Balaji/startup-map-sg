import { placeInSingapore } from "@/lib/geo/sgSpread";

export type LocationSource =
  | "onemap"
  | "nominatim_address"
  | "nominatim_name"
  | "synthetic_spread";

export type GeocodedResult = {
  lat: number;
  lng: number;
  addressText: string | null;
  locationSource: LocationSource;
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
/** min lon, min lat, max lon, max lat — tight box inside Singapore, excludes most of Johor. */
const SINGAPORE_VIEWBOX = "103.62,1.18,104.04,1.45";

function getNominatimHeaders(): Record<string, string> {
  const ua =
    process.env.GEOCODE_USER_AGENT?.trim() ||
    "Startup-Map-SG/1.0 (https://github.com/M-Sharan-Balaji/startup-map-sg; geocoding)";
  return {
    "User-Agent": ua,
    Accept: "application/json",
    "Accept-Language": "en",
  };
}

function getOneMapToken(): string | null {
  const t = process.env.ONEMAP_ACCESS_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

function isSingaporeAddress(
  a: { country_code?: string; country?: string } | undefined,
): boolean {
  if (!a) {
    return false;
  }
  const cc = a.country_code?.toLowerCase();
  if (cc === "sg" || cc === "sgp") {
    return true;
  }
  return (a.country || "").toLowerCase().includes("singapore");
}

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: { country_code?: string; country?: string };
};

/**
 * Nominatim: bounded to Singapore, multiple candidates; only **Singapore** (country) hits
 * are accepted to avoid viewbox-including–Johor errors.
 */
async function nominatimSearch(
  q: string,
): Promise<{ lat: number; lng: number; addressText: string | null } | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "sg");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", q);
  url.searchParams.set("viewbox", SINGAPORE_VIEWBOX);
  url.searchParams.set("bounded", "1");

  const res = await fetch(url.toString(), { headers: getNominatimHeaders() });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as NominatimPlace[];
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  for (const hit of data) {
    if (!isSingaporeAddress(hit.address)) {
      continue;
    }
    if (!hit.lat || !hit.lon) {
      continue;
    }
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    return {
      lat,
      lng,
      addressText: (hit.display_name || "").trim() || null,
    };
  }
  return null;
}

type OneMapResultRow = {
  LATITUDE?: string;
  LONGITUDE?: string;
  LONGTITUDE?: string;
  ADDRESS?: string;
};

async function onemapSearch(searchVal: string): Promise<GeocodedResult | null> {
  const token = getOneMapToken();
  if (!token) {
    return null;
  }
  const url = new URL("https://www.onemap.gov.sg/api/common/elastic/search");
  url.searchParams.set("searchVal", searchVal);
  url.searchParams.set("returnGeom", "Y");
  url.searchParams.set("getAddrDetails", "Y");
  url.searchParams.set("pageNum", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { results?: OneMapResultRow[] };
  const row = data.results?.[0];
  if (!row) {
    return null;
  }
  const latStr = row.LATITUDE;
  const lngStr = row.LONGITUDE ?? row.LONGTITUDE;
  if (!latStr || !lngStr) {
    return null;
  }
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < 1.0 || lat > 1.6 || lng < 103.4 || lng > 104.5) {
    return null;
  }
  return {
    lat,
    lng,
    addressText: (row.ADDRESS || "").trim() || null,
    locationSource: "onemap",
  };
}

/**
 * Picks a lat/lng for a startup: Singapore address text (Nominatim / OneMap) when possible,
 * else name-based search, else deterministic spread inside a tight Singapore box.
 * Does **not** use unbounded global Nominatim (avoids spurious non-SG matches).
 */
export async function resolveStartupGeolocation(input: {
  name: string;
  website: string;
  addressHint?: string | null;
}): Promise<GeocodedResult> {
  const name = input.name?.trim() || "Company";
  const website = input.website?.trim() || "https://example.com";
  const addr = input.addressHint?.replace(/\s+/g, " ").trim();

  if (addr && addr.length > 6) {
    const om1 = await onemapSearch(addr);
    if (om1) {
      return om1;
    }
    const n1 = await nominatimSearch(addr);
    if (n1) {
      return { ...n1, locationSource: "nominatim_address" as const };
    }
  }

  const nameQuery = `${name}, Singapore`;
  const om2 = await onemapSearch(nameQuery);
  if (om2) {
    return { ...om2, locationSource: "onemap" };
  }
  const n2 = await nominatimSearch(nameQuery);
  if (n2) {
    return { ...n2, locationSource: "nominatim_name" as const };
  }

  const { lat, lng } = placeInSingapore(website);
  return {
    lat,
    lng,
    addressText: null,
    locationSource: "synthetic_spread",
  };
}
