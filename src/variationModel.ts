/**
 * Factored variation-difficulty model (LIFT-DM1) — PURE, no DOM / Node APIs, so
 * it runs identically in the browser app and (if ported) Apps Script.
 *
 * A logged note is partial and lossy: "wall" states the support; "yoga block"
 * implies a shortened range AND that it's against the wall, without saying so. So
 * a note resolves into a structured ATTRIBUTE VECTOR (with per-dimension defaults
 * = inheritance, and tokens that can set several dimensions = implications), not
 * a single atomic per-note scalar. The final scalar is the product of each
 * dimension's level factor.
 *
 * The config (families, dimensions, tokens) lives in variationConfig.ts and is
 * passed in — nothing here is hardcoded.
 */
import {
  DEFAULT_VARIATION_CONFIG,
  type VariationConfig,
  type TokenDef,
} from "./variationConfig";

/** One flag explaining something the owner may want to review. */
export interface ResolveFlag {
  type: "unreviewed" | "conflict" | "unknown_family" | "bad_level";
  detail: string;
}
export interface ResolveResult {
  /** dimension → chosen level (defaults for any dimension no token touched). */
  vec: Record<string, string>;
  /** product of the chosen levels' factors (1 when nothing applies). */
  scalar: number;
  flags: ResolveFlag[];
}

/** Lower-case + collapse internal whitespace. (Squat-rack/cm levels are peeled
 * out of the note upstream, so we only see the variation text here.) */
export function normalizeNote(note: string | null | undefined): string {
  return (note ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

const isAlnum = (ch: string | undefined): boolean => ch !== undefined && /[a-z0-9]/i.test(ch);
const priorityOf = (t: TokenDef): number => (typeof t["priority"] === "number" ? (t["priority"] as number) : 0);

export interface MatchedToken {
  /** the configured phrase (original key, e.g. "guma heavy"). */
  phrase: string;
  token: TokenDef;
  start: number;
  end: number;
}
export interface MatchResult {
  matched: MatchedToken[];
  /** note words covered by no token — the unknown fragments. */
  fragments: string[];
}

/**
 * Match config tokens inside a note: case-insensitive, whitespace-normalised,
 * LONGEST-MATCH-FIRST with consumed spans (so "guma heavy" beats "guma" and
 * "yoga block" beats "yoga", and a consumed span can't be re-matched). Plain
 * indexOf + ASCII word-boundary checks — no regex lookbehind / Unicode escapes,
 * for maximum portability.
 */
export function matchTokens(note: string, tokenTable: Record<string, TokenDef>): MatchResult {
  const norm = normalizeNote(note);
  const consumed: boolean[] = new Array(norm.length).fill(false);
  const matched: MatchedToken[] = [];
  // Longest phrase first (by character length) so multi-word tokens win; ties
  // broken by higher priority first.
  const phrases = Object.keys(tokenTable)
    .map((raw) => ({ raw, n: normalizeNote(raw) }))
    .filter((p) => p.n.length > 0)
    .sort((a, b) => b.n.length - a.n.length || priorityOf(tokenTable[b.raw]!) - priorityOf(tokenTable[a.raw]!));
  for (const { raw, n } of phrases) {
    let from = 0;
    for (;;) {
      const idx = norm.indexOf(n, from);
      if (idx === -1) break;
      const end = idx + n.length;
      from = idx + 1;
      // Whole-token boundary: the char before/after must not be alphanumeric
      // (so "guma" doesn't match inside "gumastas").
      if (isAlnum(norm[idx - 1]) || isAlnum(norm[end])) continue;
      let free = true;
      for (let i = idx; i < end; i++) if (consumed[i]) { free = false; break; }
      if (!free) continue;
      for (let i = idx; i < end; i++) consumed[i] = true;
      matched.push({ phrase: raw, token: tokenTable[raw]!, start: idx, end });
    }
  }
  const fragments: string[] = [];
  const wordRe = /\S+/g;
  let wm: RegExpExecArray | null;
  while ((wm = wordRe.exec(norm)) !== null) {
    const s = wm.index;
    const e = s + wm[0].length;
    let anyFree = false;
    for (let i = s; i < e; i++) if (!consumed[i]) { anyFree = true; break; }
    if (anyFree) fragments.push(wm[0]);
  }
  return { matched, fragments };
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * Resolve a note for a family into { vec, scalar, flags }:
 *  1. vec starts as the family defaults (inheritance).
 *  2. matched tokens are applied in PRIORITY order (low→high) so the highest
 *     priority wins a dimension; setting a dimension to a DIFFERENT level than an
 *     already-applied token records a `conflict` flag (last value kept).
 *  3. untouched dimensions keep their default.
 *  4. note words matched by no token → an `unreviewed` flag (the fragments).
 *  5. scalar = product over the family's dimensions of dims[dim][vec[dim]].
 */
export function resolveNote(
  family: string,
  note: string | null | undefined,
  cfg: VariationConfig = DEFAULT_VARIATION_CONFIG,
): ResolveResult {
  const fam = cfg.FAMILIES[family];
  if (!fam) return { vec: {}, scalar: 1, flags: [{ type: "unknown_family", detail: family }] };
  const vec: Record<string, string> = { ...fam.defaults };
  const flags: ResolveFlag[] = [];
  const table = cfg.TOKENS[family] ?? {};
  const { matched, fragments } = matchTokens(note ?? "", table);
  // Apply low→high priority so the highest-priority token is applied LAST and
  // therefore wins; stable for equal priority (keeps match order).
  const ordered = matched
    .map((m, i) => ({ m, i }))
    .sort((a, b) => priorityOf(a.m.token) - priorityOf(b.m.token) || a.i - b.i)
    .map((x) => x.m);
  const setBy: Record<string, string> = {};
  for (const m of ordered) {
    for (const dim of Object.keys(m.token)) {
      if (dim === "priority") continue;
      const level = String(m.token[dim]);
      if (setBy[dim] !== undefined && setBy[dim] !== level)
        flags.push({ type: "conflict", detail: `${dim}: ${setBy[dim]} → ${level}` });
      vec[dim] = level;
      setBy[dim] = level;
    }
  }
  if (fragments.length) flags.push({ type: "unreviewed", detail: fragments.join(" ") });
  let scalar = 1;
  for (const dim of Object.keys(fam.dims)) {
    const level = vec[dim];
    const factor = level !== undefined ? fam.dims[dim]![level] : undefined;
    if (typeof factor === "number") scalar *= factor;
    else flags.push({ type: "bad_level", detail: `${dim}=${level}` });
  }
  return { vec, scalar: round6(scalar), flags };
}
