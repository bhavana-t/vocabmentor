-- CAASPP Essay Skills Module — additive schema changes
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).
-- These changes are purely additive: existing columns/tables/rows are untouched.

-- 1. New nullable columns on the existing essays table for CAASPP rubric scoring
alter table essays add column if not exists outline jsonb;
alter table essays add column if not exists rubric_scores jsonb;
alter table essays add column if not exists organization_feedback jsonb;
alter table essays add column if not exists evidence_comparison jsonb;

-- 2. New table for short CAASPP practice sets: evidence trainer, conventions quizzes,
--    reading/synthesis passage sets, and argument-vocabulary-in-context quizzes.
create table if not exists practice_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'evidence' | 'conventions' | 'passage' | 'vocab'
  content jsonb not null,
  answers jsonb,
  score int,
  created_at timestamptz default now()
);

-- 3. Row Level Security — deliberately left OFF here, matching the current (unenforced)
--    state of `tests`/`essays`: a policy exists on those tables using auth.uid() = user_id,
--    but RLS enforcement itself is not toggled on, which is why Parent View can already
--    read a child's data while authenticated as the parent, not the child. Enabling strict
--    RLS on just this new table would break that same pattern for practice_sets once its
--    data is surfaced in Parent View, without fixing the underlying gap (every table is
--    currently readable/writable by anyone holding the app's public key).
--
--    This is a real security gap worth fixing properly across the whole app (RLS enabled
--    consistently on all tables + Parent/Admin views moved to an authenticated backend
--    function instead of the anon client) — it's out of scope for this feature and deserves
--    its own dedicated pass rather than a partial fix on one table.
--
-- If/when you do that broader fix, apply the same policy shape here:
-- alter table practice_sets enable row level security;
-- create policy "Users can manage their own practice sets"
--   on practice_sets for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
