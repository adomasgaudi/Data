/**
 * Exercise metadata taxonomies + lookups (TASKS 20–21, and the metadata the
 * filter engine in exerciseFilter.ts reads).
 *
 * Each taxonomy is an extensible `as const` list (add an entry to extend it). The
 * per-exercise assignments are plain registries keyed by exercise NAME (the app's
 * identifier), looked up case-insensitively; an unlisted exercise simply has no
 * values for that dimension. These are pure data + total helpers — they add no
 * behaviour to existing records, so every existing record stays valid.
 *
 * Body part / muscle group / function / tier are NOT duplicated here — they're
 * derived from the existing profile.ts registry by the provider at the bottom.
 */
import {
  muscleGroup,
  exerciseCategories,
  exerciseTier,
  tagsForExercise,
} from "./profile";

// ---- Joint taxonomy (TASK 20) ----
export const JOINTS = [
  "Talocrural (Ankle)",
  "Subtalar",
  "Knee",
  "Hip",
  "Spine",
  "Cervical Spine / Neck",
  "Scapula",
  "Shoulder (Glenohumeral)",
  "Elbow",
  "Radioulnar",
  "Wrist",
  "Fingers",
  "Acromioclavicular",
  "Sternoclavicular",
  "Sternocostal",
  "Costovertebral",
] as const;
export type Joint = (typeof JOINTS)[number];

// ---- Movement taxonomy (TASK 21) — stored independently of joints ----
export const MOVEMENTS = [
  "Flexion",
  "Extension",
  "Hyperextension",
  "Internal Rotation",
  "External Rotation",
  "Abduction",
  "Adduction",
  "Horizontal Abduction",
  "Horizontal Adduction",
  "Inversion",
  "Eversion",
  "Supination",
  "Pronation",
  "Protraction",
  "Retraction",
  "Elevation",
  "Depression",
  "Upward Rotation",
  "Downward Rotation",
  "Anterior Tilt",
  "Posterior Tilt",
  "Anterior Pelvic Tilt",
  "Posterior Pelvic Tilt",
  "Dorsiflexion",
  "Plantar Flexion",
  "Radial Deviation",
  "Ulnar Deviation",
] as const;
export type Movement = (typeof MOVEMENTS)[number];

// ---- Other filterable taxonomies (extensible) ----
// Movement planes (TASK 22) — stored independently; movements reference them and
// exercises inherit them through their movements.
export const PLANES = ["Sagittal", "Frontal", "Horizontal / Transverse", "Longitudinal", "Combined / Multiplanar"] as const;
export type Plane = (typeof PLANES)[number];
export const EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Smith Machine", "Bands"] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export const LOAD_TYPES = ["Free Weight", "Machine", "Bodyweight", "Banded"] as const;
export type LoadType = (typeof LOAD_TYPES)[number];
export const LATERALITIES = ["Bilateral", "Unilateral"] as const;
export type Laterality = (typeof LATERALITIES)[number];
export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Per-exercise assignments. Keyed by exercise name; extend by adding entries.
 * Seeded with representative compound lifts — unlisted exercises resolve to []. */
export const EXERCISE_JOINTS: Record<string, readonly Joint[]> = {
  "Squat": ["Knee", "Hip", "Talocrural (Ankle)", "Spine"],
  "Deadlift": ["Hip", "Knee", "Spine", "Talocrural (Ankle)"],
  "Romanian Deadlift": ["Hip", "Spine"],
  "Bench Press": ["Shoulder (Glenohumeral)", "Elbow", "Scapula"],
  "Incline Bench Press": ["Shoulder (Glenohumeral)", "Elbow", "Scapula"],
  "Overhead Press": ["Shoulder (Glenohumeral)", "Elbow", "Scapula", "Acromioclavicular"],
  "Shoulder Press": ["Shoulder (Glenohumeral)", "Elbow", "Scapula"],
  "Pull Ups": ["Shoulder (Glenohumeral)", "Elbow", "Scapula"],
  "Lat Pulldown": ["Shoulder (Glenohumeral)", "Elbow", "Scapula"],
  "Bicep Curl": ["Elbow", "Radioulnar"],
  "Tricep Pushdown": ["Elbow"],
  "Calf Raise": ["Talocrural (Ankle)", "Subtalar"],
};
export const EXERCISE_MOVEMENTS: Record<string, readonly Movement[]> = {
  "Squat": ["Flexion", "Extension"],
  "Deadlift": ["Extension", "Flexion", "Hyperextension"],
  "Romanian Deadlift": ["Flexion", "Extension"],
  "Bench Press": ["Horizontal Adduction", "Horizontal Abduction", "Flexion", "Extension"],
  "Incline Bench Press": ["Flexion", "Horizontal Adduction"],
  "Overhead Press": ["Abduction", "Flexion", "Upward Rotation"],
  "Shoulder Press": ["Abduction", "Flexion", "Upward Rotation"],
  "Pull Ups": ["Adduction", "Extension", "Flexion", "Downward Rotation"],
  "Lat Pulldown": ["Adduction", "Extension", "Downward Rotation"],
  "Bicep Curl": ["Flexion", "Supination"],
  "Tricep Pushdown": ["Extension"],
  "Calf Raise": ["Plantar Flexion"],
};
/** Which plane(s) each MOVEMENT happens in (TASK 22). Exercises inherit planes
 * through their movements; this is the single source so a plane is never stored
 * twice. Rotations sit in the transverse plane (about a longitudinal axis). */
