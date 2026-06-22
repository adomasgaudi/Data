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
  "colosseum.bcMassUnit", "colosseum.asExcOpen", "colosseum.simplifiedView", "colosseum.viewTier.v1",
  "colosseum.idxEditAttr.v1", "colosseum.timeCompact.v1", "colosseum.bwReviewOpen",
  "colosseum.xrmReps",
  "colosseum.faintLines", "colosseum.hardSetsOnly", "colosseum.hideUgly",
  "colosseum.allGraphsAllowed",
  "colosseum.activeSet.include.v1", "colosseum.activeSet.exclude.v1",
  "colosseum.activeSet.solo.v1", "colosseum.activeSet.freq.v1",
  "colosseum.activeSet.cutoff.v1", "colosseum.activeSet.meta.v1",
  // Internal sync bookkeeping (device-local): which manual sets we've already uploaded,
  // so we push only NEW/CHANGED ones instead of re-uploading all every refresh.
  "colosseum._manualSynced.v1",
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

// ---- CACHE CATEGORY MODEL (owner: "categorize the cache / Supabase info") ------------------
// Every persisted value falls in exactly ONE of three tiers. The DEFAULT is to sync (owner:
// "all cache is synced with Supabase unless I specifically say it only stays in the browser"):
//
//   • "device"  — browser/session-only, NEVER synced. Strictly per-device: who is logged in,
//                 the view mode/tier, theme, language, transient UI toggles / open-closed states.
//                 Syncing these would leak one device's session to everyone. == LOCAL_ONLY_KEYS.
//   • "user"    — per-ATHLETE data that should FOLLOW the person across devices/logins (synced):
//                 sets, per-set overrides, priorities, history tabs, graph tabs + bubbles,
//                 exercise lens, setup notes, stats. The DEFAULT for anything syncable not global.
//   • "global"  — app-WIDE data identical for everyone (synced): exercise codes/short-names,
//                 classification/metadata, the strength-model config, world records, the athlete
//                 roster, coaching. Admin-authored; everyone reads the same copy.
//
// device → not synced; user + global → synced (today both ride the same kv mirror — the split is
// documentation + a seam for future per-user namespacing). isSyncable stays the single source of
// truth for the sync DECISION; cacheCategory just NAMES the tier.
export type CacheCategory = "device" | "user" | "global";

/** App-wide data identical for every user (synced). Extend as global stores are added; anything
 * syncable NOT listed here is treated as per-user ("user"). */
export const GLOBAL_KEYS: ReadonlySet<string> = new Set([
  "colosseum.exerciseCodes.v1", "colosseum.exerciseShortNames.v1", "colosseum.exerciseRomDefaults.v1",
  "colosseum.metaOverrides.v1", "colosseum.groupMembers.v1", "colosseum.groupDisplay.v1",
  "colosseum.bwCoeffs.v1", "colosseum.bwCoeffRange.v1", "colosseum.benchmarks.v1",
  "colosseum.decayParams.v1", "colosseum.officialDecay.v1", "colosseum.famFactors.v1",
  "colosseum.levelScales.v1", "colosseum.inclineScales.v1", "colosseum.machineMode.v1",
  "colosseum.machineWeights.v1", "colosseum.assistedHalve.v1", "colosseum.noteRenames.v1",
  "colosseum.notComparableNotes.v1", "colosseum.manualAthletes.v1", "colosseum.coaching.v1",
  "colosseum.designTokens.v1", "colosseum.handLength.v1",
]);

/** The tier a localStorage key belongs to. "device" = the browser-only set (never synced) plus
 * the internal base/non-namespaced keys; everything else is synced (user by default, or global).
 * NOTE: a KV_EXCLUDE key like manualSets is still "user" — it syncs via a DEDICATED path, it's
 * not device-only — so this keys off the true device set, not isSyncable. */
export function cacheCategory(key: string): CacheCategory {
  if (!key.startsWith("colosseum.") || key === SYNC_BASE_KEY || LOCAL_ONLY_KEYS.has(key)) return "device";
  return GLOBAL_KEYS.has(key) ? "global" : "user";
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

/** True if two STORED (string | undefined) values are DEEPLY equal as JSON — so a key
 * isn't treated as "changed" just because JSON.stringify reordered object keys. Compare
 * sync decisions with this, NOT raw `===`: the raw compare made every key with a non-
 * canonical serialization re-write + re-push on EVERY sync forever (the "syncs 284 every
 * refresh" bug). */
export function sameStored(a: string | undefined, b: string | undefined): boolean {
  if (a === b) return true;
  return deepEq(parse(a), parse(b));
}
