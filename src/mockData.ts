/**
 * Mock training data for the admin-only "test" sandbox athlete (ATH-50).
 *
 * The test user carries no scraped data, so its graph / stats / history are empty
 * and there are no sessions to log into. This generates a deterministic, realistic
 * spread of sets — a handful of barbell lifts plus weighted pull-ups, ~3 sessions a
 * week over ~5 months, with slow progressive overload — so every view populates and
 * the owner has real rows to poke at. Deterministic given `todayIso` (no flicker
 * across re-renders within a day). Pure: returns plain SetRecords, no DOM.
 *
 * Only injected when the admin view is active (see mergeManualSets), so the sandbox
 * never leaks into a user/spectator view or the shared leaderboards.
 */
import type { SetRecord } from "./domain";

interface MockLift { name: string; start: number; incPerWeek: number; reps: number; bodyweight?: boolean }

// Canonical StrengthLevel lift names so they map to real registry categories/scaling.
const MOCK_LIFTS: MockLift[] = [
  { name: "Squat", start: 60, incPerWeek: 1.5, reps: 5 },
  { name: "Bench Press", start: 45, incPerWeek: 1.0, reps: 5 },
  { name: "Deadlift", start: 80, incPerWeek: 2.0, reps: 5 },
  { name: "Overhead Press", start: 30, incPerWeek: 0.6, reps: 6 },
  { name: "Barbell Row", start: 45, incPerWeek: 0.9, reps: 8 },
  { name: "Pull Ups", start: 0, incPerWeek: 0.5, reps: 8, bodyweight: true },
];

const BODYWEIGHT = 80;
const WEEKS = 20;            // ~5 months of history
const SESSIONS_PER_WEEK = 3; // ~Mon/Wed/Fri
const SETS_PER_LIFT = 3;
const MOCK_SET_BASE = 900_000; // high, unique setNumbers (manual sets use 100000+, CSV is low)

const round2_5 = (n: number) => Math.round(n / 2.5) * 2.5;

function isoDaysBefore(todayIso: string, daysBack: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** Deterministic mock sets for one sandbox athlete, oldest → newest. */
export function testMockRecords(username: string, user: string, todayIso: string): SetRecord[] {
  const out: SetRecord[] = [];
  let setNo = MOCK_SET_BASE;
  for (let w = 0; w < WEEKS; w++) {
    for (let s = 0; s < SESSIONS_PER_WEEK; s++) {
      const daysBack = (WEEKS - 1 - w) * 7 + (SESSIONS_PER_WEEK - 1 - s) * 2;
      const date = isoDaysBefore(todayIso, daysBack);
      // Three lifts per session; the rotation covers all six across the week.
      const dayLifts = [0, 2, 4].map((off) => MOCK_LIFTS[(s + off) % MOCK_LIFTS.length]!);
      for (const lift of dayLifts) {
        const weight = round2_5(lift.start + lift.incPerWeek * w);
        for (let set = 0; set < SETS_PER_LIFT; set++) {
          out.push({
            user, username, date,
            bodyweight: BODYWEIGHT,
            exerciseName: lift.name,
            setNumber: setNo++,
            weight,
            reps: lift.reps,
            notes: "",
            dropset: false,
            percentile: null,
          });
        }
      }
    }
  }
  return out;
}
