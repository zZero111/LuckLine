-- Luckline initial schema.
--
-- Security model
--   * All writes to game data go through SECURITY DEFINER functions
--     (roll_today, delete_my_account). Clients have no INSERT/UPDATE/DELETE
--     grants on rolls, roll_badges, leaderboard_totals, badges or number_stats.
--   * The rolled number is chosen in the database from pgcrypto random bytes;
--     roll_today() takes no arguments, so a client cannot choose a number.
--   * One roll per user per UTC day is enforced by a UNIQUE constraint, so
--     concurrent calls cannot create a second row.
--   * Signed-out users (anon) get nothing beyond the badge catalogue.
--   * Other players' roll history is private: a player can read their own
--     rolls, plus everyone's roll for *today* (needed for the Today
--     leaderboard). All-time totals come from leaderboard_totals.
--   * Views are security_invoker, so RLS on the base tables still applies.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Reference data (loaded by supabase/seed.sql and supabase/seed/number_stats.csv)
-- ---------------------------------------------------------------------------

create table public.badges (
  id          smallint primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  name        text not null,
  emoji       text not null,
  description text not null,
  rarity      text not null check (rarity in ('common','uncommon','rare','epic','anomaly','mythic')),
  probability double precision not null check (probability > 0 and probability <= 1),
  ep          integer not null check (ep > 0)
);

create table public.number_stats (
  number    integer primary key check (number between 0 and 1000000),
  ep        integer not null check (ep >= 0),
  tier      text not null check (tier in ('trash','common','uncommon','rare','epic','anomaly','mythic')),
  badge_ids smallint[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- Player data
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null unique
               check (display_name ~ '^[A-Za-z0-9_.-]( ?[A-Za-z0-9_.-])*$'
                      and char_length(display_name) between 3 and 24),
  created_at   timestamptz not null default now()
);

create table public.rolls (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  roll_date  date not null default ((now() at time zone 'utc')::date),
  number     integer not null check (number between 0 and 1000000),
  ep         integer not null check (ep >= 0),
  tier       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, roll_date)
);
create index rolls_date_ep_idx on public.rolls (roll_date, ep desc);

create table public.roll_badges (
  roll_id  bigint   not null references public.rolls (id) on delete cascade,
  badge_id smallint not null references public.badges (id),
  primary key (roll_id, badge_id)
);

create table public.leaderboard_totals (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  total_ep   bigint  not null default 0,
  best_ep    integer not null default 0,
  roll_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create index leaderboard_totals_ep_idx on public.leaderboard_totals (total_ep desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.badges             enable row level security;
alter table public.number_stats       enable row level security;
alter table public.profiles           enable row level security;
alter table public.rolls              enable row level security;
alter table public.roll_badges        enable row level security;
alter table public.leaderboard_totals enable row level security;

-- The table owner (postgres) has BYPASSRLS (checked locally: rolbypassrls = t),
-- so forcing RLS does not break the SECURITY DEFINER functions, and it keeps
-- RLS in force for any non-bypass owner context.
alter table public.badges             force row level security;
alter table public.number_stats       force row level security;
alter table public.profiles           force row level security;
alter table public.rolls              force row level security;
alter table public.roll_badges        force row level security;
alter table public.leaderboard_totals force row level security;

-- Start from zero: Supabase's default privileges grant everything to anon
-- and authenticated, so revoke and grant back only what is needed.
revoke all on public.badges, public.number_stats, public.profiles, public.rolls,
              public.roll_badges, public.leaderboard_totals
  from anon, authenticated, public;

-- badges: public catalogue
grant select on public.badges to anon, authenticated;
create policy badges_read on public.badges for select to anon, authenticated using (true);

-- number_stats: no client access at all (read only inside roll_today).

-- profiles: players see display names; each player manages only their own row.
grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- rolls: own history, plus everyone's roll for today (Today leaderboard).
grant select on public.rolls to authenticated;
create policy rolls_read on public.rolls for select to authenticated
  using (user_id = (select auth.uid())
         or roll_date = ((now() at time zone 'utc')::date));

-- roll_badges: own rolls only.
grant select on public.roll_badges to authenticated;
create policy roll_badges_read_own on public.roll_badges for select to authenticated
  using (exists (select 1 from public.rolls r
                 where r.id = roll_id and r.user_id = (select auth.uid())));

-- leaderboard_totals: aggregate scores are public to players.
grant select on public.leaderboard_totals to authenticated;
create policy leaderboard_totals_read on public.leaderboard_totals for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Uniform random integer in [0, 1000000] from pgcrypto bytes (rejection
-- sampling, so no modulo bias). Not callable by clients.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.random_roll()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  range_size constant bigint := 1000001;
  limit_val  constant bigint := 4294967296 - (4294967296 % 1000001);
  v bigint;
begin
  loop
    v := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint;
    exit when v < limit_val;
  end loop;
  return (v % range_size)::integer;
end;
$$;
revoke all on function private.random_roll() from public, anon, authenticated;

create or replace function public.roll_today()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  today   date := (now() at time zone 'utc')::date;
  n       integer;
  stats   public.number_stats;
  new_id  bigint;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'choose a display name first' using errcode = 'P0001';
  end if;

  n := private.random_roll();
  select * into stats from public.number_stats where number = n;
  if not found then
    raise exception 'number_stats is not loaded' using errcode = 'P0001';
  end if;

  insert into public.rolls (user_id, roll_date, number, ep, tier)
  values (uid, today, n, stats.ep, stats.tier)
  on conflict (user_id, roll_date) do nothing
  returning id into new_id;

  if new_id is null then
    raise exception 'already rolled today' using errcode = 'P0001';
  end if;

  insert into public.roll_badges (roll_id, badge_id)
  select new_id, unnest(stats.badge_ids);

  insert into public.leaderboard_totals (user_id, total_ep, best_ep, roll_count)
  values (uid, stats.ep, stats.ep, 1)
  on conflict (user_id) do update
    set total_ep   = public.leaderboard_totals.total_ep + excluded.total_ep,
        best_ep    = greatest(public.leaderboard_totals.best_ep, excluded.best_ep),
        roll_count = public.leaderboard_totals.roll_count + 1,
        updated_at = now();

  return jsonb_build_object(
    'roll_date', today,
    'number',    n,
    'ep',        stats.ep,
    'tier',      stats.tier,
    'badges',    coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', b.slug, 'name', b.name, 'emoji', b.emoji,
               'description', b.description, 'rarity', b.rarity, 'ep', b.ep)
             order by b.ep desc)
      from public.badges b where b.id = any (stats.badge_ids)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.roll_today() from public, anon;
grant execute on function public.roll_today() to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- Cascades to profiles, rolls, roll_badges and leaderboard_totals.
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard views (security_invoker: base-table RLS applies to the caller)
-- ---------------------------------------------------------------------------

create view public.leaderboard_today
with (security_invoker = true) as
select
  rank() over (order by r.ep desc, r.created_at) as rank,
  p.display_name,
  r.number,
  r.ep,
  r.tier
from public.rolls r
join public.profiles p on p.id = r.user_id
where r.roll_date = ((now() at time zone 'utc')::date);

create view public.leaderboard_all_time
with (security_invoker = true) as
select
  rank() over (order by t.total_ep desc, t.updated_at) as rank,
  p.display_name,
  t.total_ep,
  t.best_ep,
  t.roll_count
from public.leaderboard_totals t
join public.profiles p on p.id = t.user_id;

revoke all on public.leaderboard_today, public.leaderboard_all_time from anon, authenticated, public;
grant select on public.leaderboard_today, public.leaderboard_all_time to authenticated;
