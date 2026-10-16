-- Player stats card (click a name on the leaderboard).
--
-- Other players' roll history stays private (RLS only shows today's rolls).
-- This function returns a fixed set of summary stats instead: best roll,
-- badges collected, streaks, totals. It never returns the EP wallet or the
-- full history. Signed-in players only.

create or replace function public.player_stats(target_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  prof   public.profiles;
  today  date := (now() at time zone 'utc')::date;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into prof from public.profiles where display_name = target_name;
  if not found then
    raise exception 'no such player' using errcode = 'P0001';
  end if;

  with days as (
    select distinct roll_date as d from public.rolls where user_id = prof.id
  ),
  islands as (
    select d, d - (row_number() over (order by d))::integer as grp from days
  ),
  runs as (
    select max(d) as last_day, count(*) as len from islands group by grp
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
    'current_streak',   coalesce((select len from runs where last_day >= today - 1 order by last_day desc limit 1), 0),
    'longest_streak',   coalesce((select max(len) from runs), 0),
    'wheel_spins',      (select count(*) from public.wheel_spins where user_id = prof.id)
  ) into result;

  return result;
end;
$$;
revoke all on function public.player_stats(text) from public, anon;
grant execute on function public.player_stats(text) to authenticated;
