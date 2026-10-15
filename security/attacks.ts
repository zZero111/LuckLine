/**
 * Luckline security attack suite.
 *
 * Runs against a local Supabase stack using only the publishable key and real
 * user tokens obtained through the public Auth API. psql (as postgres) is used
 * only for read-only verification queries and for one backdated test fixture
 * (ATK-09).
 *
 *   npx tsx security/attacks.ts      (or: npm run test:attacks)
 *
 * Env overrides: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DATABASE_URL.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Untyped client on purpose: attacks pass arguments the generated types forbid.
type Client = SupabaseClient;

const results: { id: string; ok: boolean; detail: string }[] = [];

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${detail}`);
}

/** Collects sub-assertions for one check id and records a single result. */
class Check {
  private failures: string[] = [];
  private passes = 0;
  constructor(private id: string, private title: string) {}
  expect(cond: boolean, what: string) {
    if (cond) this.passes++;
    else this.failures.push(what);
  }
  done() {
    const ok = this.failures.length === 0;
    record(
      this.id,
      ok,
      ok
        ? `${this.title} (${this.passes} assertions)`
        : `${this.title}\n      - ${this.failures.join("\n      - ")}`,
    );
  }
}

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

const rnd = () => randomBytes(5).toString("hex");

function newClient(): Client {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function newPlayer(label: string): Promise<{ client: Client; id: string; name: string }> {
  const client = newClient();
  const email = `atk_${label}_${rnd()}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: `Pw-${rnd()}-${rnd()}` });
  if (error || !data.session || !data.user) {
    throw new Error(`signUp for ${label} failed: ${error?.message ?? "no session returned"}`);
  }
  const name = `atk_${rnd()}`;
  const ins = await client.from("profiles").insert({ id: data.user.id, display_name: name });
  if (ins.error) throw new Error(`profile insert for ${label} failed: ${ins.error.message}`);
  return { client, id: data.user.id, name };
}

/** True when a PostgREST read was denied: an error, or zero rows. */
function deniedRead(res: { error: unknown; data: unknown }): boolean {
  if (res.error) return true;
  return Array.isArray(res.data) ? res.data.length === 0 : res.data == null;
}

function describe(res: { error: { message?: string; code?: string } | null; data: unknown }) {
  if (res.error) return `error ${res.error.code ?? ""} ${res.error.message ?? ""}`.trim();
  return `data=${JSON.stringify(res.data)?.slice(0, 160)}`;
}

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const anon = newClient();
  const A = await newPlayer("a");
  const B = await newPlayer("b");

  const rA = await A.client.rpc("roll_today");
  const rB = await B.client.rpc("roll_today");
  if (rA.error || rB.error) {
    throw new Error(`setup roll failed: A=${rA.error?.message} B=${rB.error?.message}`);
  }
  const bTodayRollId = Number(
    psql(`select id from public.rolls where user_id = ${sqlStr(B.id)} and roll_date = (now() at time zone 'utc')::date`),
  );

  // ---------------------------------------------------------------- ATK-01
  {
    const c = new Check("ATK-01", "signed-out cannot read game tables, views or auth.users");
    for (const t of [
      "rolls",
      "profiles",
      "number_stats",
      "roll_badges",
      "leaderboard_totals",
      "ep_wallets",
      "wheel_spins",
      "leaderboard_today",
      "leaderboard_all_time",
    ]) {
      const res = await anon.from(t).select("*").limit(5);
      c.expect(deniedRead(res), `anon select ${t}: ${describe(res)}`);
    }
    const au = await anon.schema("auth").from("users").select("*").limit(1);
    c.expect(deniedRead(au), `anon .schema('auth').from('users'): ${describe(au)}`);
    for (const path of ["/rest/v1/users", "/rest/v1/users?select=*"]) {
      const r = await fetch(URL + path, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      const body = await r.text();
      let rows = -1;
      try {
        const j = JSON.parse(body);
        rows = Array.isArray(j) ? j.length : -1;
      } catch {}
      c.expect(!r.ok || rows === 0, `anon GET ${path}: HTTP ${r.status} ${body.slice(0, 120)}`);
    }
    const r2 = await fetch(URL + "/rest/v1/users", {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "auth" },
    });
    c.expect(!r2.ok, `anon GET /rest/v1/users with Accept-Profile: auth: HTTP ${r2.status}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-02
  {
    const c = new Check("ATK-02", "signed-out cannot call roll_today or delete_my_account");
    const r1 = await anon.rpc("roll_today");
    c.expect(!!r1.error, `anon rpc roll_today: ${describe(r1)}`);
    const r2 = await anon.rpc("delete_my_account");
    c.expect(!!r2.error, `anon rpc delete_my_account: ${describe(r2)}`);
    for (const fn of ["roll_today", "delete_my_account"]) {
      const priv = psql(`select has_function_privilege('anon', 'public.${fn}()', 'EXECUTE')`);
      c.expect(priv === "f", `anon has EXECUTE on ${fn}()`);
    }
    const users = psql(`select count(*) from auth.users where id in (${sqlStr(A.id)}, ${sqlStr(B.id)})`);
    c.expect(users === "2", `players A/B missing after anon delete_my_account: ${users}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-03
  {
    const c = new Check(
      "ATK-03",
      "player cannot write rolls, roll_badges, leaderboard_totals, badges or number_stats",
    );
    const snap = () =>
      psql(`select md5(string_agg(x, '|' order by x)) from (
        select 'r'||id||user_id||roll_date||number||ep||tier as x from public.rolls where user_id in (${sqlStr(A.id)}, ${sqlStr(B.id)})
        union all select 'rb'||rb.roll_id||'-'||rb.badge_id from public.roll_badges rb join public.rolls r on r.id = rb.roll_id where r.user_id in (${sqlStr(A.id)}, ${sqlStr(B.id)})
        union all select 'lt'||user_id||total_ep||best_ep||roll_count from public.leaderboard_totals where user_id in (${sqlStr(A.id)}, ${sqlStr(B.id)})
        union all select 'w'||user_id||earned_ep||spent_ep from public.ep_wallets where user_id in (${sqlStr(A.id)}, ${sqlStr(B.id)})
        union all select 'b'||id||slug||name||ep||probability from public.badges
        union all select 'ns'||number||ep||tier||badge_ids::text from public.number_stats where number in (0, 7, 777777, 1000000)
      ) s`);
    const counts = () =>
      psql(
        "select (select count(*) from public.rolls)||','||(select count(*) from public.roll_badges)||','||(select count(*) from public.leaderboard_totals)||','||(select count(*) from public.badges)||','||(select count(*) from public.number_stats)",
      );
    const s0 = snap();
    const c0 = counts();
    const aRoll = psql(`select id from public.rolls where user_id = ${sqlStr(A.id)} limit 1`);
    const badgeId = Number(psql("select min(id) from public.badges"));
    const today = new Date().toISOString().slice(0, 10);
    const db = A.client;

    type Attempt = [string, PromiseLike<{ error: { message: string; code?: string } | null; data: unknown; count?: number | null }>];
    const attempts: Attempt[] = [
      ["insert rolls (other date)", db.from("rolls").insert({ user_id: A.id, roll_date: "2001-01-01", number: 1000000, ep: 999999, tier: "mythic" }).select()],
      ["insert rolls (today, B)", db.from("rolls").insert({ user_id: B.id, roll_date: today, number: 1, ep: 1, tier: "trash" }).select()],
      ["update own rolls ep", db.from("rolls").update({ ep: 999999, number: 777777 }).eq("user_id", A.id).select()],
      ["update all rolls", db.from("rolls").update({ ep: 0 }).gte("id", 0).select()],
      ["delete own rolls", db.from("rolls").delete().eq("user_id", A.id).select()],
      ["delete B rolls", db.from("rolls").delete().eq("user_id", B.id).select()],
      ["insert roll_badges", db.from("roll_badges").insert({ roll_id: Number(aRoll), badge_id: badgeId }).select()],
      ["update roll_badges", db.from("roll_badges").update({ badge_id: badgeId }).gte("roll_id", 0).select()],
      ["delete roll_badges", db.from("roll_badges").delete().gte("roll_id", 0).select()],
      ["insert leaderboard_totals", db.from("leaderboard_totals").insert({ user_id: A.id, total_ep: 9e9 }).select()],
      ["upsert leaderboard_totals", db.from("leaderboard_totals").upsert({ user_id: A.id, total_ep: 9e9, best_ep: 999999, roll_count: 1 }).select()],
      ["update leaderboard_totals", db.from("leaderboard_totals").update({ total_ep: 9e9 }).eq("user_id", A.id).select()],
      ["delete leaderboard_totals (B)", db.from("leaderboard_totals").delete().eq("user_id", B.id).select()],
      ["insert ep_wallets", db.from("ep_wallets").insert({ user_id: A.id, earned_ep: 9e9 }).select()],
      ["upsert ep_wallets", db.from("ep_wallets").upsert({ user_id: A.id, earned_ep: 9e9, spent_ep: 0 }).select()],
      ["update own ep_wallets", db.from("ep_wallets").update({ earned_ep: 9e9, spent_ep: 0 }).eq("user_id", A.id).select()],
      ["delete B ep_wallets", db.from("ep_wallets").delete().eq("user_id", B.id).select()],
      ["insert badges", db.from("badges").insert({ id: 32000, slug: "atk-x", name: "x", emoji: "x", description: "x", rarity: "mythic", probability: 1, ep: 1 }).select()],
      ["update badges", db.from("badges").update({ ep: 999999 }).gte("id", 0).select()],
      ["delete badges", db.from("badges").delete().gte("id", 0).select()],
      ["insert number_stats", db.from("number_stats").insert({ number: 1000000, ep: 1, tier: "trash" }).select()],
      ["update number_stats", db.from("number_stats").update({ ep: 999999, tier: "mythic" }).gte("number", 0).select()],
      ["delete number_stats", db.from("number_stats").delete().eq("number", 7).select()],
    ];
    for (const [label, p] of attempts) {
      const res = await p;
      const affected = Array.isArray(res.data) ? res.data.length : 0;
      c.expect(!!res.error || affected === 0, `${label}: ${describe(res)}`);
    }
    // Same but signed-out.
    const anonIns = await anon.from("rolls").insert({ user_id: A.id, number: 1, ep: 1, tier: "x" }).select();
    c.expect(!!anonIns.error, `anon insert rolls: ${describe(anonIns)}`);
    const anonBadge = await anon.from("badges").update({ ep: 1 }).gte("id", 0).select();
    c.expect(!!anonBadge.error || (anonBadge.data ?? []).length === 0, `anon update badges: ${describe(anonBadge)}`);

    const s1 = snap();
    const c1 = counts();
    c.expect(s0 === s1, `data fingerprint changed: ${s0} -> ${s1}`);
    c.expect(c0 === c1, `row counts changed: ${c0} -> ${c1}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-04
  {
    const c = new Check("ATK-04", "A cannot update/delete B's profile or insert one with B's id");
    const before = psql(`select display_name||'|'||created_at from public.profiles where id = ${sqlStr(B.id)}`);
    const up = await A.client.from("profiles").update({ display_name: `pwn_${rnd()}` }).eq("id", B.id).select();
    c.expect(!!up.error || (up.data ?? []).length === 0, `update B profile: ${describe(up)}`);
    const del = await A.client.from("profiles").delete().eq("id", B.id).select();
    c.expect(!!del.error || (del.data ?? []).length === 0, `delete B profile: ${describe(del)}`);
    const ins = await A.client.from("profiles").insert({ id: B.id, display_name: `pwn_${rnd()}` }).select();
    c.expect(!!ins.error, `insert profile with B id: ${describe(ins)}`);
    const ups = await A.client
      .from("profiles")
      .upsert({ id: B.id, display_name: `pwn_${rnd()}` }, { onConflict: "id" })
      .select();
    c.expect(!!ups.error || (ups.data ?? []).length === 0, `upsert profile with B id: ${describe(ups)}`);
    const delOwn = await A.client.from("profiles").delete().eq("id", A.id).select();
    c.expect(!!delOwn.error || (delOwn.data ?? []).length === 0, `delete own profile (no delete grant): ${describe(delOwn)}`);
    const after = psql(`select display_name||'|'||created_at from public.profiles where id = ${sqlStr(B.id)}`);
    c.expect(before === after && after !== "", `B profile changed: ${before} -> ${after}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-05
  {
    const c = new Check("ATK-05", "second roll_today on the same day fails");
    const again = await A.client.rpc("roll_today");
    c.expect(!!again.error, `second roll_today: ${describe(again)}`);
    const n = psql(`select count(*) from public.rolls where user_id = ${sqlStr(A.id)}`);
    c.expect(n === "1", `A has ${n} rolls rows`);
    const lt = psql(`select roll_count from public.leaderboard_totals where user_id = ${sqlStr(A.id)}`);
    c.expect(lt === "1", `A leaderboard roll_count = ${lt}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-06
  {
    const c = new Check("ATK-06", "20 parallel roll_today calls by fresh player C leave one row");
    const C = await newPlayer("c");
    const res = await Promise.all(Array.from({ length: 20 }, () => C.client.rpc("roll_today")));
    const ok = res.filter((r) => !r.error).length;
    c.expect(ok === 1, `${ok} of 20 calls succeeded (errors: ${[...new Set(res.filter((r) => r.error).map((r) => r.error!.message))].join("; ")})`);
    const own = await C.client.from("rolls").select("id,roll_date").eq("user_id", C.id);
    c.expect(!own.error && own.data?.length === 1, `C reads own rolls: ${describe(own)}`);
    const n = psql(`select count(*) from public.rolls where user_id = ${sqlStr(C.id)}`);
    c.expect(n === "1", `psql count of C rolls = ${n}`);
    const lt = psql(`select roll_count from public.leaderboard_totals where user_id = ${sqlStr(C.id)}`);
    c.expect(lt === "1", `C leaderboard roll_count = ${lt}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-07
  {
    const c = new Check("ATK-07", "roll_today accepts no number argument and has no overloads");
    const D = await newPlayer("d");
    for (const args of [{ number: 7 }, { n: 7 }, { number: 1000000 }]) {
      const r = await D.client.rpc("roll_today", args);
      c.expect(!!r.error, `rpc roll_today(${JSON.stringify(args)}): ${describe(r)}`);
    }
    const g = await fetch(`${URL}/rest/v1/rpc/roll_today?number=7`, { headers: { apikey: KEY } });
    c.expect(!g.ok, `GET rpc/roll_today?number=7 (anon): HTTP ${g.status}`);
    const n = psql(`select count(*) from public.rolls where user_id = ${sqlStr(D.id)}`);
    c.expect(n === "0", `D has ${n} rolls after argument attacks`);
    const procs = psql(
      "select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = 'roll_today'",
    )
      .split("\n")
      .filter(Boolean);
    c.expect(
      procs.length === 1 && procs[0] === "roll_today()",
      `roll_today signatures in pg_proc: ${JSON.stringify(procs)}`,
    );
    c.done();
  }

  // ---------------------------------------------------------------- ATK-08
  {
    const c = new Check("ATK-08", "all public views are security_invoker and anon has no SELECT");
    const rows = psql(
      `select c.relname||'|'||coalesce(array_to_string(c.reloptions, ','), '')||'|'||has_table_privilege('anon', c.oid, 'SELECT')
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('v', 'm') order by 1`,
    )
      .split("\n")
      .filter(Boolean);
    c.expect(rows.length > 0, "no views found in public");
    for (const row of rows) {
      const [name, opts, anonSel] = row.split("|");
      c.expect(
        /security_invoker=(true|on|1)/i.test(opts),
        `view ${name} reloptions='${opts}' (not security_invoker)`,
      );
      // boolean || text yields 'true'/'false'
      c.expect(anonSel === "false", `anon has SELECT on view ${name} (${anonSel})`);
    }
    const mv = psql(
      "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'm'",
    );
    c.expect(mv === "0", `materialized views in public (cannot be security_invoker): ${mv}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-09
  {
    const c = new Check("ATK-09", "A cannot read B's past roll history or B's roll_badges");
    // Fixture: backdated roll + badge for B, inserted as postgres.
    const backId = psql(
      `insert into public.rolls (user_id, roll_date, number, ep, base_ep, tier)
       values (${sqlStr(B.id)}, ((now() at time zone 'utc')::date - 30), 424242, 5, 5, 'common') returning id`,
    ).split("\n")[0];
    const badgeId = psql("select min(id) from public.badges");
    psql(`insert into public.roll_badges (roll_id, badge_id) values (${backId}, ${badgeId})`);
    psql(
      `insert into public.roll_badges (roll_id, badge_id) values (${bTodayRollId}, ${badgeId}) on conflict do nothing`,
    );

    const today = psql("select (now() at time zone 'utc')::date");
    const res = await A.client.from("rolls").select("id,roll_date,number").eq("user_id", B.id);
    c.expect(!res.error, `A select B rolls errored: ${describe(res)}`);
    const rows = (res.data ?? []) as { id: number; roll_date: string }[];
    c.expect(
      rows.every((r) => r.roll_date === today),
      `A sees B rows not from today: ${JSON.stringify(rows)}`,
    );
    c.expect(!rows.some((r) => String(r.id) === backId), `A sees backdated roll ${backId}`);
    const direct = await A.client.from("rolls").select("*").eq("id", Number(backId));
    c.expect(deniedRead(direct), `A select backdated roll by id: ${describe(direct)}`);
    const past = await A.client.from("rolls").select("*").lt("roll_date", today).neq("user_id", A.id);
    c.expect(deniedRead(past), `A select others' past rolls: ${describe(past)}`);

    const rb = await A.client.from("roll_badges").select("*").in("roll_id", [Number(backId), bTodayRollId]);
    c.expect(deniedRead(rb), `A select B roll_badges: ${describe(rb)}`);
    const rbAll = await A.client.from("roll_badges").select("roll_id");
    const aIds = psql(`select coalesce(string_agg(id::text, ','), '') from public.rolls where user_id = ${sqlStr(A.id)}`)
      .split(",")
      .filter(Boolean);
    const foreign = ((rbAll.data ?? []) as { roll_id: number }[]).filter((r) => !aIds.includes(String(r.roll_id)));
    c.expect(foreign.length === 0, `A sees roll_badges of other rolls: ${JSON.stringify(foreign.slice(0, 5))}`);
    const embed = await A.client.from("rolls").select("id, roll_badges(badge_id)").eq("user_id", B.id);
    const leaked = ((embed.data ?? []) as { roll_badges?: unknown[] }[]).some((r) => (r.roll_badges ?? []).length > 0);
    c.expect(!leaked, `A sees B roll_badges via embed: ${describe(embed)}`);
    // Sanity: B can see its own backdated roll (proves the fixture is visible to its owner).
    const own = await B.client.from("rolls").select("id").eq("id", Number(backId));
    c.expect(!own.error && own.data?.length === 1, `fixture sanity: B cannot see own backdated roll: ${describe(own)}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-10
  {
    const c = new Check("ATK-10", "A cannot change own profile id or created_at");
    const before = psql(`select id||'|'||created_at from public.profiles where id = ${sqlStr(A.id)}`);
    const fresh = crypto.randomUUID();
    const r1 = await A.client.from("profiles").update({ id: fresh }).eq("id", A.id).select();
    c.expect(!!r1.error, `update own id: ${describe(r1)}`);
    const r1b = await A.client.from("profiles").update({ id: B.id }).eq("id", A.id).select();
    c.expect(!!r1b.error, `update own id to B id: ${describe(r1b)}`);
    const r2 = await A.client.from("profiles").update({ created_at: "2000-01-01T00:00:00Z" }).eq("id", A.id).select();
    c.expect(!!r2.error, `update own created_at: ${describe(r2)}`);
    const r3 = await A.client
      .from("profiles")
      .update({ display_name: `atk_${rnd()}`, created_at: "2000-01-01T00:00:00Z" })
      .eq("id", A.id)
      .select();
    c.expect(!!r3.error, `update display_name + created_at together: ${describe(r3)}`);
    const E = newClient();
    const { data: su } = await E.auth.signUp({ email: `atk_e_${rnd()}@example.test`, password: `Pw-${rnd()}-${rnd()}` });
    const r4 = await E.from("profiles")
      .insert({ id: su.user!.id, display_name: `atk_${rnd()}`, created_at: "2000-01-01T00:00:00Z" })
      .select();
    c.expect(!!r4.error, `insert profile with created_at: ${describe(r4)}`);
    const after = psql(`select id||'|'||created_at from public.profiles where id = ${sqlStr(A.id)}`);
    c.expect(before === after, `A profile id/created_at changed: ${before} -> ${after}`);
    const sanity = await A.client.from("profiles").update({ display_name: `atk_${rnd()}` }).eq("id", A.id).select();
    c.expect(!sanity.error && sanity.data?.length === 1, `sanity: renaming own profile should work: ${describe(sanity)}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-11
  {
    const c = new Check("ATK-11", "HTML/script display names rejected by check constraint");
    const F = newClient();
    const { data: su, error } = await F.auth.signUp({ email: `atk_f_${rnd()}@example.test`, password: `Pw-${rnd()}-${rnd()}` });
    if (error || !su.user) throw new Error(`signUp F failed: ${error?.message}`);
    for (const bad of [
      "<script>x</script>",
      "<b>x</b>",
      `x"onmouseover=y`,
      "a'b--c",
      "<img src=x>",
      "  lead",
      "ab",
      "x".repeat(25),
      "tab\tname",
    ]) {
      const ins = await F.from("profiles").insert({ id: su.user.id, display_name: bad }).select();
      c.expect(
        !!ins.error && ins.error.code === "23514",
        `insert display_name ${JSON.stringify(bad)}: ${describe(ins)}`,
      );
      const upd = await A.client.from("profiles").update({ display_name: bad }).eq("id", A.id).select();
      c.expect(!!upd.error && upd.error.code === "23514", `update display_name ${JSON.stringify(bad)}: ${describe(upd)}`);
    }
    const n = psql(`select count(*) from public.profiles where display_name ~ '[<>"''&]'`);
    c.expect(n === "0", `${n} profiles contain HTML metacharacters`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-12
  {
    const c = new Check("ATK-12", "wallets are private and rerolls need sign-in");
    const r = await anon.rpc("reroll_today");
    c.expect(!!r.error, `anon rpc reroll_today: ${describe(r)}`);
    const priv = psql(`select has_function_privilege('anon', 'public.reroll_today()', 'EXECUTE')`);
    c.expect(priv === "f", "anon has EXECUTE on reroll_today()");
    const mine = await A.client.from("ep_wallets").select("user_id");
    c.expect(!mine.error && (mine.data ?? []).every((w) => w.user_id === A.id), `A reads wallets: ${describe(mine)}`);
    const theirs = await A.client.from("ep_wallets").select("*").eq("user_id", B.id);
    c.expect(deniedRead(theirs), `A reads B's wallet: ${describe(theirs)}`);
    for (const fn of ["record_roll(uuid,date,smallint)", "rescore_all()", "reroll_price()", "max_rerolls()"]) {
      const p = psql(`select has_function_privilege('authenticated', 'private.${fn}', 'EXECUTE')`);
      c.expect(p === "f", `authenticated has EXECUTE on private.${fn}`);
    }
    c.done();
  }

  // ---------------------------------------------------------------- ATK-13
  {
    const c = new Check("ATK-13", "reroll without enough EP fails and changes nothing");
    const G = await newPlayer("g");
    const first = await G.client.rpc("reroll_today");
    c.expect(!!first.error, `reroll before rolling: ${describe(first)}`);
    await G.client.rpc("roll_today");
    psql(`update public.ep_wallets set earned_ep = 99, spent_ep = 0 where user_id = ${sqlStr(G.id)}`); // 1 EP short
    const before = psql(`select (select count(*) from public.rolls where user_id = ${sqlStr(G.id)})||','||balance from public.ep_wallets where user_id = ${sqlStr(G.id)}`);
    const poor = await G.client.rpc("reroll_today");
    c.expect(!!poor.error && /not enough EP/.test(poor.error.message), `reroll with 99 EP: ${describe(poor)}`);
    const after = psql(`select (select count(*) from public.rolls where user_id = ${sqlStr(G.id)})||','||balance from public.ep_wallets where user_id = ${sqlStr(G.id)}`);
    c.expect(before === after, `rolls/balance changed: ${before} -> ${after}`);
    for (const args of [{ number: 7 }, { price: 0 }, { attempt: 1 }]) {
      const r = await G.client.rpc("reroll_today", args);
      c.expect(!!r.error, `rpc reroll_today(${JSON.stringify(args)}): ${describe(r)}`);
    }
    const procs = psql("select string_agg(p.oid::regprocedure::text, ',') from pg_proc p where p.proname = 'reroll_today'");
    c.expect(procs === "reroll_today()", `reroll_today signatures: ${procs}`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-14
  {
    const c = new Check("ATK-14", "20 parallel rerolls by a rich player: max 3 succeed, each charged once");
    const H = await newPlayer("h");
    await H.client.rpc("roll_today");
    psql(`update public.ep_wallets set earned_ep = earned_ep + 1000000 where user_id = ${sqlStr(H.id)}`);
    const w0 = psql(`select earned_ep||','||spent_ep from public.ep_wallets where user_id = ${sqlStr(H.id)}`).split(",").map(Number);
    const res = await Promise.all(Array.from({ length: 20 }, () => H.client.rpc("reroll_today")));
    const ok = res.filter((r) => !r.error);
    c.expect(ok.length === 3, `${ok.length} of 20 rerolls succeeded (errors: ${[...new Set(res.filter((r) => r.error).map((r) => r.error!.message))].join("; ")})`);
    const rows = psql(`select count(*)||','||max(attempt) from public.rolls where user_id = ${sqlStr(H.id)}`);
    c.expect(rows === "4,3", `rolls count,max attempt = ${rows}`);
    const gained = Number(psql(`select coalesce(sum(ep), 0) from public.rolls where user_id = ${sqlStr(H.id)} and attempt > 0`));
    const w1 = psql(`select earned_ep||','||spent_ep from public.ep_wallets where user_id = ${sqlStr(H.id)}`).split(",").map(Number);
    c.expect(w1[1] - w0[1] === 300, `spent_ep grew by ${w1[1] - w0[1]}, expected 300`);
    c.expect(w1[0] - w0[0] === gained, `earned_ep grew by ${w1[0] - w0[0]}, rerolls earned ${gained}`);
    const day = psql(`select t.total_ep = (select max(ep) from public.rolls where user_id = ${sqlStr(H.id)}) and t.roll_count = 1 from public.leaderboard_totals t where user_id = ${sqlStr(H.id)}`);
    c.expect(day === "t", "leaderboard total is not the day's best roll / roll_count != 1");
    const lb = await H.client.from("leaderboard_today").select("display_name").eq("display_name", H.name);
    c.expect(!lb.error && lb.data?.length === 1, `H appears ${lb.data?.length} times on today's leaderboard`);
    c.done();
  }

  // ---------------------------------------------------------------- ATK-15
  {
    const c = new Check("ATK-15", "wheel: sign-in needed, one spin a day, only after rolling, no arguments");
    const r = await anon.rpc("spin_wheel");
    c.expect(!!r.error, `anon rpc spin_wheel: ${describe(r)}`);
    c.expect(psql(`select has_function_privilege('anon', 'public.spin_wheel()', 'EXECUTE')`) === "f", "anon has EXECUTE on spin_wheel()");
    const prizes = await anon.from("wheel_prizes").select("slug");
    c.expect(!prizes.error && (prizes.data ?? []).length >= 2, `anon can read the prize list: ${describe(prizes)}`);

    const S = await newPlayer("s");
    const early = await S.client.rpc("spin_wheel");
    c.expect(!!early.error && /roll today first/.test(early.error.message), `spin before rolling: ${describe(early)}`);
    await S.client.rpc("roll_today");
    for (const args of [{ prize_id: 8 }, { prize: "jackpot" }, { multiplier: 10 }]) {
      const a = await S.client.rpc("spin_wheel", args);
      c.expect(!!a.error, `rpc spin_wheel(${JSON.stringify(args)}): ${describe(a)}`);
    }
    const res = await Promise.all(Array.from({ length: 20 }, () => S.client.rpc("spin_wheel")));
    const ok = res.filter((x) => !x.error).length;
    c.expect(ok === 1, `${ok} of 20 parallel spins succeeded (errors: ${[...new Set(res.filter((x) => x.error).map((x) => x.error!.message))].join("; ")})`);
    c.expect(psql(`select count(*) from public.wheel_spins where user_id = ${sqlStr(S.id)}`) === "1", "more than one wheel_spins row");
    const procs = psql("select string_agg(p.oid::regprocedure::text, ',') from pg_proc p where p.proname = 'spin_wheel'");
    c.expect(procs === "spin_wheel()", `spin_wheel signatures: ${procs}`);

    const theirs = await A.client.from("wheel_spins").select("*").eq("user_id", S.id);
    c.expect(deniedRead(theirs), `A reads S's spin: ${describe(theirs)}`);
    for (const [label, q] of [
      ["insert wheel_spins", A.client.from("wheel_spins").insert({ user_id: A.id, spin_date: "2001-01-01", prize_id: 8, roll_id: 1, ep_before: 0, ep_after: 0 }).select()],
      ["update own wheel_spins", S.client.from("wheel_spins").update({ free_reroll_used: false, prize_id: 8 }).eq("user_id", S.id).select()],
      ["delete own wheel_spins", S.client.from("wheel_spins").delete().eq("user_id", S.id).select()],
      ["update wheel_prizes", A.client.from("wheel_prizes").update({ weight: 1000000 }).eq("slug", "jackpot").select()],
      ["insert wheel_prizes", A.client.from("wheel_prizes").insert({ id: 99, slug: "x", label: "x", kind: "multiplier", value: 100, weight: 1, color: "#000000", sort: 99 }).select()],
      ["update own roll multiplier", S.client.from("rolls").update({ multiplier: 10 }).eq("user_id", S.id).select()],
    ] as const) {
      const x = await q;
      c.expect(!!x.error || (x.data ?? []).length === 0, `${label}: ${describe(x)}`);
    }
    c.expect(psql(`select count(*) from public.wheel_spins where user_id = ${sqlStr(S.id)}`) === "1", "S's spin row was deleted");
    c.done();
  }

  // ---------------------------------------------------------------- ATK-16
  {
    const c = new Check("ATK-16", "wheel prizes apply exactly: 3x, lose half (never below 0 EP), free reroll");
    const weights = psql("select string_agg(id || ':' || weight, ',' order by id) from public.wheel_prizes");
    const force = (slug: string) =>
      psql(`update public.wheel_prizes set weight = case when slug = '${slug}' then 1000000000 else 1 end`);
    try {
      // 3x on a known roll.
      const T = await newPlayer("t");
      await T.client.rpc("roll_today");
      psql(`update public.rolls set base_ep = 40, ep = 40 where user_id = ${sqlStr(T.id)};
            update public.ep_wallets set earned_ep = 40 where user_id = ${sqlStr(T.id)};
            select 1 from public.leaderboard_totals where user_id = ${sqlStr(T.id)}`);
      force("triple");
      const sp = await T.client.rpc("spin_wheel");
      const d = sp.data as { prize: { slug: string }; ep_before: number; ep_after: number } | null;
      c.expect(!sp.error && d?.prize.slug === "triple" && d.ep_before === 40 && d.ep_after === 120, `3x spin: ${describe(sp)}`);
      const t = psql(`select r.ep||','||r.base_ep||','||r.multiplier||','||w.earned_ep||','||l.total_ep from public.rolls r
        join public.ep_wallets w using (user_id) join public.leaderboard_totals l using (user_id) where r.user_id = ${sqlStr(T.id)}`);
      c.expect(t === "120,40,3.00,120,120", `after 3x (ep,base,mult,earned,total): ${t}`);

      // Lose half with almost everything already spent.
      const L = await newPlayer("l");
      await L.client.rpc("roll_today");
      psql(`update public.rolls set base_ep = 1000, ep = 1000 where user_id = ${sqlStr(L.id)};
            update public.ep_wallets set earned_ep = 1000, spent_ep = 990 where user_id = ${sqlStr(L.id)}`);
      force("lose-half");
      const lh = await L.client.rpc("spin_wheel");
      c.expect(!lh.error && (lh.data as { ep_after: number }).ep_after === 500, `lose half: ${describe(lh)}`);
      const lw = psql(`select earned_ep||','||spent_ep||','||balance from public.ep_wallets where user_id = ${sqlStr(L.id)}`);
      c.expect(lw === "990,990,0", `wallet after losing half (earned,spent,balance): ${lw}`);

      // Free reroll: works with 0 EP, costs nothing, and is on top of the 3 paid ones.
      const F = await newPlayer("fr");
      await F.client.rpc("roll_today");
      psql(`update public.ep_wallets set earned_ep = 0, spent_ep = 0 where user_id = ${sqlStr(F.id)};
            update public.rolls set base_ep = 0, ep = 0 where user_id = ${sqlStr(F.id)}`);
      force("free-reroll");
      const fs = await F.client.rpc("spin_wheel");
      c.expect(!fs.error, `free-reroll spin: ${describe(fs)}`);
      const free = await F.client.rpc("reroll_today");
      c.expect(!free.error && (free.data as { free: boolean }).free === true, `free reroll with 0 EP: ${describe(free)}`);
      c.expect(psql(`select spent_ep from public.ep_wallets where user_id = ${sqlStr(F.id)}`) === "0", "free reroll charged EP");
      const poor = await F.client.rpc("reroll_today");
      c.expect(!!poor.error, `second reroll with no EP should fail: ${describe(poor)}`);
      psql(`update public.ep_wallets set earned_ep = earned_ep + 10000 where user_id = ${sqlStr(F.id)}`);
      const paid = [];
      for (let i = 0; i < 4; i++) paid.push(await F.client.rpc("reroll_today"));
      c.expect(paid.slice(0, 3).every((x) => !x.error) && !!paid[3].error, `3 paid rerolls then refusal: ${paid.map((x) => (x.error ? x.error.message : "ok")).join(" / ")}`);
      const fr = psql(`select count(*)||','||max(attempt)||','||(select spent_ep from public.ep_wallets where user_id = ${sqlStr(F.id)}) from public.rolls where user_id = ${sqlStr(F.id)}`);
      c.expect(fr === "5,4,300", `rolls,max attempt,spent after free + 3 paid: ${fr}`);

      // Rescoring keeps the wheel multiplier.
      psql("select private.rescore_all()");
      const kept = psql(`select ep = floor(base_ep * multiplier) + bonus_ep and multiplier = 3 from public.rolls where user_id = ${sqlStr(T.id)}`);
      c.expect(kept === "t", "rescore_all dropped the 3x multiplier");
    } finally {
      for (const pair of weights.split(",")) {
        const [id, w] = pair.split(":");
        psql(`update public.wheel_prizes set weight = ${Number(w)} where id = ${Number(id)}`);
      }
    }
    c.done();
  }

  // ---------------------------------------------------------------- ATK-17
  {
    const c = new Check("ATK-17", "avatars: own folder only, images only, 5 MB max, path must be your own");
    // 1x1 transparent PNG.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    const P = await newPlayer("p");
    const Q = await newPlayer("q");
    const up = (cl: Client, path: string, body: Buffer | string, type: string, upsert = false) =>
      cl.storage.from("avatars").upload(path, body, { contentType: type, upsert });

    const own = await up(P.client, `${P.id}/avatar-1.png`, png, "image/png");
    c.expect(!own.error, `upload own avatar: ${own.error?.message}`);
    const setOwn = await P.client.from("profiles").update({ avatar_path: `${P.id}/avatar-1.png` }).eq("id", P.id).select();
    c.expect(!setOwn.error && setOwn.data?.length === 1, `set own avatar_path: ${describe(setOwn)}`);
    const qOwn = await up(Q.client, `${Q.id}/avatar-1.png`, png, "image/png");
    c.expect(!qOwn.error, `Q uploads own avatar: ${qOwn.error?.message}`);

    for (const [label, res] of [
      ["upload into Q's folder", await up(P.client, `${Q.id}/avatar-2.png`, png, "image/png")],
      ["overwrite Q's file", await up(P.client, `${Q.id}/avatar-1.png`, png, "image/png", true)],
      ["upload as text/html", await up(P.client, `${P.id}/x.png`, "<script>alert(1)</script>", "text/html")],
      ["upload SVG", await up(P.client, `${P.id}/x.svg`, "<svg xmlns='http://www.w3.org/2000/svg'/>", "image/svg+xml")],
      ["upload .html name", await up(P.client, `${P.id}/x.html`, png, "image/png")],
      ["path traversal name", await up(P.client, `${P.id}/../${Q.id}/avatar-9.png`, png, "image/png")],
      ["upload over 5 MB", await up(P.client, `${P.id}/big.png`, Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")],
      ["signed-out upload", await up(anon, `${P.id}/anon.png`, png, "image/png")],
    ] as const) {
      c.expect(!!res.error, `${label} should fail`);
    }
    const delQ = await P.client.storage.from("avatars").remove([`${Q.id}/avatar-1.png`]);
    c.expect((delQ.data ?? []).length === 0, `P deleted Q's file: ${JSON.stringify(delQ.data)}`);
    c.expect(psql(`select count(*) from storage.objects where bucket_id = 'avatars' and name = '${Q.id}/avatar-1.png'`) === "1", "Q's file is gone");

    const steal = await P.client.from("profiles").update({ avatar_path: `${Q.id}/avatar-1.png` }).eq("id", P.id).select();
    c.expect(!!steal.error, `point own avatar_path at Q's file: ${describe(steal)}`);
    const lock = await P.client.from("profiles").update({ avatar_locked: false }).eq("id", P.id).select();
    c.expect(!!lock.error, `change own avatar_locked: ${describe(lock)}`);
    const other = await P.client.from("profiles").update({ avatar_path: null }).eq("id", Q.id).select();
    c.expect(!!other.error || (other.data ?? []).length === 0, `clear Q's avatar_path: ${describe(other)}`);

    const pub = await fetch(`${URL}/storage/v1/object/public/avatars/${P.id}/avatar-1.png`);
    c.expect(pub.ok && (pub.headers.get("content-type") ?? "").startsWith("image/png"), `public avatar URL: HTTP ${pub.status} ${pub.headers.get("content-type")}`);
    c.done();

    // ---------------------------------------------------------------- ATK-18
    const d = new Check("ATK-18", "only admins can remove avatars; a removed avatar stays locked");
    const notAdmin = await P.client.rpc("admin_remove_avatar", { target_name: Q.name });
    d.expect(!!notAdmin.error, `non-admin admin_remove_avatar: ${describe(notAdmin)}`);
    d.expect((await P.client.rpc("am_i_admin")).data === false, "P is reported as admin");
    const adm = await P.client.from("admins").select("*");
    d.expect(deniedRead(adm), `read admins table: ${describe(adm)}`);
    const selfAdmin = await P.client.from("admins").insert({ user_id: P.id }).select();
    d.expect(!!selfAdmin.error, `make self admin: ${describe(selfAdmin)}`);
    const anonRm = await anon.rpc("admin_remove_avatar", { target_name: Q.name });
    d.expect(!!anonRm.error, `anon admin_remove_avatar: ${describe(anonRm)}`);

    psql(`update public.profiles set avatar_path = '${Q.id}/avatar-1.png' where id = ${sqlStr(Q.id)}`);
    psql(`insert into public.admins (user_id) values (${sqlStr(A.id)}) on conflict do nothing`);
    try {
      d.expect((await A.client.rpc("am_i_admin")).data === true, "admin not recognised");
      const rm = await A.client.rpc("admin_remove_avatar", { target_name: Q.name });
      d.expect(!rm.error && rm.data === `${Q.id}/avatar-1.png`, `admin removes Q's avatar: ${describe(rm)}`);
      const del = await A.client.storage.from("avatars").remove([`${Q.id}/avatar-1.png`]);
      d.expect((del.data ?? []).length === 1, `admin deletes Q's file: ${del.error?.message ?? JSON.stringify(del.data)}`);
      const q = psql(`select coalesce(avatar_path, 'null')||','||avatar_locked from public.profiles where id = ${sqlStr(Q.id)}`);
      d.expect(q === "null,true", `Q profile after removal: ${q}`);
      const again = await up(Q.client, `${Q.id}/avatar-2.png`, png, "image/png");
      d.expect(!!again.error, "locked player re-uploaded an avatar");
      const reset = await Q.client.from("profiles").update({ avatar_path: `${Q.id}/avatar-2.png` }).eq("id", Q.id).select();
      d.expect(!!reset.error, `locked player set avatar_path: ${describe(reset)}`);
    } finally {
      psql(`delete from public.admins where user_id = ${sqlStr(A.id)}`);
    }
    // Deleting an account still works when the player has a file in Storage.
    const delAcct = await P.client.rpc("delete_my_account");
    d.expect(!delAcct.error, `delete_my_account with an avatar on file: ${describe(delAcct)}`);
    d.done();
  }
}

main()
  .catch((e) => {
    record("SETUP", false, `test harness error: ${e instanceof Error ? e.stack : String(e)}`);
  })
  .finally(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  });
