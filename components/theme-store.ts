/**
 * Client theme: localStorage + <html class="dark"> + system preference when unset.
 * Exposed through useSyncExternalStore (avoids setState in effects; SSR: light).
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "sg-startup-map-theme";

const listeners = new Set<() => void>();

let snapshot: Theme = "light";

function readStored(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "dark" || s === "light") {
      return s;
    }
  } catch {
    // ignore
  }
  return null;
}

function readSystem(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readThemeFromEnvironment(): Theme {
  return readStored() ?? readSystem();
}

function applyToDom(t: Theme) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle("dark", t === "dark");
}

function emit() {
  for (const l of listeners) {
    l();
  }
}

export function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const isFirst = listeners.size === 0;
  listeners.add(callback);
  if (isFirst) {
    snapshot = readThemeFromEnvironment();
    applyToDom(snapshot);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onPrefChange = () => {
      if (readStored() != null) {
        return;
      }
      snapshot = readSystem();
      applyToDom(snapshot);
      emit();
    };
    mq.addEventListener("change", onPrefChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        snapshot = readThemeFromEnvironment();
        applyToDom(snapshot);
        emit();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        mq.removeEventListener("change", onPrefChange);
        window.removeEventListener("storage", onStorage);
      }
    };
  }
  return () => {
    listeners.delete(callback);
  };
}

export function getSnapshot(): Theme {
  if (typeof window === "undefined") {
    return snapshot;
  }
  if (listeners.size === 0) {
    /* First paint before subscribe: align DOM + in-memory (Strict Mode, etc.) */
    snapshot = readThemeFromEnvironment();
    applyToDom(snapshot);
  }
  return snapshot;
}

export function getServerSnapshot(): Theme {
  return "light";
}

export function setTheme(t: Theme) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // ignore
  }
  snapshot = t;
  applyToDom(t);
  emit();
}

export function toggleTheme() {
  setTheme(getSnapshot() === "dark" ? "light" : "dark");
}
