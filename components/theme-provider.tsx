"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { Theme } from "./theme-store";
import {
  getServerSnapshot,
  getSnapshot,
  setTheme,
  subscribe,
  toggleTheme,
} from "./theme-store";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const noopSubscribe = () => () => {};

function clientReady() {
  return true;
}
function ssrNotReady() {
  return false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(noopSubscribe, clientReady, ssrNotReady);
  const set = useCallback((t: Theme) => {
    setTheme(t);
  }, []);
  const tgl = useCallback(() => {
    toggleTheme();
  }, []);
  const value = useMemo(
    () => ({ theme, setTheme: set, toggle: tgl, ready }),
    [theme, set, tgl, ready],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
