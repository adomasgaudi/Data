/**
 * Equipment model — pure resolution (Phase 3 of docs/machine-model-plan.md).
 *
 * A piece of EQUIPMENT (machine / dumbbell / bar…) is shared by exercises and owns the machine
 * settings (kg base, ÷ multiplier, assisted). A lift's "Default" is its own legacy per-exercise
 * settings — NOT in the registry, passed in here as the `fallback`. These functions are the pure
 * core the app's resolvers delegate to, so the stamp→registry→fallback rule is unit-tested.
 */
export interface Equipment {
  id: string;
  name: string;
  kind?: string;
  kgBase: number;
  divisor: number;
  assisted: boolean;
}

export type EquipSettings = { kgBase: number; divisor: number; assisted: boolean };

/**
 * Resolve the machine settings for a chosen/stamped equipment id: the registry entry's settings
 * when the id is present AND in the registry, else the `fallback` (the lift's Default / legacy
 * per-exercise settings). A missing/unknown id never throws — it falls back. This single rule
 * backs BOTH a set's stamped equipment (so old, unstamped sets keep the default) and a user's
 * current choice (what a new set will use).
 */
export function resolveEquip(
  id: string | null | undefined,
  registry: Record<string, Equipment>,
  fallback: EquipSettings,
): EquipSettings {
  const e = id ? registry[id] : undefined;
  return e ? { kgBase: e.kgBase, divisor: e.divisor, assisted: e.assisted } : fallback;
}
