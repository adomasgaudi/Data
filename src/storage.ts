/**
 * Tiny localStorage helpers, extracted from main.ts to replace ~50 copy-pasted
 * try/catch JSON read/write blocks. One place to get the read-back validation and
 * the "storage may be unavailable" guard right, so every per-device override store
 * behaves identically.
 */

/** Read a JSON object from localStorage. Returns {} on a missing key, a parse
 * error, or any non-object value (matches the inline loaders this replaces). */
export function loadJsonObject<T extends object>(key: string): T {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? "{}");
    return (o && typeof o === "object" ? o : {}) as T;
  } catch {
    return {} as T;
  }
}

/** Write a value as JSON to localStorage, swallowing failures (private mode,
 * quota, SSR) so a save never throws into the UI. */
export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable */
  }
}
