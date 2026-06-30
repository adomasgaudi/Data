/**
 * Graph / calendar "hard sets" lens — RIR effort bands or a % of 1RM threshold with a
 * choice of strength reference (strict that-day vs smoothed decay curve).
 */
import type { SetRecord } from "./domain";
import type { GraphConfig } from "./graphConfig";
import { addedWeight1RM } from "./aggregate";
import { strengthDenominatorAtSets } from "./graphMetrics";
import type { EffortClass } from "./metrics";

export type HardSetFilterMode = "off" | "rir" | "pct";
export type HardSetStrengthRef = "now" | "smooth";

export interface HardSetFilterConfig {
  mode: HardSetFilterMode;
  /** Min fraction of strength to KEEP (0–1), when mode === "pct". */
  minPct: number;
  /** Which strength curve defines 100%, when mode === "pct". */
  strengthRef: HardSetStrengthRef;
}

export const HARD_SET_PCT_THRESHOLDS = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95] as const;

export const DEFAULT_HARD_SET_FILTER: HardSetFilterConfig = {
  mode: "off",
  minPct: 0.8,
  strengthRef: "now",
};

const FILTER_KEY = "colosseum.hardSetFilter.v1";
const LEGACY_KEY = "colosseum.hardSetsOnly";

export function recordSetId(r: SetRecord): string {
  return `${r.username}|${r.originalExerciseName ?? r.exerciseName}|${r.date}|${r.setNumber}`;
}

export function loadHardSetFilter(): HardSetFilterConfig {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<HardSetFilterConfig>;
      const mode = o.mode === "rir" || o.mode === "pct" ? o.mode : "off";
      const minPct = HARD_SET_PCT_THRESHOLDS.includes(o.minPct as (typeof HARD_SET_PCT_THRESHOLDS)[number])
        ? (o.minPct as number)
        : DEFAULT_HARD_SET_FILTER.minPct;
      const strengthRef = o.strengthRef === "smooth" ? "smooth" : "now";
      return { mode, minPct, strengthRef };
    }
  } catch { /* ignore */ }
  try {
    if (localStorage.getItem(LEGACY_KEY) === "1") {
      return { mode: "rir", minPct: 0.8, strengthRef: "now" };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_HARD_SET_FILTER };
}

export function saveHardSetFilter(cfg: HardSetFilterConfig): void {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(cfg));
    localStorage.setItem(LEGACY_KEY, cfg.mode !== "off" ? "1" : "0");
  } catch { /* ignore */ }
}

export function cycleHardSetFilterMode(cfg: HardSetFilterConfig): HardSetFilterConfig {
  const next: HardSetFilterMode = cfg.mode === "off" ? "rir" : cfg.mode === "rir" ? "pct" : "off";
  return { ...cfg, mode: next };
}

export function cycleHardSetFilterPct(cfg: HardSetFilterConfig): HardSetFilterConfig {
  const i = HARD_SET_PCT_THRESHOLDS.indexOf(cfg.minPct as (typeof HARD_SET_PCT_THRESHOLDS)[number]);
  const next = HARD_SET_PCT_THRESHOLDS[(i < 0 ? 2 : i + 1) % HARD_SET_PCT_THRESHOLDS.length]!;
  return { ...cfg, minPct: next };
}

export function cycleHardSetFilterRef(cfg: HardSetFilterConfig): HardSetFilterConfig {
  return { ...cfg, strengthRef: cfg.strengthRef === "now" ? "smooth" : "now" };
}

export function hardSetFilterModeLabel(mode: HardSetFilterMode): string {
  return mode === "off" ? "Off" : mode === "rir" ? "RIR" : "%1RM";
}

export function hardSetFilterRefLabel(ref: HardSetStrengthRef): string {
  return ref === "now" ? "Now" : "Smooth";
}

/** Set ids to DROP from graphs / calendar when the lens is active. */
export function hardSetFilterDropIds(
  records: readonly SetRecord[],
  filter: HardSetFilterConfig,
  graphCfg: GraphConfig,
  effortOf: (r: SetRecord) => EffortClass | null,
): Set<string> {
  const drop = new Set<string>();
  if (filter.mode === "off") return drop;

  if (filter.mode === "rir") {
    for (const r of records) {
      const eff = effortOf(r);
      if (eff === "mid" || eff === "warmup") drop.add(recordSetId(r));
    }
    return drop;
  }

  const groups = new Map<string, SetRecord[]>();
  for (const r of records) {
    const k = `${r.username}|${r.originalExerciseName ?? r.exerciseName}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  for (const rs of groups.values()) {
    const denom = strengthDenominatorAtSets(rs, graphCfg, filter.strengthRef);
    for (const r of rs) {
      const e1rm = addedWeight1RM(r, graphCfg.formula);
      const s = denom.get(r);
      if (e1rm == null || s == null || s <= 0) continue; // unknown → keep (like RIR)
      if (e1rm / s < filter.minPct - 1e-9) drop.add(recordSetId(r));
    }
  }
  return drop;
}
