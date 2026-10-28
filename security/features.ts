/**
 * Luckline feature checks for the engagement update: streak shields and
 * milestones, cosmetics and the shop, events, the community number, the Badge
 * Hunt, family fusion, the weekly recap and EP credits. Includes access checks
 * (signed-out and cross-player) for every new table and function.
 *
 * Runs against a local Supabase stack with the publishable key and real user
 * tokens. psql (as postgres) sets up fixtures that need time travel (rolls on
 * earlier days) and checks results.
 *
 *   npx tsx security/features.ts      (or: npm run test:features)
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

type Client = SupabaseClient;
const results: { id: string; ok: boolean; detail: string }[] = [];

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
    results.push({ id: this.id, ok, detail: this.title });
    console.log(
      `${ok ? "PASS" : "FAIL"} ${this.id} ${ok ? `${this.title} (${this.passes} assertions)` : `${this.title}\n      - ${this.failures.join("\n      - ")}`}`,
    );
  }
}

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim();
}
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const rnd = () => randomBytes(5).toString("hex");
const today = () => psql("select (now() at time zone 'utc')::date");
const addDays = (d: string, n: number) => psql(`select ${q(d)}::date + ${n}`);

function newClient(): Client {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function newPlayer(label: string) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({ email: `ft_${label}_${rnd()}@example.test`, password: `Pw-${rnd()}-${rnd()}` });
  if (error || !data.session || !data.user) throw new Error(`signUp ${label}: ${error?.message ?? "no session"}`);
  const name = `ft_${rnd()}`;
  const ins = await client.from("profiles").insert({ id: data.user.id, display_name: name });
  if (ins.error) throw new Error(`profile ${label}: ${ins.error.message}`);
  return { client, id: data.user.id, name };
}
type Player = Awaited<ReturnType<typeof newPlayer>>;

/** A finished roll on `daysAgo` days ago (outside the app, for time travel). */
function backdate(uid: string, daysAgo: number, number = 777) {
  psql(`insert into public.rolls (user_id, roll_date, number, ep, base_ep, tier, attempt)
        select ${q(uid)}, ((now() at time zone 'utc')::date - ${daysAgo}), ns.number, ns.ep, ns.ep, ns.tier, 0
          from public.number_stats ns where ns.number = ${number}`);
}
const addEp = (uid: string, ep: number) =>
  psql(`insert into public.ep_wallets (user_id, earned_ep) values (${q(uid)}, ${ep})
        on conflict (user_id) do update set earned_ep = public.ep_wallets.earned_ep + ${ep}`);
const balance = (uid: string) => Number(psql(`select balance from public.ep_wallets where user_id = ${q(uid)}`));
const creditSum = (uid: string, kind: string) =>
  Number(psql(`select coalesce(sum(amount), 0) from public.ep_credits where user_id = ${q(uid)} and kind = ${q(kind)}`));
const badgeId = (slug: string) => Number(psql(`select id from public.badges where slug = ${q(slug)}`));
const afterRoll = (uid: string, day: string, ids: number[], n: number) =>
  JSON.parse(psql(`select private.after_roll(${q(uid)}::uuid, ${q(day)}::date, array[${ids.join(",")}]::smallint[], ${n})`)) as { kind: string; title: string; detail: string }[];
const fails = (res: { error: { message?: string } | null }, text: string) => !!res.error && (res.error.message ?? "").includes(text);

