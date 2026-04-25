const MAX_LEN = 80;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN);
}

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
