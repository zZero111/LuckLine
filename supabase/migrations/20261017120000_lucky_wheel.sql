-- Lucky Wheel: one spin per player per UTC day, after rolling.
--
-- * The prize is picked in the database (weighted, pgcrypto random bytes) and
--   applied in the same transaction. spin_wheel() takes no arguments.
-- * Multiplier and bonus prizes change the player's latest roll of the day:
--     rolls.ep = floor(base_ep * multiplier) + bonus_ep
--   base_ep is the number's own score, so rescore_all() keeps wheel effects.
-- * "Lose half" can't take the wallet below zero: earned_ep never drops below
--   spent_ep.
-- * A free reroll prize allows one extra reroll today (on top of the normal
--   limit) that costs no EP.
-- * Prizes and odds live in wheel_prizes: change weights with a migration.

-- ---------------------------------------------------------------------------
-- Prize catalogue
-- ---------------------------------------------------------------------------

create table public.wheel_prizes (
  id     smallint primary key,
  slug   text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  label  text not null,
  kind   text not null check (kind in ('nothing', 'multiplier', 'bonus', 'free_reroll')),
  value  numeric(6, 2) not null default 0,
  weight integer not null check (weight > 0),
  color  text not null check (color ~ '^#[0-9a-f]{6}$'),
  sort   smallint not null unique
);

insert into public.wheel_prizes (id, slug, label, kind, value, weight, color, sort) values
  (1, 'nothing',     'Nothing',     'nothing',      0,    250, '#3f3f46', 1),
  (2, 'double',      '2× EP',       'multiplier',   2,    200, '#0ea5e9', 2),
  (3, 'lose-half',   'Lose half',   'multiplier',   0.5,  150, '#e11d48', 3),
  (4, 'bonus-50',    '+50 EP',      'bonus',        50,   150, '#10b981', 4),
  (5, 'free-reroll', 'Free reroll', 'free_reroll',  0,    150, '#f59e0b', 5),
  (6, 'triple',      '3× EP',       'multiplier',   3,     70, '#8b5cf6', 6),
  (7, 'quintuple',   '5× EP',       'multiplier',   5,     25, '#d946ef', 7),
  (8, 'jackpot',     '10× JACKPOT', 'multiplier',   10,     5, '#facc15', 8);

alter table public.wheel_prizes enable row level security;
alter table public.wheel_prizes force row level security;
revoke all on public.wheel_prizes from anon, authenticated, public;
grant select on public.wheel_prizes to anon, authenticated;
create policy wheel_prizes_read on public.wheel_prizes for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Roll modifiers
-- ---------------------------------------------------------------------------

alter table public.rolls
  add column base_ep    integer,
  add column multiplier numeric(6, 2) not null default 1 check (multiplier > 0),
  add column bonus_ep   integer not null default 0 check (bonus_ep >= 0);
update public.rolls set base_ep = ep;
alter table public.rolls alter column base_ep set not null;
alter table public.rolls add constraint rolls_base_ep_check check (base_ep >= 0);

-- One extra (free) reroll is possible on top of the normal three.
alter table public.rolls drop constraint rolls_attempt_check;
alter table public.rolls add constraint rolls_attempt_check check (attempt between 0 and 4);

-- ---------------------------------------------------------------------------
-- Spins
-- ---------------------------------------------------------------------------

create table public.wheel_spins (
  user_id          uuid not null references auth.users (id) on delete cascade,
  spin_date        date not null,
  prize_id         smallint not null references public.wheel_prizes (id),
  roll_id          bigint not null references public.rolls (id) on delete cascade,
  ep_before        integer not null,
  ep_after         integer not null,
  free_reroll_used boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (user_id, spin_date)
);
create index wheel_spins_roll_id_idx on public.wheel_spins (roll_id);
create index wheel_spins_prize_id_idx on public.wheel_spins (prize_id);

