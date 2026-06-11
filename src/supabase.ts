import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nbjgwqytwkkuarxlkmnj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iamd3cXl0d2trdWFyeGxrbW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjgxMDMsImV4cCI6MjA5Njc0NDEwM30.ipByiSzhYQWd12LjwD1twavR1YkoU0vEGaxjpJMH5ko";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Types matching the `sets` table ──────────────────────────────────────────

export interface DbSet {
  id: string;
  user_id: string;
  username: string;
  date: string;          // "yyyy-MM-dd"
  bodyweight: number | null;
  exercise_name: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  notes: string;
  dropset: boolean;
  percentile: number | null;
  imported_at: string;
}

export interface DbProfile {
  user_id: string;
  username: string;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat: number | null;
  age: number | null;
  sex: "m" | "f" | null;
  updated_at: string;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export const ADMIN_EMAIL = "admin@col.app";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function isAdmin(email: string | undefined) {
  return email === ADMIN_EMAIL;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

/** Fetch all sets visible to the current user (own sets, or all if admin). */
export async function fetchSets(): Promise<DbSet[]> {
  const { data, error } = await supabase
    .from("sets")
    .select("*")
    .order("date", { ascending: false })
    .order("exercise_name")
    .order("set_number");
  if (error) throw error;
  return (data ?? []) as DbSet[];
}

/** Upsert a batch of sets (insert or update on conflict). */
export async function upsertSets(rows: Omit<DbSet, "id" | "imported_at">[]) {
  const { error } = await supabase
    .from("sets")
    .upsert(rows, { onConflict: "user_id,date,exercise_name,set_number" });
  if (error) throw error;
}
