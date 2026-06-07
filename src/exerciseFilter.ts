/**
 * Reusable exercise filter engine (TASK 19). Pure and identity-agnostic: it works
 * purely off exercise NAMES + a metadata provider, so it filters original,
 * dissolved, combined and comparison exercises exactly the same way.
 *
 * A filter is a dimension + a set of accepted values. Within one filter the values
 * are OR'd (any match passes); across filters they're AND'd (all must pass). An
 * empty value set is treated as inactive (matches everything), so you can hold one
 * filter per dimension and just fill the ones you care about.
 */
import { exerciseMetaValues } from "./exerciseMeta";

export const FILTER_DIMS = [
  "discipline",
  "bodyPart",
  "muscleGroup",
  "joint",
  "movement",
  "plane",
  "function",
  "equipment",
  "difficulty",
  "loadType",
  "laterality",
  "tier",
] as const;
export type ExerciseFilterDim = (typeof FILTER_DIMS)[number];

/** Human labels for the dimensions (for any UI that renders them). */
export const FILTER_DIM_LABELS: Record<ExerciseFilterDim, string> = {
  discipline: "Discipline",
  bodyPart: "Body part",
  muscleGroup: "Muscle group",
  joint: "Joint",
  movement: "Movement",
  plane: "Plane",
  function: "Function",
  equipment: "Equipment",
  difficulty: "Difficulty",
  loadType: "Load type",
  laterality: "Unilateral/Bilateral",
  tier: "Tier",
};

export interface ExerciseFilter {
  dim: ExerciseFilterDim;
  /** Accepted values (OR within a dimension). Empty ⇒ this filter is inactive. */
  values: string[];
}

/** Supplies an exercise's values for a dimension. Defaults to the built-in
 * metadata (profile-derived + taxonomy registries). */
export type MetaProvider = (name: string, dim: ExerciseFilterDim) => string[];
const defaultProvider: MetaProvider = (name, dim) => exerciseMetaValues(name, dim);

/** True if one exercise satisfies ALL the (active) filters. */
export function matchesFilters(
  name: string,
  filters: readonly ExerciseFilter[],
  meta: MetaProvider = defaultProvider,
): boolean {
  return filters.every((f) => {
    if (f.values.length === 0) return true; // inactive
    const accepted = new Set(f.values);
    return meta(name, f.dim).some((v) => accepted.has(v));
  });
}

/** Filter a list of exercise names by the active filters (AND across dimensions,
 * OR within a dimension). Order is preserved; identity is irrelevant. */
export function filterExercises(
  names: readonly string[],
  filters: readonly ExerciseFilter[],
  meta: MetaProvider = defaultProvider,
): string[] {
  const active = filters.filter((f) => f.values.length > 0);
  if (active.length === 0) return [...names];
  return names.filter((n) => matchesFilters(n, active, meta));
}
