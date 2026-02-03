import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

type ThemeMode = "light" | "dark";

export type ThemeTokens = {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceMuted: string;
  card: string;
  cardMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  heroPrimary: string;
  heroRest: string;
  chipBackground: string;
  chipText: string;
  overlay: string;
  shadow: string;
};

const lightTheme: ThemeTokens = {
  mode: "light",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF2FF",
  card: "#FFFFFF",
  cardMuted: "#F1F5F9",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  accent: "#6366F1",
  accentSoft: "rgba(99,102,241,0.15)",
  accentText: "#1F2937",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  heroPrimary: "#312E81",
  heroRest: "#0F172A",
  chipBackground: "rgba(99,102,241,0.1)",
  chipText: "#1E1B4B",
  overlay: "rgba(15,23,42,0.4)",
  shadow: "rgba(15,23,42,0.12)",
};

const darkTheme: ThemeTokens = {
  mode: "dark",
  background: "#0B1120",
  surface: "#111827",
  surfaceMuted: "#1E293B",
  card: "#111827",
  cardMuted: "#1F2937",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5F5",
  textMuted: "#64748B",
  border: "#1E293B",
  accent: "#A5B4FC",
  accentSoft: "rgba(129,140,248,0.25)",
  accentText: "#111827",
  success: "#4ADE80",
  warning: "#FACC15",
  danger: "#F87171",
  heroPrimary: "#1E1B4B",
  heroRest: "#0F172A",
  chipBackground: "rgba(129,140,248,0.18)",
  chipText: "#E0E7FF",
  overlay: "rgba(0,0,0,0.6)",
  shadow: "rgba(0,0,0,0.4)",
};

type ThemeContextValue = {
  theme: ThemeTokens;
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [overrideMode, setOverrideMode] = useState<ThemeMode | null>(null);
  const resolvedMode: ThemeMode = overrideMode ?? (systemScheme === "dark" ? "dark" : "light");
  const theme = resolvedMode === "dark" ? darkTheme : lightTheme;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: resolvedMode === "dark",
      mode: resolvedMode,
      toggleTheme: () => setOverrideMode((prev) => (prev === "dark" ? "light" : "dark")),
      setMode: (mode: ThemeMode) => setOverrideMode(mode),
    }),
    [theme, resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
