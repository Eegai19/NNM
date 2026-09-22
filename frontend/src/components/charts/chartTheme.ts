import { useTheme } from "@/contexts/ThemeContext";
import { CHART_COLORS } from "@/utils/constants";

export interface ChartTheme {
  /** Categorical series colours, assigned in fixed order. */
  series: readonly string[];
  grid: string;
  axis: string;
  /** Surface the marks sit on -- also used for the 2px gap between fills. */
  surface: string;
  tooltipBackground: string;
  tooltipBorder: string;
  text: string;
  mutedText: string;
}

const LIGHT: Omit<ChartTheme, "series"> = {
  grid: "#e2e8f0",
  axis: "#94a3b8",
  surface: "#ffffff",
  tooltipBackground: "#ffffff",
  tooltipBorder: "#cbd5e1",
  text: "#0f172a",
  mutedText: "#64748b",
};

const DARK: Omit<ChartTheme, "series"> = {
  grid: "#1e293b",
  axis: "#64748b",
  surface: "#111a2e",
  tooltipBackground: "#111a2e",
  tooltipBorder: "#334155",
  text: "#e2e8f0",
  mutedText: "#94a3b8",
};

/** Chart tokens for the currently active theme. */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const base = theme === "dark" ? DARK : LIGHT;
  return { ...base, series: theme === "dark" ? CHART_COLORS.dark : CHART_COLORS.light };
}
