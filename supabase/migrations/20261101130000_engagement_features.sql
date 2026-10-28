-- Engagement update, part 2: streak shields and milestones, limited events, the
-- community number, the Badge Hunt, family fusion, album rewards, the weekly
-- recap, and the roll functions that tie them together.
--
-- Everything that moves EP or hands out a reward runs inside the roll functions
-- (record_roll -> after_roll) or in a SECURITY DEFINER function that takes the
-- player from auth.uid(). Rewards are idempotent (ep_credits is unique per
-- player, kind and ref), so a repeated call can never pay twice.

-- ---------------------------------------------------------------------------
-- Streak shields and milestones
-- ---------------------------------------------------------------------------

create or replace function private.shield_price() returns integer
language sql immutable set search_path = '' as $$ select 600 $$;
create or replace function private.max_shields() returns integer
language sql immutable set search_path = '' as $$ select 3 $$;
revoke all on function private.shield_price() from public, anon, authenticated;
revoke all on function private.max_shields() from public, anon, authenticated;

create table public.streak_shields (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  count    smallint not null default 0 check (count between 0 and 3),
  auto_use boolean not null default true
);
create table public.shield_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
create table public.streak_milestone_defs (
  days     smallint primary key check (days > 0),
  ep       integer not null default 0 check (ep >= 0),
  shields  smallint not null default 0 check (shields >= 0),
  cosmetic text references public.cosmetics (id)
);
insert into public.streak_milestone_defs (days, ep, shields, cosmetic) values
  (7, 500, 0, null),
  (14, 1000, 1, null),
  (30, 0, 0, 'name-gold'),
  (100, 0, 0, 'frame-centurion');
create table public.streak_milestones (
  user_id    uuid not null references auth.users (id) on delete cascade,
  days       smallint not null references public.streak_milestone_defs (days),
  claimed_at timestamptz not null default now(),
  primary key (user_id, days)
);
create index streak_milestones_days_idx on public.streak_milestones (days);
create index streak_milestone_defs_cosmetic_idx on public.streak_milestone_defs (cosmetic);

-- ---------------------------------------------------------------------------
-- Limited events
-- ---------------------------------------------------------------------------

create table public.game_events (
  id              smallint primary key,
  slug            text not null unique check (slug ~ '^[a-z0-9-]{1,30}$'),
  name            text not null,
  tagline         text not null,
  roll_label      text not null,
  color           text not null check (color ~ '^#[0-9a-f]{6}$'),
  multiplier      numeric(4, 1) not null default 3 check (multiplier > 1),
  badge_slugs     text[] not null,
  reward_cosmetic text references public.cosmetics (id),
  reward_hits     smallint not null default 3 check (reward_hits > 0)
);
create index game_events_reward_idx on public.game_events (reward_cosmetic);
create table public.event_days (
  day      date primary key,
  event_id smallint not null references public.game_events (id)
);
create index event_days_event_idx on public.event_days (event_id);
create table public.event_hits (
  user_id  uuid not null references auth.users (id) on delete cascade,
  event_id smallint not null references public.game_events (id),
  day      date not null,
  primary key (user_id, day)
);
create index event_hits_event_idx on public.event_hits (event_id);

insert into public.game_events (id, slug, name, tagline, roll_label, color, multiplier, badge_slugs, reward_cosmetic) values
  (1, 'beast-day',     'Beast Day',      'Friday the 13th · fire badges pay triple', 'Roll into the fire', '#fb923c', 3, array['beastly', 'unlucky-thirteen', 'emergency'], 'aura-beast'),
  (2, 'eleven-eleven', 'Eleven Eleven',  '11/11 · every one pays triple',            'Roll for ones',      '#22d3ee', 3, array['triple-ones', 'quad-ones', 'ones-overload'], 'frame-neon'),
  (3, 'lucky-sevens',  'Lucky Sevens',   '7/7 · sevens pay triple',                  'Roll for sevens',    '#facc15', 3, array['lucky-seven', 'slot-machine', 'jackpot'], 'aura-gold'),
  (4, 'pi-day',        'Pi Day',         '3/14 · pi badges pay triple',              'Roll for pi',        '#818cf8', 3, array['pi-day', 'slice-of-pi', 'pi-somewhere'], 'aura-starfall'),
  (5, 'nice-day',      'Nice Day',       '6/9 · nice pays triple',                   'Roll for nice',      '#f472b6', 3, array['nice', 'extra-nice', 'meme-combo'], 'name-neon'),
  (6, 'new-year',      'New Year',       '1/1 · fresh year, fresh luck',             'Roll in the new year', '#38bdf8', 3, array['y2k', 'this-century', 'future-year'], 'frame-ice');

-- Event days through 2028: Friday the 13th, and fixed dates each year.
insert into public.event_days (day, event_id)
select d, 1
  from (select ('2026-01-01'::date + i) as d from generate_series(0, 1095) i) x
 where extract(isodow from d) = 5 and extract(day from d) = 13;
insert into public.event_days (day, event_id)
select make_date(y, m, dd), e
  from (values (2, 11, 11), (3, 7, 7), (4, 3, 14), (5, 6, 9), (6, 1, 1)) v(e, m, dd),
       generate_series(2026, 2028) y;

-- ---------------------------------------------------------------------------
-- Community number
-- ---------------------------------------------------------------------------

create table public.community_numbers (
  day    date primary key,
  number integer not null check (number between 0 and 999999)
);
create table public.community_results (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  matches  smallint not null check (matches between 0 and 6),
  number   integer not null,
  distance integer not null,
  primary key (user_id, day)
);
create index community_results_day_idx on public.community_results (day, matches);

