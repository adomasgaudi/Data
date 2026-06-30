-- Colosseum: shared key→value store — "the browser cache, for MULTIPLE users"
-- (CLAUDE.md rule 41). Each row mirrors ONE localStorage `colosseum.*` key as a
-- JSON blob, shared by every device/user. `manualSets` is NOT here — logged sets
-- keep using the `sets` table; this holds all the OTHER shared config/overrides.
--
-- Matches the WORKING anon pattern of `sets` (rule 30): NO auth, RLS OFF, explicit
-- anon grants. Idempotent — safe to re-run.
--
-- ⚠ RUN THIS ONCE IN THE SUPABASE SQL EDITOR. Do NOT run it via the db-migrate
--   workflow — that also runs 0001_initial_schema.sql, which would re-enable RLS
--   on `sets` and break the live anon access.

create table if not exists kv (
  key         text        primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now()
);

alter table kv disable row level security;

grant select, insert, update, delete on kv to anon, authenticated;
