-- ====================================================================
-- Migration: Add student_profiles and update leaderboard view for anonymous auth
-- Run this script in: Supabase Dashboard > SQL Editor
-- ====================================================================

-- 1. Create the student_profiles table associated with auth.users (supports anonymous auth)
create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 60),
  department text not null check (department in ('CSE', 'ECE', 'EEE', 'ME', 'CE', 'Other')),
  year text not null check (year in ('1st Year', '2nd Year', '3rd Year', '4th Year')),
  class_division text not null check (char_length(trim(class_division)) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security on student_profiles
alter table public.student_profiles enable row level security;

-- Authenticated users (including anonymous auth sessions) can view student profiles on leaderboard
drop policy if exists "Authenticated users can view student profiles" on public.student_profiles;
create policy "Authenticated users can view student profiles"
on public.student_profiles for select to authenticated using (true);

-- Each student can only insert their own profile matching auth.uid()
drop policy if exists "Users insert own student profile" on public.student_profiles;
create policy "Users insert own student profile"
on public.student_profiles for insert to authenticated with check (auth.uid() = id);

-- Each student can only update their own profile matching auth.uid()
drop policy if exists "Users update own student profile" on public.student_profiles;
create policy "Users update own student profile"
on public.student_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 3. Ensure predictions table and RLS are configured for anonymous authenticated sessions
alter table public.predictions enable row level security;

drop policy if exists "Authenticated users can view predictions" on public.predictions;
create policy "Authenticated users can view predictions"
on public.predictions for select to authenticated using (true);

drop policy if exists "Users insert own prediction" on public.predictions;
create policy "Users insert own prediction"
on public.predictions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own prediction" on public.predictions;
create policy "Users update own prediction"
on public.predictions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Prediction points calculation function
create or replace function public.prediction_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
) returns integer
language sql immutable as $$
  select case
    when predicted_home = actual_home and predicted_away = actual_away then 5
    when (predicted_home > predicted_away and actual_home > actual_away)
      or (predicted_home < predicted_away and actual_home < actual_away)
      or (predicted_home = predicted_away and actual_home = actual_away) then 2
    else 0
  end;
$$;

-- 5. Updated leaderboard view showing student name, department, year, class, and points
create or replace view public.leaderboard
with (security_invoker = true) as
select
  sp.full_name as display_name,
  sp.full_name,
  sp.department,
  sp.year,
  sp.class_division,
  pr.prediction_home,
  pr.prediction_away,
  case when m.result_confirmed
    then public.prediction_points(pr.prediction_home, pr.prediction_away, m.actual_home, m.actual_away)
    else 0
  end as points
from public.predictions pr
join public.student_profiles sp on sp.id = pr.user_id
join public.matches m on m.id = pr.match_id;