-- ---------------------------------------------------------------------------
-- Badge Hunt
-- ---------------------------------------------------------------------------

create table public.hunt_days (
  day      date primary key,
  badge_id smallint not null references public.badges (id),
  counted  integer not null,
  bonus_ep integer not null check (bonus_ep > 0)
);
create index hunt_days_badge_idx on public.hunt_days (badge_id);
create table public.hunt_hits (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  bonus_ep integer not null,
  primary key (user_id, day)
);
create table public.hunt_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  wins       smallint not null default 0 check (wins between 0 and 7),
  total_wins integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Family fusion and album rewards
-- ---------------------------------------------------------------------------

create table public.family_fusions (
  user_id   uuid not null references auth.users (id) on delete cascade,
  family    text not null check (family ~ '^[a-z0-9-]{1,40}$'),
  reward_ep integer not null,
  fused_at  timestamptz not null default now(),
  primary key (user_id, family)
);
create table public.album_rewards (
  pct      smallint primary key check (pct between 1 and 100),
  ep       integer not null default 0 check (ep >= 0),
  cosmetic text references public.cosmetics (id),
  label    text not null
);
insert into public.album_rewards (pct, ep, cosmetic, label) values
  (10, 500, null, '+500 EP'),
  (25, 2000, null, '+2,000 EP'),
  (50, 0, 'aura-ember', 'Ember aura skin'),
  (75, 6000, null, '+6,000 EP'),
  (100, 25000, 'frame-prism', 'Prism frame and +25,000 EP');
create index album_rewards_cosmetic_idx on public.album_rewards (cosmetic);
create table public.album_claims (
  user_id    uuid not null references auth.users (id) on delete cascade,
  pct        smallint not null references public.album_rewards (pct),
  claimed_at timestamptz not null default now(),
  primary key (user_id, pct)
);
create index album_claims_pct_idx on public.album_claims (pct);

-- ---------------------------------------------------------------------------
-- Row level security for the new tables
-- ---------------------------------------------------------------------------

-- Catalogue / schedule tables: every signed-in player can read them.
-- Per-player tables: a player reads only their own rows. Nothing is writable.
do $$
declare
  t text;
begin
  foreach t in array array['streak_shields', 'shield_uses', 'streak_milestone_defs', 'streak_milestones',
                           'game_events', 'event_days', 'event_hits', 'community_numbers', 'community_results',
                           'hunt_days', 'hunt_hits', 'hunt_progress', 'family_fusions', 'album_rewards', 'album_claims']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
  end loop;
end $$;

grant select on public.streak_milestone_defs, public.game_events, public.event_days, public.album_rewards to authenticated;
create policy streak_milestone_defs_read on public.streak_milestone_defs for select to authenticated using (true);
create policy game_events_read on public.game_events for select to authenticated using (true);
create policy event_days_read on public.event_days for select to authenticated using (true);
create policy album_rewards_read on public.album_rewards for select to authenticated using (true);

grant select on public.streak_shields, public.shield_uses, public.streak_milestones, public.event_hits,
                public.hunt_hits, public.hunt_progress, public.family_fusions, public.album_claims to authenticated;
create policy streak_shields_read_own on public.streak_shields for select to authenticated using (user_id = (select auth.uid()));
create policy shield_uses_read_own on public.shield_uses for select to authenticated using (user_id = (select auth.uid()));
create policy streak_milestones_read_own on public.streak_milestones for select to authenticated using (user_id = (select auth.uid()));
create policy event_hits_read_own on public.event_hits for select to authenticated using (user_id = (select auth.uid()));
create policy hunt_hits_read_own on public.hunt_hits for select to authenticated using (user_id = (select auth.uid()));
create policy hunt_progress_read_own on public.hunt_progress for select to authenticated using (user_id = (select auth.uid()));
create policy family_fusions_read_own on public.family_fusions for select to authenticated using (user_id = (select auth.uid()));
create policy album_claims_read_own on public.album_claims for select to authenticated using (user_id = (select auth.uid()));
-- community_numbers, community_results, hunt_days: no direct access, only through the functions below.

-- ---------------------------------------------------------------------------
-- Streaks
-- ---------------------------------------------------------------------------

