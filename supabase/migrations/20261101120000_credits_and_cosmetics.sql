-- Engagement update, part 1: EP credits, cosmetics and the shop.
--
-- * ep_credits: every EP reward that is not a roll (streak milestones, album
--   rewards, fusions, the community number, the Badge Hunt). private.grant_ep()
--   is the only way to add one; it is idempotent per (player, kind, ref), so a
--   reward can never be paid twice, and rescore_all() keeps them.
-- * Cosmetics: aura (leaderboard row effect), frame (picture ring), reveal
--   (roll colours) and name (name style). Some are bought with EP, some are
--   earned. They never change a roll, the odds or the score.
-- * reroll_tokens: free rerolls earned from rewards.
-- * rolls.free_reroll / rolls.event_bonus_ep: used by the next migration.
--
-- Security: every new table has RLS on and forced, no direct writes for
-- clients; changes go through SECURITY DEFINER functions that take the player
-- from auth.uid() and lock the wallet where EP moves.

create or replace function private.utc_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'utc')::date $$;
revoke all on function private.utc_today() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- EP credits
-- ---------------------------------------------------------------------------

create table public.ep_credits (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind ~ '^[a-z-]{1,20}$'),
  ref        text not null check (char_length(ref) between 1 and 60),
  amount     integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);

alter table public.ep_credits enable row level security;
alter table public.ep_credits force row level security;
revoke all on public.ep_credits from anon, authenticated, public;
grant select on public.ep_credits to authenticated;
create policy ep_credits_read_own on public.ep_credits for select to authenticated
  using (user_id = (select auth.uid()));

-- Adds `amt` EP to the player's wallet once per (kind, ref). Asking again with a
-- bigger amount pays only the difference (the community bonus can improve during
-- a day). Returns the EP actually added. The wallet row must exist (it does after
-- a first roll, and rewards only happen during rolls).
create or replace function private.grant_ep(uid uuid, k text, r text, amt integer)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  old   integer;
  delta integer;
begin
  if amt <= 0 then
    return 0;
  end if;
  select amount into old from public.ep_credits where user_id = uid and kind = k and ref = r for update;
  if old is null then
    insert into public.ep_credits (user_id, kind, ref, amount) values (uid, k, r, amt);
    delta := amt;
  elsif amt > old then
    update public.ep_credits set amount = amt where user_id = uid and kind = k and ref = r;
    delta := amt - old;
  else
    return 0;
  end if;
  insert into public.ep_wallets as w (user_id, earned_ep) values (uid, delta)
  on conflict (user_id) do update set earned_ep = w.earned_ep + excluded.earned_ep, updated_at = now();
  return delta;
end;
$$;
revoke all on function private.grant_ep(uuid, text, text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Free rerolls
-- ---------------------------------------------------------------------------

create table public.reroll_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  count   smallint not null default 0 check (count between 0 and 10)
);
alter table public.reroll_tokens enable row level security;
alter table public.reroll_tokens force row level security;
revoke all on public.reroll_tokens from anon, authenticated, public;
grant select on public.reroll_tokens to authenticated;
create policy reroll_tokens_read_own on public.reroll_tokens for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.rolls
  add column free_reroll    boolean not null default false,
  add column event_bonus_ep integer not null default 0 check (event_bonus_ep >= 0);

-- Rerolls now include free ones from the wheel and from tokens.
alter table public.rolls drop constraint rolls_attempt_check;
alter table public.rolls add constraint rolls_attempt_check check (attempt between 0 and 8);

-- Mark the free reroll players already took through the Lucky Wheel.
update public.rolls r
   set free_reroll = true
  from (select s.user_id, s.spin_date, max(r2.attempt) as attempt
          from public.wheel_spins s
          join public.rolls r2 on r2.user_id = s.user_id and r2.roll_date = s.spin_date
         where s.free_reroll_used
         group by s.user_id, s.spin_date) f
 where r.user_id = f.user_id and r.roll_date = f.spin_date and r.attempt = f.attempt and r.attempt > 0;

-- ---------------------------------------------------------------------------
-- Cosmetics
-- ---------------------------------------------------------------------------

create table public.cosmetics (
  id          text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  kind        text not null check (kind in ('aura', 'frame', 'reveal', 'name')),
  name        text not null,
  description text not null,
  price       integer check (price is null or price > 0),
  unlock      text,
  sort        smallint not null default 0
);

alter table public.cosmetics enable row level security;
alter table public.cosmetics force row level security;
revoke all on public.cosmetics from anon, authenticated, public;
grant select on public.cosmetics to authenticated;
create policy cosmetics_read on public.cosmetics for select to authenticated using (true);

