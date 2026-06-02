const DARK = {
  bg:           "#080c18",
  card:         "#0d1528",
  cardAlt:      "#111d33",
  border:       "rgba(255,255,255,0.08)",
  borderBright: "rgba(255,255,255,0.15)",
  bgControl:    "rgba(255,255,255,0.06)",
  borderControl:"rgba(255,255,255,0.14)",
  borderSubtle: "rgba(255,255,255,0.04)",
  cardShadow:   "0 2px 20px rgba(0,0,0,0.5)",
  pillShadow:   "0 2px 10px rgba(0,0,0,0.4)",
  t1: "#f1f5f9",
  t2: "#d4e0ec",
  t3: "#b0c4d8",
  t4: "#8aaabf",
  t5: "#607d92",
  blue:   "#60a5fa",
  green:  "#34d399",
  yellow: "#fbbf24",
  red:    "#f87171",
  purple: "#a78bfa",
  cyan:   "#22d3ee",
  orange: "#fb923c",
  teal:   "#2dd4bf",
};

const LIGHT = {
  bg:           "#f0f2f5",
  card:         "#ffffff",
  cardAlt:      "#e8ebf0",
  border:       "rgba(0,0,0,0.10)",
  borderBright: "rgba(0,0,0,0.20)",
  bgControl:    "rgba(0,0,0,0.05)",
  borderControl:"rgba(0,0,0,0.13)",
  borderSubtle: "rgba(0,0,0,0.06)",
  cardShadow:   "0 2px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
  pillShadow:   "0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)",
  t1: "#0f172a",
  t2: "#1e293b",
  t3: "#334155",
  t4: "#475569",
  t5: "#64748b",
  blue:   "#1a5fc4",
  green:  "#0a7a52",
  yellow: "#b06808",
  red:    "#c42020",
  purple: "#5a28c0",
  cyan:   "#0a6880",
  orange: "#c44408",
  teal:   "#0a6a60",
};

export const T = { ...DARK, isDark: true };

export function applyTheme(isDark) {
  Object.assign(T, isDark ? DARK : LIGHT);
  T.isDark = isDark;
}

export const ATD_PREFIX = "BR-ATD-";
export const ATP_GROUP  = "BR-ATP";

export const GROUP_COLORS = {
  "BR-ATD-BR1":  "#60a5fa",
  "BR-ATD-BR2":  "#34d399",
  "BR-ATD-BR3":  "#a78bfa",
  "BR-ATD-BR4":  "#22d3ee",
  "BR-ATD-BR5":  "#fbbf24",
  "BR-ATD-BR6":  "#fb923c",
  "BR-ATD-BR7":  "#f472b6",
  "BR-ATD-BR8":  "#4ade80",
  "BR-ATD-BR9":  "#e879f9",
  "BR-ATD-BR10": "#38bdf8",
  "BR-ATP":      "#fb923c",
};

export function gridCols(n) {
  if (n <= 5) return n;
  if (n === 6) return 3;
  if (n <= 8)  return 4;
  return 5;
}

export function progColor(p) {
  if (p == null) return T.t4;
  if (p > 1)     return T.cyan;
  if (p >= 0.8)  return T.green;
  if (p >= 0.6)  return T.yellow;
  return T.red;
}

export function scoreColor(s) {
  if (!s)       return T.t4;
  if (s >= 9)   return T.green;
  if (s >= 8.5) return T.blue;
  if (s >= 8)   return T.purple;
  if (s >= 7)   return T.yellow;
  return T.red;
}
