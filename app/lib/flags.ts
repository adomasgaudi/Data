/**
 * Local feature flags, shaped like LaunchDarkly's client so swapping to
 * `launchdarkly-react-client-sdk` later is a drop-in.
 *
 * LaunchDarkly itself is intentionally NOT wired here: its SDK cannot initialise
 * without an account + a client-side ID, and flags are created in their dashboard.
 * Until then, defaults live in code and can be overridden per-device via the
 * `colosseum.flags` localStorage key (e.g. {"showExperimentalCharts": true}).
 */
export interface Flags {
  newLeaderboard: boolean;
  showExperimentalCharts: boolean;
}

const DEFAULTS: Flags = {
  newLeaderboard: true,
  showExperimentalCharts: false,
};

function loadFlags(): Flags {
  try {
    const raw = JSON.parse(localStorage.getItem("colosseum.flags") ?? "{}");
    return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    return DEFAULTS;
  }
}

export const flags: Flags = loadFlags();

/** Read a single flag. Mirrors LaunchDarkly's `useFlags()[key]` shape. */
export function useFlag<K extends keyof Flags>(key: K): Flags[K] {
  return flags[key];
}
