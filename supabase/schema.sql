-- crowd-sourced community remarks: ONE wiki-style editable remark per location
-- dashboard > supabase sql editor > new query

-- migration frm the old designs (safe to skip on a fresh proj)
drop table if exists public.remarks;
drop table if exists public.community_remarks;

-- location_name/address/region are stamped server-side by api frm canonical app data, so rows in dashboard are readable & filterable w/o cross-referencing location ids
create table if not exists public.community_remarks (
  location_id text primary key,
  location_name text not null,
  address text,
  region text,
  content text not null check (char_length(content) between 1 and 280),
  updated_at timestamptz not null default now()
);

-- index fr browsing/moderating by region or name in the dashboard
create index if not exists community_remarks_region_idx on public.community_remarks (region);

-- row level security: anyone can read/add/edit/clear the shared remark via anon key
-- content length is capped by the check constraint above regardless of client input
alter table public.community_remarks enable row level security;

create policy "anon can read community remarks"
  on public.community_remarks for select
  to anon
  using (true);

create policy "anon can add community remarks"
  on public.community_remarks for insert
  to anon
  with check (true);

create policy "anon can edit community remarks"
  on public.community_remarks for update
  to anon
  using (true)
  with check (true);

create policy "anon can clear community remarks"
  on public.community_remarks for delete
  to anon
  using (true);
