-- Profile pictures: player uploads plus admin removal.
--
-- * Files live in the public Storage bucket "avatars" at <user id>/<name>.
--   Storage policies let a player write only inside their own folder.
--   The bucket accepts PNG, JPEG and WebP up to 5 MB (SVG is not allowed:
--   it can carry scripts). The site shrinks images to 256x256 before upload.
-- * profiles.avatar_path points at the player's current file and must sit in
--   their own folder.
-- * Admins (public.admins, managed with SQL only) can remove any avatar.
--   admin_remove_avatar() clears the path and locks the player's avatar so it
--   can't be re-uploaded; unlock with
--     update public.profiles set avatar_locked = false where display_name = '…';

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.admins force row level security;
revoke all on public.admins from anon, authenticated, public;
-- No policies: nobody reads or writes this table through the API.

create or replace function private.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = uid) $$;
revoke all on function private.is_admin(uuid) from public, anon;
-- Storage policies run as the requesting user, so they need to call this.
grant usage on schema private to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_admin(auth.uid()) $$;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column avatar_path text,
  add column avatar_locked boolean not null default false;

alter table public.profiles add constraint profiles_avatar_path_check check (
  avatar_path is null
  or (avatar_path ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,40}\.(webp|png|jpg)$'
      and split_part(avatar_path, '/', 1) = id::text)
);
alter table public.profiles add constraint profiles_avatar_locked_check
  check (not avatar_locked or avatar_path is null);

-- Players may set their own avatar_path (RLS already limits updates to their
-- own row); avatar_locked is admin-only.
grant update (avatar_path) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket and policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,40}\.(webp|png|jpg)$'
    and not exists (select 1 from public.profiles p
                    where p.id = (select auth.uid()) and p.avatar_locked)
  );

create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_select_own_or_admin on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or private.is_admin((select auth.uid())))
  );

create policy avatars_delete_own_or_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or private.is_admin((select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- Admin removal
-- ---------------------------------------------------------------------------

-- Clears a player's avatar and locks it. Returns the removed file path so the
-- admin's browser can delete the file from Storage (allowed by the policy above).
create or replace function public.admin_remove_avatar(target_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed text;
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.profiles p
     set avatar_path = null, avatar_locked = true
    from (select id, avatar_path from public.profiles where display_name = target_name) old
   where p.id = old.id
  returning old.avatar_path into removed;
  if not found then
    raise exception 'no such player' using errcode = 'P0001';
  end if;
  return removed;
end;
$$;
revoke all on function public.admin_remove_avatar(text) from public, anon;
grant execute on function public.admin_remove_avatar(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboards carry the avatar
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
  b.avatar_path
from (
  select distinct on (r.user_id) r.user_id, r.number, r.ep, r.tier, r.multiplier, r.bonus_ep,
         r.created_at, p.display_name, p.avatar_path
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
  p.avatar_path
from public.leaderboard_totals t
join public.profiles p on p.id = t.user_id;

revoke all on public.leaderboard_today, public.leaderboard_all_time from anon, authenticated, public;
grant select on public.leaderboard_today, public.leaderboard_all_time to authenticated;