-- Streak facts for one player. Days covered by a shield keep a streak alive but
-- don't add to its length. current = the run that includes today or yesterday.
create or replace function private.streak_info(uid uuid, today date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with rolled as (
    select distinct roll_date as d from public.rolls where user_id = uid
  ),
  covered as (
    select d, true as is_roll from rolled
    union all
    select s.day, false from public.shield_uses s
     where s.user_id = uid and s.day not in (select d from rolled)
  ),
  islands as (
    select d, is_roll, d - (row_number() over (order by d))::integer as grp from covered
  ),
  runs as (
    select max(d) as last_day, count(*) filter (where is_roll) as len from islands group by grp
  )
  select jsonb_build_object(
    'current',      coalesce((select len from runs where last_day >= today - 1 order by last_day desc limit 1), 0),
    'latest_len',   coalesce((select len from runs order by last_day desc limit 1), 0),
    'last_roll',    (select max(d) from rolled),
    'best',         coalesce((select max(len) from runs), 0),
    'rolled_today', exists (select 1 from rolled where d = today)
  )
$$;
revoke all on function private.streak_info(uuid, date) from public, anon, authenticated;

-- Before a new day's first roll: if days were missed and the player has enough
-- auto-use shields to cover all of them, spend them so the streak survives.
create or replace function private.apply_shields(uid uuid, today date)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  last_roll date;
  have      smallint;
  auto      boolean;
  missing   integer := 0;
  i         integer;
begin
  select max(roll_date) into last_roll from public.rolls where user_id = uid and roll_date < today;
  if last_roll is null or last_roll >= today - 1 then
    return;
  end if;
  select count, auto_use into have, auto from public.streak_shields where user_id = uid for update;
  if not found or not auto or have = 0 then
    return;
  end if;
  for i in 1 .. (today - last_roll - 1) loop
    if not exists (select 1 from public.shield_uses where user_id = uid and day = last_roll + i) then
      missing := missing + 1;
    end if;
  end loop;
  if missing < 1 or missing > have then
    return;
  end if;
  for i in 1 .. (today - last_roll - 1) loop
    insert into public.shield_uses (user_id, day) values (uid, last_roll + i) on conflict do nothing;
  end loop;
  update public.streak_shields set count = have - missing where user_id = uid;
end;
$$;
revoke all on function private.apply_shields(uuid, date) from public, anon, authenticated;

-- Grants streak milestones the player has reached; returns reward entries.
create or replace function private.check_milestones(uid uuid, streak integer)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  d       public.streak_milestone_defs;
  rewards jsonb := '[]'::jsonb;
  parts   text[];
  paid    integer;
  fresh   boolean;
begin
  for d in
    select m.* from public.streak_milestone_defs m
     where m.days <= streak
       and not exists (select 1 from public.streak_milestones c where c.user_id = uid and c.days = m.days)
     order by m.days
  loop
    insert into public.streak_milestones (user_id, days) values (uid, d.days) on conflict do nothing;
    parts := '{}';
    if d.ep > 0 then
      paid := private.grant_ep(uid, 'milestone', d.days::text, d.ep);
      parts := parts || ('+' || to_char(d.ep, 'FM999,999') || ' EP');
    end if;
    if d.shields > 0 then
      insert into public.streak_shields as s (user_id, count) values (uid, least(d.shields, private.max_shields()))
      on conflict (user_id) do update set count = least(s.count + d.shields, private.max_shields());
      parts := parts || ('+' || d.shields || ' streak shield');
    end if;
    if d.cosmetic is not null then
      fresh := private.grant_cosmetic(uid, d.cosmetic, 'streak-' || d.days);
      parts := parts || ((select name from public.cosmetics where id = d.cosmetic) || ' unlocked');
    end if;
    rewards := rewards || jsonb_build_array(jsonb_build_object(
      'kind', 'milestone', 'title', d.days || '-day streak', 'detail', array_to_string(parts, ', ')));
  end loop;
  return rewards;
end;
$$;
revoke all on function private.check_milestones(uuid, integer) from public, anon, authenticated;

create or replace function public.my_streak()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  today   date := private.utc_today();
  info    jsonb;
  sh      public.streak_shields;
  have    integer;
  auto    boolean;
  last_d  date;
  rolled  boolean;
  missed  integer;
  pending boolean;
  cur     integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  info := private.streak_info(uid, today);
  select * into sh from public.streak_shields where user_id = uid;
  have := coalesce(sh.count, 0);
  auto := coalesce(sh.auto_use, true);
  last_d := (info ->> 'last_roll')::date;
  rolled := (info ->> 'rolled_today')::boolean;
  missed := case when last_d is null or rolled then 0 else greatest(0, today - last_d - 1) end;
  pending := auto and missed between 1 and have;
  cur := case when (info ->> 'current')::integer > 0 then (info ->> 'current')::integer
              when pending then (info ->> 'latest_len')::integer
              else 0 end;
  return jsonb_build_object(
    'current',       cur,
    'best',          greatest((info ->> 'best')::integer, cur),
    'rolled_today',  rolled,
    'missed_days',   missed,
    'shield_will_cover', pending,
    'at_risk',       missed >= 1 and not pending and (info ->> 'latest_len')::integer > 0,
    'shields',       jsonb_build_object('count', have, 'max', private.max_shields(),
                                        'price', private.shield_price(), 'auto', auto),
    'days', (
      select jsonb_agg(jsonb_build_object(
               'date', d,
               'state', case when exists (select 1 from public.rolls r where r.user_id = uid and r.roll_date = d) then 'rolled'
                             when exists (select 1 from public.shield_uses s where s.user_id = uid and s.day = d) then 'shield'
                             when d = today then 'today'
                             else 'missed' end) order by d)
        from (select today - 13 + i as d from generate_series(0, 13) i) x),
    'shields_used_in_window', (select count(*) from public.shield_uses where user_id = uid and day between today - 13 and today),
    'milestones', (
      select jsonb_agg(jsonb_build_object(
               'days', m.days, 'ep', m.ep, 'shields', m.shields,
               'cosmetic', m.cosmetic, 'cosmetic_name', (select name from public.cosmetics where id = m.cosmetic),
               'claimed', exists (select 1 from public.streak_milestones c where c.user_id = uid and c.days = m.days))
             order by m.days)
        from public.streak_milestone_defs m)
  );
end;
$$;
revoke all on function public.my_streak() from public, anon;
grant execute on function public.my_streak() to authenticated;

create or replace function public.buy_shield()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  price integer := private.shield_price();
  w     public.ep_wallets;
  have  smallint;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into w from public.ep_wallets where user_id = uid for update;
  select count into have from public.streak_shields where user_id = uid for update;
  if coalesce(have, 0) >= private.max_shields() then
    raise exception 'shields full' using errcode = 'P0001';
  end if;
  if w.user_id is null or w.balance < price then
    raise exception 'not enough EP' using errcode = 'P0001';
  end if;
  update public.ep_wallets set spent_ep = spent_ep + price, updated_at = now() where user_id = uid
  returning * into w;
  insert into public.streak_shields as s (user_id, count) values (uid, 1)
  on conflict (user_id) do update set count = s.count + 1
  returning count into have;
  return jsonb_build_object('shields', have, 'balance', w.balance);
end;
$$;
revoke all on function public.buy_shield() from public, anon;
grant execute on function public.buy_shield() to authenticated;

create or replace function public.set_shield_auto(on_off boolean)
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
  if on_off is null then
    raise exception 'on or off' using errcode = 'P0001';
  end if;
  insert into public.streak_shields as s (user_id, count, auto_use) values (uid, 0, on_off)
  on conflict (user_id) do update set auto_use = on_off;
end;
$$;
revoke all on function public.set_shield_auto(boolean) from public, anon;
grant execute on function public.set_shield_auto(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create or replace function private.event_for(d date)
returns public.game_events
language sql
stable
set search_path = ''
as $$
  select e.* from public.event_days ed join public.game_events e on e.id = ed.event_id where ed.day = d
$$;
revoke all on function private.event_for(date) from public, anon, authenticated;

-- Extra EP on an event day: (multiplier - 1) x the EP of the boosted badges the roll scored.
create or replace function private.event_bonus(ev public.game_events, badge_ids smallint[])
returns integer
language sql
stable
set search_path = ''
as $$
  select floor(coalesce(sum(b.ep), 0) * (ev.multiplier - 1))::integer
    from public.badges b
   where b.id = any (badge_ids) and b.slug = any (ev.badge_slugs)
$$;
revoke all on function private.event_bonus(public.game_events, smallint[]) from public, anon, authenticated;

create or replace function public.event_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  today date := private.utc_today();
  ev    public.game_events;
  nx    record;
  cur   jsonb := null;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  ev := private.event_for(today);
  if ev.id is not null then
    cur := jsonb_build_object(
      'slug', ev.slug, 'name', ev.name, 'tagline', ev.tagline, 'roll_label', ev.roll_label,
      'color', ev.color, 'multiplier', ev.multiplier,
      'ends_at', ((today + 1)::timestamp at time zone 'utc'),
      'boosted', coalesce((
        select jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name, 'emoji', b.emoji,
                 'description', b.description, 'rarity', b.rarity, 'ep', b.ep) order by b.ep)
          from public.badges b where b.slug = any (ev.badge_slugs)), '[]'::jsonb),
      'hits', (select count(*) from public.event_hits h where h.user_id = uid and h.event_id = ev.id),
      'need', ev.reward_hits,
      'hit_today', exists (select 1 from public.event_hits h where h.user_id = uid and h.day = today),
      'reward', (select jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind)
                   from public.cosmetics c where c.id = ev.reward_cosmetic),
      'reward_owned', exists (select 1 from public.player_cosmetics pc where pc.user_id = uid and pc.item_id = ev.reward_cosmetic)
    );
  end if;
  select ed.day, e.slug, e.name, e.tagline, e.color into nx
    from public.event_days ed join public.game_events e on e.id = ed.event_id
   where ed.day > today order by ed.day limit 1;
  return jsonb_build_object(
    'today', cur,
    'next', case when nx.day is null then null else jsonb_build_object(
      'slug', nx.slug, 'name', nx.name, 'tagline', nx.tagline, 'color', nx.color,
      'day', nx.day, 'days_away', nx.day - today) end
  );
