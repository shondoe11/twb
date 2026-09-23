--* twb supabase schema: community_remarks + feedback
--& dashboard > supabase sql editor > new query > paste whole file > run
--~ idempotent: every statement is create-if-not-exists / drop-policy-then-recreate, so re-running never touches existing rows

--^ ---------------------------------------------------------------------------
--* crowd-sourced community remarks: ONE wiki-style editable remark per location

--& location_name/address/region are stamped server-side by api frm canonical app data, so rows in dash readable & filterable w/o cross-referencing location ids
create table if not exists public.community_remarks (
  location_id text primary key,
  location_name text not null,
  address text,
  region text,
  content text not null check (char_length(content) between 1 and 280),
  updated_at timestamptz not null default now()
);

--~ index fr browsing/moderating by region/name in dash
create index if not exists community_remarks_region_idx on public.community_remarks (region);

--~ row level security: anyone can read/add/edit/clear shared remark via anon key
--~ content length capped by check constraint above regardless of client input
alter table public.community_remarks enable row level security;

--~ postgres has no 'create policy if not exists', so drop first keeps file re-runnable
drop policy if exists "anon can read community remarks" on public.community_remarks;
create policy "anon can read community remarks"
  on public.community_remarks for select
  to anon
  using (true);

drop policy if exists "anon can add community remarks" on public.community_remarks;
create policy "anon can add community remarks"
  on public.community_remarks for insert
  to anon
  with check (true);

drop policy if exists "anon can edit community remarks" on public.community_remarks;
create policy "anon can edit community remarks"
  on public.community_remarks for update
  to anon
  using (true)
  with check (true);

drop policy if exists "anon can clear community remarks" on public.community_remarks;
create policy "anon can clear community remarks"
  on public.community_remarks for delete
  to anon
  using (true);


--^ ---------------------------------------------------------------------------
--* feedback/suggestions submitted via /feedback
--& append-only inbox: rows written by api, read only frm dashboard

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug', 'suggestion', 'data', 'other')),
  message text not null check (char_length(message) between 1 and 1000),
  contact text check (contact is null or char_length(contact) <= 200),
  --~ path the user came frm (eg / or /about) so context is kept w/o tracking
  page text check (page is null or char_length(page) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

--~ newest first
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

--~ row level security: anon can ONLY insert
alter table public.feedback enable row level security;

drop policy if exists "anon can submit feedback" on public.feedback;
create policy "anon can submit feedback"
  on public.feedback for insert
  to anon
  with check (true);


--^ ---------------------------------------------------------------------------
--* ui interaction events (pin opens, directions, filters...) posted by /api/events
--& self-hosted replacement fr vercel custom events (pro-only). append-only, no user identifiers
--& allowed event names + prop shapes live in src/lib/analytics.ts & are enforced by api

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 64),
  props jsonb not null default '{}'::jsonb,
  --~ path the event fired on (eg / or /about)
  page text check (page is null or char_length(page) <= 100),
  created_at timestamptz not null default now()
);

--~ 2 ways events get queried: per-name over time & everything recent
create index if not exists events_name_created_at_idx on public.events (name, created_at desc);
create index if not exists events_created_at_idx on public.events (created_at desc);

--~ row level security: anon can ONLY insert
alter table public.events enable row level security;

drop policy if exists "anon can record events" on public.events;
create policy "anon can record events"
  on public.events for insert
  to anon
  with check (true);
