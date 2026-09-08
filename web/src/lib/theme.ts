export const THEME_STORAGE_KEY = "tradeos-theme";

export type ThemePreference = "light" | "dark" | "system";

export function applyTheme(theme: ThemePreference): void {
  const isDark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function getStoredTheme(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export const THEME_CHANGE_EVENT = "tradeos-theme-change";

export function setStoredTheme(theme: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  // The native "storage" event only fires in *other* tabs/windows, never the
  // one that made the change, so a same-tab listener (e.g. the toggle's own
  // active-state highlight) needs this instead.
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/**
 * Serialized as a string and inlined into a blocking <script> in the root
 * layout's <head>, so the .dark class is set before first paint - avoiding
 * a flash of the wrong theme on load. Cannot import THEME_STORAGE_KEY
 * (this runs before any module graph exists), so the key is duplicated
 * literally; keep it in sync with THEME_STORAGE_KEY above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("tradeos-theme");var d=t==="dark"||((t===null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
