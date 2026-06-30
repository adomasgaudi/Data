/**
 * Exercise pairing model — the PURE, tested core (CEO plan: docs/ceo/exercise-pairing.md).
 *
 * A pairing flag answers "how well does lift A superset with lift B, HERE?". The
 * owner's decisions (2026-06-15):
 *   • DIRECTIONAL — "A → B" is a separate edge from "B → A" (you flag from the
 *     card of the lift you're on; the candidate is the target).
 *   • TWO LAYERS — a SHARED gym truth everyone sees, plus a PERSONAL veto that
 *     shadows it for one user only. Clearing your override falls back to the
 *     shared flag; it NEVER deletes shared knowledge.
 *   • SINGLE shared pool for now (no named gyms yet — the shared layer IS "the gym").
 *   • SYNC to all users — both layers are `colosseum.*` keys, so they ride the
 *     existing kv mirror (cacheSync) automatically; no backend wiring.
 *
 * Grades are the concurrent 5-level vocabulary (super…no-way); "neutral" means
 * unset (no stored value). Resolution for a directional pair, for one user:
 *     personal[user][A→B] ?? personal[user][*→B] ?? shared[A→B] ?? shared[*→B] ?? neutral
 * The `*→B` WILDCARD edge is how the old per-EXERCISE flags (a property of the
 * candidate, context-free) migrate in: they become a gym-wide baseline for B that
 * any specific A→B edge can override.
 */

export type PairGrade = "super" | "good" | "neutral" | "difficult" | "noway";
export type StoredGrade = Exclude<PairGrade, "neutral">;
export type PairLayer = "personal" | "shared" | "auto";

/** Source token for a context-free ("any lift") flag — the migrated per-exercise grade. */
export const PAIR_WILDCARD = "*";
/** Edge-key separator — a control char that can't appear in an exercise name. */
const SEP = "";

export interface PairMap { [edge: string]: StoredGrade }
export interface PersonalPairMap { [user: string]: PairMap }

/** Build the directional edge key for (from → to). */
export function pairEdge(from: string, to: string): string { return from + SEP + to; }
/** Split an edge key back into its endpoints. */
export function pairEdgeParts(edge: string): { from: string; to: string } {
  const i = edge.indexOf(SEP);
  return i < 0 ? { from: PAIR_WILDCARD, to: edge } : { from: edge.slice(0, i), to: edge.slice(i + 1) };
}

/** Rank for sorting: super(0) … no-way(4); neutral sits in the middle. */
export function pairGradeRank(g: PairGrade): number {
  return ["super", "good", "neutral", "difficult", "noway"].indexOf(g);
}

/** Resolve the EFFECTIVE grade + which layer it came from, for a directional pair
 *  (from → to) as seen by `user`. Personal beats shared. Pairings are STRICTLY
 *  per-(from)-exercise — there is NO cross-exercise wildcard, so a flag made on one
 *  lift's card never leaks onto another's (owner: pairings are unique per exercise). */
export function resolvePairGrade(
  from: string, to: string, shared: PairMap, personal: PersonalPairMap, user: string,
): { grade: PairGrade; layer: PairLayer } {
  const mine = personal[user] ?? {};
  const e = pairEdge(from, to);
  if (mine[e]) return { grade: mine[e], layer: "personal" };
  if (shared[e]) return { grade: shared[e], layer: "shared" };
  return { grade: "neutral", layer: "auto" };
}

/** Set (or clear, when grade==="neutral") a directional pair grade on one layer.
 *  Returns NEW map objects (never mutates the inputs) so callers can persist + sync
 *  cleanly. For the personal layer, an empty per-user bucket is pruned. */
export function setPairGrade(
  args: {
    from: string; to: string; grade: PairGrade; layer: "personal" | "shared";
    user: string; shared: PairMap; personal: PersonalPairMap;
  },
): { shared: PairMap; personal: PersonalPairMap } {
  const { from, to, grade, layer, user } = args;
  const edge = pairEdge(from, to);
  if (layer === "shared") {
    const shared = { ...args.shared };
    if (grade === "neutral") delete shared[edge]; else shared[edge] = grade;
    return { shared, personal: args.personal };
  }
  const personal: PersonalPairMap = { ...args.personal };
  const bucket = { ...(personal[user] ?? {}) };
  if (grade === "neutral") delete bucket[edge]; else bucket[edge] = grade;
  if (Object.keys(bucket).length) personal[user] = bucket; else delete personal[user];
  return { shared: args.shared, personal };
}

/** Drop any cross-exercise WILDCARD edge (`*→to`) from a shared map. Earlier builds
 *  migrated the old context-free per-exercise flags into wildcards, which then leaked
 *  onto every lift's card — this purges that contamination. Returns the cleaned map +
 *  whether anything was removed (so the caller only re-persists when needed). */
export function stripWildcards(shared: PairMap): { map: PairMap; changed: boolean } {
  const out: PairMap = {}; let changed = false;
  for (const [edge, g] of Object.entries(shared)) {
    if (pairEdgeParts(edge).from === PAIR_WILDCARD) { changed = true; continue; }
    out[edge] = g;
  }
  return { map: out, changed };
}

/** Same wildcard purge across every user's personal bucket. */
export function stripWildcardsPersonal(personal: PersonalPairMap): { map: PersonalPairMap; changed: boolean } {
  const out: PersonalPairMap = {}; let changed = false;
  for (const [user, bucket] of Object.entries(personal)) {
    const r = stripWildcards(bucket);
    if (r.changed) changed = true;
    if (Object.keys(r.map).length) out[user] = r.map;
    else if (Object.keys(bucket).length) changed = true; // emptied bucket dropped
  }
  return { map: out, changed };
}

/** All edges that resolve to a non-neutral grade FOR a user, flattened for a manager
 *  view: the union of shared + this user's personal, with the EFFECTIVE grade/layer
 *  per edge (personal shadowing shared). Sorted super→no-way, then by from, then to. */
export function flaggedPairsFor(
  shared: PairMap, personal: PersonalPairMap, user: string,
): { from: string; to: string; grade: PairGrade; layer: PairLayer }[] {
  const mine = personal[user] ?? {};
  const edges = new Set<string>([...Object.keys(shared), ...Object.keys(mine)]);
  const rows = [...edges].map((edge) => {
    const { from, to } = pairEdgeParts(edge);
    const r = resolvePairGrade(from, to, shared, personal, user);
    return { from, to, grade: r.grade, layer: r.layer };
  }).filter((r) => r.grade !== "neutral");
  rows.sort((a, b) =>
    pairGradeRank(a.grade) - pairGradeRank(b.grade) ||
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return rows;
}
