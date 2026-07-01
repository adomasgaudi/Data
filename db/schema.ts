import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema mirroring the live Supabase tables (see src/supabase.ts).
 * `sets` uses the composite NATURAL primary key (no uuid id) — the same shape
 * PostgREST upserts against; a surrogate id would break `onConflict` upserts.
 *
 * Note: `db:push`/`db:generate` need DATABASE_URL (the Postgres connection
 * string). No live migration is run here — schema + config only.
 */
export const sets = pgTable(
  "sets",
  {
    userId: text("user_id").notNull(),
    username: text("username").notNull(),
    date: text("date").notNull(),
    bodyweight: real("bodyweight"),
    exerciseName: text("exercise_name").notNull(),
    setNumber: integer("set_number").notNull(),
    weight: real("weight"),
    reps: integer("reps"),
    notes: text("notes").notNull().default(""),
    dropset: boolean("dropset").notNull().default(false),
    percentile: real("percentile"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.exerciseName, t.setNumber] })],
);

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  username: text("username").notNull(),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  bodyFat: real("body_fat"),
  age: integer("age"),
  sex: text("sex"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Shared key→value mirror of the `colosseum.*` localStorage keys. */
export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
