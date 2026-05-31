/**
 * StrengthLevel fetcher — a faithful TypeScript port of the Apps Script
 * (importDATA). Same approach: load each athlete's profile page, parse
 * `window.prefill` for their user_id, then paginate /api/workouts and flatten
 * every set into a row matching SOURCE_COLUMNS.
 *
 * This MUST run server-side (a serverless function / Node), never in the
 * browser: StrengthLevel does not send CORS headers, so a browser fetch is
 * blocked — exactly why the original logic lived in Apps Script (server-side).
 *
 * `fetch` is taken from the global (Node 18+, Cloudflare Workers, Netlify
 * Functions all provide it). The row shape it emits is the same object the
 * dashboard's boundary schema (RawSetRowSchema) expects.
 */

const BASE_URL = "https://my.strengthlevel.com";
const FETCH_LIMIT = 200;
const FETCH_DELAY_MS = 100;

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json, text/plain, */*",
  Referer: BASE_URL,
};

/** Display name -> StrengthLevel username (from the Apps Script USERS map). */
export const USERS: Record<string, string> = {
  Adomas: "adomasgaudi",
  Kristina: "andromeda94",
  Johan: "johannesschut",
  Andrius: "andriusp",
  Mantas: "mantasp",
  Marija: "marijasenkus",
  Sandra: "sandrakri",
  Dzul: "dzuljeta",
  Agne: "agne_ram",
  Laurynas: "bebras",
  Simona: "simona",
  Henrikas: "henrikas",
  Tomas: "t.urba",
  Brigita: "brigita_r",
  Karolis: "karolisb",
  Simonas: "simonasputrius",
  Indre: "indre_ju",
  Natalija: "natali",
  Monika: "monika",
  Ruta: "rutagaudi",
};

/** Raw row object — same keys as the Apps Script OUTPUT_COLUMNS. */
export interface RawRow {
  user: string;
  username: string;
  date: string;
  bodyweight: number | string;
  exercise_name: string;
  set_number: number;
  weight: number | string;
  reps: number | string;
  notes: string;
  dropset: boolean | string;
  percentile: number | string;
}

interface SlSet {
  weight?: number | string;
  reps?: number | string;
  notes?: string;
  dropset?: boolean | string;
  percentile?: number | string;
}
interface SlExercise {
  exercise_name?: string;
  sets?: SlSet[];
}
interface SlWorkout {
  date?: string;
  bodyweight?: number | string;
  exercises?: SlExercise[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Fetch a profile page and extract the StrengthLevel user_id. */
async function resolveUserId(username: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(username)}/workouts`, { headers: HEADERS });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/window\.prefill\s*=\s*(\[[\s\S]*?\]);/);
  if (!match || !match[1]) return null;
  try {
    const prefill = JSON.parse(match[1]) as Array<{ request?: { params?: { user_id?: unknown } } }>;
    const id = prefill[0]?.request?.params?.user_id;
    return id == null ? null : String(id);
  } catch {
    return null;
  }
}

function buildWorkoutsUrl(userId: string, offset: number): string {
  const params = new URLSearchParams({
    user_id: userId,
    limit: String(FETCH_LIMIT),
    offset: String(offset),
    "workout.fields": "date,bodyweight,exercises",
    "workoutexercise.fields": "exercise_name,sets",
    "set.fields": "weight,reps,notes,dropset,percentile",
  });
  return `${BASE_URL}/api/workouts?${params.toString()}`;
}

/** Flatten one workout into per-set rows. Exported for testing the port logic. */
export function rowsFromWorkout(workout: SlWorkout, userLabel: string, username: string): RawRow[] {
  const out: RawRow[] = [];
  const date = workout.date ?? "";
  const bodyweight = workout.bodyweight ?? "";
  for (const exercise of workout.exercises ?? []) {
    const exerciseName = exercise.exercise_name ?? "";
    const sets = exercise.sets ?? [];
    sets.forEach((s, i) => {
      out.push({
        user: userLabel,
        username,
        date,
        bodyweight,
        exercise_name: exerciseName,
        set_number: i + 1,
        weight: s.weight ?? "",
        reps: s.reps ?? "",
        notes: s.notes ?? "",
        dropset: s.dropset ?? "",
        percentile: s.percentile ?? "",
      });
    });
  }
  return out;
}

/** Paginate all workouts for one resolved user. */
async function fetchUserRows(userId: string, userLabel: string, username: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(buildWorkoutsUrl(userId, offset), { headers: HEADERS });
    if (!res.ok) break;
    const payload = (await res.json()) as { data?: SlWorkout[] };
    const workouts = payload.data ?? [];
    if (workouts.length === 0) break;
    for (const w of workouts) rows.push(...rowsFromWorkout(w, userLabel, username));
    offset += FETCH_LIMIT;
    await sleep(FETCH_DELAY_MS);
  }
  return rows;
}

/** Run an async mapper over items with bounded concurrency (keeps us within
 * serverless wall-clock limits without hammering StrengthLevel all at once). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface FetchAllResult {
  updatedAt: string;
  rows: RawRow[];
  /** Users that could not be resolved/fetched (surfaced as data-health info). */
  skipped: string[];
}

/**
 * Fetch every configured athlete's full set log. This is the website-side
 * equivalent of the Apps Script's updatePAST (full rebuild), but runs users
 * concurrently so it completes inside a serverless function's time budget.
 */
export async function fetchAllRows(
  users: Record<string, string> = USERS,
  concurrency = 5,
): Promise<FetchAllResult> {
  const entries = Object.entries(users);
  const skipped: string[] = [];

  const perUser = await mapPool(entries, concurrency, async ([userLabel, username]) => {
    const userId = await resolveUserId(username);
    if (userId === null) {
      skipped.push(userLabel);
      return [] as RawRow[];
    }
    return fetchUserRows(userId, userLabel, username);
  });

  return { updatedAt: new Date().toISOString(), rows: perUser.flat(), skipped };
}
