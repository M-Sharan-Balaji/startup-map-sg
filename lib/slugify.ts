const MAX_LEN = 80;

/**
 * Converts a name to a URL-friendly slug.
 * Removes special characters, replaces spaces with hyphens, and limits length.
 * @param name - Name to convert to slug
 * @returns URL-friendly slug string
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN);
}

/**
 * Creates a unique slug by appending a number if the base slug is already used.
 * @param base - Base slug to start with
 * @param used - Set of already-used slugs to check against
 * @returns Unique slug not in the used set
 */
export function makeUniqueSlug(base: string, used: Set<string>): string {
  let s = base || "startup";
  let n = 0;
  while (used.has(s)) {
    n += 1;
    s = `${base}-${n}`;
  }
  used.add(s);
  return s;
}
