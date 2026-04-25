const RUN_URL = "https://agent.tinyfish.ai/v1/automation/run";

const startupExtractionSchema = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    website: { type: "string" },
    stage: { type: "string" },
    sector_hint: { type: "string" },
    hiring: { type: "boolean" },
  },
  required: ["name", "description"],
  propertyOrdering: [
    "name",
    "description",
    "website",
    "stage",
    "sector_hint",
    "hiring",
  ],
};

function getApiKey(): string {
  const k = process.env.TINYFISH_API_KEY;
  if (!k) {
    throw new Error("TINYFISH_API_KEY is not set");
  }
  return k;
}

type AgentRunResult = {
  result?: unknown;
  status?: string;
};

function parseAgentPayload(body: unknown): unknown {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;
  if ("result" in r) return r.result;
  if ("output" in r) return r.output;
  return body;
}

export type ExtractedStartup = {
  name: string;
  description: string;
  website?: string;
  stage?: string;
  sector_hint?: string;
  hiring?: boolean;
};

export async function extractStartupFromPage(
  url: string,
): Promise<ExtractedStartup | null> {
  const res = await fetch(RUN_URL, {
    method: "POST",
    headers: {
      "X-API-Key": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      goal:
        "You are on a public company or startup page. Extract the public company or product name, a concise 1–3 sentence description, canonical website, rough funding stage if stated, a primary industry tag, and whether they appear to be hiring on this page.",
      output_schema: startupExtractionSchema,
    }),
  });

  if (res.status === 403) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TinyFish agent run failed ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as AgentRunResult;
  const result = parseAgentPayload(data) as ExtractedStartup | null;
  if (!result || typeof result.name !== "string" || typeof result.description !== "string") {
    return null;
  }
  return result;
}
