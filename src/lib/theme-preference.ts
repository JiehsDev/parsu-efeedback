"use client";

import {
  DEFAULT_THEME,
  DEFAULT_MODE,
  isThemeId,
  isColorMode,
  THEME_STORAGE_KEY,
  MODE_STORAGE_KEY,
  type ThemeId,
  type ColorMode,
} from "./themes";

const CHANGE_EVENT = "parsu:theme-change";

export function getTheme(): ThemeId {
  const value = document.documentElement.dataset.theme;
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export function getServerTheme(): ThemeId {
  return DEFAULT_THEME;
}

export function getMode(): ColorMode {
  const value = document.documentElement.dataset.mode;
  return isColorMode(value) ? value : DEFAULT_MODE;
}

export function getServerMode(): ColorMode {
  return DEFAULT_MODE;
}

export function setMode(mode: ColorMode) {
  document.documentElement.dataset.mode = mode;
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Mode changes still work with browser storage disabled.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still works for this page when storage is blocked.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToTheme(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (![THEME_STORAGE_KEY, MODE_STORAGE_KEY, null].includes(event.key)) return;
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      document.documentElement.dataset.theme = isThemeId(event.newValue)
        ? event.newValue
        : DEFAULT_THEME;
    }
    if (event.key === MODE_STORAGE_KEY || event.key === null) {
      document.documentElement.dataset.mode = isColorMode(event.newValue)
        ? event.newValue
        : DEFAULT_MODE;
    }
    callback();
  }
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
