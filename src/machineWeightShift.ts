/** How to treat existing logged sets when a lift's machine base weight changes. */
export type MachineWeightSetAdjust = "keep" | "shift";

/** Δ kg base change (new − old). */
export function machineWeightDelta(oldBase: number, newBase: number): number {
  return newBase - oldBase;
}

/** Weight after applying a machine-base adjustment to one set's logged value. */
export function adjustedSetWeight(
  loggedWeight: number,
  delta: number,
  mode: MachineWeightSetAdjust,
): number {
  if (mode === "keep" || delta === 0) return loggedWeight;
  return Math.round((loggedWeight - delta) * 10) / 10;
}
