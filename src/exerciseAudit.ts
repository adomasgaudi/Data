/**
 * Exercise data-hygiene audits (TASKS 61–62). Two pure, read-only reporters:
 *
 *   • duplicateAudit      — clusters of names that look like the same lift
 *     (typos / casing / plurals / trailing numbers), produced as a REVIEW list.
 *     It NEVER merges anything; merging stays a deliberate, owner-confirmed act
 *     (see EXERCISE_NAME_ALIASES in aggregate.ts). This is just "here's what to
 *     look at".
 *   • relationshipAudit   — structural problems in the user's exercise
 *     definitions: dissolved lifts pointing at a parent that doesn't exist,
 *     broken parent references, and combined / comparison groups with no (or too
 *     few) members. Produces a validation report, fixes nothing.
 *
 * Both take plain data and return plain data, so they're trivially testable and
 * carry no side effects.
 */
import type { SetRecord } from "./domain";
import { nearDuplicateExercises } from "./aggregate";

// ---- TASK 61: duplicate / near-duplicate REVIEW list ----
export interface DuplicateCluster {
  /** The variant spellings in this cluster, most-logged first. */
  names: string[];
  /** Total sets logged across every spelling. */
  sets: number;
  /** A suggested canonical (the most-logged spelling) — a HINT only, never applied. */
  suggested: string;
}

/**
 * Build the review list of probable duplicates. This is a thin, intention-named
 * wrapper over `nearDuplicateExercises` (the existing clustering) that adds a
 * suggested canonical and makes the "review, don't merge" contract explicit in
 * the type. No record is rewritten and no alias is created.
 */
export function duplicateAudit(records: readonly SetRecord[]): DuplicateCluster[] {
  return nearDuplicateExercises(records).map((c) => ({
    names: c.names,
    sets: c.sets,
    suggested: c.names[0] ?? "",
  }));
}

// ---- TASK 62: exercise-relationship validation ----
/** A user-defined exercise, mirrored from main.ts's UserExerciseDef (kept local
 * so this module has no DOM/storage dependency). */
export interface RelationshipDef {
  name: string;
  identity: "original" | "dissolved" | "combined" | "comparison_group";
  parent?: string;
  members?: string[];
}

export type RelationshipIssueKind =
  | "orphan_dissolved" // dissolved, but no parent set
  | "broken_parent" // dissolved → a parent name that doesn't exist
  | "self_parent" // dissolved → itself
  | "empty_combined" // combined with < 2 members
  | "empty_comparison" // comparison_group with < 2 members
  | "missing_member" // member name doesn't exist
  | "duplicate_def"; // two defs share a name

export interface RelationshipIssue {
  kind: RelationshipIssueKind;
  /** The definition the problem is about. */
  name: string;
  /** Human-readable explanation for the validation report. */
  detail: string;
}

/**
 * Validate exercise relationships against the set of names that actually exist
 * (logged originals + other defs). `existingNames` should be every selectable
 * exercise name; comparisons are case-insensitive. Returns one issue per problem
 * found, or [] for a clean library. Detects every category the spec asks for:
 * orphan dissolved, broken parent refs, empty combined/comparison groups, plus
 * missing members, self-parenting and duplicate definitions.
 */
export function relationshipAudit(
  defs: readonly RelationshipDef[],
  existingNames: readonly string[],
): RelationshipIssue[] {
  const issues: RelationshipIssue[] = [];
  const known = new Set(existingNames.map((n) => n.toLowerCase().trim()));
  const has = (n: string | undefined): boolean => !!n && known.has(n.toLowerCase().trim());

  // Duplicate definitions (same name defined more than once).
  const seen = new Map<string, number>();
  for (const d of defs) {
    const k = d.name.toLowerCase().trim();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const d of defs) {
    const k = d.name.toLowerCase().trim();
    if ((seen.get(k) ?? 0) > 1) {
      issues.push({ kind: "duplicate_def", name: d.name, detail: `"${d.name}" is defined ${seen.get(k)} times.` });
      seen.set(k, 0); // report each duplicated name once
    }
  }

  for (const d of defs) {
    if (d.identity === "dissolved") {
      if (!d.parent || !d.parent.trim()) {
        issues.push({ kind: "orphan_dissolved", name: d.name, detail: `"${d.name}" is dissolved but has no parent exercise.` });
      } else if (d.parent.toLowerCase().trim() === d.name.toLowerCase().trim()) {
        issues.push({ kind: "self_parent", name: d.name, detail: `"${d.name}" is dissolved into itself.` });
      } else if (!has(d.parent)) {
        issues.push({ kind: "broken_parent", name: d.name, detail: `"${d.name}" dissolves into "${d.parent}", which doesn't exist.` });
      }
    }

    if (d.identity === "combined" || d.identity === "comparison_group") {
      const members = d.members ?? [];
      if (members.length < 2) {
        issues.push({
          kind: d.identity === "combined" ? "empty_combined" : "empty_comparison",
          name: d.name,
          detail: `"${d.name}" (${d.identity}) needs at least 2 members but has ${members.length}.`,
        });
      }
      for (const m of members) {
        if (!has(m)) issues.push({ kind: "missing_member", name: d.name, detail: `"${d.name}" includes "${m}", which doesn't exist.` });
      }
    }
  }

  return issues;
}
