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
      `insert into public.rolls (user_id, roll_date, number, ep, tier)
       values (${sqlStr(B.id)}, ((now() at time zone 'utc')::date - 30), 424242, 5, 'common') returning id`,
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
