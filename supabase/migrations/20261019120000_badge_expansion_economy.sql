-- Badge expansion (96 -> 369 badges) rebalancing.
--
-- With more badges a typical roll is worth more (median 12 -> 74 EP, average
-- 93 -> 356 EP), so prices and prizes scale with it:
--   * reroll price 100 -> 400 EP (about one average roll, as before)
--   * Lucky Wheel bonus prize +50 -> +200 EP
-- The new badges themselves are data: load them with supabase/seed.sql and
-- number_stats, then run private.rescore_all() (see docs/SETUP.md).

create or replace function private.reroll_price() returns integer
language sql immutable set search_path = '' as $$ select 400 $$;
revoke all on function private.reroll_price() from public, anon, authenticated;

update public.wheel_prizes
   set slug = 'bonus-ep', label = '+200 EP', value = 200
 where slug = 'bonus-50';
