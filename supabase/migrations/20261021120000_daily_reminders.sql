-- Daily roll reminder emails.
--
-- Every evening (pg_cron, 17:55 UTC) private.send_daily_reminders() emails
-- players who have reminders on, haven't rolled yet today and rolled at least
-- once in the last 14 days. Mail goes out through the Brevo HTTP API (pg_net),
-- in one batch request. Players opt out on the Account page or with the
-- one-click link in each email (no sign-in needed: a per-player secret token).
--
-- Setup (docs/SETUP.md): store the Brevo API key in Vault as
-- 'brevo_api_key', then set the sender and site URL in
-- private.reminder_settings and flip enabled = true. Until then nothing sends.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Settings (private: no API access)
-- ---------------------------------------------------------------------------

create table private.reminder_settings (
  id           boolean primary key default true check (id),
  enabled      boolean not null default false,
  api_url      text not null default 'https://api.brevo.com/v3/smtp/email',
  sender_email text not null default '',
  sender_name  text not null default 'Luckline',
  site_url     text not null default '',
  active_days  integer not null default 14 check (active_days between 1 and 365)
);
insert into private.reminder_settings default values;

create table private.reminder_runs (
  id         bigint generated always as identity primary key,
  ran_at     timestamptz not null default now(),
  recipients integer not null,
  request_id bigint,
  note       text
);

-- ---------------------------------------------------------------------------
-- Per-player preferences
-- ---------------------------------------------------------------------------

create table public.reminder_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  enabled    boolean not null default true,
  token      uuid not null default gen_random_uuid() unique,
  last_sent  date,
  updated_at timestamptz not null default now()
);

alter table public.reminder_prefs enable row level security;
alter table public.reminder_prefs force row level security;
revoke all on public.reminder_prefs from anon, authenticated, public;
-- The unsubscribe token is never readable through the API (column grants).
grant select (user_id, enabled) on public.reminder_prefs to authenticated;
grant update (enabled) on public.reminder_prefs to authenticated;
create policy reminder_prefs_read_own on public.reminder_prefs for select to authenticated
  using (user_id = (select auth.uid()));
create policy reminder_prefs_update_own on public.reminder_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Every player gets a row (reminders on) when their profile is created.
create or replace function private.create_reminder_prefs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reminder_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.create_reminder_prefs() from public, anon, authenticated;
create trigger profiles_create_reminder_prefs
  after insert on public.profiles
  for each row execute function private.create_reminder_prefs();

insert into public.reminder_prefs (user_id)
select id from public.profiles
on conflict do nothing;

