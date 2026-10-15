-- EP rework, badge families and paid rerolls.
--
-- * badges.family: only the best badge per family counts towards a roll's EP.
--   number_stats.badge_ids holds only the counted badges.
-- * Rerolls: after the daily roll, a player can spend EP to roll again, up to
--   private.max_rerolls() times per UTC day, at private.reroll_price() EP each.
--   Every roll is kept (attempt 0 = daily roll, 1.. = rerolls). A day's score
--   is its best roll.
-- * EP wallet (ep_wallets): earned_ep = EP of every roll, spent_ep = EP spent
--   on rerolls, balance = earned - spent. Players can read only their own.
-- * leaderboard_totals: total_ep is now the sum of each day's best roll,
--   roll_count is days played, best_ep is the best single roll.
--
-- After loading the new badges and number_stats, run
--   select private.rescore_all();
-- to recompute every stored roll, the totals and the wallets
-- (docs/SETUP.md has the exact commands).

-- ---------------------------------------------------------------------------
-- Badge families
-- ---------------------------------------------------------------------------

alter table public.badges
  add column family text not null default ''
  check (family ~ '^[a-z0-9-]{0,40}$');

-- ---------------------------------------------------------------------------
-- Rerolls: several rolls per user per day
-- ---------------------------------------------------------------------------

create or replace function private.reroll_price() returns integer
language sql immutable set search_path = '' as $$ select 100 $$;

create or replace function private.max_rerolls() returns integer
language sql immutable set search_path = '' as $$ select 3 $$;

revoke all on function private.reroll_price() from public, anon, authenticated;
revoke all on function private.max_rerolls() from public, anon, authenticated;

alter table public.rolls
  add column attempt smallint not null default 0 check (attempt between 0 and 3);
alter table public.rolls drop constraint rolls_user_id_roll_date_key;
alter table public.rolls add constraint rolls_user_day_attempt_key unique (user_id, roll_date, attempt);

-- ---------------------------------------------------------------------------
-- EP wallets
-- ---------------------------------------------------------------------------

create table public.ep_wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  earned_ep  bigint not null default 0 check (earned_ep >= 0),
  spent_ep   bigint not null default 0 check (spent_ep >= 0),
  balance    bigint generated always as (earned_ep - spent_ep) stored,
  updated_at timestamptz not null default now(),
  check (spent_ep <= earned_ep)
);

alter table public.ep_wallets enable row level security;
alter table public.ep_wallets force row level security;
revoke all on public.ep_wallets from anon, authenticated, public;
grant select on public.ep_wallets to authenticated;
create policy ep_wallets_read_own on public.ep_wallets for select to authenticated
  using (user_id = (select auth.uid()));

-- Existing players start with what they earned so far (rescore_all fixes it
-- up to the new EP scale).
insert into public.ep_wallets (user_id, earned_ep)
select user_id, coalesce(sum(ep), 0) from public.rolls group by user_id
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Rolling
-- ---------------------------------------------------------------------------

-- Records one roll for uid on today's date with the given attempt number, and
-- updates totals and wallet. Raises unique_violation if that attempt exists.
create or replace function private.record_roll(uid uuid, today date, attempt_no smallint)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  n        integer := private.random_roll();
  stats    public.number_stats;
  new_id   bigint;
  prev_best integer;
  w        public.ep_wallets;
begin
  select * into stats from public.number_stats where number = n;
  if not found then
    raise exception 'number_stats is not loaded' using errcode = 'P0001';
  end if;

  select max(ep) into prev_best from public.rolls where user_id = uid and roll_date = today;

  insert into public.rolls (user_id, roll_date, number, ep, tier, attempt)
  values (uid, today, n, stats.ep, stats.tier, attempt_no)
  returning id into new_id;

  insert into public.roll_badges (roll_id, badge_id)
  select new_id, unnest(stats.badge_ids);

  -- Day score = best roll of the day.
  insert into public.leaderboard_totals (user_id, total_ep, best_ep, roll_count)
  values (uid, stats.ep, stats.ep, 1)
  on conflict (user_id) do update
    set total_ep   = public.leaderboard_totals.total_ep
                     + greatest(0, stats.ep - coalesce(prev_best, 0)),
        best_ep    = greatest(public.leaderboard_totals.best_ep, stats.ep),
        roll_count = public.leaderboard_totals.roll_count + (case when prev_best is null then 1 else 0 end),
        updated_at = now();

  insert into public.ep_wallets (user_id, earned_ep) values (uid, stats.ep)
  on conflict (user_id) do update
    set earned_ep = public.ep_wallets.earned_ep + excluded.earned_ep, updated_at = now()
  returning * into w;

  return jsonb_build_object(
    'roll_date',    today,
    'attempt',      attempt_no,
    'number',       n,
    'ep',           stats.ep,
    'tier',         stats.tier,
    'day_best_ep',  greatest(stats.ep, coalesce(prev_best, 0)),
    'balance',      w.balance,
    'rerolls_left', private.max_rerolls() - attempt_no,
    'reroll_price', private.reroll_price(),
    'badges',       coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', b.slug, 'name', b.name, 'emoji', b.emoji,
               'description', b.description, 'rarity', b.rarity, 'ep', b.ep)
             order by b.ep desc)
      from public.badges b where b.id = any (stats.badge_ids)), '[]'::jsonb)
  );
