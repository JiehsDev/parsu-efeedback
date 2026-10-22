import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_INITIALIZER,
  isThemeId,
  MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./themes";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
function variables(block: string) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1]!, match[2]!]),
  );
}
const base = variables(css.match(/:root\s*\{([^}]+)\}/)![1]!);
function rgb(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}
function luminance(hex: string) {
  const values = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
function blend(foreground: string, background: string, alpha: number) {
  const fg = rgb(foreground);
  return `#${rgb(background)
    .map((value, index) =>
      Math.round(fg[index]! * alpha + value * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

describe("theme readability", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const theme of THEMES) {
      it(`${theme.label} ${mode}: text meets 4.5:1 and input/focus boundaries meet 3:1`, () => {
        const override =
          css.match(new RegExp(`:root\\[data-theme="${theme.id}"\\]\\s*\\{([^}]+)\\}`))?.[1] ?? "";
        const darkBase =
          mode === "dark" ? (css.match(/:root\[data-mode="dark"\]\s*\{([^}]+)\}/)?.[1] ?? "") : "";
        const darkTheme =
          mode === "dark"
            ? (css.match(
                new RegExp(
                  `:root\\[data-mode="dark"\\]\\[data-theme="${theme.id}"\\]\\s*\\{([^}]+)\\}`,
                ),
              )?.[1] ?? "")
            : "";
        const palette = {
          ...base,
          ...variables(override),
          ...variables(darkBase),
          ...variables(darkTheme),
        };
        if (mode === "light") expect(palette["--primary"]).toBe(theme.color);
        else expect(palette["--primary"]).toBe(theme.darkColor);
        const pairs = [
          ["--foreground", "--background"],
          ["--card-foreground", "--card"],
          ["--popover-foreground", "--popover"],
          ["--primary-foreground", "--primary"],
          ["--secondary-foreground", "--secondary"],
          ["--destructive-foreground", "--destructive"],
          ["--muted-foreground", "--muted"],
          ["--muted-foreground", "--background"],
          ["--muted-foreground", "--card"],
          ["--accent-foreground", "--accent"],
          ["--primary", "--background"],
          ["--primary", "--card"],
          ["--destructive", "--card"],
          ["--qa-slate", "--card"],
          ["--qa-amber-strong", "--card"],
          ["--foreground", "--accent"],
          ["--qa-success-strong", "--qa-success-soft"],
          ["--qa-amber-strong", "--qa-amber-soft"],
          ["--qa-rose-strong", "--qa-rose-soft"],
          ["--qa-teal-strong", "--qa-teal-soft"],
        ];
        for (const [text, surface] of pairs) {
          expect(
            contrast(palette[text!]!, palette[surface!]!),
            `${text} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        for (const background of ["--card", "--background"]) {
          expect(contrast(palette["--input"]!, palette[background]!)).toBeGreaterThanOrEqual(3);
          expect(contrast(palette["--ring"]!, palette[background]!)).toBeGreaterThanOrEqual(3);
        }
        // Student navigation uses a translucent light wrapper; badges use a tinted primary fill.
        expect(
          contrast(
            "#ffffff",
            blend("#ffffff", palette["--navigation"] ?? palette["--primary"]!, 0.1),
          ),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(palette["--primary"]!, blend(palette["--primary"]!, palette["--card"]!, 0.15)),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("initial theme", () => {
  for (const saved of [null, "unknown", ...THEMES.map((theme) => theme.id)]) {
    it(`restores a valid choice or defaults to ParSU blue (${saved})`, () => {
      const document = { documentElement: { dataset: {} as Record<string, string> } };
      runInNewContext(THEME_INITIALIZER, { document, localStorage: { getItem: () => saved } });
      expect(document.documentElement.dataset.theme).toBe(isThemeId(saved) ? saved : DEFAULT_THEME);
    });
  }
  it("uses the default when storage is blocked", () => {
    const document = { documentElement: { dataset: {} as Record<string, string> } };
    runInNewContext(THEME_INITIALIZER, {
      document,
      localStorage: {
        getItem: () => {
          throw Error("blocked");
        },
      },
    });
    expect(document.documentElement.dataset.theme).toBe("blue");
  });
});

describe("initial color mode", () => {
  for (const savedMode of [null, "invalid", "light", "dark"]) {
    it(`restores mode independently of the color theme (${savedMode})`, () => {
      const document = { documentElement: { dataset: {} as Record<string, string> } };
      runInNewContext(THEME_INITIALIZER, {
        document,
        localStorage: {
          getItem: (key: string) =>
            key === MODE_STORAGE_KEY ? savedMode : key === THEME_STORAGE_KEY ? "pink" : null,
        },
      });
      expect(document.documentElement.dataset.theme).toBe("pink");
      expect(document.documentElement.dataset.mode).toBe(savedMode === "dark" ? "dark" : "light");
    });
  }
  it("keeps the color when mode storage is blocked", () => {
    const document = { documentElement: { dataset: {} as Record<string, string> } };
    runInNewContext(THEME_INITIALIZER, {
      document,
      localStorage: {
        getItem: (key: string) => {
          if (key === MODE_STORAGE_KEY) throw Error("blocked");
          return "lime";
        },
      },
    });
    expect(document.documentElement.dataset.theme).toBe("lime");
    expect(document.documentElement.dataset.mode).toBe("light");
  });
});
