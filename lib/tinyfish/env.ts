/**
 * Pasted API keys in Render/hosting UIs may include extra quotes, spaces, or a `Bearer` prefix.
 */
export function getTinyfishApiKey(): string {
  let k = (process.env.TINYFISH_API_KEY || "").trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  if (!k) {
    throw new Error("TINYFISH_API_KEY is not set");
  }
  return k;
}