export const MOVEMENT_PLANES: Record<Movement, readonly Plane[]> = {
  "Flexion": ["Sagittal"],
  "Extension": ["Sagittal"],
  "Hyperextension": ["Sagittal"],
  "Dorsiflexion": ["Sagittal"],
  "Plantar Flexion": ["Sagittal"],
  "Anterior Tilt": ["Sagittal"],
  "Posterior Tilt": ["Sagittal"],
  "Anterior Pelvic Tilt": ["Sagittal"],
  "Posterior Pelvic Tilt": ["Sagittal"],
  "Abduction": ["Frontal"],
  "Adduction": ["Frontal"],
  "Inversion": ["Frontal"],
  "Eversion": ["Frontal"],
  "Elevation": ["Frontal"],
  "Depression": ["Frontal"],
  "Upward Rotation": ["Frontal"],
  "Downward Rotation": ["Frontal"],
  "Radial Deviation": ["Frontal"],
  "Ulnar Deviation": ["Frontal"],
  "Internal Rotation": ["Horizontal / Transverse"],
  "External Rotation": ["Horizontal / Transverse"],
  "Horizontal Abduction": ["Horizontal / Transverse"],
  "Horizontal Adduction": ["Horizontal / Transverse"],
  "Supination": ["Horizontal / Transverse", "Longitudinal"],
  "Pronation": ["Horizontal / Transverse", "Longitudinal"],
  "Protraction": ["Horizontal / Transverse"],
  "Retraction": ["Horizontal / Transverse"],
};

/** Explicit per-exercise plane overrides (e.g. a clearly multiplanar lift). Most
 * exercises leave this empty and inherit planes from their movements. */
export const EXERCISE_PLANES: Record<string, readonly Plane[]> = {};
export const EXERCISE_EQUIPMENT: Record<string, readonly Equipment[]> = {
  "Squat": ["Barbell"],
  "Deadlift": ["Barbell"],
  "Bench Press": ["Barbell"],
  "Pull Ups": ["Bodyweight"],
  "Lat Pulldown": ["Cable", "Machine"],
  "Bicep Curl": ["Dumbbell", "Barbell"],
};
export const EXERCISE_LOAD_TYPES: Record<string, readonly LoadType[]> = {
  "Squat": ["Free Weight"],
  "Deadlift": ["Free Weight"],
  "Bench Press": ["Free Weight"],
  "Pull Ups": ["Bodyweight"],
  "Lat Pulldown": ["Machine"],
};
export const EXERCISE_LATERALITY: Record<string, readonly Laterality[]> = {
  "Squat": ["Bilateral"],
  "Deadlift": ["Bilateral"],
  "Bench Press": ["Bilateral"],
  "Bulgarian Split Squat": ["Unilateral"],
  "Single Leg Romanian Deadlift": ["Unilateral"],
  "Lunge": ["Unilateral"],
};
export const EXERCISE_DIFFICULTY: Record<string, readonly Difficulty[]> = {
  "Squat": ["Intermediate"],
  "Deadlift": ["Intermediate"],
  "Bench Press": ["Beginner"],
  "Muscle Ups": ["Advanced"],
  "Pull Ups": ["Intermediate"],
};

/** Case-insensitive registry lookup → a fresh array (never the stored ref). */
function lookup<T extends string>(reg: Record<string, readonly T[]>, name: string): T[] {
  if (reg[name]) return [...reg[name]!];
  const lower = name.toLowerCase();
  for (const k of Object.keys(reg)) if (k.toLowerCase() === lower) return [...reg[k]!];
  return [];
}

