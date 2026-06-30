/**
 * Pairing PRACTICALITY model — pure & tested (CEO plan docs/ceo/exercise-pairing.md,
 * Phase 5). The owner wants supersets ranked not just by non-overlapping muscle but
 * by whether you can REALISTICALLY do both in a busy gym.
 *
 * Owner's chosen depth (2026-06-15): FULL SEPARATE TAGS — every exercise carries an
 * independent **Station** (which fixed spot it ties up, or "Free" if portable/floor),
 * **Setup** (teardown cost: none/light/heavy — a deadlift is heavy), and **Occupancy**
 * (how many stations it holds at once; gym etiquette says keep the total ≤ ~2). These
 * are SEEDED from the lift's equipment + name keywords here, and any value can be
 * overridden per-exercise later without touching the score.
 *
 * `pairPracticalityScore(a, b)` is symmetric and LOWER = more practical, so it drops
 * straight into the pair-with "Practical" sort where the old name-regex pairEaseScore
 * used to sit. No DOM, no app state — just the data + the maths, so it's unit-tested.
 */
import { equipmentForExercise, type Equipment } from "./exerciseMeta";

/** The kind of fixed station a lift occupies. "Free" = none (bodyweight on the floor
 *  or a portable dumbbell/KB/band you can carry to another spot). */
export const STATIONS = ["Free", "Bench", "Rack", "Machine", "Cable", "Platform"] as const;
export type Station = (typeof STATIONS)[number];
/** Teardown cost of the lift's setup (plates, rack pins, bar load…). */
export const SETUPS = ["None", "Light", "Heavy"] as const;
export type Setup = (typeof SETUPS)[number];

export interface PracProfile {
  station: Station;
  setup: Setup;
  occ: number; // stations tied up at once (almost always 1)
  portable: boolean; // can the implement travel to another station?
}

/** Default profile each EQUIPMENT type implies — the seed when an exercise carries an
 *  explicit equipment tag. Portable kit (DB/KB/band/bodyweight) needs no fixed spot. */
const EQUIP_PROFILE: Record<Equipment, PracProfile> = {
  "Dumbbell": { station: "Free", setup: "Light", occ: 1, portable: true },
  "Kettlebell": { station: "Free", setup: "Light", occ: 1, portable: true },
  "Bands": { station: "Free", setup: "Light", occ: 1, portable: true },
  "Bodyweight": { station: "Free", setup: "None", occ: 1, portable: true },
  "Barbell": { station: "Rack", setup: "Heavy", occ: 1, portable: false },
  "Smith Machine": { station: "Machine", setup: "Light", occ: 1, portable: false },
  "Machine": { station: "Machine", setup: "None", occ: 1, portable: false },
  "Cable": { station: "Cable", setup: "Light", occ: 1, portable: false },
};

const DEFAULT_PROFILE: PracProfile = { station: "Free", setup: "None", occ: 1, portable: true };

/** Name-keyword inference — the primary signal, since the equipment registry is only
 *  sparsely seeded. SPECIFIC → GENERIC (first match wins): "incline bench" before
 *  "bench", "leg press" before "press". A match gives the lift's full profile. */
