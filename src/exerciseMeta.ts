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

/**
 * Keyword-inference rules (TASKS 57–60). Each rule maps a name fragment to the
 * joints + movements that fragment implies; the FIRST matching rule wins, so the
 * list runs SPECIFIC → GENERIC ("leg curl" before "curl", "incline bench" before
 * "bench"). A name that matches nothing stays unassigned — we never guess. Planes
 * are NOT listed: an exercise inherits them through its inferred movements via
 * MOVEMENT_PLANES, so they're computed, never stored twice.
 */
export const INFER_RULES: { kw: string; joints: readonly Joint[]; movements: readonly Movement[] }[] = [
  { kw: "romanian deadlift", joints: ["Hip", "Spine"], movements: ["Flexion", "Extension"] },
  { kw: "rdl", joints: ["Hip", "Spine"], movements: ["Flexion", "Extension"] },
  { kw: "stiff leg deadlift", joints: ["Hip", "Spine"], movements: ["Flexion", "Extension"] },
  { kw: "deadlift", joints: ["Hip", "Knee", "Spine", "Talocrural (Ankle)"], movements: ["Extension", "Flexion", "Hyperextension"] },
  { kw: "hip thrust", joints: ["Hip"], movements: ["Extension", "Flexion"] },
  { kw: "glute bridge", joints: ["Hip"], movements: ["Extension", "Flexion"] },
  { kw: "leg press", joints: ["Knee", "Hip"], movements: ["Flexion", "Extension"] },
  { kw: "leg extension", joints: ["Knee"], movements: ["Extension"] },
  { kw: "leg curl", joints: ["Knee"], movements: ["Flexion"] },
  { kw: "calf", joints: ["Talocrural (Ankle)", "Subtalar"], movements: ["Plantar Flexion"] },
  { kw: "split squat", joints: ["Knee", "Hip", "Talocrural (Ankle)"], movements: ["Flexion", "Extension"] },
  { kw: "lunge", joints: ["Knee", "Hip", "Talocrural (Ankle)"], movements: ["Flexion", "Extension"] },
  { kw: "step up", joints: ["Knee", "Hip", "Talocrural (Ankle)"], movements: ["Flexion", "Extension"] },
  { kw: "squat", joints: ["Knee", "Hip", "Talocrural (Ankle)", "Spine"], movements: ["Flexion", "Extension"] },
  { kw: "lateral raise", joints: ["Shoulder (Glenohumeral)", "Scapula"], movements: ["Abduction", "Upward Rotation"] },
  { kw: "front raise", joints: ["Shoulder (Glenohumeral)", "Scapula"], movements: ["Flexion"] },
  { kw: "rear delt", joints: ["Shoulder (Glenohumeral)", "Scapula"], movements: ["Horizontal Abduction", "Retraction"] },
  { kw: "face pull", joints: ["Shoulder (Glenohumeral)", "Scapula"], movements: ["Horizontal Abduction", "External Rotation", "Retraction"] },
  { kw: "pulldown", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Adduction", "Extension", "Downward Rotation"] },
  { kw: "pull up", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Adduction", "Extension", "Flexion", "Downward Rotation"] },
  { kw: "pull-up", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Adduction", "Extension", "Flexion", "Downward Rotation"] },
  { kw: "pullup", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Adduction", "Extension", "Flexion", "Downward Rotation"] },
  { kw: "chin up", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Adduction", "Extension", "Flexion", "Downward Rotation"] },
  { kw: "chin-up", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Adduction", "Extension", "Flexion", "Downward Rotation"] },
  { kw: "muscle up", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Adduction", "Extension", "Flexion", "Downward Rotation"] },
  { kw: "overhead press", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula", "Acromioclavicular"], movements: ["Abduction", "Flexion", "Upward Rotation"] },
  { kw: "shoulder press", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula", "Acromioclavicular"], movements: ["Abduction", "Flexion", "Upward Rotation"] },
  { kw: "military press", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula", "Acromioclavicular"], movements: ["Abduction", "Flexion", "Upward Rotation"] },
  { kw: "ohp", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula", "Acromioclavicular"], movements: ["Abduction", "Flexion", "Upward Rotation"] },
  { kw: "incline bench", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Flexion", "Horizontal Adduction"] },
  { kw: "incline press", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Flexion", "Horizontal Adduction"] },
  { kw: "bench press", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Horizontal Adduction", "Horizontal Abduction", "Flexion", "Extension"] },
  { kw: "bench", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Horizontal Adduction", "Horizontal Abduction", "Flexion", "Extension"] },
  { kw: "chest press", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Horizontal Adduction", "Flexion", "Extension"] },
  { kw: "push up", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Horizontal Adduction", "Flexion", "Extension"] },
  { kw: "push-up", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Horizontal Adduction", "Flexion", "Extension"] },
  { kw: "fly", joints: ["Shoulder (Glenohumeral)", "Scapula"], movements: ["Horizontal Adduction", "Horizontal Abduction"] },
  { kw: "flye", joints: ["Shoulder (Glenohumeral)", "Scapula"], movements: ["Horizontal Adduction", "Horizontal Abduction"] },
  { kw: "row", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Extension", "Flexion", "Retraction"] },
  { kw: "shrug", joints: ["Scapula"], movements: ["Elevation"] },
  { kw: "dip", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Extension", "Flexion", "Horizontal Adduction"] },
  { kw: "pushdown", joints: ["Elbow"], movements: ["Extension"] },
  { kw: "push down", joints: ["Elbow"], movements: ["Extension"] },
  { kw: "kickback", joints: ["Elbow"], movements: ["Extension"] },
  { kw: "skull", joints: ["Elbow"], movements: ["Extension"] },
  { kw: "tricep", joints: ["Elbow"], movements: ["Extension"] },
  { kw: "bicep", joints: ["Elbow", "Radioulnar"], movements: ["Flexion", "Supination"] },
  { kw: "curl", joints: ["Elbow", "Radioulnar"], movements: ["Flexion", "Supination"] },
  { kw: "wrist", joints: ["Wrist"], movements: ["Flexion", "Extension"] },
  { kw: "crunch", joints: ["Spine"], movements: ["Flexion"] },
  { kw: "sit up", joints: ["Spine"], movements: ["Flexion"] },
  { kw: "situp", joints: ["Spine"], movements: ["Flexion"] },
  { kw: "back extension", joints: ["Spine"], movements: ["Extension", "Hyperextension"] },
  { kw: "hyperextension", joints: ["Spine"], movements: ["Extension", "Hyperextension"] },
  { kw: "press", joints: ["Shoulder (Glenohumeral)", "Elbow", "Scapula"], movements: ["Flexion", "Extension"] },
];

/** The first inference rule whose keyword appears in the (lower-cased) name. */
function inferRule(name: string): (typeof INFER_RULES)[number] | undefined {
  const lower = name.toLowerCase();
  return INFER_RULES.find((r) => lower.includes(r.kw));
}
/** Inferred joints for a name (TASK 58), or [] when nothing matches. */
export const inferJoints = (name: string): Joint[] => [...(inferRule(name)?.joints ?? [])];
/** Inferred movements for a name (TASK 59), or [] when nothing matches. */
export const inferMovements = (name: string): Movement[] => [...(inferRule(name)?.movements ?? [])];

/**
 * Bulk-migration helper (TASK 57). For each name, returns the metadata it would
 * receive — explicit registry assignment if one exists, otherwise keyword
 * inference, otherwise nothing. Planes are derived from the resulting movements.
 * This lets the whole library be populated in one pass instead of editing each
 * exercise by hand; `source` records WHERE each value came from for transparency,
 * and a name that matches no rule comes back with empty arrays (never a guess).
 */
export interface InferredMeta {
  name: string;
  joints: Joint[];
  movements: Movement[];
  planes: Plane[];
  source: "registry" | "inferred" | "none";
}
export function bulkInferMetadata(names: readonly string[]): InferredMeta[] {
  return names.map((name) => {
    const regJ = lookup(EXERCISE_JOINTS, name);
    const regM = lookup(EXERCISE_MOVEMENTS, name);
    if (regJ.length || regM.length) {
      const movements = regM.length ? regM : inferMovements(name);
      return { name, joints: regJ.length ? regJ : inferJoints(name), movements, planes: planesForExercise(name, movements), source: "registry" };
    }
    const movements = inferMovements(name);
    const joints = inferJoints(name);
    if (movements.length || joints.length)
      return { name, joints, movements, planes: planesForExercise(name, movements), source: "inferred" };
    return { name, joints: [], movements: [], planes: [], source: "none" };
  });
}
/** As above but shaped as a ready-to-save UserAssignments map, skipping names
 * that inferred nothing (so unknowns stay unassigned rather than guessed). */
export function bulkInferAssignments(names: readonly string[]): UserAssignments {
  const out: UserAssignments = {};
  for (const m of bulkInferMetadata(names)) {
    if (m.source === "none") continue;
    out[m.name] = { joint: m.joints, movement: m.movements, plane: m.planes };
  }
  return out;
}

export const jointsForExercise = (name: string): Joint[] => {
  const explicit = lookup(EXERCISE_JOINTS, name);
  return explicit.length ? explicit : inferJoints(name);
};
export const movementsForExercise = (name: string): Movement[] => {
  const explicit = lookup(EXERCISE_MOVEMENTS, name);
  return explicit.length ? explicit : inferMovements(name);
};
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