-- One-click unsubscribe from the email link (works signed out).
create or replace function public.unsubscribe_reminders(unsubscribe_token uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.reminder_prefs set enabled = false, updated_at = now()
   where token = unsubscribe_token;
  return found;
end;
$$;
revoke all on function public.unsubscribe_reminders(uuid) from public;
grant execute on function public.unsubscribe_reminders(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------

-- Consecutive days rolled, ending on (and including) the given day.
create or replace function private.streak_ending(uid uuid, last_day date)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  n integer := 0;
begin
  while exists (select 1 from public.rolls where user_id = uid and roll_date = last_day - n) loop
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function private.streak_ending(uuid, date) from public, anon, authenticated;

-- Builds and sends one Brevo batch. only_email: send a single test email to
-- that address instead (ignores who has rolled). Returns the number of emails.
create or replace function private.send_daily_reminders(only_email text default null)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  cfg      private.reminder_settings;
  api_key  text;
  today    date := (now() at time zone 'utc')::date;
  versions jsonb;
  ids      uuid[];
  n        integer;
  req      bigint;
  html     text;
begin
  select * into cfg from private.reminder_settings;
  if only_email is null and not cfg.enabled then
    insert into private.reminder_runs (recipients, note) values (0, 'disabled');
    return 0;
  end if;
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'brevo_api_key';
  if api_key is null or cfg.sender_email = '' or cfg.site_url = '' then
    insert into private.reminder_runs (recipients, note) values (0, 'not configured');
    return 0;
  end if;

  if only_email is not null then
    versions := jsonb_build_array(jsonb_build_object(
      'to', jsonb_build_array(jsonb_build_object('email', only_email)),
      'params', jsonb_build_object('name', 'there', 'streak', '', 'unsubscribe', cfg.site_url || '/unsubscribe/')));
    ids := '{}';
  else
    with due as (
      select p.id, p.display_name, u.email, rp.token,
             private.streak_ending(p.id, today - 1) as streak
        from public.profiles p
        join auth.users u on u.id = p.id
        join public.reminder_prefs rp on rp.user_id = p.id
       where rp.enabled
         and u.email is not null
         and u.email_confirmed_at is not null
         and (rp.last_sent is null or rp.last_sent < today)
         and not exists (select 1 from public.rolls r where r.user_id = p.id and r.roll_date = today)
         and exists (select 1 from public.rolls r where r.user_id = p.id
                      and r.roll_date >= today - cfg.active_days)
       limit 1000
    )
    select jsonb_agg(jsonb_build_object(
             'to', jsonb_build_array(jsonb_build_object('email', email, 'name', display_name)),
             'params', jsonb_build_object(
               'name', display_name,
               -- Only mention a streak that's still alive (rolled yesterday).
               'streak', case when streak >= 2 then 'Keep your 🔥 ' || streak || '-day streak alive.' else '' end,
               'unsubscribe', cfg.site_url || '/unsubscribe/?token=' || token))),
           array_agg(id)
      into versions, ids
      from due;
  end if;

  n := coalesce(jsonb_array_length(versions), 0);
  if n = 0 then
    insert into private.reminder_runs (recipients, note) values (0, 'nobody due');
    return 0;
  end if;

  html := '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;background:#09090b;color:#fafafa;border-radius:16px">'
       || '<h1 style="margin:0 0 8px;font-size:24px">🎲 Your roll is waiting, {{ params.name }}</h1>'
       || '<p style="color:#d4d4d8">Today''s number is still out there. One roll, 0 to 1,000,000, and the badges are up for grabs.</p>'
       || '<p style="color:#fdba74;font-weight:600">{{ params.streak }}</p>'
       || '<p><a href="' || cfg.site_url || '/" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:12px">Roll now</a></p>'
       || '<p style="color:#71717a;font-size:12px;margin-top:24px">You get this because daily reminders are on for your Luckline account. '
       || '<a href="{{ params.unsubscribe }}" style="color:#a1a1aa">Stop these emails</a> or turn them off on your Account page.</p>'
       || '</div>';

  select net.http_post(
    url := cfg.api_url,
    headers := jsonb_build_object('api-key', api_key, 'content-type', 'application/json', 'accept', 'application/json'),
    body := jsonb_build_object(
      'sender', jsonb_build_object('email', cfg.sender_email, 'name', cfg.sender_name),
      'subject', '🎲 Your Luckline roll is waiting',
      'htmlContent', html,
      'textContent', 'Your roll is waiting, {{ params.name }}. {{ params.streak }} Roll now: ' || cfg.site_url
                     || '/  To stop these emails: {{ params.unsubscribe }}',
      'messageVersions', versions)
  ) into req;

  if array_length(ids, 1) > 0 then
    update public.reminder_prefs set last_sent = today where user_id = any (ids);
  end if;
  insert into private.reminder_runs (recipients, request_id, note)
  values (n, req, case when only_email is null then 'daily' else 'test' end);
  return n;
end;
$$;
revoke all on function private.send_daily_reminders(text) from public, anon, authenticated;

-- 17:55 UTC every day (about six hours before the daily reset).
select cron.schedule('luckline-daily-reminders', '55 17 * * *', $$select private.send_daily_reminders()$$);
