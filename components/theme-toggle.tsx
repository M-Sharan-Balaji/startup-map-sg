"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggle, ready } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700"
      title={ready && theme === "dark" ? "Light mode" : "Dark mode"}
      aria-label={ready && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {ready && theme === "dark" ? (
        <span className="text-base leading-none" aria-hidden>
          ☀️
        </span>
      ) : (
        <span className="text-base leading-none" aria-hidden>
          🌙
        </span>
      )}
    </button>
  );
}
