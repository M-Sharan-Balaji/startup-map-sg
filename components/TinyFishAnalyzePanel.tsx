"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  dataPayloadFromSseBlock,
  extractSseEventBlocks,
  tryParseEventJson,
} from "@/lib/parseSseText";
import { parsePublicWebsiteUrl } from "@/lib/websiteUrl";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Refetch list/map data after a successful run adds a row to the store */
  onStartupAdded?: () => void;
};

type LogLine = { t: string; text: string; kind: "info" | "error" | "ok" };

export function TinyFishAnalyzePanel({ open, onClose, onStartupAdded }: Props) {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapSave, setMapSave] = useState<
    | "idle"
    | "saving"
    | {
        kind: "ok";
        created: boolean;
        name: string;
        alreadyOnMap?: boolean;
      }
    | { kind: "err"; message: string }
  >("idle");
  /** After debounced lookup: URL shape + “already in store” (server) */
  const [lookup, setLookup] = useState<
    | "idle"
    | "checking"
    | { valid: true; exists: false }
    | { valid: true; exists: true; name: string }
    | { valid: false; error: string }
  >("idle");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((text: string, kind: LogLine["kind"] = "info") => {
    const t = new Date().toLocaleTimeString();
    setLog((prev) => [...prev, { t, text, kind }]);
    queueMicrotask(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    setStreamingUrl(null);
    setRunId(null);
    setLog([]);
    setResult(null);
    setError(null);
    setMapSave("idle");
  }, []);

  const localUrl = useMemo(() => parsePublicWebsiteUrl(url.trim()), [url]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const u = url.trim();
    if (!u) {
      queueMicrotask(() => {
        setLookup("idle");
      });
      return;
    }
    if (!localUrl.ok) {
      queueMicrotask(() => {
        setLookup({ valid: false, error: localUrl.error });
      });
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setLookup("checking");
      void (async () => {
        try {
          const r = await fetch(
            `/api/startups/lookup?${new URLSearchParams({ url: u })}`,
            { signal: ac.signal, cache: "no-store" },
          );
          const d = (await r.json()) as {
            valid: boolean;
            exists?: boolean;
            name?: string;
            error?: string;
          };
          if (ac.signal.aborted) {
            return;
          }
          if (d.valid === false) {
            setLookup({ valid: false, error: d.error || "This URL is not allowed" });
            return;
          }
          if (d.exists && d.name) {
            setLookup({ valid: true, exists: true, name: d.name });
          } else {
            setLookup({ valid: true, exists: false });
          }
        } catch (e) {
          if (ac.signal.aborted || (e as Error).name === "AbortError") {
            return;
          }
          setLookup("idle");
        }
      })();
    }, 400);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [open, url, localUrl]);

  const start = useCallback(async () => {
    if (!url.trim()) {
      setError("Add your company’s website to get started");
      return;
    }
    const v = parsePublicWebsiteUrl(url.trim());
    if (!v.ok) {
      setError(v.error);
      return;
    }
    reset();
    setRunning(true);
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    let buf = "";
    try {
      const res = await fetch("/api/tinyfish/agent-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = t;
        try {
          const j = JSON.parse(t) as { error?: string; message?: string; detail?: string };
          msg = j.error || j.message || t;
        } catch {
          // use raw
        }
        setError(msg);
        appendLog(`Error: ${msg}`, "error");
        setRunning(false);
        return;
      }
      if (!res.body) {
        setError("No response stream");
        setRunning(false);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      appendLog("Connected — the agent is exploring your public site", "ok");
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const { blocks, remainder } = extractSseEventBlocks(buf);
        buf = remainder;
        for (const block of blocks) {
          const data = dataPayloadFromSseBlock(block);
          if (!data.trim()) continue;
          const ev = tryParseEventJson(data);
          if (!ev) continue;
          const ty = String(ev.type || "");
          if (ty === "HEARTBEAT") {
            continue;
          }
          if (ty === "STARTED" && ev.run_id) {
            setRunId(String(ev.run_id));
            appendLog(`Run started: ${String(ev.run_id)}`, "ok");
            continue;
          }
          if (ty === "STREAMING_URL" && ev.streaming_url) {
            const u = String(ev.streaming_url);
            setStreamingUrl(u);
            appendLog("Live view ready — you can follow along in the browser", "ok");
            continue;
          }
          if (ty === "PROGRESS" && ev.purpose) {
            appendLog(String(ev.purpose), "info");
            continue;
          }
          if (ty === "TF_API_RESULT") {
            appendLog(`API tool: ${String(ev.tinyfish_api || "tool")}`, "info");
            continue;
          }
          if (ty === "COMPLETE") {
            setResult(ev.result);
            if (String(ev.status) === "FAILED") {
              const help = [ev.error, ev.help_message].filter(Boolean).join(" ");
              appendLog(`Failed: ${help || "unknown error"}`, "error");
            } else {
              appendLog("Run completed", "ok");
              const site = url.trim();
              if (site) {
                setMapSave("saving");
                void (async () => {
                  try {
                    const res = await fetch("/api/startups/merge-one", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: site }),
                    });
                    const data = (await res.json()) as {
                      error?: string;
                      created?: boolean;
                      name?: string;
                      alreadyOnMap?: boolean;
                    };
                    if (res.ok) {
                      const already = data.alreadyOnMap === true;
                      setMapSave({
                        kind: "ok",
                        created: Boolean(data.created),
                        name: String(data.name || "Your startup"),
                        alreadyOnMap: already,
                      });
                      onStartupAdded?.();
                      if (already) {
                        appendLog(
                          "This site is already on the map — we didn’t create a duplicate.",
                          "ok",
                        );
                      } else {
                        appendLog(
                          "Added to the map — look for it in the sidebar or on the map.",
                          "ok",
                        );
                      }
                    } else {
                      const msg = data.error || res.statusText;
                      setMapSave({ kind: "err", message: msg });
                      appendLog(`Map was not updated: ${msg}`, "error");
                    }
                  } catch (e) {
                    const m = (e as Error).message;
                    setMapSave({ kind: "err", message: m });
                    appendLog(`Map was not updated: ${m}`, "error");
                  }
                })();
              }
            }
            continue;
          }
          appendLog(data.slice(0, 500), "info");
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        appendLog("Cancelled", "info");
      } else {
        setError((e as Error).message);
        appendLog((e as Error).message, "error");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [appendLog, onStartupAdded, reset, url]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] dark:bg-black/70"
      role="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stop();
          onClose();
        }
      }}
      aria-modal="true"
      aria-label="Add your startup"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/10 dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-zinc-100 bg-gradient-to-r from-sky-50 via-white to-violet-50 px-4 py-4 dark:border-zinc-700 dark:from-sky-950/50 dark:via-zinc-900 dark:to-violet-950/40">
          <div className="pr-32">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              For founders
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Add your startup
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Paste your public website — we run a live analysis to read what’s on the page and
              surface a short profile. No custom prompts: sit back and watch the run.{" "}
              <span className="text-zinc-500 dark:text-zinc-500">
                TinyFish and hosting are paid for on this site — you are not charged.
              </span>
            </p>
          </div>
          <div className="absolute right-3 top-3 flex gap-2">
            {running && (
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                onClick={stop}
              >
                Stop
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              onClick={() => {
                stop();
                onClose();
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-zinc-100 p-4 dark:border-zinc-800 md:border-r md:border-b-0">
            <label
              className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400"
              htmlFor="tf-site-url"
            >
              Your company website
            </label>
            <input
              id="tf-site-url"
              className={`mt-1.5 w-full rounded-xl border bg-zinc-50/80 px-3.5 py-2.5 text-sm text-zinc-900 shadow-inner outline-none transition placeholder:text-zinc-400 focus:bg-white focus:ring-2 dark:bg-zinc-950/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
                url.trim() && !localUrl.ok
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800 dark:focus:border-red-600"
                  : "border-zinc-200 ring-sky-500/0 focus:border-sky-500 focus:ring-sky-500/20 dark:border-zinc-600 dark:focus:border-sky-500"
              }`}
              placeholder="https://your-startup.com"
              value={url}
              disabled={running}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url.trim() !== "" && !localUrl.ok && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="status">
                {localUrl.error}
              </p>
            )}
            {url.trim() !== "" && localUrl.ok && lookup === "checking" && (
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" role="status">
                Checking this URL and the map…
              </p>
            )}
            {url.trim() !== "" && localUrl.ok && typeof lookup === "object" && lookup.valid && lookup.exists && (
              <p
                className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                role="status"
              >
                This company is already on the map as <strong className="font-semibold">{lookup.name}</strong>
                . You can still run a fresh preview; we will not add a second pin for the same site.
              </p>
            )}
            {url.trim() !== "" && localUrl.ok && typeof lookup === "object" && lookup.valid && !lookup.exists && (
              <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400" role="status">
                URL looks valid and is not on the map yet.
              </p>
            )}
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
              Use your marketing or product site. We only use this address for the live run and the map
              update.
            </p>
            {mapSave === "saving" && (
              <p className="mt-2 text-xs text-sky-600 dark:text-sky-400">Saving to the map…</p>
            )}
            {mapSave !== "idle" && mapSave !== "saving" && mapSave.kind === "ok" && (
              <p
                className={`mt-2 text-xs font-medium ${
                  mapSave.alreadyOnMap
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {mapSave.alreadyOnMap
                  ? `Already on the map: ${mapSave.name} (no duplicate)`
                  : mapSave.created
                    ? `Added: ${mapSave.name}`
                    : `Updated: ${mapSave.name}`}
              </p>
            )}
            {mapSave !== "idle" && mapSave !== "saving" && mapSave.kind === "err" && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" title={mapSave.message}>
                Could not add to the map: {mapSave.message}
              </p>
            )}
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-3 py-3 text-sm font-semibold text-white shadow-md shadow-sky-900/20 transition hover:from-sky-500 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:from-sky-500 dark:to-sky-600 dark:hover:from-sky-400 dark:hover:to-sky-500"
              disabled={running || !localUrl.ok}
              onClick={() => void start()}
            >
              {running ? "Exploring your site…" : "Run live analysis"}
            </button>
            {error && (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
            )}
            {runId && (
              <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">Run ID: {runId}</p>
            )}

            <div
              ref={logRef}
              className="mt-4 min-h-[140px] max-h-[28vh] overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50/90 p-3 font-mono text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300"
            >
              {log.length === 0 && (
                <p className="text-zinc-400 dark:text-zinc-500">
                  Progress and steps from the agent will stream here.
                </p>
              )}
              {log.map((l, i) => (
                <div
                  key={`${l.t}-${i}`}
                  className={
                    l.kind === "error"
                      ? "text-red-700 dark:text-red-300"
                      : l.kind === "ok"
                        ? "text-emerald-800 dark:text-emerald-300"
                        : "text-zinc-700 dark:text-zinc-300"
                  }
                >
                  <span className="text-zinc-400 dark:text-zinc-500">{l.t}</span> {l.text}
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 min-h-[320px] flex-col p-4 dark:border-zinc-800">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Live browser stream
            </p>
            <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">
              When the run exposes a <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">STREAMING_URL</code>,
              TinyFish can show the session below. <strong className="font-medium text-zinc-600 dark:text-zinc-300">
                If the frame shows a blank or “couldn’t load” page, open in a new tab
              </strong>{" "}
              — the live view host often blocks embedding (X-Frame-Options), but the same URL works in a full tab.
            </p>
            {streamingUrl ? (
              <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
                <a
                  className="inline-flex w-full items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-center text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-500/20 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25"
                  href={streamingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open live view in new tab
                </a>
                <iframe
                  title="TinyFish live browser"
                  className="h-full min-h-[240px] w-full flex-1 rounded-xl border border-zinc-200 bg-zinc-900 dark:border-zinc-700"
                  src={streamingUrl}
                  allow="fullscreen; display-capture; clipboard-read; clipboard-write; autoplay"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="mt-2 flex min-h-[280px] flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-500">
                {running
                  ? "Waiting for the live view URL…"
                  : "Run an analysis to watch the session here"}
              </div>
            )}
            {result != null && (
              <div className="mt-3 max-h-[200px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Result</p>
                <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-zinc-800 dark:text-zinc-200">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
