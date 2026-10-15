# Luckline: manual setup checklist

Everything here needs a person with dashboard access. Nothing in this repo
holds the hosted secret key or database password, and none should.

## 1. Local development

```bash
npm install
npx supabase start                 # prints the local URL + publishable key
cp .env.example .env.local         # fill in the two local values
npx supabase db reset              # applies migrations + supabase/seed.sql (badges)
npm run precompute                 # writes supabase/seed/number_stats.csv (~24 MB, gitignored)
psql "$(npx supabase status -o env | sed -n 's/^DB_URL=\"\(.*\)\"$/\1/p')" \
  -c "\copy public.number_stats from 'supabase/seed/number_stats.csv' csv"
npm run dev                        # http://127.0.0.1:3000; magic-link mail at http://127.0.0.1:54324
```

`roll_today()` raises `number_stats is not loaded` until the CSV is loaded.

## 2. Hosted database: schema, badges and number_stats

> **Only build the hosted database from this repo's migration**
> (`supabase/migrations/20261015120000_init_schema.sql`). The app expects its exact
> tables, views (`leaderboard_today`, `leaderboard_all_time`, `leaderboard_totals`)
> and the `roll_today()` return shape. If a different schema script was run in the
> SQL Editor first, remove those objects before applying this one.


Run these yourself. Use the **Session pooler** or direct connection string
from Dashboard → Connect. Let psql prompt for the password; don't put it in
shell history or in this repo.

```bash
npx supabase db push                                   # applies supabase/migrations
npm run precompute                                     # regenerates seed.sql + CSV
export LUCKLINE_DB="postgresql://postgres.<project-ref>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
psql "$LUCKLINE_DB" -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql "$LUCKLINE_DB" -v ON_ERROR_STOP=1 \
  -c "\copy public.number_stats from 'supabase/seed/number_stats.csv' csv"
psql "$LUCKLINE_DB" -Atc "select (select count(*) from public.badges), (select count(*) from public.number_stats)"
# expect: 96|1000001
```

Badge ids are stable, so if you change the badges later, write a new
migration. Don't edit the hosted tables by hand.

### Upgrading a live database to the EP rework (96 badges, families, rerolls)

For a project that is already running the original 30-badge version. Existing
rolls are kept and rescored with the new EP values; every player's wallet starts
with all the EP their past rolls earn under the new scale.

```bash
git pull && npm ci
npx supabase db push        # applies 20261016120000_ep_rework_and_rerolls.sql
npm run precompute          # regenerates supabase/seed.sql and the CSV (about 15 s)

# One transaction: new badges, new number_stats, rescore everything.
# If any step fails, nothing changes.
psql "$LUCKLINE_DB" -1 -v ON_ERROR_STOP=1 \
  -f supabase/seed.sql \
  -c "truncate public.number_stats" \
  -c "\copy public.number_stats from 'supabase/seed/number_stats.csv' csv" \
  -c "select private.rescore_all()"

psql "$LUCKLINE_DB" -Atc "select (select count(*) from public.badges), (select count(*) from public.number_stats), (select count(*) from public.ep_wallets)"
# expect: 96|1000001|<number of players who have rolled>
```

Then merge the PR so the new site deploys. Between `db push` and the psql
transaction (a minute or two) rolls still work and are rescored by
`rescore_all()`; the old site keeps working against the new schema until the
new one deploys.

### Adding the Lucky Wheel

One migration, no data to load:

```bash
git pull && npm ci
npx supabase db push        # applies 20261017120000_lucky_wheel.sql
```

Then merge the PR. Existing rolls are untouched (each gets `multiplier = 1`).
Prizes and odds live in `public.wheel_prizes` (the `weight` column; weights are
relative, currently out of 1,000). Change them with a new migration.

### Adding profile pictures

One migration:

```bash
git pull && npm ci
npx supabase db push        # applies 20261018120000_avatars.sql (creates the "avatars" bucket)
```

Then merge the PR.

