const DOUBLE_NL = "\n\n";

/**
 * Parse incremental SSE chunks: return complete `\\n\\n`-delimited blocks and keep
 * the last partial line in the remainder.
 */
export function extractSseEventBlocks(
  buffer: string,
): { blocks: string[]; remainder: string } {
  const blocks: string[] = [];
  let rest = buffer;
  for (;;) {
    const i = rest.indexOf(DOUBLE_NL);
    if (i === -1) break;
    blocks.push(rest.slice(0, i));
    rest = rest.slice(i + DOUBLE_NL.length);
  }
  return { blocks, remainder: rest };
}

export function dataPayloadFromSseBlock(block: string): string {
  const lines = block.split("\n");
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.replace(/^data:\s?/i, ""));
    }
  }
  return dataLines.join("\n");
}

export type TinyFishSseEvent = {
  type: string;
  [key: string]: unknown;
};

export function tryParseEventJson(data: string): TinyFishSseEvent | null {
  if (!data.trim()) return null;
  try {
    return JSON.parse(data) as TinyFishSseEvent;
  } catch {
    return { type: "RAW", message: data } as TinyFishSseEvent;
  }
}
