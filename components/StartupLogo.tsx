"use client";

import { useState } from "react";

import { resolveLogoUrl } from "@/lib/logo";
import type { Startup } from "@/lib/startup";

type Props = {
  startup: Pick<Startup, "id" | "name" | "website" | "logoUrl">;
  size: number;
  className?: string;
};

function initialLetter(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

export function StartupLogo({ startup, size, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const src = resolveLogoUrl(startup);
  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-900 ring-1 ring-sky-200/80 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-hidden
      >
        {initialLetter(startup.name)}
      </div>
    );
  }
  return (
    // External favicon per domain; Next/Image would require allowlisting many hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-lg bg-white object-contain ring-1 ring-zinc-200/80 ${className}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