export const jointsForExercise = (name: string): Joint[] => lookup(EXERCISE_JOINTS, name);
export const movementsForExercise = (name: string): Movement[] => lookup(EXERCISE_MOVEMENTS, name);
export const equipmentForExercise = (name: string): Equipment[] => lookup(EXERCISE_EQUIPMENT, name);
export const loadTypesForExercise = (name: string): LoadType[] => lookup(EXERCISE_LOAD_TYPES, name);
export const lateralityForExercise = (name: string): Laterality[] => lookup(EXERCISE_LATERALITY, name);
export const difficultyForExercise = (name: string): Difficulty[] => lookup(EXERCISE_DIFFICULTY, name);

/** The planes an exercise works in (TASK 22): inherited from its movements via
 * MOVEMENT_PLANES, plus any explicit per-exercise override. */
export function planesForExercise(name: string, movements: readonly Movement[] = movementsForExercise(name)): Plane[] {
  const explicit = lookup(EXERCISE_PLANES, name);
  const out = new Set<Plane>(explicit);
  for (const m of movements) for (const p of MOVEMENT_PLANES[m] ?? []) out.add(p);
  return [...out];
}

/**
 * Joint-specific movement display aliases (TASK 23). The GENERIC movement is what
 * is stored/filtered (e.g. "Flexion"); the UI can show a joint-specific label
 * (ankle "Flexion" → "Dorsiflexion") via movementDisplay(). Aliases are pure
 * relabels — they never create a new movement record. Keyed `${joint}|${movement}`.
 */
export const MOVEMENT_ALIASES: Record<string, string> = {
  "Talocrural (Ankle)|Flexion": "Dorsiflexion",
  "Talocrural (Ankle)|Extension": "Plantar Flexion",
  "Wrist|Abduction": "Radial Deviation",
  "Wrist|Adduction": "Ulnar Deviation",
  "Shoulder (Glenohumeral)|Horizontal Abduction": "Horizontal (Frontal) Abduction",
  "Spine|Extension": "Extension / Hyperextension",
  "Hip|Flexion": "Flexion (Anterior Pelvic Tilt)",
  "Hip|Extension": "Extension (Posterior Pelvic Tilt)",
};
/** The label to SHOW for a generic movement at a given joint (alias if any, else
 * the generic movement itself). Display-only — the stored movement is unchanged. */
export function movementDisplay(movement: string, joint?: string): string {
  if (joint && MOVEMENT_ALIASES[`${joint}|${movement}`]) return MOVEMENT_ALIASES[`${joint}|${movement}`]!;
  return movement;
}

/** Functional-pattern labels for an exercise (from the profile registry). */
function functionsForExercise(name: string): string[] {
  return tagsForExercise(name)
    .filter((t) => t.kind === "functional-pattern")
    .map((t) => t.label);
}

/** Optional per-exercise user assignments (TASK 24), injected into the provider
 * so saved joints/movements/planes drive filtering. Keyed by exercise name. */
export type UserAssignments = Record<string, Partial<Record<"joint" | "movement" | "plane", string[]>>>;
function userVals(user: UserAssignments | undefined, name: string, dim: string): string[] | undefined {
  const v = user?.[name]?.[dim as "joint" | "movement" | "plane"];
  return v && v.length ? [...v] : undefined;
}

/**
 * The values an exercise has for a filter dimension — the single metadata source
 * the filter engine reads. Joint/Movement/Plane/Equipment/Difficulty/Load/
 * Laterality come from the registries above; Body part / Muscle group / Function
 * / Tier are derived from the existing profile.ts data. Identity-agnostic: it's
 * keyed purely by exercise name, so it works for original/dissolved/combined/
 * comparison names alike (unknown names just have no values).
 */
export function exerciseMetaValues(name: string, dim: string, user?: UserAssignments): string[] {
  switch (dim) {
    case "bodyPart":
      return exerciseCategories(name);
    case "muscleGroup":
      return [muscleGroup(name)];
    case "function":
      return functionsForExercise(name);
    case "tier":
      return [exerciseTier(name)];
    case "joint":
      return userVals(user, name, "joint") ?? jointsForExercise(name);
    case "movement":
      return userVals(user, name, "movement") ?? movementsForExercise(name);
    case "plane": {
      const explicit = userVals(user, name, "plane");
      if (explicit) return explicit;
      // Inherit from the exercise's (user-or-seeded) movements.
      const moves = (userVals(user, name, "movement") ?? movementsForExercise(name)) as Movement[];
      return planesForExercise(name, moves);
    }
    case "equipment":
      return equipmentForExercise(name);
    case "loadType":
      return loadTypesForExercise(name);
    case "laterality":
      return lateralityForExercise(name);
    case "difficulty":
      return difficultyForExercise(name);
    default:
      return [];
  }
}
