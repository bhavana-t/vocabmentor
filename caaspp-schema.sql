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

-- 3. Row Level Security — IMPORTANT: check this against your existing tables first.
--    If `tests`/`essays` already have RLS policies scoped to auth.uid() = user_id,
--    apply the same policy here so students can only read/write their own practice sets.
--    (I could not confirm your existing policy since the real schema file was missing
--    from the repo — please verify in Supabase → Authentication → Policies before relying
--    on this table for anything sensitive.)
--
-- Example, if RLS is enabled on your other tables:
-- alter table practice_sets enable row level security;
-- create policy "Users can manage their own practice sets"
--   on practice_sets for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
