import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";

import { dark, light } from "./palette";
import type { Mode, Palette } from "./palette";
import { makeTypeRoles } from "./typeRoles";
import type { TypeRoles } from "./typeRoles";

export type Theme = {
  mode: Mode;
  /** The active palette — every color in the new screens resolves through this. */
  c: Palette;
  /** Type roles built from the active palette. */
  t: TypeRoles;
};

const ThemeContext = createContext<Theme | null>(null);

/**
 * Theme provider — follows the system color scheme (design README §Interactions:
 * "Light/dark follows system color scheme"). LIGHT = Porcelain, DARK = Ivy.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const mode: Mode = scheme === "dark" ? "dark" : "light";

  const value = useMemo<Theme>(() => {
    const c = mode === "dark" ? dark : light;
    return { mode, c, t: makeTypeRoles(c) };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Must be called under <ThemeProvider>. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