-- price null = not for sale; unlock says how to earn it.
insert into public.cosmetics (id, kind, name, description, price, unlock, sort) values
  ('aura-ember',    'aura', 'Ember',     'Glowing sparks rise around your leaderboard row.',       2500, 'Reach 50% of the badge album.', 1),
  ('aura-void',     'aura', 'Void',      'A dark vortex circles your name.',                       1800, null, 2),
  ('aura-code',     'aura', 'Code Rain', 'Green code streams down beside your name.',              2000, null, 3),
  ('aura-storm',    'aura', 'Storm',     'Lightning crackles around your row.',                    2200, null, 4),
  ('aura-gold',     'aura', 'Gold Rush', 'Gold glints rain down around your row.',                 3000, 'Roll a boosted badge on 3 Lucky Sevens days.', 5),
  ('aura-starfall', 'aura', 'Starfall',  'Stars twinkle around your name.',                        2600, 'Roll a boosted badge on 3 Pi Days.', 6),
  ('aura-beast',    'aura', 'Beast',     'Burning embers, for those who braved Beast Day.',        null, 'Roll a boosted badge on 3 Beast Days.', 7),
  ('frame-gold',    'frame', 'Gold ring',  'A gold ring around your picture.',                     1500, null, 1),
  ('frame-neon',    'frame', 'Neon ring',  'A glowing cyan ring around your picture.',             1500, 'Roll a boosted badge on 3 Eleven Eleven days.', 2),
  ('frame-ice',     'frame', 'Ice ring',   'A frosty blue ring around your picture.',              1500, 'Roll a boosted badge on 3 New Year days.', 3),
  ('frame-flame',   'frame', 'Flame ring', 'A fiery ring around your picture.',                    1800, null, 4),
  ('frame-centurion','frame','Centurion',  'A laurel-gold frame for a 100-day streak.',            null, 'Reach a 100-day streak.', 5),
  ('frame-prism',   'frame', 'Prism',      'A shifting rainbow frame for a finished album.',       null, 'Collect 100% of the badge album.', 6),
  ('reveal-neon',   'reveal', 'Neon Nights', 'Hot pink and electric blue while your number lands.', 2000, null, 1),
  ('reveal-sunset', 'reveal', 'Sunset',      'Warm oranges and pinks while your number lands.',     2000, null, 2),
  ('reveal-ocean',  'reveal', 'Ocean',       'Cool blues and greens while your number lands.',      2000, null, 3),
  ('reveal-mono',   'reveal', 'Monochrome',  'Silver and white while your number lands.',           1200, null, 4),
  ('name-gold',     'name', 'Gold glow',   'Your name glows gold.',                                 null, 'Reach a 30-day streak.', 1),
  ('name-prism',    'name', 'Prism',       'Your name shimmers in rainbow colours.',                null, 'Fuse a badge family into a Master badge.', 2),
  ('name-hunter',   'name', 'Hunter',      'Your name glows like a trophy.',                        null, 'Win the Badge Hunt 7 times.', 3),
  ('name-neon',     'name', 'Neon',        'Your name glows hot pink.',                             1200, 'Roll a boosted badge on 3 Nice Days.', 4),
  ('name-ice',      'name', 'Ice',         'Your name glows icy blue.',                             1200, null, 5),
  ('name-ember',    'name', 'Ember',       'Your name smoulders orange.',                           1500, null, 6),
  ('name-glitch',   'name', 'Glitch',      'Your name flickers like a broken screen.',              2500, null, 7);