end;
$$;
revoke all on function public.event_status() from public, anon;
grant execute on function public.event_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Community number
-- ---------------------------------------------------------------------------

create or replace function private.community_number(d date)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  n integer;
begin
  select number into n from public.community_numbers where day = d;
  if n is not null then
    return n;
  end if;
  insert into public.community_numbers (day, number) values (d, private.random_below(1000000))
  on conflict (day) do nothing;
  select number into n from public.community_numbers where day = d;
  return n;
end;
$$;
revoke all on function private.community_number(date) from public, anon, authenticated;

-- How many of the six digits (zero-padded) are equal in the same place.
create or replace function private.digit_matches(a integer, b integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer from generate_series(1, 6) i
   where substr(lpad((a % 1000000)::text, 6, '0'), i, 1) = substr(lpad((b % 1000000)::text, 6, '0'), i, 1)
$$;
revoke all on function private.digit_matches(integer, integer) from public, anon, authenticated;

create or replace function private.community_bonus(matches integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case matches when 2 then 50 when 3 then 150 when 4 then 400 when 5 then 1500 when 6 then 25000 else 0 end
$$;
revoke all on function private.community_bonus(integer) from public, anon, authenticated;

create or replace function public.community_today()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  today   date := private.utc_today();
  cn      integer;
  mine    public.community_results;
  players integer;
  closer  integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  cn := private.community_number(today);
  select * into mine from public.community_results where user_id = uid and day = today;
  select count(*) into players from public.community_results where day = today;
  -- The number stays hidden until you have rolled, so it can never feel like a hint.
  if mine.user_id is null then
    return jsonb_build_object('revealed', false, 'players', players);
  end if;
  select count(*) into closer from public.community_results
   where day = today and (distance < mine.distance);
  return jsonb_build_object(
    'revealed', true,
    'number',   lpad(cn::text, 6, '0'),
    'your_number', mine.number,
    'matches',  mine.matches,
    'distance', mine.distance,
    'positions', (select jsonb_agg(substr(lpad((mine.number % 1000000)::text, 6, '0'), i, 1)
                                   = substr(lpad(cn::text, 6, '0'), i, 1) order by i) from generate_series(1, 6) i),
    'bonus',    private.community_bonus(mine.matches),
    'rank',     closer + 1,
    'players',  players,
    'distribution', (select jsonb_agg(coalesce(c.n, 0) order by g.m)
                       from generate_series(0, 6) g(m)
                       left join (select matches, count(*) as n from public.community_results
                                   where day = today group by matches) c on c.matches = g.m),
    'ladder', jsonb_build_array(
      jsonb_build_object('matches', 2, 'ep', 50), jsonb_build_object('matches', 3, 'ep', 150),
      jsonb_build_object('matches', 4, 'ep', 400), jsonb_build_object('matches', 5, 'ep', 1500),
      jsonb_build_object('matches', 6, 'ep', 25000))
  );
end;
$$;
revoke all on function public.community_today() from public, anon;
grant execute on function public.community_today() to authenticated;

-- ---------------------------------------------------------------------------
-- Badge Hunt
-- ---------------------------------------------------------------------------

create or replace function private.hunt_wins_needed() returns integer
language sql immutable set search_path = '' as $$ select 7 $$;
revoke all on function private.hunt_wins_needed() from public, anon, authenticated;

-- Today's wanted badge (picked on first use). Mid-rarity badges, so the hunt is
-- winnable: roughly a 1-in-8 to 1-in-40 chance per roll. Bonus = 10x the badge's EP.
create or replace function private.hunt_for(d date)
returns public.hunt_days
language plpgsql
volatile
set search_path = ''
as $$
declare
  h       public.hunt_days;
  total   integer;
  pick    smallint;
  matches integer;
begin
  select * into h from public.hunt_days where day = d;
  if found then
    return h;
  end if;
  select count(*) into total from public.badges
   where ep between 8 and 40
     and id <> coalesce((select badge_id from public.hunt_days where day = d - 1), -1);
  if total = 0 then
    return null;
  end if;
  select b.id into pick from public.badges b
   where b.ep between 8 and 40
     and b.id <> coalesce((select badge_id from public.hunt_days where day = d - 1), -1)
   order by b.id offset private.random_below(total) limit 1;
  select count(*) into matches from public.number_stats where pick = any (badge_ids);
  insert into public.hunt_days (day, badge_id, counted, bonus_ep)
  select d, b.id, matches, b.ep * 10 from public.badges b where b.id = pick
  on conflict (day) do nothing;
  select * into h from public.hunt_days where day = d;
  return h;
end;
$$;
revoke all on function private.hunt_for(date) from public, anon, authenticated;

create or replace function public.hunt_today()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  today date := private.utc_today();
  h     public.hunt_days;
  b     public.badges;
  prog  public.hunt_progress;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  h := private.hunt_for(today);
  if h.day is null then
    return jsonb_build_object('available', false);
  end if;
  select * into b from public.badges where id = h.badge_id;
  select * into prog from public.hunt_progress where user_id = uid;
  return jsonb_build_object(
    'available', true,
    'badge', jsonb_build_object('slug', b.slug, 'name', b.name, 'emoji', b.emoji, 'description', b.description,
                                'rarity', b.rarity, 'ep', b.ep),
    'bonus_ep', h.bonus_ep,
    'chance', h.counted::double precision / 1000001,
    'hit_today', exists (select 1 from public.hunt_hits where user_id = uid and day = today),
    'wins', coalesce(prog.wins, 0),
    'total_wins', coalesce(prog.total_wins, 0),
    'wins_needed', private.hunt_wins_needed(),
    'max_rerolls', private.max_rerolls()
  );
end;
$$;
revoke all on function public.hunt_today() from public, anon;
grant execute on function public.hunt_today() to authenticated;

-- ---------------------------------------------------------------------------
-- Fusion
-- ---------------------------------------------------------------------------

create or replace function private.fusion_reward(size integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select least(25000, 500 * size + 2000) $$;
revoke all on function private.fusion_reward(integer) from public, anon, authenticated;

-- Fuse a finished family (3+ badges, all collected) into a Master badge.
create or replace function public.fuse_family(fam text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  size   integer;
  owned  integer;
  reward integer;
  fresh  boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select count(*) into size from public.badges where family = fam;
  if size < 3 then
    raise exception 'not a fusable family' using errcode = 'P0001';
  end if;
  select count(distinct rb.badge_id) into owned
    from public.roll_badges rb
    join public.rolls r on r.id = rb.roll_id
    join public.badges b on b.id = rb.badge_id
   where r.user_id = uid and b.family = fam;
  if owned < size then
    raise exception 'family not complete' using errcode = 'P0001';
  end if;
  reward := private.fusion_reward(size);
  insert into public.family_fusions (user_id, family, reward_ep) values (uid, fam, reward);
  perform private.grant_ep(uid, 'fusion', fam, reward);
  fresh := private.grant_cosmetic(uid, 'name-prism', 'fusion');
  return jsonb_build_object(
    'family', fam, 'size', size, 'reward_ep', reward, 'new_cosmetic', fresh,
    'balance', (select balance from public.ep_wallets where user_id = uid));
exception when unique_violation then
  raise exception 'already fused' using errcode = 'P0001';
end;
$$;
revoke all on function public.fuse_family(text) from public, anon;
grant execute on function public.fuse_family(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Weekly recap
-- ---------------------------------------------------------------------------

-- week_back = 0 is this week (Monday to Sunday, UTC), 1 is last week, ...
create or replace function public.weekly_recap(week_back integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  today   date := private.utc_today();
  ws      date;
  we      date;
  total   integer;
  prev    integer;
  players integer;
  better  integer;
  lower   integer;
  info    jsonb;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if week_back < 0 or week_back > 520 then
    raise exception 'bad week' using errcode = 'P0001';
  end if;
  ws := today - (extract(isodow from today)::integer - 1) - week_back * 7;
  we := ws + 6;

  select coalesce(sum(best), 0) into total from (
    select max(ep) as best from public.rolls where user_id = uid and roll_date between ws and we group by roll_date) x;
  select coalesce(sum(best), 0) into prev from (
    select max(ep) as best from public.rolls where user_id = uid and roll_date between ws - 7 and ws - 1 group by roll_date) x;

  with totals as (
    select user_id, sum(best) as t from (
      select user_id, roll_date, max(ep) as best from public.rolls
       where roll_date between ws and we group by user_id, roll_date) d
     group by user_id)
  select count(*), count(*) filter (where t > total), count(*) filter (where t < total)
    into players, better, lower from totals;

  info := private.streak_info(uid, today);

  return jsonb_build_object(
    'week_start', ws, 'week_end', we,
    'week_number', extract(week from ws)::integer,
    'is_current', week_back = 0,
    'total_ep', total,
    'last_week_ep', prev,
    'days', (
      select jsonb_agg(jsonb_build_object('date', g.d, 'number', b.number, 'ep', b.ep, 'tier', b.tier) order by g.d)
        from (select ws + i as d from generate_series(0, 6) i) g
        left join lateral (
          select r.number, r.ep, r.tier from public.rolls r
           where r.user_id = uid and r.roll_date = g.d order by r.ep desc, r.created_at limit 1) b on true),
    'best', (select jsonb_build_object('number', r.number, 'ep', r.ep, 'tier', r.tier, 'date', r.roll_date)
               from public.rolls r where r.user_id = uid and r.roll_date between ws and we
              order by r.ep desc, r.created_at limit 1),
    'rarest_badge', (select jsonb_build_object('name', b.name, 'emoji', b.emoji, 'rarity', b.rarity, 'ep', b.ep,
                                               'one_in', round(1 / b.probability)::bigint)
                       from public.roll_badges rb
                       join public.rolls r on r.id = rb.roll_id
                       join public.badges b on b.id = rb.badge_id
                      where r.user_id = uid and r.roll_date between ws and we
                      order by b.ep desc, b.id limit 1),
    'streak', (info ->> 'current')::integer,
    'shields_used', (select count(*) from public.shield_uses where user_id = uid and day between ws and we),
    'rank', case when total > 0 then better + 1 else null end,
    'players', players,
    'luckier_than_pct', case when total > 0 and players > 1 then round(100.0 * lower / (players - 1))::integer else null end
  );
end;
$$;
revoke all on function public.weekly_recap(integer) from public, anon;
grant execute on function public.weekly_recap(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- After every roll: events, the community number, the hunt, streak milestones, album
-- ---------------------------------------------------------------------------

create or replace function private.after_roll(uid uuid, today date, badge_ids smallint[], roll_number integer)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  rewards jsonb := '[]'::jsonb;
  ev      public.game_events;
  hits    integer;
  fresh   boolean;
  cn      integer;
  m       integer;
  best_m  integer;
  delta   integer;
  h       public.hunt_days;
  added   integer;
  wins    smallint;
  streak  integer;
  total   integer;
  owned   integer;
  album_pct integer;
  a       public.album_rewards;
begin
  -- Event: a boosted badge today counts towards the event's reward.
  ev := private.event_for(today);
  if ev.id is not null and exists (
    select 1 from public.badges b where b.id = any (badge_ids) and b.slug = any (ev.badge_slugs)
  ) then
    insert into public.event_hits (user_id, event_id, day) values (uid, ev.id, today) on conflict do nothing;
    select count(*) into hits from public.event_hits where user_id = uid and event_id = ev.id;
    if ev.reward_cosmetic is not null and hits >= ev.reward_hits then
      fresh := private.grant_cosmetic(uid, ev.reward_cosmetic, 'event-' || ev.slug);
      if fresh then
        rewards := rewards || jsonb_build_array(jsonb_build_object(
          'kind', 'event', 'title', ev.name || ' reward',
          'detail', (select name from public.cosmetics where id = ev.reward_cosmetic) || ' unlocked'));
      end if;
    end if;
  end if;

  -- Community number: the best match of the day pays the ladder bonus.
  cn := private.community_number(today);
  m := private.digit_matches(roll_number, cn);
  insert into public.community_results as c (user_id, day, matches, number, distance)
  values (uid, today, m, roll_number, abs(roll_number - cn))
  on conflict (user_id, day) do update
    set matches = excluded.matches, number = excluded.number, distance = excluded.distance
    where excluded.matches > c.matches or (excluded.matches = c.matches and excluded.distance < c.distance);
  select matches into best_m from public.community_results where user_id = uid and day = today;
  delta := private.grant_ep(uid, 'community', today::text, private.community_bonus(best_m));
  if delta > 0 then
    rewards := rewards || jsonb_build_array(jsonb_build_object(
      'kind', 'community', 'title', best_m || ' digits match the community number',
      'detail', '+' || to_char(private.community_bonus(best_m), 'FM999,999') || ' EP'));
  end if;

  -- Badge Hunt.
  h := private.hunt_for(today);
  if h.day is not null and h.badge_id = any (badge_ids) then
    insert into public.hunt_hits (user_id, day, bonus_ep) values (uid, today, h.bonus_ep) on conflict do nothing;
    get diagnostics added = row_count;
    if added > 0 then
      perform private.grant_ep(uid, 'hunt', today::text, h.bonus_ep);
      rewards := rewards || jsonb_build_array(jsonb_build_object(
        'kind', 'hunt', 'title', 'Badge Hunt won: ' || (select name from public.badges where id = h.badge_id),
        'detail', '+' || to_char(h.bonus_ep, 'FM999,999') || ' EP'));
      insert into public.hunt_progress as p (user_id, wins, total_wins) values (uid, 1, 1)
      on conflict (user_id) do update set wins = p.wins + 1, total_wins = p.total_wins + 1
      returning p.wins into wins;
      if wins >= private.hunt_wins_needed() then
        update public.hunt_progress set wins = 0 where user_id = uid;
        insert into public.reroll_tokens as t (user_id, count) values (uid, 1)
        on conflict (user_id) do update set count = least(t.count + 1, 10);
        fresh := private.grant_cosmetic(uid, 'name-hunter', 'hunt');
        rewards := rewards || jsonb_build_array(jsonb_build_object(
          'kind', 'hunt', 'title', 'Hunt streak complete',
          'detail', '+1 free reroll' || case when fresh then ', Hunter name unlocked' else '' end));
      end if;
    end if;
  end if;

  -- Streak milestones.
  streak := (private.streak_info(uid, today) ->> 'current')::integer;
  rewards := rewards || private.check_milestones(uid, streak);

  -- Album milestones.
  select count(*) into total from public.badges;
  select count(distinct rb.badge_id) into owned
    from public.roll_badges rb join public.rolls r on r.id = rb.roll_id where r.user_id = uid;
  album_pct := case when total = 0 then 0 else floor(100.0 * owned / total)::integer end;
  for a in
    select ar.* from public.album_rewards ar
     where ar.pct <= album_pct
       and not exists (select 1 from public.album_claims c where c.user_id = uid and c.pct = ar.pct)
     order by ar.pct
  loop
    insert into public.album_claims (user_id, pct) values (uid, a.pct) on conflict do nothing;
    if a.ep > 0 then
      perform private.grant_ep(uid, 'album', a.pct::text, a.ep);
    end if;
    if a.cosmetic is not null then
      perform private.grant_cosmetic(uid, a.cosmetic, 'album-' || a.pct);
    end if;
    rewards := rewards || jsonb_build_array(jsonb_build_object(
      'kind', 'album', 'title', 'Album ' || a.pct || '% complete', 'detail', a.label));
  end loop;

  return rewards;
end;
$$;
revoke all on function private.after_roll(uuid, date, smallint[], integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rolling (replaces the earlier versions)
-- ---------------------------------------------------------------------------

drop function private.record_roll(uuid, date, smallint);

create or replace function private.record_roll(uid uuid, today date, attempt_no smallint, was_free boolean default false)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  n         integer := private.random_roll();
  stats     public.number_stats;
  ev        public.game_events;
  ev_bonus  integer := 0;
  eff       integer;
  new_id    bigint;
  prev_best integer;
  w         public.ep_wallets;
  rewards   jsonb;
begin
  select * into stats from public.number_stats where number = n;
  if not found then
    raise exception 'number_stats is not loaded' using errcode = 'P0001';
  end if;

  -- A new day's first roll: shields cover missed days before today counts.
  if attempt_no = 0 then
    perform private.apply_shields(uid, today);
  end if;

  ev := private.event_for(today);
  if ev.id is not null then
    ev_bonus := private.event_bonus(ev, stats.badge_ids);
  end if;
  eff := stats.ep + ev_bonus;

  select max(ep) into prev_best from public.rolls where user_id = uid and roll_date = today;

  insert into public.rolls (user_id, roll_date, number, ep, base_ep, event_bonus_ep, tier, attempt, free_reroll)
  values (uid, today, n, eff, stats.ep, ev_bonus, stats.tier, attempt_no, was_free)
  returning id into new_id;

  insert into public.roll_badges (roll_id, badge_id)
  select new_id, unnest(stats.badge_ids);

  insert into public.leaderboard_totals (user_id, total_ep, best_ep, roll_count)
  values (uid, eff, eff, 1)
  on conflict (user_id) do update
    set total_ep   = public.leaderboard_totals.total_ep + greatest(0, eff - coalesce(prev_best, 0)),
        best_ep    = greatest(public.leaderboard_totals.best_ep, eff),
        roll_count = public.leaderboard_totals.roll_count + (case when prev_best is null then 1 else 0 end),
        updated_at = now();

  insert into public.ep_wallets (user_id, earned_ep) values (uid, eff)
  on conflict (user_id) do update
    set earned_ep = public.ep_wallets.earned_ep + excluded.earned_ep, updated_at = now();

  rewards := private.after_roll(uid, today, stats.badge_ids, n);
  select * into w from public.ep_wallets where user_id = uid;

  return jsonb_build_object(
    'roll_date',    today,
    'attempt',      attempt_no,
    'number',       n,
    'ep',           eff,
    'base_ep',      stats.ep,
    'event_bonus',  ev_bonus,
    'multiplier',   1,
    'bonus_ep',     0,
    'tier',         stats.tier,
    'day_best_ep',  greatest(eff, coalesce(prev_best, 0)),
    'balance',      w.balance,
    'streak',       (private.streak_info(uid, today) ->> 'current')::integer,
    'rewards',      rewards,
    'badges',       coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', b.slug, 'name', b.name, 'emoji', b.emoji,
               'description', b.description, 'rarity', b.rarity, 'ep', b.ep)
             order by b.ep desc)
      from public.badges b where b.id = any (stats.badge_ids)), '[]'::jsonb)
  );
end;
$$;
revoke all on function private.record_roll(uuid, date, smallint, boolean) from public, anon, authenticated;

create or replace function public.reroll_today()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid       uuid := auth.uid();
  today     date := private.utc_today();
  price     integer := private.reroll_price();
  w         public.ep_wallets;
  spin      public.wheel_spins;
  tokens    smallint;
  free      boolean := false;
  paid_used integer;
  last_try  smallint;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Lock the wallet: rerolls, spins and purchases by one player run one at a time.
  select * into w from public.ep_wallets where user_id = uid for update;

  select max(attempt) into last_try from public.rolls where user_id = uid and roll_date = today;
  if last_try is null then
    raise exception 'roll today first' using errcode = 'P0001';
  end if;
  if last_try >= 8 then
    raise exception 'no rerolls left today' using errcode = 'P0001';
  end if;

  select s.* into spin from public.wheel_spins s
    join public.wheel_prizes p on p.id = s.prize_id
   where s.user_id = uid and s.spin_date = today and p.kind = 'free_reroll';

  if spin.user_id is not null and not spin.free_reroll_used then
    -- The Lucky Wheel's free reroll comes first.
    update public.wheel_spins set free_reroll_used = true where user_id = uid and spin_date = today;
    free := true;
  else
    select count into tokens from public.reroll_tokens where user_id = uid for update;
    if coalesce(tokens, 0) > 0 then
      update public.reroll_tokens set count = count - 1 where user_id = uid;
      free := true;
    end if;
  end if;

  if not free then
    select count(*) into paid_used from public.rolls
     where user_id = uid and roll_date = today and attempt > 0 and not free_reroll;
    if paid_used >= private.max_rerolls() then
      raise exception 'no rerolls left today' using errcode = 'P0001';
    end if;
    if w.user_id is null or w.balance < price then
      raise exception 'not enough EP' using errcode = 'P0001';
    end if;
    update public.ep_wallets set spent_ep = spent_ep + price, updated_at = now() where user_id = uid;
  end if;

  return private.record_roll(uid, today, (last_try + 1)::smallint, free)
         || jsonb_build_object('free', free);
end;
$$;
revoke all on function public.reroll_today() from public, anon;
grant execute on function public.reroll_today() to authenticated;

create or replace function public.roll_today()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  today date := private.utc_today();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'choose a display name first' using errcode = 'P0001';
  end if;
  begin
    return private.record_roll(uid, today, 0::smallint, false);
  exception when unique_violation then
    raise exception 'already rolled today' using errcode = 'P0001';
  end;
end;
$$;
revoke all on function public.roll_today() from public, anon;
grant execute on function public.roll_today() to authenticated;

-- The wheel's maths now also keeps the event bonus.
create or replace function public.spin_wheel()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  today   date := private.utc_today();
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
    new_ep := floor(target.base_ep * prize.value)::integer + target.bonus_ep + target.event_bonus_ep;
    update public.rolls set multiplier = prize.value, ep = new_ep where id = target.id;
  elsif prize.kind = 'bonus' then
    new_ep := target.ep + prize.value::integer;
    update public.rolls set bonus_ep = bonus_ep + prize.value::integer, ep = new_ep where id = target.id;
  end if;
  delta := new_ep - target.ep;

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

-- Rescoring keeps wheel effects, event bonuses and every EP credit.
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
         ep = floor(ns.ep * r.multiplier)::integer + r.bonus_ep + r.event_bonus_ep,
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
  select u.user_id, coalesce(r.s, 0) + coalesce(c.s, 0)
    from (select user_id from public.rolls union select user_id from public.ep_credits) u
    left join (select user_id, sum(ep) as s from public.rolls group by user_id) r on r.user_id = u.user_id
    left join (select user_id, sum(amount) as s from public.ep_credits group by user_id) c on c.user_id = u.user_id
  on conflict (user_id) do update
    set earned_ep = greatest(excluded.earned_ep, w.spent_ep), updated_at = now();
end;
$$;
revoke all on function private.rescore_all() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Player stats use the shield-aware streak
-- ---------------------------------------------------------------------------

create or replace function public.player_stats(target_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  prof   public.profiles;
  today  date := private.utc_today();
  info   jsonb;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into prof from public.profiles where display_name = target_name;
  if not found then
    raise exception 'no such player' using errcode = 'P0001';
  end if;
  info := private.streak_info(prof.id, today);

  with days as (
    select distinct roll_date as d from public.rolls where user_id = prof.id
  ),
  best as (
    select number, ep, tier, roll_date, multiplier, attempt
      from public.rolls where user_id = prof.id
     order by ep desc, created_at
     limit 1
  ),
  earned as (
    select distinct rb.badge_id
      from public.roll_badges rb join public.rolls r on r.id = rb.roll_id
     where r.user_id = prof.id
  ),
  rarest as (
    select b.name, b.emoji, b.rarity, b.ep
      from earned e join public.badges b on b.id = e.badge_id
     order by b.ep desc, b.id
     limit 1
  )
  select jsonb_build_object(
    'display_name',     prof.display_name,
    'avatar_path',      prof.avatar_path,
    'joined',           (prof.created_at at time zone 'utc')::date,
    'days_played',      (select count(*) from days),
    'total_rolls',      (select count(*) from public.rolls where user_id = prof.id),
    'total_ep',         coalesce((select total_ep from public.leaderboard_totals where user_id = prof.id), 0),
    'rank_all_time',    (select rank from public.leaderboard_all_time where display_name = prof.display_name),
    'best',             (select to_jsonb(best) from best),
    'badges_collected', (select count(*) from earned),
    'badges_total',     (select count(*) from public.badges),
    'rarest_badge',     (select to_jsonb(rarest) from rarest),
    'current_streak',   (info ->> 'current')::integer,
    'longest_streak',   (info ->> 'best')::integer,
    'wheel_spins',      (select count(*) from public.wheel_spins where user_id = prof.id)
  ) into result;

  return result;
end;
$$;
revoke all on function public.player_stats(text) from public, anon;
grant execute on function public.player_stats(text) to authenticated;
