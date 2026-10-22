export const THEME_STORAGE_KEY = "parsu-color-theme";
export const DEFAULT_THEME = "blue";
export const MODE_STORAGE_KEY = "parsu-color-mode";
export const DEFAULT_MODE = "light";
export type ColorMode = "light" | "dark";

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark";
}

export const THEMES = [
  { id: "blue", label: "ParSU Blue", color: "#06345c", darkColor: "#93c5fd" },
  { id: "pink", label: "Pink", color: "#be185d", darkColor: "#f9a8d4" },
  { id: "lime", label: "Lime Green", color: "#3f6212", darkColor: "#bef264" },
  { id: "purple", label: "Purple", color: "#5b4fe0", darkColor: "#c4b5fd" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

// Run before the body paints, including when browser storage is unavailable.
export const THEME_INITIALIZER = `(()=>{let theme="${DEFAULT_THEME}",mode="${DEFAULT_MODE}";try{const saved=localStorage.getItem("${THEME_STORAGE_KEY}");if(${JSON.stringify(THEMES.map((theme) => theme.id))}.includes(saved))theme=saved;}catch{}try{const saved=localStorage.getItem("${MODE_STORAGE_KEY}");if(saved==="light"||saved==="dark")mode=saved;}catch{}document.documentElement.dataset.theme=theme;document.documentElement.dataset.mode=mode;})();`;
