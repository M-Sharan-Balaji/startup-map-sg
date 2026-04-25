"use client";

import dynamic from "next/dynamic";

const StartupExplorer = dynamic(
  () =>
    import("@/components/StartupExplorer").then((m) => ({
      default: m.StartupExplorer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center bg-[#f6f7f9] text-sm text-zinc-600">
        Loading map…
      </div>
    ),
  },
);

export function MapShell() {
  return <StartupExplorer />;
}
