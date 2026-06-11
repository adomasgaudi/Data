-- Colosseum: initial schema
-- Idempotent — safe to re-run.

-- ── sets ─────────────────────────────────────────────────────────────────────
-- One row per logged set.  Columns mirror the StrengthLevel CSV columns so the
-- app pipeline (canonicalize → attachNoteLevel → sanityCheck) runs unchanged.

CREATE TABLE IF NOT EXISTS sets (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username       text        NOT NULL,
  date           date        NOT NULL,
  bodyweight     numeric,
  exercise_name  text        NOT NULL,
  set_number     integer     NOT NULL,
  weight         numeric,
  reps           integer,
  notes          text        NOT NULL DEFAULT '',
  dropset        boolean     NOT NULL DEFAULT false,
  percentile     numeric,
  imported_at    timestamptz DEFAULT now(),

  -- Prevent duplicate imports (same user, same day, same exercise, same set position)
  UNIQUE (user_id, date, exercise_name, set_number)
);

CREATE INDEX IF NOT EXISTS sets_user_date ON sets (user_id, date DESC);
CREATE INDEX IF NOT EXISTS sets_username   ON sets (username);

ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

-- Users read/write only their own sets
DROP POLICY IF EXISTS "sets_own" ON sets;
CREATE POLICY "sets_own" ON sets
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin (g@cool.lt) can read ALL sets (for the admin view / coach digest)
DROP POLICY IF EXISTS "sets_admin_read" ON sets;
CREATE POLICY "sets_admin_read" ON sets
  FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'g@cool.lt');

-- Admin can also write any user's sets (for corrections)
DROP POLICY IF EXISTS "sets_admin_write" ON sets;
CREATE POLICY "sets_admin_write" ON sets
  FOR ALL
  USING  ((auth.jwt() ->> 'email') = 'g@cool.lt')
  WITH CHECK ((auth.jwt() ->> 'email') = 'g@cool.lt');


-- ── athlete_profiles ──────────────────────────────────────────────────────────
-- Static profile per user (height, weight, etc.). One row per auth user.

CREATE TABLE IF NOT EXISTS athlete_profiles (
  user_id     uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text    UNIQUE NOT NULL,
  height_cm   numeric,
  weight_kg   numeric,
  body_fat    numeric,
  age         integer,
  sex         text    CHECK (sex IN ('m', 'f')),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own" ON athlete_profiles;
CREATE POLICY "profiles_own" ON athlete_profiles
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_admin" ON athlete_profiles;
CREATE POLICY "profiles_admin" ON athlete_profiles
  FOR ALL
  USING  ((auth.jwt() ->> 'email') = 'g@cool.lt')
  WITH CHECK ((auth.jwt() ->> 'email') = 'g@cool.lt');
