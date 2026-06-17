/**
 * Multi-user cache sync — the PURE, tested core (CLAUDE.md rule 41).
 *
 * Supabase is just "the browser cache, for multiple users": each SHARED
 * `colosseum.*` localStorage key is mirrored to the `kv` table so every device/
 * user shares one copy. This module owns the two things that must be provably
 * correct — WHICH keys sync, and HOW two devices' versions of a key combine
 * WITHOUT losing anyone's edit. The impure orchestration (Supabase fetch/upsert,
 * localStorage I/O, boot timing) is thin glue layered on top in main.ts.
 *
 * Merge model: 3-way (git-style). We keep a local-only snapshot of the last value
 * we synced (the "base"). On sync we have base + local + remote; a side that did
 * NOT change a key yields to the side that did, so nothing is clobbered. Only a
 * genuine simultaneous edit of the SAME leaf conflicts, resolved loss-aversely
 * (keep data over deletion; cloud wins a scalar tie).
 */

/** Device/display prefs that must NEVER sync — they'd fight across users/devices. */
export const LOCAL_ONLY_KEYS: ReadonlySet<string> = new Set([
  // SESSION IDENTITY — strictly per-DEVICE: who you logged in as, which athlete you're
  // viewing, and the view mode. These must never sync, or one device's login leaks to
  // everyone (the bug: every visitor inherited the admin's role.v1 → saw the admin pages
  // + the admin's current athlete). The current top-tab/page isn't persisted at all, so
  // it's already device-local. (`colosseum.role.v1` was missing here — that was the leak.)
  "colosseum.role.v1", "colosseum.signedIn", "colosseum.viewUser.v1", "colosseum.viewMode",
  "colosseum.lastAthlete.v1",
  "colosseum.lang", "colosseum.theme", "colosseum.nameMode.v1",
  "colosseum.showAddSets", "colosseum.statsSectionShown", "colosseum.bcShowRange",
  "colosseum.idxSubMode.v1", "colosseum.woShowAll",
  "colosseum.showAloneTags", "colosseum.maintGroupBy",
  "colosseum.bcMassUnit", "colosseum.asExcOpen", "colosseum.simplifiedView",
  "colosseum.idxEditAttr.v1", "colosseum.timeCompact.v1", "colosseum.bwReviewOpen",
  "colosseum.xrmReps",
  "colosseum.faintLines", "colosseum.hardSetsOnly", "colosseum.hideUgly",
  "colosseum.allGraphsAllowed",
  "colosseum.activeSet.include.v1", "colosseum.activeSet.exclude.v1",
  "colosseum.activeSet.solo.v1", "colosseum.activeSet.freq.v1",
  "colosseum.activeSet.cutoff.v1", "colosseum.activeSet.meta.v1",
  "colosseum.ghPat.v1", // GitHub PAT for Action triggers — secret, never sync
]);

/** Keys that already sync via a DEDICATED path, so they skip the kv mirror. */
export const KV_EXCLUDE: ReadonlySet<string> = new Set([
  "colosseum.manualSets.v1", // → the `sets` table, merged by id
]);

/** Local-only snapshot of the last cloud state we merged (the 3-way "base"). */
export const SYNC_BASE_KEY = "colosseum._kvBase.v1";

/** True if a localStorage key is mirrored to the shared kv table. */
export function isSyncable(key: string): boolean {
  return key.startsWith("colosseum.")
    && key !== SYNC_BASE_KEY
    && !LOCAL_ONLY_KEYS.has(key)
    && !KV_EXCLUDE.has(key);
}

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const parse = (s: string | undefined): Json | undefined => {
  if (s === undefined) return undefined;
  try { return JSON.parse(s); } catch { return s; } // a non-JSON scalar stored raw
};

/** Deep structural equality (object key-order-insensitive). */
export function deepEq(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && deepEq(a[k], b[k]));
  }
  return false;
}

/** 3-way merge of parsed JSON. `undefined` = absent on that side (deletion). */
export function merge3Json(base: Json | undefined, local: Json | undefined, remote: Json | undefined): Json | undefined {
  if (deepEq(local, remote)) return local;        // already agree
  if (deepEq(local, base)) return remote;         // only remote changed (incl. delete)
  if (deepEq(remote, base)) return local;         // only local changed
  // both changed:
  if (isObj(local) && isObj(remote)) {            // maps → union keys, merge each
    const b = isObj(base) ? base : {};
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const m = merge3Json(b[k], local[k], remote[k]);
      if (m !== undefined) out[k] = m;            // undefined → resolved as deleted
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) { // lists → union, dedupe, keep order
    const seen = new Set(local.map((x) => JSON.stringify(x)));
    const out = [...local];
    for (const x of remote) { const s = JSON.stringify(x); if (!seen.has(s)) { seen.add(s); out.push(x); } }
    return out;
  }
  // scalar / type conflict, both changed → loss-averse: keep data over a delete,
  // and on a true value tie let the cloud (remote) win deterministically.
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  return remote;
}

/** 3-way merge at the STRING (localStorage) level. Returns the merged string, or
 *  `undefined` if the key resolves to deleted. */
export function merge3(base: string | undefined, local: string | undefined, remote: string | undefined): string | undefined {
  if (local === remote) return local;
  const merged = merge3Json(parse(base), parse(local), parse(remote));
  return merged === undefined ? undefined : JSON.stringify(merged);
}