const KW_RULES: { kw: string; p: PracProfile }[] = [
  // Portable free weights — carry them to any spot (most practical to superset).
  { kw: "dumbbell", p: { station: "Free", setup: "Light", occ: 1, portable: true } },
  { kw: " db", p: { station: "Free", setup: "Light", occ: 1, portable: true } },
  { kw: "db ", p: { station: "Free", setup: "Light", occ: 1, portable: true } },
  { kw: "kettlebell", p: { station: "Free", setup: "Light", occ: 1, portable: true } },
  { kw: " kb", p: { station: "Free", setup: "Light", occ: 1, portable: true } },
  { kw: "band", p: { station: "Free", setup: "Light", occ: 1, portable: true } },
  // Heavy barbell lifts at a rack / platform — fixed spot, big teardown.
  { kw: "deadlift", p: { station: "Platform", setup: "Heavy", occ: 1, portable: false } },
  { kw: "rdl", p: { station: "Platform", setup: "Heavy", occ: 1, portable: false } },
  { kw: "barbell", p: { station: "Rack", setup: "Heavy", occ: 1, portable: false } },
  { kw: "back squat", p: { station: "Rack", setup: "Heavy", occ: 1, portable: false } },
  { kw: "front squat", p: { station: "Rack", setup: "Heavy", occ: 1, portable: false } },
  { kw: "overhead press", p: { station: "Rack", setup: "Heavy", occ: 1, portable: false } },
  { kw: "incline bench", p: { station: "Bench", setup: "Heavy", occ: 1, portable: false } },
  { kw: "bench press", p: { station: "Bench", setup: "Heavy", occ: 1, portable: false } },
  { kw: "preacher", p: { station: "Bench", setup: "Light", occ: 1, portable: false } },
  // Bar-supported bodyweight — needs a bar/dip station but no loading.
  { kw: "pull up", p: { station: "Rack", setup: "None", occ: 1, portable: false } },
  { kw: "pull-up", p: { station: "Rack", setup: "None", occ: 1, portable: false } },
  { kw: "pullup", p: { station: "Rack", setup: "None", occ: 1, portable: false } },
  { kw: "chin up", p: { station: "Rack", setup: "None", occ: 1, portable: false } },
  { kw: "chin-up", p: { station: "Rack", setup: "None", occ: 1, portable: false } },
  { kw: "muscle up", p: { station: "Rack", setup: "None", occ: 1, portable: false } },
  { kw: "dip", p: { station: "Machine", setup: "None", occ: 1, portable: false } },
  // Fixed machines / cables — immovable, but no setup (walk between them).
  { kw: "leg press", p: { station: "Machine", setup: "None", occ: 1, portable: false } },
  { kw: "pulldown", p: { station: "Cable", setup: "Light", occ: 1, portable: false } },
  { kw: "cable", p: { station: "Cable", setup: "Light", occ: 1, portable: false } },
  { kw: "smith", p: { station: "Machine", setup: "Light", occ: 1, portable: false } },
  { kw: "machine", p: { station: "Machine", setup: "None", occ: 1, portable: false } },
  { kw: "hack squat", p: { station: "Machine", setup: "Light", occ: 1, portable: false } },
  { kw: "leg extension", p: { station: "Machine", setup: "None", occ: 1, portable: false } },
  { kw: "leg curl", p: { station: "Machine", setup: "None", occ: 1, portable: false } },
  { kw: "pec deck", p: { station: "Machine", setup: "None", occ: 1, portable: false } },
];

/** The seeded Station/Setup/Occupancy/portability for one lift: a specific name-keyword
 *  rule wins (it's the richer signal — "deadlift" → Platform), then an explicit equipment
 *  tag, then the easy default (Free/None). */
export function practicalityProfile(name: string): PracProfile {
  const lower = ` ${name.toLowerCase()} `;
  const hit = KW_RULES.find((r) => lower.includes(r.kw));
  if (hit) return { ...hit.p };
  const eq = equipmentForExercise(name)[0];
  return { ...(eq ? EQUIP_PROFILE[eq] : DEFAULT_PROFILE) };
}

const setupCost = (s: Setup): number => (s === "Heavy" ? 2 : s === "Light" ? 1 : 0);

/**
 * How practical it is to SUPERSET lift `a` with lift `b` — symmetric, LOWER = easier.
 *   • STATIONS held at once: if either lift is portable (or they share one station
 *     type), you can co-locate → 1; two different fixed stations → 2.
 *   • SETUP churn: each round you leave & return, so heavy teardown hurts (×3).
 *   • ETIQUETTE: holding more than ~2 stations' worth at once is penalised (×6).
 */
export function pairPracticalityScore(a: string, b: string): number {
  const pa = practicalityProfile(a);
  const pb = practicalityProfile(b);
  const sameStation = pa.station === pb.station && pa.station !== "Free";
  const stations = pa.portable || pb.portable || sameStation ? 1 : 2;
  const setup = setupCost(pa.setup) + setupCost(pb.setup);
  const occExcess = Math.max(0, pa.occ - 1 + (pb.occ - 1) + (stations - 1) - 1);
  return stations * 10 + setup * 3 + occExcess * 6;
}

/** A short human hint for a pair's tooltip, e.g. "1 station · heavy setup". */
export function pairPracticalityHint(a: string, b: string): string {
  const pa = practicalityProfile(a);
  const pb = practicalityProfile(b);
  const sameStation = pa.station === pb.station && pa.station !== "Free";
  const stations = pa.portable || pb.portable || sameStation ? 1 : 2;
  const heavy = pa.setup === "Heavy" || pb.setup === "Heavy";
  return `${stations} station${stations > 1 ? "s" : ""}${heavy ? " · heavy setup" : ""}`;
}
