"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Check, Palette, Moon, Sun } from "lucide-react";
import { THEMES } from "@/lib/themes";
import {
  getTheme,
  getServerTheme,
  setTheme,
  subscribeToTheme,
  getMode,
  getServerMode,
  setMode,
} from "@/lib/theme-preference";

export function ThemeSwitcher({
  sidebar = false,
  onPrimary = false,
}: {
  sidebar?: boolean;
  onPrimary?: boolean;
}) {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);
  const mode = useSyncExternalStore(subscribeToTheme, getMode, getServerMode);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className={`relative flex gap-1 ${sidebar ? "flex-col" : "items-center"}`} ref={root}>
      <button
        ref={trigger}
        type="button"
        aria-label="Choose color theme"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-9 items-center gap-2 rounded-lg p-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${sidebar ? "w-full justify-center lg:justify-start" : "justify-center"} ${onPrimary ? "text-white hover:bg-black/10 focus-visible:outline-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-[var(--ring)]"}`}
      >
        <Palette className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={sidebar ? "hidden lg:inline" : "hidden sm:inline"}>Theme</span>
      </button>
      <button
        type="button"
        role="switch"
        aria-label="Dark mode"
        aria-checked={mode === "dark"}
        title={mode === "dark" ? "Use light mode" : "Use dark mode"}
        onClick={() => setMode(mode === "dark" ? "light" : "dark")}
        className={`flex min-h-9 items-center gap-2 rounded-lg p-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${sidebar ? "w-full justify-center lg:justify-start" : "justify-center"} ${onPrimary ? "text-white hover:bg-black/10 focus-visible:outline-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-[var(--ring)]"}`}
      >
        {mode === "dark" ? (
          <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span className={sidebar ? "hidden lg:inline" : "hidden sm:inline"}>Dark mode</span>
        <span
          className={
            sidebar ? "ml-auto hidden text-[10px] lg:inline" : "hidden text-[10px] sm:inline"
          }
        >
          {mode === "dark" ? "On" : "Off"}
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          className={`absolute z-50 w-52 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-3 text-[var(--popover-foreground)] shadow-xl ${sidebar ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"}`}
        >
          <fieldset>
            <legend className="mb-2 text-xs font-semibold">Color theme</legend>
            <div className="space-y-1">
              {THEMES.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-[var(--accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--ring)]"
                >
                  <input
                    type="radio"
                    name={`theme-${panelId}`}
                    value={option.id}
                    checked={theme === option.id}
                    onChange={() => setTheme(option.id)}
                    className="sr-only"
                  />
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: mode === "dark" ? option.darkColor : option.color }}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{option.label}</span>
                  {theme === option.id && (
                    <Check className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
