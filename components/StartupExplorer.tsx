"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StartupLogo } from "@/components/StartupLogo";
import { StartupMap } from "@/components/StartupMap";
import { ThemeToggle } from "@/components/theme-toggle";
import { TinyFishAnalyzePanel } from "@/components/TinyFishAnalyzePanel";
import { STAGES, type Startup } from "@/lib/startup";

type ApiResponse = {
  version: number;
  updatedAt: string;
  startups: Startup[];
};

export function StartupExplorer() {
  const [all, setAll] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [sector, setSector] = useState("");
  const [hiringOnly, setHiringOnly] = useState(false);
  const [selected, setSelected] = useState<Startup | null>(null);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);
      const res = await fetch("/api/startups", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ApiResponse;
      setAll(data.startups);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "k") {
        ev.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const st of all) {
      for (const x of st.sectors) s.add(x);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [all]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((s) => {
      if (stage && s.stage !== stage) return false;
      if (sector && !s.sectors.map((x) => x.toLowerCase()).includes(sector.toLowerCase())) {
        return false;
      }
      if (hiringOnly && s.hiring !== true) return false;
      if (!t) return true;
      const hay = [s.name, s.description, s.website, ...s.sectors]
        .join(" ")
        .toLowerCase();
      return t.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [all, q, stage, sector, hiringOnly]);

  return (
    <div className="relative flex h-dvh w-full flex-col bg-[#f6f7f9] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="z-10 flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold tracking-tight">Singapore startup map</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Curated map + optional TinyFish enrichment.{" "}
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[10px] dark:border-zinc-600 dark:bg-zinc-800">
              ⌘K
            </kbd>{" "}
            search
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Founders</span>
            <button
              type="button"
              onClick={() => setAnalyzeOpen(true)}
              className="rounded-lg border border-sky-200 bg-gradient-to-b from-sky-50 to-white px-3 py-1.5 text-sm font-semibold text-sky-900 shadow-sm shadow-sky-900/5 transition hover:border-sky-300 hover:from-sky-100 dark:border-sky-800 dark:from-sky-950/80 dark:to-zinc-900 dark:text-sky-100 dark:hover:border-sky-700"
            >
              Add your startup
            </button>
          </div>
          <label className="flex flex-col gap-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Search
            <input
              ref={searchRef}
              className="min-w-[200px] rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-sky-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="Name, sector, URL…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Stage
            <select
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm shadow-sm outline-none focus:border-sky-500 dark:border-zinc-600 dark:bg-zinc-900"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All</option>
              {STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Sector
            <select
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm shadow-sm outline-none focus:border-sky-500 dark:border-zinc-600 dark:bg-zinc-900"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              <option value="">All</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-5 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={hiringOnly}
              onChange={(e) => setHiringOnly(e.target.checked)}
            />
            Hiring
          </label>
          <div className="flex items-end self-end pb-0.5">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="hidden w-80 shrink-0 flex-col border-r border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/50 md:flex">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {loading
              ? "Loading…"
              : `${filtered.length} of ${all.length} visible`}
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`mb-1 flex w-full gap-2 rounded-lg border px-2 py-2 text-left text-sm transition hover:border-sky-400 dark:hover:border-sky-600 ${selected?.id === s.id ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/50" : "border-transparent bg-zinc-50/80 dark:bg-zinc-800/40"}`}
                  onClick={() => setSelected(s)}
                >
                  <StartupLogo startup={s} size={40} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{s.name}</div>
                    <div className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {s.description}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="relative min-h-[50vh] flex-1 md:min-h-0">
          {error && (
            <div className="absolute inset-x-0 top-0 z-20 m-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200">
              {error}
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-300">
              Loading map…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/70 p-6 text-center dark:bg-zinc-950/60">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No startups match</p>
              <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                Try clearing the search box and filters, or add a company with{" "}
                <strong className="font-medium text-zinc-700 dark:text-zinc-300">Add your startup</strong> in
                the header.
              </p>
            </div>
          )}
          <StartupMap startups={filtered} onSelect={setSelected} />
        </div>

        {selected && (
          <aside className="absolute right-0 top-0 z-20 m-3 w-[min(100%,22rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 md:relative md:m-0 md:h-full md:w-80 md:rounded-none md:border-l md:border-t-0 md:shadow-none">
            <button
              type="button"
              className="float-right text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="Close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <div className="flex items-start gap-3 pr-6">
              <StartupLogo startup={selected} size={48} className="mt-0.5 shadow-sm" />
              <h2 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                {selected.name}
              </h2>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{selected.description}</p>
            <dl className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-500">
              {selected.stage !== "Unknown" && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0">Stage</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">{selected.stage}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-20 shrink-0">Sectors</dt>
                <dd className="text-zinc-800 dark:text-zinc-200">{selected.sectors.join(", ")}</dd>
              </div>
              {selected.hiring && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0">Hiring</dt>
                  <dd className="text-emerald-700 dark:text-emerald-400">Yes (from seed / enrichment)</dd>
                </div>
              )}
              {selected.lastEnrichedAt && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0">Enriched</dt>
                  <dd>{new Date(selected.lastEnrichedAt).toLocaleString()}</dd>
                </div>
              )}
              {selected.sourceUrl && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0">Source</dt>
                  <dd className="break-all">
                    <a
                      className="text-sky-600 hover:underline dark:text-sky-400"
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      link
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <a
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              href={selected.website}
              target="_blank"
              rel="noreferrer"
            >
              Visit website
            </a>
          </aside>
        )}
      </div>
      <TinyFishAnalyzePanel
        open={analyzeOpen}
        onClose={() => setAnalyzeOpen(false)}
        onStartupAdded={load}
      />
    </div>
  );
}