end;
$$;
revoke all on function private.record_roll(uuid, date, smallint) from public, anon, authenticated;

create or replace function public.roll_today()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'choose a display name first' using errcode = 'P0001';
  end if;
  begin
    return private.record_roll(uid, today, 0::smallint);
  exception when unique_violation then
    raise exception 'already rolled today' using errcode = 'P0001';
  end;
end;
$$;
revoke all on function public.roll_today() from public, anon;
grant execute on function public.roll_today() to authenticated;

-- Spend reroll_price() EP for another roll today. Takes no arguments.
create or replace function public.reroll_today()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  today    date := (now() at time zone 'utc')::date;
  price    integer := private.reroll_price();
  w        public.ep_wallets;
  last_try smallint;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Lock the wallet: concurrent rerolls by one player run one at a time.
  select * into w from public.ep_wallets where user_id = uid for update;

  select max(attempt) into last_try from public.rolls where user_id = uid and roll_date = today;
  if last_try is null then
    raise exception 'roll today first' using errcode = 'P0001';
  end if;
  if last_try >= private.max_rerolls() then
    raise exception 'no rerolls left today' using errcode = 'P0001';
  end if;
  if w.user_id is null or w.balance < price then
    raise exception 'not enough EP' using errcode = 'P0001';
  end if;

  update public.ep_wallets
     set spent_ep = spent_ep + price, updated_at = now()
   where user_id = uid;

  return private.record_roll(uid, today, (last_try + 1)::smallint);
end;
$$;
revoke all on function public.reroll_today() from public, anon;
grant execute on function public.reroll_today() to authenticated;

-- Public game constants for the UI.
create or replace function public.reroll_terms()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('price', private.reroll_price(), 'max_per_day', private.max_rerolls())
$$;
revoke all on function public.reroll_terms() from public;
grant execute on function public.reroll_terms() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard: today's view shows each player's best roll
-- ---------------------------------------------------------------------------

create or replace view public.leaderboard_today
with (security_invoker = true) as
select
  rank() over (order by b.ep desc, b.created_at) as rank,
  b.display_name,
  b.number,
  b.ep,
  b.tier
from (
  select distinct on (r.user_id) r.user_id, r.number, r.ep, r.tier, r.created_at, p.display_name
  from public.rolls r
  join public.profiles p on p.id = r.user_id
  where r.roll_date = ((now() at time zone 'utc')::date)
  order by r.user_id, r.ep desc, r.created_at
) b;

revoke all on public.leaderboard_today from anon, authenticated, public;
grant select on public.leaderboard_today to authenticated;

-- ---------------------------------------------------------------------------
-- Rescoring after a badge / number_stats change
-- ---------------------------------------------------------------------------

create or replace function private.rescore_all()
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if (select count(*) from public.number_stats) <> 1000001 then
    raise exception 'number_stats must hold all 1,000,001 numbers before rescoring';
  end if;

  update public.rolls r
     set ep = ns.ep, tier = ns.tier
    from public.number_stats ns
   where ns.number = r.number;

  delete from public.roll_badges;
  insert into public.roll_badges (roll_id, badge_id)
  select r.id, unnest(ns.badge_ids)
    from public.rolls r join public.number_stats ns on ns.number = r.number;

  insert into public.leaderboard_totals as t (user_id, total_ep, best_ep, roll_count)
  select user_id, sum(day_best), max(day_best), count(*)
    from (select user_id, roll_date, max(ep) as day_best
            from public.rolls group by user_id, roll_date) d
   group by user_id
  on conflict (user_id) do update
    set total_ep = excluded.total_ep, best_ep = excluded.best_ep,
        roll_count = excluded.roll_count, updated_at = now();

  insert into public.ep_wallets as w (user_id, earned_ep)
  select user_id, sum(ep) from public.rolls group by user_id
  on conflict (user_id) do update
    set earned_ep = greatest(excluded.earned_ep, w.spent_ep), updated_at = now();
end;
$$;
revoke all on function private.rescore_all() from public, anon, authenticated;
