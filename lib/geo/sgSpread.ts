/**
 * Tight WGS84 bounds for **synthetic** pin spread when no real address is geocoded.
 * A loose 1.15–1.48 × 103.6–104.1 box can include **Johor**; this box stays inside Singapore.
 */
export const SG_PLACEMENT_BOX = {
  south: 1.18,
  west: 103.62,
  north: 1.45,
  east: 104.04,
} as const;

/** @deprecated Use {@link SG_PLACEMENT_BOX}. */
export const SG_BOX = SG_PLACEMENT_BOX;

export function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks a point inside {@link SG_PLACEMENT_BOX} from a hash of `key` so markers spread
 * on the map. **Not geocoding** — unrelated to a real address.
 */
export function placeInSingapore(key: string): { lat: number; lng: number } {
  const b = SG_PLACEMENT_BOX;
  const h = hash32(key);
  const u = h / 4294967295;
  const v = (h % 100000) / 100000;
  const lat = b.south + (b.north - b.south) * (0.2 + 0.8 * u);
  const lng = b.west + (b.east - b.west) * (0.1 + 0.9 * v);
  return { lat, lng };
}