create table public.player_cosmetics (
  user_id     uuid not null references auth.users (id) on delete cascade,
  item_id     text not null references public.cosmetics (id),
  source      text not null check (char_length(source) between 1 and 40),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index player_cosmetics_item_idx on public.player_cosmetics (item_id);

alter table public.player_cosmetics enable row level security;
alter table public.player_cosmetics force row level security;
revoke all on public.player_cosmetics from anon, authenticated, public;
grant select on public.player_cosmetics to authenticated;
create policy player_cosmetics_read_own on public.player_cosmetics for select to authenticated
  using (user_id = (select auth.uid()));

-- What each player has equipped. Readable by every player (the leaderboard
-- shows it); writable only through equip_cosmetic() / buy_cosmetic().
alter table public.profiles
  add column aura       text references public.cosmetics (id) on delete set null,
  add column frame      text references public.cosmetics (id) on delete set null,
  add column reveal     text references public.cosmetics (id) on delete set null,
  add column name_style text references public.cosmetics (id) on delete set null;
create index profiles_aura_idx on public.profiles (aura);
create index profiles_frame_idx on public.profiles (frame);
create index profiles_reveal_idx on public.profiles (reveal);
create index profiles_name_style_idx on public.profiles (name_style);

-- Gives the player an item (no-op if they have it). True when it is new.
create or replace function private.grant_cosmetic(uid uuid, item text, src text)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  added integer;
begin
  insert into public.player_cosmetics (user_id, item_id, source) values (uid, item, src)
  on conflict (user_id, item_id) do nothing;
  get diagnostics added = row_count;
  return added > 0;
end;
$$;
revoke all on function private.grant_cosmetic(uuid, text, text) from public, anon, authenticated;

-- Sets one profile slot to an item the player owns (or clears it).
create or replace function private.set_equipped(uid uuid, k text, item text)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if k = 'aura' then update public.profiles set aura = item where id = uid;
  elsif k = 'frame' then update public.profiles set frame = item where id = uid;
  elsif k = 'reveal' then update public.profiles set reveal = item where id = uid;
  elsif k = 'name' then update public.profiles set name_style = item where id = uid;
  end if;
end;
$$;
revoke all on function private.set_equipped(uuid, text, text) from public, anon, authenticated;

-- Equip (or, with item null, unequip) a cosmetic the caller owns.
create or replace function public.equip_cosmetic(slot text, item text)
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
  if slot not in ('aura', 'frame', 'reveal', 'name') then
    raise exception 'unknown slot' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'choose a display name first' using errcode = 'P0001';
  end if;
  if item is not null then
    if not exists (
      select 1 from public.player_cosmetics pc join public.cosmetics c on c.id = pc.item_id
       where pc.user_id = uid and pc.item_id = item and c.kind = slot
    ) then
      raise exception 'you do not own that' using errcode = 'P0001';
    end if;
  end if;
  perform private.set_equipped(uid, slot, item);
end;
$$;
revoke all on function public.equip_cosmetic(text, text) from public, anon;
grant execute on function public.equip_cosmetic(text, text) to authenticated;

-- Buy a cosmetic with EP and equip it. Returns the new balance.
create or replace function public.buy_cosmetic(item text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c   public.cosmetics;
  w   public.ep_wallets;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into c from public.cosmetics where id = item;
  if not found then
    raise exception 'unknown item' using errcode = 'P0001';
  end if;
  if c.price is null then
    raise exception 'not for sale' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'choose a display name first' using errcode = 'P0001';
  end if;

  select * into w from public.ep_wallets where user_id = uid for update;
  if exists (select 1 from public.player_cosmetics where user_id = uid and item_id = item) then
    raise exception 'already owned' using errcode = 'P0001';
  end if;
  if w.user_id is null or w.balance < c.price then
    raise exception 'not enough EP' using errcode = 'P0001';
  end if;

  update public.ep_wallets set spent_ep = spent_ep + c.price, updated_at = now() where user_id = uid
  returning * into w;
  insert into public.player_cosmetics (user_id, item_id, source) values (uid, item, 'shop');
  perform private.set_equipped(uid, c.kind, item);
  return jsonb_build_object('item', item, 'kind', c.kind, 'balance', w.balance);
end;
$$;
revoke all on function public.buy_cosmetic(text) from public, anon;
grant execute on function public.buy_cosmetic(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboards show what players have equipped
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
  b.bonus_ep,
  b.avatar_path,
  b.aura,
  b.frame,
  b.name_style
from (
  select distinct on (r.user_id) r.user_id, r.number, r.ep, r.tier, r.multiplier, r.bonus_ep,
         r.created_at, p.display_name, p.avatar_path, p.aura, p.frame, p.name_style
  from public.rolls r
  join public.profiles p on p.id = r.user_id
  where r.roll_date = ((now() at time zone 'utc')::date)
  order by r.user_id, r.ep desc, r.created_at
) b;

create or replace view public.leaderboard_all_time
with (security_invoker = true) as
select
  rank() over (order by t.total_ep desc, t.updated_at) as rank,
  p.display_name,
  t.total_ep,
  t.best_ep,
  t.roll_count,
  p.avatar_path,
  p.aura,
  p.frame,
  p.name_style
from public.leaderboard_totals t
join public.profiles p on p.id = t.user_id;

revoke all on public.leaderboard_today, public.leaderboard_all_time from anon, authenticated, public;
grant select on public.leaderboard_today, public.leaderboard_all_time to authenticated;