**Make yourself an admin** so you can remove pictures. In the dashboard's SQL
Editor, with the email you sign in with:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

Admins see a 🗑 button next to every picture on the leaderboard. Removing a
picture also stops that player uploading a new one. To let them upload again:

```sql
update public.profiles set avatar_locked = false where display_name = 'TheirName';
```

To remove an admin: `delete from public.admins where user_id = (select id from auth.users where email = 'you@example.com');`

Reroll price and daily limit live in the database (`private.reroll_price()`,
`private.max_rerolls()`, currently 100 EP and 3 per day). Change them with a
new migration that redefines those two functions; the UI reads them through
`reroll_terms()`.

## 3. Supabase dashboard

| Area | Setting |
|---|---|
| Project Settings → API Keys | Use the **publishable** key (`sb_publishable_…`) as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The app never uses a secret key. Disable the legacy JWT `anon`/`service_role` keys once nothing uses them. |
| Database → Settings → SSL | Turn on **Enforce SSL on incoming connections**. |
| Database → Settings → Network restrictions | Restrict direct DB access to the IPs you run psql/CI from. |
| Auth → Sign In / Providers → Email | Email provider on. **Confirm email** on. **Email OTP expiration = 300** seconds. |
| Auth → Email Templates → Magic Link *and* Confirm signup | Replace the link with `{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=email` (see `supabase/templates/magic_link.html`). The local `config.toml` setting is **not** pushed to the hosted project. |
| Auth → SMTP | Configure custom SMTP. The built-in sender is rate-limited and for testing only. |
| Auth → Attack Protection | Enable CAPTCHA (hCaptcha or Turnstile). The app does not send a captcha token yet, so wiring it into the login form is a follow-up. |
| Auth → Rate Limits | Lower the email-sending and OTP verification limits (for example 30 emails/hour, 30 verifications per 5 min per IP). |
| Auth → URL Configuration | **Site URL** = `https://zzero111.github.io/RNGdle-2` (no trailing slash). **Redirect URLs**: exactly `https://zzero111.github.io/RNGdle-2/auth/confirm/` and nothing else. No wildcards. Local addresses belong in `supabase/config.toml` for the local stack only, not on the hosted project. |
| Organization → Team | At least **two Owners** with MFA enabled. |
| Database → Backups | Confirm daily backups are on; consider PITR. |

Build settings: the GitHub Pages workflow reads `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from **GitHub → Settings → Secrets and
variables → Actions → Variables** (they are public values, so Variables is fine).
The workflow itself sets `NEXT_PUBLIC_BASE_PATH=/RNGdle-2`. Never add a secret key
or the database password there.

## 4. GitHub

- Settings → Branches: protect the default branch (require a PR, at least 1 approval, no force pushes, no deletion).
- Settings → Code security: enable **Secret scanning** and **Push protection**.
- Enable **Dependabot alerts** and **Dependabot security updates**.
- Settings → Pages → **Build and deployment → Source: GitHub Actions**.
  `.github/workflows/deploy-pages.yml` builds the static site and deploys it to
  `https://zzero111.github.io/RNGdle-2/` on every push to the default branch.
  Pull requests build and test only. Free GitHub plans need a public repo for Pages.

## 5. Static hosting: what changed and what is lost

The app is a static export: there is no server. Sign-in, the roll and all data
calls run in the browser against Supabase, and Row Level Security in the
database is the protection. Compared with a server-hosted app:

- GitHub Pages cannot send HTTP headers. The Content-Security-Policy and the
  referrer policy are set with `<meta>` tags. `frame-ancestors`, `X-Frame-Options`,
  `X-Content-Type-Options` and `Strict-Transport-Security` cannot be set this way.
- The session token is kept in the browser's localStorage, so a script injected
  into a page could read it. Display names are rendered as plain text for that reason.
- Every site under the same `github.io` account shares one browser origin and
  its storage. Do not host other apps on `zzero111.github.io` that you do not trust.
