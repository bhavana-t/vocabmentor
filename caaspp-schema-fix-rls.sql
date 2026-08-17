-- Fix: practice_sets ended up with Row Level Security enabled but no policy, which
-- silently blocks every insert/select with "new row violates row-level security policy"
-- (Postgres error 42501). Our original caaspp-schema.sql never enabled RLS on this table —
-- it appears Supabase enabled it automatically when the table was created via the SQL
-- editor. This brings practice_sets back in line with how `tests`/`essays` currently
-- behave (RLS off, unenforced) so Evidence Practice / Conventions Quiz / Reading Set /
-- Word of the Day saves actually work again.
--
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).

alter table practice_sets disable row level security;
