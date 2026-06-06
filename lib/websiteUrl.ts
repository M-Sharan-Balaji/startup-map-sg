/**
 * Public website URLs for the “Add your startup” flow and TinyFish.
 * Safe to import from client and server.
 */

export type ParsePublicWebsiteResult =
  | { ok: true; normalized: string; hostname: string }
  | { ok: false; error: string };

/**
 * Checks if a hostname appears to be private or loopback address.
 * Used to prevent users from adding local/private websites to the public map.
 * @param hostname - Hostname to check
 * @returns true if hostname is private/loopback, false otherwise
 */
function looksLikePrivateOrLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") {
    return true;
  }
  if (h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (/^192\.168\./.test(h) || /^10\./.test(h)) {
    return true;
  }
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) {
    return true;
  }
  return false;
}

/**
 * Parses and validates a public website URL for the "Add your startup" flow.
 * Ensures the URL is HTTPS, public (not local/private), and properly formatted.
 * Strict enough for a public company site; not a general-purpose URL parser.
 * @param input - User-provided URL string
 * @returns ParsePublicWebsiteResult with normalized URL and hostname if valid, or error message
 */
export function parsePublicWebsiteUrl(input: string): ParsePublicWebsiteResult {
  const t = input.trim();
  if (!t) {
    return { ok: false, error: "Enter a website URL" };
  }
  let u: URL;
  try {
    const withProto = t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
    u = new URL(withProto);
  } catch {
    return { ok: false, error: "That doesn’t look like a valid website address" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Only http or https links are allowed" };
  }
  if (!u.hostname || u.hostname.length < 2) {
    return { ok: false, error: "Add a real domain (e.g. yourcompany.com)" };
  }
  if (looksLikePrivateOrLoopbackHost(u.hostname)) {
    return { ok: false, error: "Use a public website — local or private links aren’t allowed" };
  }
  const hostNorm = u.hostname.replace(/^www\./i, "");
  return { ok: true, normalized: u.toString(), hostname: hostNorm };
}
