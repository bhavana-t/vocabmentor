-- ─────────────────────────────────────────────────────────────────────────────
-- VocabMentor — Supabase SQL Setup
-- Run this entire script in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Users table
create table if not exists users (
  id uuid references auth.users primary key,
  username text unique not null,
  email text,
  profile jsonb,
  current_lesson int default 1,
  current_day int default 1,
  streak int default 0,
  last_active text,
  badges text[] default '{}',
  created_at timestamp default now()
);

-- Lessons table
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  lesson_num int,
  day int,
  answers jsonb,
  feedback jsonb,
  created_at timestamp default now()
);

-- Tests table
create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  lesson_num int,
  skill text,
  attempt_num int default 1,
  scores jsonb,
  passed boolean default false,
  answers jsonb,
  feedback jsonb,
  created_at timestamp default now()
);

-- Essays table
create table if not exists essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  topic_data jsonb,
  first_essay text,
  first_evaluation jsonb,
  rewrite_essay text,
  rewrite_evaluation jsonb,
  status text default 'pending_rewrite',
  created_at timestamp default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table users enable row level security;
alter table lessons enable row level security;
alter table tests enable row level security;
alter table essays enable row level security;

-- Users policies
create policy "users_select_own" on users for select using (auth.uid() = id);
create policy "users_insert_own" on users for insert with check (auth.uid() = id);
create policy "users_update_own" on users for update using (auth.uid() = id);

-- Lessons policies
create policy "lessons_select_own" on lessons for select using (auth.uid() = user_id);
create policy "lessons_insert_own" on lessons for insert with check (auth.uid() = user_id);

-- Tests policies
create policy "tests_select_own" on tests for select using (auth.uid() = user_id);
create policy "tests_insert_own" on tests for insert with check (auth.uid() = user_id);

-- Essays policies
create policy "essays_select_own" on essays for select using (auth.uid() = user_id);
create policy "essays_insert_own" on essays for insert with check (auth.uid() = user_id);
create policy "essays_update_own" on essays for update using (auth.uid() = user_id);

-- ── Admin: allow reading all data (replace YOUR_ADMIN_UID with your actual UID)
-- Uncomment and update after you register your admin account:
-- create policy "admin_read_users" on users for select using (auth.uid() = 'YOUR_ADMIN_UID');
-- create policy "admin_read_tests" on tests for select using (auth.uid() = 'YOUR_ADMIN_UID');
-- create policy "admin_read_essays" on essays for select using (auth.uid() = 'YOUR_ADMIN_UID');
