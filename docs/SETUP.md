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
# expect: 30|1000001
```

Badge ids are stable, so if you change the badges later, write a new
migration. Don't edit the hosted tables by hand.

## 3. Supabase dashboard

| Area | Setting |
|---|---|
| Project Settings → API Keys | Use the **publishable** key (`sb_publishable_…`) as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The app never uses a secret key. Disable the legacy JWT `anon`/`service_role` keys once nothing uses them. |
| Database → Settings → SSL | Turn on **Enforce SSL on incoming connections**. |
| Database → Settings → Network restrictions | Restrict direct DB access to the IPs you run psql/CI from. |
| Auth → Sign In / Providers → Email | Email provider on. **Confirm email** on. **Email OTP expiration = 300** seconds. |
| Auth → Email Templates → Magic Link *and* Confirm signup | Replace the link with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (see `supabase/templates/magic_link.html`). The local `config.toml` setting is **not** pushed to the hosted project. |
| Auth → SMTP | Configure custom SMTP. The built-in sender is rate-limited and for testing only. |
| Auth → Attack Protection | Enable CAPTCHA (hCaptcha or Turnstile). The app does not send a captcha token yet, so wiring it into the login form is a follow-up. |
| Auth → Rate Limits | Lower the email-sending and OTP verification limits (for example 30 emails/hour, 30 verifications per 5 min per IP). |
| Auth → URL Configuration | **Site URL** = your default hosting URL (e.g. `https://<app>.vercel.app`). **Redirect URLs**: exact entries only, `https://<app>.vercel.app/auth/confirm`. No wildcards and no preview domains. |
| Organization → Team | At least **two Owners** with MFA enabled. |
| Database → Backups | Confirm daily backups are on; consider PITR. |

Hosting env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
and `NEXT_PUBLIC_SITE_URL` (your exact default URL, used to build the
magic-link redirect). Nothing else.

## 4. GitHub

- Settings → Branches: protect `main` (require a PR, at least 1 approval, no force pushes, no deletion).
- Settings → Code security: enable **Secret scanning** and **Push protection**.
- Enable **Dependabot alerts** and **Dependabot security updates**.
- `.github/workflows/static.yml` (GitHub Pages deploy of the old static
  prototype) uploads the whole repository as a static site. Delete it or
  replace it now that the app is Next.js.
