/**
 * Exercise-frequency tiers (S/A/B/C/D), extracted from main.ts. Pure data + a
 * pure lookup, so the "how often is this lift trained" classification has one
 * source of truth and can be unit-tested. Also passed into
 * aggregate.buildActiveExerciseSet for the active-set cutoff.
 */

export const FREQ_TIERS: { tier: string; min: number; label: string }[] = [
  { tier: "S", min: 25, label: "S · staples (25+ sets)" },
  { tier: "A", min: 15, label: "A · regulars (15–24)" },
  { tier: "B", min: 8, label: "B · occasional (8–14)" },
  { tier: "C", min: 3, label: "C · rare (3–7)" },
  { tier: "D", min: 1, label: "D · tried once or twice (1–2)" },
];

/** The highest tier a set-count qualifies for, or null below the lowest threshold. */
export function frequencyTier(count: number): { tier: string; label: string } | null {
  for (const t of FREQ_TIERS) if (count >= t.min) return { tier: t.tier, label: t.label };
  return null;
}
