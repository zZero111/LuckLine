# Security tests: Luckline MVP

Run on 2026-10-15 against the local Supabase stack and a production build
(`next build && next start`). Sources:

- **ATK**: the scripted attack suite (`npm run test:attacks`, `security/attacks.ts`).
- **SCAN**: advisors, lint, secret search, npm audit and build-output search.
- **FE**: a black-box tester that never saw the source.
- **E2E**: a manual end-to-end browser run.

Result after the fix round: **no open Critical or High findings.** The attack suite was re-run after fixes and passed 11/11. Supabase `db lint` reports no errors, and `db advisors` reports only INFO items.

## Findings

| id | severity | what happened | status |
|---|---|---|---|
| ATK-01 | — | Signed-out reads of rolls, profiles, number_stats, roll_badges, leaderboard_totals, both views and `auth.users` all denied | Pass |
| ATK-02 | — | Signed-out cannot call `roll_today` or `delete_my_account` (no EXECUTE for anon) | Pass |
| ATK-03 | — | Player insert/update/upsert/delete on rolls, roll_badges, leaderboard_totals, ep_wallets, badges, number_stats: all denied, row counts unchanged | Pass |
| ATK-04 | — | Player A cannot update, delete or impersonate player B's profile | Pass |
| ATK-05 | — | Second `roll_today` on the same UTC day fails ("already rolled today") | Pass |
| ATK-06 | — | 20 parallel `roll_today` calls by one player leave exactly 1 row (UNIQUE(user_id, roll_date)) | Pass |
| ATK-07 | — | `roll_today` takes no arguments; `{number: 7}`, `{n: 7}` and GET `?number=7` all fail; no overloads exist | Pass |
| ATK-08 | — | Both views are `security_invoker = true`; anon has no SELECT on them | Pass |
| ATK-09 | — | Player A cannot read B's past rolls or any of B's roll_badges (only today's leaderboard rows are visible) | Pass |
| ATK-10 | — | Players cannot change their profile `id` or `created_at` (column-level grants) | Pass |
| ATK-11 | — | Display names containing HTML, quotes or control characters are rejected by the check constraint | Pass |
| ATK-12 | — | (EP rework) Signed-out cannot call `reroll_today`; a player reads only their own `ep_wallets` row; `private.*` helpers (`record_roll`, `rescore_all`, price/limit) are not executable by clients | Pass |
| ATK-13 | — | (EP rework) Reroll before rolling or with 99 EP fails and changes nothing; `reroll_today` takes no arguments and has no overloads | Pass |
| ATK-14 | — | (EP rework) 20 parallel rerolls by a player with 1M EP: exactly 3 succeed, `spent_ep` grows by exactly 300, EP earned matches the rolls, the day's score is its best roll, and the player shows once on today's leaderboard | Pass |
| ATK-15 | — | (Lucky Wheel) Signed-out cannot spin; spinning before rolling fails; `spin_wheel` takes no arguments (prize, multiplier) and has no overloads; 20 parallel spins give exactly one; players can't read others' spins or write `wheel_spins`, `wheel_prizes` or a roll's `multiplier` | Pass |
| ATK-16 | — | (Lucky Wheel) 3× turns a 40-EP roll into 120 in the roll, wallet and leaderboard; "lose half" with 10 EP left ends at 0 EP, never negative; a free reroll works with 0 EP, costs nothing and still leaves all 3 paid rerolls; `rescore_all()` keeps multipliers | Pass |
| ATK-17 | — | (Avatars) Players upload only into their own Storage folder; HTML, SVG, `.html` names, path traversal, files over 5 MB and signed-out uploads are rejected; a player can't delete another's file, point their `avatar_path` at someone else's file, or change `avatar_locked`; public avatar URLs serve `image/*` | Pass |
| ATK-18 | — | (Avatars) Only admins can call `admin_remove_avatar` or read/write `admins`; an admin removal clears the path, deletes the file and locks the player (re-upload and re-pointing both fail); deleting an account with a picture on file still works | Pass |
| E2E-01 | — | Magic link → confirm page (button, no GET verification) → display name → roll → leaderboard → profile works; a reused link shows "Link expired or already used" | Pass |
| E2E-02 | Low | Header kept showing "Choose a name" after sign-in or name creation (stale cached layout) | Fixed: `revalidatePath('/', 'layout')` in auth actions |
| E2E-03 | Low | `upgrade-insecure-requests` and HSTS broke local HTTP calls to Supabase in `next start` | Fixed: only sent when the Supabase URL is HTTPS |
| FE-01 | Low (reported as High) | A signed-in user can read every player's rolls for **today** through REST, including `user_id` and `created_at`. The tester said past rolls leaked too; that was not reproduced (past-dated fixture rows stayed hidden), so this is the intended Today-leaderboard access | Accepted; follow-up below |
| FE-02 | Low | A signed-in user can read all profiles (`id`, `display_name`, `created_at`). No email or other private data | Accepted; follow-up below |
| FE-03…FE-15 | — | Email exposure, double roll, choosing the number, parameter injection, cross-user writes, stored XSS, open redirect, Host-header injection into the magic link, GET-only sign-in, anon RPC, admin endpoints, security headers: all blocked or passing | Pass |
| SCAN-01 | High (dev-only) | `npm audit`: `braces` ≤3.0.3 stack-exhaustion DoS via `eslint-config-next` → `fast-glob`. No patched `braces` exists; the suggested fix is a downgrade to `eslint-config-next@14`, which is incompatible with Next 16. Only reachable through ESLint globs we write ourselves; `npm audit --omit=dev` reports 0 | Accepted risk; revisit when a fixed version ships |
| SCAN-02 | Low | `security/attacks.ts` has fallback values for the local CLI's well-known default publishable key and DB URL | Accepted (local defaults, not secrets) |
| SCAN-03 | Info | Advisor: `number_stats` has RLS with no policies | Intended: deny-all to clients |
| SCAN-04 | Info | Advisor: unindexed FK `roll_badges.badge_id` | Fixed: index added in migration |
| SCAN-05 | Info | Advisor: unused indexes on a fresh DB | No action |
| SCAN-06 | Info | Build was made against local env; CSP `connect-src` follows `NEXT_PUBLIC_SUPABASE_URL` | Rebuild with hosted env when deploying |
| SCAN-07 | Medium | CSP uses `'unsafe-inline'` for scripts and styles (static headers, no nonces) | Follow-up |
| SCAN-08 | — | No `sb_secret_` key, JWT, DB password or private key in git history or `.next` output (string literals in supabase-js only); only `.env.example` (empty) is tracked | Pass |
| SCAN-09 | — | gitleaks could not run (Docker Hub rate limit); a regex sweep over `git log -p --all` was used instead | Re-run gitleaks in GitHub secret scanning |

## Follow-ups (Medium / Low)

1. **SCAN-07**: the static export cannot use per-request nonces. Drop `'unsafe-inline'` from `script-src` only if Next can emit hash-based inline scripts; otherwise accept it.
2. **FE-01**: expose today's leaderboard without `user_id`. Options: revoke the column with column grants plus an own-rows function for history, or serve "today" from a `leaderboard_today` table filled by `roll_today()`.
3. **FE-02**: limit `profiles` SELECT to `id, display_name` via column grants, or move the leaderboard join into a definer function so `profiles` can be own-row only.
4. **SCAN-01**: track `braces` / `eslint-config-next` for a fixed release.
5. Wire CAPTCHA into the login form once it is enabled in the dashboard (see docs/SETUP.md).
6. Tier "trash" is empty: 25.7% of numbers score 0 EP, so the bottom 1% cannot be separated. Decide on a rule (for example "0 EP = trash") if you want it populated.

## Static export on GitHub Pages (changes after the security passes above)

The attack suite and scans above ran against the earlier server-rendered build.
The static export was written without being able to install dependencies or run
the build, so it has not been re-tested. Before relying on it, re-run
`npm run test:attacks` against a local stack and open the deployed site.

| ID | Severity | What changed | Status |
|---|---|---|---|
| STATIC-01 | Medium | GitHub Pages cannot send `X-Frame-Options`, `frame-ancestors`, `nosniff` or HSTS. CSP and referrer policy are set with `<meta>` tags only. | Accepted |
| STATIC-02 | Medium | Session token is in localStorage, readable by any script that runs on the page. | Accepted; display names are plain text |
| STATIC-03 | Low | All sites under `zzero111.github.io` share one browser origin and storage. | Accepted; do not host untrusted apps there |
