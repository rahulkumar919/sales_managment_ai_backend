-- =============================================================================
-- Cold-Call Companion — Supabase PostgreSQL schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ── Outcome enum ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'call_outcome') then
    create type call_outcome as enum (
      'meeting_booked',
      'next_step_agreed',
      'callback_requested',
      'information_requested',
      'not_interested',
      'not_the_right_person',
      'no_answer_or_unreachable',
      'disconnected',
      'other'
    );
  end if;
end $$;

-- ── Follow-up channel enum ───────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'follow_up_channel') then
    create type follow_up_channel as enum ('phone', 'whatsapp', 'email', 'meeting');
  end if;
end $$;

-- ── AI summary status enum ───────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_summary_status') then
    create type ai_summary_status as enum ('pending', 'done', 'failed');
  end if;
end $$;

-- ── calls ────────────────────────────────────────────────────────────────────
create table if not exists calls (
  id                  uuid        primary key default gen_random_uuid(),
  prospect_name       text        not null check (char_length(prospect_name) between 1 and 80),
  company             text        not null check (char_length(company) between 1 and 80),
  role                text        check (char_length(role) <= 80),
  context             text        check (char_length(context) <= 200),
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  last_stage_reached  int         not null default 1 check (last_stage_reached between 1 and 8),
  outcome             call_outcome,
  next_action         text        check (char_length(next_action) <= 200),
  follow_up_at        timestamptz,
  follow_up_channel   follow_up_channel,
  closing_notes       text        check (char_length(closing_notes) <= 500),
  ai_summary          jsonb,
  ai_summary_status   ai_summary_status,
  ai_summary_at       timestamptz,

  -- Closed calls must have an outcome
  constraint closed_call_has_outcome check (ended_at is null or outcome is not null)
);

-- Indexes
create index if not exists calls_started_at_idx on calls (started_at desc);
create index if not exists calls_ended_at_idx   on calls (ended_at);

-- ── stage_results ────────────────────────────────────────────────────────────
create table if not exists stage_results (
  id             uuid        primary key default gen_random_uuid(),
  call_id        uuid        not null references calls(id) on delete cascade,
  stage_number   int         not null check (stage_number between 1 and 8),
  option_key     text        check (char_length(option_key) <= 60),
  prospect_words text        check (char_length(prospect_words) <= 2000),
  saved_at       timestamptz not null default now(),

  -- Only one result per stage per call
  constraint stage_results_unique_stage unique (call_id, stage_number)
);

create index if not exists stage_results_call_id_idx on stage_results (call_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- RLS is enabled but NO policies are created.
-- The backend uses the service-role key which bypasses RLS entirely.
-- The anon key is never used or shipped; the browser never touches the DB directly.
alter table calls        enable row level security;
alter table stage_results enable row level security;

-- ── reach_stage function ─────────────────────────────────────────────────────
-- Atomically sets last_stage_reached to MAX(current, p_stage).
-- Never lowers the value. Never updates a closed call (ended_at IS NOT NULL).
create or replace function reach_stage(p_call_id uuid, p_stage int)
returns void
language plpgsql
security definer  -- runs as the function owner (postgres), not the calling role
as $$
begin
  if p_stage < 1 or p_stage > 8 then
    raise exception 'Invalid stage number: %', p_stage;
  end if;

  update calls
  set    last_stage_reached = greatest(last_stage_reached, p_stage)
  where  id = p_call_id
    and  ended_at is null;   -- never touch a closed call

  -- If no row was updated (closed or non-existent), silently succeed.
  -- The route layer has already validated that the call exists and is open.
end;
$$;

-- Restrict execution to the service role only (anon / authenticated cannot call it)
-- Revoke from PUBLIC first, then grant back to the service_role.
revoke execute on function reach_stage(uuid, int) from public;
revoke execute on function reach_stage(uuid, int) from anon;
revoke execute on function reach_stage(uuid, int) from authenticated;
grant  execute on function reach_stage(uuid, int) to service_role;
