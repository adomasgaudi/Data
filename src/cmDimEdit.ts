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

/** Parametric cm→× curve — 0cm is always ×1; slopes above/below are editable. */
export interface CmCurveFormula {
  /** × change per +1cm (deeper / easier) — a negative number. */
  deeperPerCm: number;
  /** × change per −1cm (shallower / harder) — a positive number. */
  shallowerPerCm: number;
  min: number;
  max: number;
}

/** Derive default formula slopes from the built-in preset table endpoints. */
export function defaultCmCurveFormula(levels: Record<string, number>): CmCurveFormula {
  const { anchors } = splitCmDimLevels(levels);
  const rows = sortedCmAnchors(anchors);
  const at0 = rows.find((r) => r.cm === 0)?.factor ?? 1;
  const pos = rows.filter((r) => r.cm > 0).sort((a, b) => b.cm - a.cm);
  const neg = rows.filter((r) => r.cm < 0).sort((a, b) => a.cm - b.cm);
  const deeperPerCm = pos.length ? (pos[0]!.factor - at0) / pos[0]!.cm : -0.02;
  const shallowerPerCm = neg.length ? (neg[0]!.factor - at0) / (-neg[0]!.cm) : 0.025;
  const fs = rows.map((r) => r.factor);
  return {
    deeperPerCm: Math.round(deeperPerCm * 1e6) / 1e6,
    shallowerPerCm: Math.round(shallowerPerCm * 1e6) / 1e6,
    min: Math.min(0.4, ...fs, 1),
    max: Math.max(1.6, ...fs, 1),
  };
}

/** × multiplier at `cm` from the parametric formula (0cm → ×1 before clamp). */
export function cmCurveFormulaMult(cm: number, f: CmCurveFormula): number {
  const raw = cm >= 0 ? 1 + f.deeperPerCm * cm : 1 + f.shallowerPerCm * (-cm);
  return Math.max(f.min, Math.min(f.max, Math.round(raw * 1000) / 1000));
}

/** Sample the formula across the preset cm span (for SVG + previews). */
export function cmCurveFormulaSamples(
  levels: Record<string, number>,
  formula: CmCurveFormula,
  steps = 24,
): Array<{ cm: number; factor: number }> {
  const cms = sortedCmAnchors(splitCmDimLevels(levels).anchors).map((r) => r.cm);
  const minCm = cms[0] ?? -20;
  const maxCm = cms[cms.length - 1] ?? 25;
  const out: Array<{ cm: number; factor: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const cm = Math.round((minCm + ((maxCm - minCm) * i) / steps) * 10) / 10;
    out.push({ cm, factor: cmCurveFormulaMult(cm, formula) });
  }
  return out;
}
