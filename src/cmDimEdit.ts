/**
 * CM-based variation dimensions — split curve anchors from named units, format keys,
 * and resolve factors via interpolation (pure, no DOM/storage).
 */
import { cmLevelKey, interpCmFactor, parseCmLevelKey } from "./handstandLean";

/** Parse a level key's cm value — accepts "+25cm", "30cm", "-3cm". */
export function parseCmLevel(level: string): number | undefined {
  const signed = parseCmLevelKey(level);
  if (signed !== undefined) return signed;
  const m = /^(\d+(?:\.\d+)?)cm$/.exec(level.trim());
  return m ? parseFloat(m[1]!) : undefined;
}

export function isCmLevelKey(level: string): boolean {
  return parseCmLevel(level) !== undefined;
}

/** Whether a dim's levels are mostly cm-shaped (curve editor, not a flat chip list). */
export function dimUsesCmCurve(levels: Record<string, number>): boolean {
  const cm = Object.keys(levels).filter(isCmLevelKey);
  return cm.length >= 2;
}

/** Split a dim table into interpolated cm anchors vs named shortcuts (blue, none…). */
export function splitCmDimLevels(levels: Record<string, number>): {
  anchors: Record<string, number>;
  named: Record<string, number>;
} {
  const anchors: Record<string, number> = {};
  const named: Record<string, number> = {};
  for (const [k, f] of Object.entries(levels)) {
    if (isCmLevelKey(k)) anchors[k] = f;
    else named[k] = f;
  }
  return { anchors, named };
}

/** Infer whether positive cm keys use a "+" prefix (rom) or plain "Ncm" (shoulderDist). */
export function inferCmKeyStyle(existingKeys: readonly string[]): "signed" | "plain" {
  for (const k of existingKeys) {
    if (/^\+\d/.test(k)) return "signed";
  }
  return "plain";
}

/** Format a numeric cm as a level key matching the family's existing style. */
export function formatCmLevelKey(cm: number, style: "signed" | "plain" = "signed"): string {
  if (style === "plain") return `${Math.round(cm)}cm`;
  return cmLevelKey(cm);
}

/** Default cm equivalents for well-known named unit keys. */
export const DEFAULT_NAMED_UNIT_CM: Record<string, number> = {
  blue: 6,
  wall: 0,
};

/** Resolve a named unit's cm (caller supplies owner overrides on top of defaults). */
export function namedUnitCm(
  key: string,
  overrides: Record<string, number> = {},
): number | undefined {
  if (key in overrides) return overrides[key];
  return DEFAULT_NAMED_UNIT_CM[key];
}

/** Factor for a level: exact table hit, else interpolate on cm anchors, else 1. */
export function factorForCmDimLevel(
  anchors: Record<string, number>,
  level: string,
  namedCm?: number,
): number {
  if (level in anchors) return anchors[level]!;
  const cm = parseCmLevel(level) ?? namedCm;
  if (cm !== undefined) {
    const style = inferCmKeyStyle(Object.keys(anchors));
    const key = formatCmLevelKey(cm, style);
    const interp = interpCmFactor(anchors, key);
    if (interp !== undefined) return interp;
    // shoulderDist-style plain keys: try the key as stored too
    if (style === "plain") {
      const alt = interpCmFactor(anchors, `${Math.round(cm)}cm`);
      if (alt !== undefined) return alt;
    }
  }
  return 1;
}

/** Sorted anchor rows for display (cm ascending). */
export function sortedCmAnchors(anchors: Record<string, number>): Array<{ key: string; cm: number; factor: number }> {
  return Object.entries(anchors)
    .map(([key, factor]) => ({ key, cm: parseCmLevel(key) ?? 0, factor }))
    .filter((r) => Number.isFinite(r.cm))
    .sort((a, b) => a.cm - b.cm);
}

/** The few cm heights that define the editable curve — min, 0 (when in range), max. */
export function defaultSparseAnchorCms(levels: Record<string, number>): number[] {
  const { anchors } = splitCmDimLevels(levels);
  const cms = sortedCmAnchors(anchors).map((a) => a.cm);
  if (cms.length <= 3) return cms;
  const min = cms[0]!, max = cms[cms.length - 1]!;
  const zero = cms.find((c) => c === 0);
  const mid = cms[Math.floor(cms.length / 2)]!;
  const picked = new Set<number>([min, max]);
  if (zero !== undefined) picked.add(0);
  else picked.add(mid);
  return [...picked].sort((a, b) => a - b);
}

/** Sparse cm→× anchors derived from a full preset table (for the formula editor, not every step). */
export function defaultSparseAnchors(levels: Record<string, number>): Record<string, number> {
  const { anchors } = splitCmDimLevels(levels);
  const style = inferCmKeyStyle(Object.keys(anchors));
  const out: Record<string, number> = {};
  for (const cm of defaultSparseAnchorCms(levels)) {
    const key = formatCmLevelKey(cm, style);
    out[key] = anchors[key] ?? factorForCmDimLevel(anchors, key, cm);
  }
  return out;
}

/** Layer owner sparse-anchor edits over defaults (extra keys = user-added anchors). */
export function mergeCmCurveAnchors(
  defaults: Record<string, number>,
  overrides: Record<string, number> = {},
): Record<string, number> {
  return { ...defaults, ...overrides };
}