alter table public.wheel_spins enable row level security;
alter table public.wheel_spins force row level security;
revoke all on public.wheel_spins from anon, authenticated, public;
grant select on public.wheel_spins to authenticated;
create policy wheel_spins_read_own on public.wheel_spins for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Uniform random integer in [0, n) from pgcrypto bytes (rejection sampling).
create or replace function private.random_below(n integer)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  limit_val bigint := 4294967296 - (4294967296 % n);
  v bigint;
begin
  if n < 1 then
    raise exception 'random_below needs n >= 1';
  end if;
  loop
    v := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint;
    exit when v < limit_val;
  end loop;
  return (v % n)::integer;
end;
$$;
revoke all on function private.random_below(integer) from public, anon, authenticated;

-- Rebuild one player's leaderboard totals from their rolls (day score = best roll).
create or replace function private.refresh_totals(uid uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.leaderboard_totals as t (user_id, total_ep, best_ep, roll_count)
  select uid, coalesce(sum(day_best), 0), coalesce(max(day_best), 0), count(*)
    from (select roll_date, max(ep) as day_best
            from public.rolls where user_id = uid group by roll_date) d
  on conflict (user_id) do update
    set total_ep = excluded.total_ep, best_ep = excluded.best_ep,
        roll_count = excluded.roll_count, updated_at = now();
$$;
revoke all on function private.refresh_totals(uuid) from public, anon, authenticated;

-- record_roll now also stores base_ep (same body otherwise).
create or replace function private.record_roll(uid uuid, today date, attempt_no smallint)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  n         integer := private.random_roll();
  stats     public.number_stats;
  new_id    bigint;
  prev_best integer;
  w         public.ep_wallets;
begin
  select * into stats from public.number_stats where number = n;
  if not found then
    raise exception 'number_stats is not loaded' using errcode = 'P0001';
  end if;

  select max(ep) into prev_best from public.rolls where user_id = uid and roll_date = today;

  insert into public.rolls (user_id, roll_date, number, ep, base_ep, tier, attempt)
  values (uid, today, n, stats.ep, stats.ep, stats.tier, attempt_no)
  returning id into new_id;

  insert into public.roll_badges (roll_id, badge_id)
  select new_id, unnest(stats.badge_ids);

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
    'base_ep',      stats.ep,
    'multiplier',   1,
    'bonus_ep',     0,
    'tier',         stats.tier,
    'day_best_ep',  greatest(stats.ep, coalesce(prev_best, 0)),
    'balance',      w.balance,
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

-- ---------------------------------------------------------------------------
-- Rerolls: a free-reroll prize adds one extra reroll that costs nothing
-- ---------------------------------------------------------------------------

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
  spin     public.wheel_spins;
  free     boolean;
  last_try smallint;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Lock the wallet: rerolls and spins by one player run one at a time.
  select * into w from public.ep_wallets where user_id = uid for update;

  select max(attempt) into last_try from public.rolls where user_id = uid and roll_date = today;
  if last_try is null then
    raise exception 'roll today first' using errcode = 'P0001';
  end if;

  select s.* into spin from public.wheel_spins s
    join public.wheel_prizes p on p.id = s.prize_id
   where s.user_id = uid and s.spin_date = today and p.kind = 'free_reroll';
  -- free: today's spin won a free reroll that hasn't been used yet.
  free := spin.user_id is not null and not spin.free_reroll_used;

  if free then
    update public.wheel_spins set free_reroll_used = true
     where user_id = uid and spin_date = today;
  else
    -- Paid rerolls so far = rerolls made, minus the free one if it was used.
    if last_try - (case when spin.user_id is not null then 1 else 0 end) >= private.max_rerolls() then
      raise exception 'no rerolls left today' using errcode = 'P0001';
    end if;
    if w.user_id is null or w.balance < price then
      raise exception 'not enough EP' using errcode = 'P0001';
    end if;
    update public.ep_wallets
       set spent_ep = spent_ep + price, updated_at = now()
     where user_id = uid;
  end if;

  return private.record_roll(uid, today, (last_try + 1)::smallint)
         || jsonb_build_object('free', free);
end;
$$;
revoke all on function public.reroll_today() from public, anon;
grant execute on function public.reroll_today() to authenticated;

-- ---------------------------------------------------------------------------
-- The spin
-- ---------------------------------------------------------------------------

create or replace function public.spin_wheel()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  today   date := (now() at time zone 'utc')::date;
  w       public.ep_wallets;
  target  public.rolls;
  prize   public.wheel_prizes;
  total_w integer;
  pick    integer;
  new_ep  integer;
  delta   integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Same lock as rerolls, so a spin and a reroll can't interleave.
  select * into w from public.ep_wallets where user_id = uid for update;

  select * into target from public.rolls
   where user_id = uid and roll_date = today
   order by attempt desc limit 1
   for update;
  if not found then
    raise exception 'roll today first' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.wheel_spins where user_id = uid and spin_date = today) then
    raise exception 'already spun today' using errcode = 'P0001';
  end if;

  -- Weighted pick.
  select sum(weight) into total_w from public.wheel_prizes;
  pick := private.random_below(total_w);
  select wp.* into prize
    from public.wheel_prizes wp
   where wp.id = (select c.id
                    from (select id, sort, sum(weight) over (order by sort) as upto
                            from public.wheel_prizes) c
                   where c.upto > pick
                   order by c.sort
                   limit 1);

  new_ep := target.ep;
  if prize.kind = 'multiplier' then
    new_ep := floor(target.base_ep * prize.value)::integer + target.bonus_ep;
    update public.rolls set multiplier = prize.value, ep = new_ep where id = target.id;
  elsif prize.kind = 'bonus' then
    new_ep := target.ep + prize.value::integer;
    update public.rolls set bonus_ep = bonus_ep + prize.value::integer, ep = new_ep where id = target.id;
  end if;
  delta := new_ep - target.ep;

  -- The primary key also stops a second spin if two calls race past the check.
  insert into public.wheel_spins (user_id, spin_date, prize_id, roll_id, ep_before, ep_after)
  values (uid, today, prize.id, target.id, target.ep, new_ep);

  if delta <> 0 then
    update public.ep_wallets
       set earned_ep = greatest(earned_ep + delta, spent_ep), updated_at = now()
     where user_id = uid
    returning * into w;
    perform private.refresh_totals(uid);
  end if;

  return jsonb_build_object(
    'prize', jsonb_build_object('id', prize.id, 'slug', prize.slug, 'label', prize.label,
                                'kind', prize.kind, 'value', prize.value),
    'attempt',   target.attempt,
    'number',    target.number,
    'ep_before', target.ep,
    'ep_after',  new_ep,
    'balance',   w.balance
  );
end;
$$;
revoke all on function public.spin_wheel() from public, anon;
grant execute on function public.spin_wheel() to authenticated;

-- ---------------------------------------------------------------------------
-- Rescoring keeps wheel effects
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
     set base_ep = ns.ep,
         ep = floor(ns.ep * r.multiplier)::integer + r.bonus_ep,
         tier = ns.tier
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

-- ---------------------------------------------------------------------------
-- Leaderboard: show the wheel multiplier on today's best rolls
-- ---------------------------------------------------------------------------

create or replace view public.leaderboard_today
with (security_invoker = true) as
select
  rank() over (order by b.ep desc, b.created_at) as rank,
  b.display_name,
  b.number,
  b.ep,
  b.tier,
  b.multiplier,
  b.bonus_ep
from (
  select distinct on (r.user_id) r.user_id, r.number, r.ep, r.tier, r.multiplier, r.bonus_ep,
         r.created_at, p.display_name
  from public.rolls r
  join public.profiles p on p.id = r.user_id
  where r.roll_date = ((now() at time zone 'utc')::date)
  order by r.user_id, r.ep desc, r.created_at
) b;

revoke all on public.leaderboard_today from anon, authenticated, public;
grant select on public.leaderboard_today to authenticated;