async function main() {
  const anon = newClient();
  const T = today();

  // --------------------------------------------------------------- FEAT-01
  {
    const c = new Check("FEAT-01", "a roll returns rewards, streak and the new fields");
    const p = await newPlayer("roll");
    const r = await p.client.rpc("roll_today");
    c.expect(!r.error, `roll_today: ${r.error?.message}`);
    const d = r.data as Record<string, unknown>;
    c.expect(Array.isArray(d.rewards), "rewards is an array");
    c.expect(d.streak === 1, `streak is 1 on the first day (got ${d.streak})`);
    c.expect(d.event_bonus === 0, "no event bonus on a normal day");
    const row = psql(`select ep, base_ep, event_bonus_ep, free_reroll from public.rolls where user_id = ${q(p.id)}`);
    const [ep, base, ev, free] = row.split("|");
    c.expect(ep === base && ev === "0" && free === "f", `roll row is consistent (${row})`);
    c.done();
  }

  // --------------------------------------------------------------- FEAT-02
  {
    const c = new Check("FEAT-02", "streak shields: auto-cover missed days, only when they all fit");
    const covered = await newPlayer("shield2");
    backdate(covered.id, 3);
    backdate(covered.id, 4);
    psql(`insert into public.streak_shields (user_id, count) values (${q(covered.id)}, 2)`);
    const r1 = await covered.client.rpc("roll_today");
    c.expect(!r1.error, `roll ${r1.error?.message}`);
    c.expect(psql(`select count(*) from public.shield_uses where user_id = ${q(covered.id)}`) === "2", "two shield days recorded");
    c.expect(psql(`select count from public.streak_shields where user_id = ${q(covered.id)}`) === "0", "both shields spent");
    const s1 = (await covered.client.rpc("my_streak")).data as { current: number; days: { state: string }[] };
    c.expect(s1.current === 3, `streak is 3 rolled days across the shielded gap (got ${s1.current})`);
    c.expect(s1.days.filter((d) => d.state === "shield").length === 2, "the day grid shows the two shield days");

    const short = await newPlayer("shield1");
    backdate(short.id, 3);
    psql(`insert into public.streak_shields (user_id, count) values (${q(short.id)}, 1)`);
    await short.client.rpc("roll_today");
    c.expect(psql(`select count(*) from public.shield_uses where user_id = ${q(short.id)}`) === "0", "one shield cannot cover two missed days, so none is spent");
    c.expect(psql(`select count from public.streak_shields where user_id = ${q(short.id)}`) === "1", "the shield is kept");
    c.expect(((await short.client.rpc("my_streak")).data as { current: number }).current === 1, "the streak restarts at 1");

    const off = await newPlayer("shieldoff");
    backdate(off.id, 2);
    psql(`insert into public.streak_shields (user_id, count, auto_use) values (${q(off.id)}, 1, false)`);
    await off.client.rpc("roll_today");
    c.expect(psql(`select count(*) from public.shield_uses where user_id = ${q(off.id)}`) === "0", "auto-use off: no shield spent");
    const toggled = await off.client.rpc("set_shield_auto", { on_off: true });
    c.expect(!toggled.error, `set_shield_auto: ${toggled.error?.message}`);
    c.expect(psql(`select auto_use from public.streak_shields where user_id = ${q(off.id)}`) === "t", "auto-use switched on");
    const nul = await off.client.rpc("set_shield_auto", { on_off: null });
    c.expect(!!nul.error, "null is rejected");
    c.done();
  }

  // --------------------------------------------------------------- FEAT-03
  {
    const c = new Check("FEAT-03", "streak milestones pay once");
    const m = await newPlayer("milestone");
    for (let k = 1; k <= 6; k++) backdate(m.id, k);
    const r = await m.client.rpc("roll_today");
    const rewards = (r.data as { rewards: { kind: string; title: string }[] }).rewards;
    c.expect(rewards.some((x) => x.kind === "milestone" && x.title === "7-day streak"), `7-day milestone in rewards: ${JSON.stringify(rewards)}`);
    c.expect(creditSum(m.id, "milestone") === 500, "500 EP credited");
    const again = await m.client.rpc("reroll_today");
    c.expect(again.error?.message?.includes("not enough EP") === true || !again.error, "reroll path runs");
    c.expect(creditSum(m.id, "milestone") === 500, "no second payment");

    const m2 = await newPlayer("milestone14");
    for (let k = 1; k <= 13; k++) backdate(m2.id, k);
    await m2.client.rpc("roll_today");
    c.expect(creditSum(m2.id, "milestone") === 1500, `7 + 14 day EP credited (got ${creditSum(m2.id, "milestone")})`);
    c.expect(psql(`select count from public.streak_shields where user_id = ${q(m2.id)}`) === "1", "14-day milestone gives a shield");
    c.expect(psql(`select count(*) from public.streak_milestones where user_id = ${q(m2.id)}`) === "2", "two milestones recorded");
    c.done();
  }

  // --------------------------------------------------------------- FEAT-04
  {
    const c = new Check("FEAT-04", "buying shields");
    const p = await newPlayer("buyshield");
    await p.client.rpc("roll_today");
    psql(`update public.ep_wallets set spent_ep = 0, earned_ep = 0 where user_id = ${q(p.id)}`);
    const broke = await p.client.rpc("buy_shield");
    c.expect(fails(broke, "not enough EP"), `broke: ${broke.error?.message}`);
    addEp(p.id, 5000);
    for (let i = 1; i <= 3; i++) {
      const ok = await p.client.rpc("buy_shield");
      c.expect(!ok.error && (ok.data as { shields: number }).shields === i, `buy #${i}: ${ok.error?.message}`);
    }
    c.expect(balance(p.id) === 5000 - 1800, `balance after 3 shields (${balance(p.id)})`);
    const full = await p.client.rpc("buy_shield");
    c.expect(fails(full, "shields full"), `full: ${full.error?.message}`);
    const anonBuy = await anon.rpc("buy_shield");
    c.expect(!!anonBuy.error, "signed-out cannot buy");
    c.done();
  }

  // --------------------------------------------------------------- FEAT-05
  {
    const c = new Check("FEAT-05", "cosmetics: buy, equip and protection");
    const p = await newPlayer("shop");
    const other = await newPlayer("shopother");
    await p.client.rpc("roll_today");
    await other.client.rpc("roll_today");
    psql(`update public.ep_wallets set spent_ep = 0, earned_ep = 0 where user_id = ${q(p.id)}`);
    const poor = await p.client.rpc("buy_cosmetic", { item: "aura-void" });
    c.expect(fails(poor, "not enough EP"), `poor: ${poor.error?.message}`);
    addEp(p.id, 5000);
    const bought = await p.client.rpc("buy_cosmetic", { item: "aura-void" });
    c.expect(!bought.error, `buy: ${bought.error?.message}`);
    c.expect(balance(p.id) === 5000 - 1800, "1,800 EP spent");
    c.expect(psql(`select aura from public.profiles where id = ${q(p.id)}`) === "aura-void", "bought item is equipped");
    c.expect(fails(await p.client.rpc("buy_cosmetic", { item: "aura-void" }), "already owned"), "cannot buy twice");
    c.expect(fails(await p.client.rpc("buy_cosmetic", { item: "name-gold" }), "not for sale"), "earn-only items cannot be bought");
    c.expect(fails(await p.client.rpc("buy_cosmetic", { item: "nope" }), "unknown item"), "unknown item");
    c.expect(fails(await p.client.rpc("equip_cosmetic", { slot: "frame", item: "frame-gold" }), "do not own"), "cannot equip what you don't own");
    c.expect(fails(await p.client.rpc("equip_cosmetic", { slot: "name", item: "aura-void" }), "do not own"), "wrong slot rejected");
    c.expect(!(await p.client.rpc("equip_cosmetic", { slot: "aura", item: null })).error, "unequip works");
    c.expect(psql(`select aura is null from public.profiles where id = ${q(p.id)}`) === "t", "aura cleared");
    c.expect(!(await p.client.rpc("equip_cosmetic", { slot: "aura", item: "aura-void" })).error, "re-equip works");
    // Direct writes are denied.
    await other.client.from("profiles").update({ aura: "aura-void" }).eq("id", other.id);
    c.expect(psql(`select aura is null from public.profiles where id = ${q(other.id)}`) === "t", "cannot equip by editing profiles");
    const ins = await other.client.from("player_cosmetics").insert({ user_id: other.id, item_id: "aura-void", source: "hax" });
    c.expect(!!ins.error, "cannot insert into player_cosmetics");
    const peek = await other.client.from("player_cosmetics").select("*").eq("user_id", p.id);
    c.expect((peek.data ?? []).length === 0, "cannot read another player's cosmetics");
    const lb = await p.client.from("leaderboard_today").select("display_name, aura, frame, name_style").eq("display_name", p.name);
    c.expect(lb.data?.[0]?.aura === "aura-void", `leaderboard shows the equipped aura: ${JSON.stringify(lb.data)}`);
    c.done();
  }

  // --------------------------------------------------------------- FEAT-06
  {
    const c = new Check("FEAT-06", "limited events: bonus, hits and reward");
    const p = await newPlayer("event");
    await p.client.rpc("roll_today");
    const beast = ["beastly", "unlucky-thirteen", "emergency"].map(badgeId);
    c.expect(beast.every((n) => n > 0), "event badge slugs exist in the catalogue");
    for (const slugs of Object.values({
      b: ["beastly", "unlucky-thirteen", "emergency"], e: ["triple-ones", "quad-ones", "ones-overload"],
      s: ["lucky-seven", "slot-machine", "jackpot"], p: ["pi-day", "slice-of-pi", "pi-somewhere"],
      n: ["nice", "extra-nice", "meme-combo"], y: ["y2k", "this-century", "future-year"] })) {
      c.expect(slugs.every((s) => badgeId(s) > 0), `all boosted badges exist: ${slugs.join(",")}`);
    }
    const sumEp = Number(psql(`select sum(ep) from public.badges where id = any(array[${beast.join(",")}])`));
    const bonus = Number(psql(`select private.event_bonus((select e from public.game_events e where id = 1), array[${beast.join(",")}]::smallint[])`));
    c.expect(bonus === sumEp * 2, `bonus is (3-1) x boosted EP (${bonus} vs ${sumEp * 2})`);
    const none = Number(psql(`select private.event_bonus((select e from public.game_events e where id = 1), array[${badgeId("double-take")}]::smallint[])`));
    c.expect(none === 0, "other badges get no bonus");
    for (const day of ["2026-11-13", "2027-08-13"]) afterRoll(p.id, day, [beast[0]], 5);
    c.expect(psql(`select count(*) from public.player_cosmetics where user_id = ${q(p.id)} and item_id = 'aura-beast'`) === "0", "two hits are not enough");
    const third = afterRoll(p.id, "2028-10-13", [beast[1]], 5);
    c.expect(third.some((x) => x.kind === "event"), `third hit announces the reward: ${JSON.stringify(third)}`);
    c.expect(psql(`select count(*) from public.player_cosmetics where user_id = ${q(p.id)} and item_id = 'aura-beast'`) === "1", "Beast aura unlocked");
    c.expect(afterRoll(p.id, "2028-10-13", [beast[1]], 5).every((x) => x.kind !== "event"), "no second announcement");

    // A live event day: status and the roll bonus.
    psql(`insert into public.event_days (day, event_id) values (${q(T)}, 1) on conflict (day) do update set event_id = 1`);
    try {
      const st = (await p.client.rpc("event_status")).data as { today: { slug: string; boosted: unknown[]; need: number }; next: { slug: string } };
      c.expect(st.today?.slug === "beast-day" && st.today.boosted.length === 3 && st.today.need === 3, `event_status today: ${JSON.stringify(st.today)?.slice(0, 100)}`);
      const q2 = await newPlayer("eventroll");
      const r = (await q2.client.rpc("roll_today")).data as { ep: number; base_ep: number; event_bonus: number };
      c.expect(r.ep === r.base_ep + r.event_bonus, `ep = base + event bonus (${r.ep} = ${r.base_ep} + ${r.event_bonus})`);
    } finally {
      psql(`delete from public.event_days where day = ${q(T)}`);
    }
    const st2 = (await p.client.rpc("event_status")).data as { today: unknown; next: { days_away: number } };
    c.expect(st2.today === null && st2.next.days_away > 0, "no event today, a next event is shown");
    c.expect(!!(await anon.rpc("event_status")).error, "signed-out cannot call event_status");
    c.done();
  }

  // --------------------------------------------------------------- FEAT-07
  {
    const c = new Check("FEAT-07", "community number: hidden until rolled, ladder bonus, distribution");
    psql(`insert into public.community_numbers (day, number) values (${q(T)}, 358217) on conflict (day) do update set number = 358217`);
    psql(`delete from public.community_results where day = ${q(T)}`);
    const p = await newPlayer("community");
    const before = (await p.client.rpc("community_today")).data as Record<string, unknown>;
    c.expect(before.revealed === false && !("number" in before), `hidden before rolling: ${JSON.stringify(before)}`);
    await p.client.rpc("roll_today");
    // Replace the random roll with a known near-miss.
    psql(`update public.community_results set matches = 0, number = 5, distance = 999999 where user_id = ${q(p.id)} and day = ${q(T)}`);
    const rewards = afterRoll(p.id, T, [], 358914);
    c.expect(rewards.some((x) => x.kind === "community" && x.detail === "+400 EP"), `4 matches pays 400: ${JSON.stringify(rewards)}`);
    c.expect(creditSum(p.id, "community") === 400, "400 EP in credits");
    const after = (await p.client.rpc("community_today")).data as {
      revealed: boolean; number: string; matches: number; distance: number; positions: boolean[]; bonus: number; rank: number; players: number; distribution: number[];
    };
    c.expect(after.revealed && after.number === "358217" && after.matches === 4 && after.distance === 697, `result: ${JSON.stringify(after).slice(0, 140)}`);
    c.expect(JSON.stringify(after.positions) === "[true,true,true,false,true,false]", `positions ${JSON.stringify(after.positions)}`);
    c.expect(after.bonus === 400, "bonus 400");
    c.expect(after.distribution.length === 7 && after.distribution.reduce((a, b) => a + b, 0) === after.players, "distribution adds up to the players");
    // A worse later roll never lowers the bonus; a better one pays only the difference.
    afterRoll(p.id, T, [], 111111);
    c.expect(creditSum(p.id, "community") === 400, "a worse roll changes nothing");
    afterRoll(p.id, T, [], 358217);
    c.expect(creditSum(p.id, "community") === 25000, "exact match pays 25,000 in total");
    c.expect(psql("select private.digit_matches(1000000, 0)") === "6", "1,000,000 counts as 000000");
    for (const [m, ep] of [[0, 0], [1, 0], [2, 50], [3, 150], [4, 400], [5, 1500], [6, 25000]]) {
      c.expect(psql(`select private.community_bonus(${m})`) === String(ep), `ladder ${m} -> ${ep}`);
    }
    const direct = await p.client.from("community_numbers").select("*");
    c.expect((direct.data ?? []).length === 0, "the number table is not readable");
    const direct2 = await p.client.from("community_results").select("*");
    c.expect((direct2.data ?? []).length === 0, "results are not readable");
    c.expect(!!(await anon.rpc("community_today")).error, "signed-out cannot call community_today");
    psql(`delete from public.community_numbers where day = ${q(T)}`);
    psql(`delete from public.community_results where day = ${q(T)}`);
    c.done();
  }

  // --------------------------------------------------------------- FEAT-08
  {
    const c = new Check("FEAT-08", "Badge Hunt: bonus once a day, 7 wins give a free reroll and Hunter");
    const p = await newPlayer("hunt");
    await p.client.rpc("roll_today");
    const wanted = badgeId("double-take");
    psql(`delete from public.hunt_days where day = ${q(T)}`);
    psql(`insert into public.hunt_days (day, badge_id, counted, bonus_ep) values (${q(T)}, ${wanted}, 500000, 20)`);
    const status = (await p.client.rpc("hunt_today")).data as { available: boolean; badge: { slug: string }; bonus_ep: number; chance: number; hit_today: boolean; wins_needed: number };
    c.expect(status.badge.slug === "double-take" && status.bonus_ep === 20 && status.wins_needed === 7, `status ${JSON.stringify(status).slice(0, 120)}`);
    const win = afterRoll(p.id, T, [wanted], 7);
    c.expect(win.some((x) => x.kind === "hunt"), "hit announced");
    c.expect(creditSum(p.id, "hunt") >= 20, "bonus credited");
    const before = creditSum(p.id, "hunt");
    afterRoll(p.id, T, [wanted], 7);
    c.expect(creditSum(p.id, "hunt") === before, "second hit the same day pays nothing");
    c.expect(afterRoll(p.id, T, [badgeId("monochrome")], 7).every((x) => x.kind !== "hunt"), "other badges don't count");
    for (let k = 1; k <= 6; k++) {
      const d = addDays("2031-01-01", k);
      psql(`insert into public.hunt_days (day, badge_id, counted, bonus_ep) values (${q(d)}, ${wanted}, 500000, 20)`);
      afterRoll(p.id, d, [wanted], 7);
    }
    c.expect(psql(`select count from public.reroll_tokens where user_id = ${q(p.id)}`) === "1", "7th win gives a free reroll");
    c.expect(psql(`select count(*) from public.player_cosmetics where user_id = ${q(p.id)} and item_id = 'name-hunter'`) === "1", "Hunter name unlocked");
    c.expect(psql(`select wins from public.hunt_progress where user_id = ${q(p.id)}`) === "0", "the counter restarts");
    c.expect(psql("select count(*) from public.badges where ep between 8 and 40") !== "0", "there are badges to hunt");
    c.expect(((await p.client.from("hunt_days").select("*")).data ?? []).length === 0, "hunt_days is not readable directly");
    c.expect(!!(await anon.rpc("hunt_today")).error, "signed-out cannot call hunt_today");
    psql(`delete from public.hunt_days where day = ${q(T)} or day > '2030-12-31'`);
    c.done();
  }

  // --------------------------------------------------------------- FEAT-09
  {
    const c = new Check("FEAT-09", "free reroll tokens and the paid reroll limit");
    const p = await newPlayer("token");
    await p.client.rpc("roll_today");
    addEp(p.id, 10000);
    psql(`insert into public.reroll_tokens (user_id, count) values (${q(p.id)}, 1)`);
    const b0 = balance(p.id);
    const free = (await p.client.rpc("reroll_today")).data as { free: boolean; attempt: number };
    c.expect(free.free === true && free.attempt === 1, "token reroll is free");
    c.expect(psql(`select count from public.reroll_tokens where user_id = ${q(p.id)}`) === "0", "token used");
    c.expect(balance(p.id) >= b0, "no EP was spent");
    c.expect(psql(`select free_reroll from public.rolls where user_id = ${q(p.id)} and attempt = 1`) === "t", "the roll is marked free");
    for (let i = 2; i <= 4; i++) {
      const paid = await p.client.rpc("reroll_today");
      c.expect(!paid.error, `paid reroll #${i - 1}: ${paid.error?.message}`);
    }
    const over = await p.client.rpc("reroll_today");
    c.expect(fails(over, "no rerolls left today"), `fourth paid reroll refused: ${over.error?.message}`);
    c.done();
  }

  // --------------------------------------------------------------- FEAT-10
  {
    const c = new Check("FEAT-10", "family fusion");
    const p = await newPlayer("fuse");
    await p.client.rpc("roll_today");
    c.expect(fails(await p.client.rpc("fuse_family", { fam: "repeat" }), "family not complete"), "an unfinished family cannot be fused");
    psql(`insert into public.rolls (user_id, roll_date, number, ep, base_ep, tier, attempt)
          select ${q(p.id)}, ((now() at time zone 'utc')::date - 50), 5, 1, 1, 'common', 0 on conflict do nothing`);
    psql(`insert into public.roll_badges (roll_id, badge_id)
          select (select id from public.rolls where user_id = ${q(p.id)} and roll_date = ((now() at time zone 'utc')::date - 50)), b.id
            from public.badges b where b.family = 'repeat' on conflict do nothing`);
    const before = balance(p.id);
    const f = await p.client.rpc("fuse_family", { fam: "repeat" });
    c.expect(!f.error, `fuse: ${f.error?.message}`);
    c.expect((f.data as { reward_ep: number }).reward_ep === 5000, "6-badge family pays 5,000 EP");
    c.expect(balance(p.id) === before + 5000, "wallet credited");
    c.expect(psql(`select count(*) from public.player_cosmetics where user_id = ${q(p.id)} and item_id = 'name-prism'`) === "1", "prism name unlocked");
    c.expect(fails(await p.client.rpc("fuse_family", { fam: "repeat" }), "already fused"), "cannot fuse twice");
    c.expect(creditSum(p.id, "fusion") === 5000, "paid once");
    c.expect(fails(await p.client.rpc("fuse_family", { fam: "half" }), "not a fusable family"), "single-badge family rejected");
    c.expect(fails(await p.client.rpc("fuse_family", { fam: "no-such-family" }), "not a fusable family"), "unknown family rejected");
    c.expect(psql(`select private.fusion_reward(74)`) === "25000", "reward is capped");
    c.expect(!!(await anon.rpc("fuse_family", { fam: "repeat" })).error, "signed-out cannot fuse");
    c.done();
  }

  // --------------------------------------------------------------- FEAT-11
  {
    const c = new Check("FEAT-11", "weekly recap");
    const p = await newPlayer("recap");
    const rival = await newPlayer("recaprival");
    await rival.client.rpc("roll_today");
    await p.client.rpc("roll_today");
    const wk = (await p.client.rpc("weekly_recap", { week_back: 0 })).data as {
      week_start: string; week_end: string; total_ep: number; days: { date: string; ep: number | null }[]; best: { ep: number } | null; players: number; rank: number | null; is_current: boolean; luckier_than_pct: number | null; streak: number;
    };
    c.expect(wk.days.length === 7 && wk.is_current, "seven days, current week");
    const todayEp = Number(psql(`select max(ep) from public.rolls where user_id = ${q(p.id)} and roll_date = ${q(T)}`));
    c.expect(wk.total_ep === todayEp && wk.best?.ep === todayEp, `total is the day's best (${wk.total_ep} vs ${todayEp})`);
    c.expect(wk.days.some((d) => d.date === T && d.ep === todayEp), "today's slot holds the roll");
    c.expect(wk.players >= 2 && wk.rank !== null, "rank among players");
    c.expect(wk.streak === 1, "streak 1");
    c.expect(!JSON.stringify(wk).includes(rival.name), "no other player's name appears");
    const last = (await p.client.rpc("weekly_recap", { week_back: 1 })).data as { total_ep: number; rank: number | null; best: unknown };
    c.expect(last.total_ep === 0 && last.rank === null && last.best === null, "an empty week is empty");
    c.expect(!!(await p.client.rpc("weekly_recap", { week_back: -1 })).error, "negative week rejected");
    c.expect(!!(await p.client.rpc("weekly_recap", { week_back: 9999 })).error, "huge week rejected");
    c.expect(!!(await anon.rpc("weekly_recap", { week_back: 0 })).error, "signed-out cannot call weekly_recap");
    c.done();
  }

  // --------------------------------------------------------------- FEAT-12
  {
    const c = new Check("FEAT-12", "new tables and functions: no signed-out access, no direct writes, no cross-player reads");
    const a = await newPlayer("sec_a");
    const b = await newPlayer("sec_b");
    await a.client.rpc("roll_today");
    await b.client.rpc("roll_today");
    psql(`insert into public.streak_shields (user_id, count) values (${q(a.id)}, 2) on conflict (user_id) do update set count = 2`);
    const tables = ["ep_credits", "reroll_tokens", "cosmetics", "player_cosmetics", "streak_shields", "shield_uses", "streak_milestone_defs", "streak_milestones",
      "game_events", "event_days", "event_hits", "community_numbers", "community_results", "hunt_days", "hunt_hits", "hunt_progress", "family_fusions", "album_rewards", "album_claims"];
    for (const t of tables) {
      const res = await anon.from(t).select("*").limit(3);
      c.expect(!res.error ? (res.data ?? []).length === 0 : true, `anon select ${t}`);
      const w = await a.client.from(t).insert({ user_id: a.id } as never);
      c.expect(!!w.error, `signed-in insert into ${t} is denied`);
      const u = await a.client.from(t).update({ user_id: a.id } as never).eq("user_id", a.id).select();
      c.expect(!!u.error || (u.data ?? []).length === 0, `signed-in update ${t} is denied`);
      const d = await a.client.from(t).delete().eq("user_id", a.id).select();
      c.expect(!!d.error || (d.data ?? []).length === 0, `signed-in delete ${t} is denied`);
    }
    const peek = await b.client.from("streak_shields").select("*").eq("user_id", a.id);
    c.expect((peek.data ?? []).length === 0, "cannot read another player's shields");
    const ownShield = await a.client.from("streak_shields").select("count").eq("user_id", a.id);
    c.expect(ownShield.data?.[0]?.count === 2, "can read your own shields");
    for (const [fn, args] of [["my_streak", {}], ["buy_shield", {}], ["set_shield_auto", { on_off: true }], ["buy_cosmetic", { item: "aura-void" }],
      ["equip_cosmetic", { slot: "aura", item: null }], ["event_status", {}], ["community_today", {}], ["hunt_today", {}], ["fuse_family", { fam: "repeat" }],
      ["weekly_recap", { week_back: 0 }]] as [string, Record<string, unknown>][]) {
      c.expect(!!(await anon.rpc(fn, args)).error, `signed-out ${fn} is denied`);
    }
    for (const fn of ["grant_ep", "grant_cosmetic", "after_roll", "record_roll", "apply_shields", "check_milestones", "hunt_for", "community_number", "streak_info"]) {
      const res = await a.client.schema("private" as never).rpc(fn as never, {} as never);
      c.expect(!!res.error, `private.${fn} is not callable by players`);
    }
    c.done();
  }

  // --------------------------------------------------------------- FEAT-13
  {
    const c = new Check("FEAT-13", "rescore_all keeps EP credits and event bonuses");
    const p = await newPlayer("rescore");
    await p.client.rpc("roll_today");
    psql(`select private.grant_ep(${q(p.id)}::uuid, 'album', '10', 500)`);
    psql(`update public.rolls set event_bonus_ep = 123, ep = ep + 123 where user_id = ${q(p.id)}`);
    const spentBefore = psql(`select spent_ep from public.ep_wallets where user_id = ${q(p.id)}`);
    psql("select private.rescore_all()");
    const expected = Number(psql(`select coalesce(sum(ep), 0) from public.rolls where user_id = ${q(p.id)}`)) + 500;
    c.expect(Number(psql(`select earned_ep from public.ep_wallets where user_id = ${q(p.id)}`)) === expected, "wallet = rolls + credits after a rescore");
    c.expect(psql(`select event_bonus_ep from public.rolls where user_id = ${q(p.id)}`) === "123", "the event bonus survives");
    c.expect(psql(`select spent_ep from public.ep_wallets where user_id = ${q(p.id)}`) === spentBefore, "spent EP is untouched");
    c.expect(psql(`select private.grant_ep(${q(p.id)}::uuid, 'album', '10', 500)`) === "0", "the same credit cannot be paid twice");
    c.done();
  }

  // --------------------------------------------------------------- FEAT-14
  {
    const c = new Check("FEAT-14", "album rewards");
    const p = await newPlayer("album");
    await p.client.rpc("roll_today");
    const total = Number(psql("select count(*) from public.badges"));
    const need = Math.ceil((total * 10) / 100);
    psql(`insert into public.rolls (user_id, roll_date, number, ep, base_ep, tier, attempt)
          select ${q(p.id)}, ((now() at time zone 'utc')::date - 60), 5, 1, 1, 'common', 0 on conflict do nothing`);
    psql(`insert into public.roll_badges (roll_id, badge_id)
          select (select id from public.rolls where user_id = ${q(p.id)} and roll_date = ((now() at time zone 'utc')::date - 60)), b.id
            from public.badges b order by b.id limit ${need} on conflict do nothing`);
    const r = afterRoll(p.id, T, [], 5);
    c.expect(r.some((x) => x.kind === "album" && x.title === "Album 10% complete"), `10% reward: ${JSON.stringify(r)}`);
    c.expect(creditSum(p.id, "album") === 500, "500 EP");
    c.expect(afterRoll(p.id, T, [], 5).every((x) => x.kind !== "album"), "paid once");
    c.done();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} feature checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
