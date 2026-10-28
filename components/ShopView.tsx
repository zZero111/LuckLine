"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AURA_TAG,
  KIND_LABEL,
  REVEAL_PALETTE,
  auraSpec,
  cosmeticColor,
  nameClass,
  type Cosmetic,
  type CosmeticKind,
} from "@/lib/game/cosmetics";
import { sfx } from "@/lib/game/sfx";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";
import { BadgeAura } from "./BadgeAura";
import { Confetti } from "./Confetti";
import { PlayerName } from "./PlayerName";
import { SignInPrompt } from "./SignInPrompt";
import { formatNumber } from "./types";

const KINDS: CosmeticKind[] = ["aura", "frame", "reveal", "name"];
const AURA_ICON: Record<string, string> = {
  "aura-ember": "🔥",
  "aura-void": "🕳️",
  "aura-code": "01",
  "aura-storm": "⚡",
  "aura-gold": "✦",
  "aura-starfall": "✨",
  "aura-beast": "👹",
};

function friendly(message: string) {
  if (message.includes("not enough EP")) return "You don't have enough EP for that yet.";
  if (message.includes("already owned")) return "You already own that.";
  if (message.includes("not for sale")) return "That one can't be bought. It has to be earned.";
  if (message.includes("do not own")) return "You don't own that yet.";
  return "Something went wrong. Please try again.";
}

/** The little picture on a shop card. */
function Swatch({ item, big = false, name }: { item: Cosmetic; big?: boolean; name?: string | null }) {
  const color = cosmeticColor(item);
  if (item.kind === "aura") {
    const spec = auraSpec(item.id, big ? 1 : 0.7);
    const body = (
      <div
        className="flex items-center justify-center rounded-xl border bg-zinc-950 px-4 py-3 font-bold"
        style={{ borderColor: `${color}aa`, minWidth: big ? 0 : 56, color }}
      >
        {big ? (
          <span className="flex w-full items-center gap-3 text-zinc-100">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-sm font-bold text-white">{(name ?? "Y").slice(0, 1).toUpperCase()}</span>
            <span className="flex-1 text-lg font-bold">{name ?? "You"}</span>
            <span className="font-mono tabular-nums">5,877</span>
          </span>
        ) : (
          <span className="text-xl">{AURA_ICON[item.id] ?? "✦"}</span>
        )}
      </div>
    );
    return (
      <div className="flex items-center justify-center rounded-xl px-4 py-5" style={{ background: `radial-gradient(ellipse at 50% 60%, ${color}33, transparent 70%), #0a0a0b` }}>
        {spec ? (
          <BadgeAura spec={spec} className={big ? "w-full" : ""}>
            {body}
          </BadgeAura>
        ) : (
          body
        )}
      </div>
    );
  }
  if (item.kind === "frame") {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl px-4 py-5" style={{ background: `radial-gradient(ellipse at 50% 60%, ${color}26, transparent 70%), #0a0a0b` }}>
        <Avatar path={null} name={name ?? "You"} size={big ? 64 : 44} frame={item.id} />
        {big && <PlayerName name={name ?? "You"} className="text-lg font-bold" />}
      </div>
    );
  }
  if (item.kind === "reveal") {
    const colors = REVEAL_PALETTE[item.id] ?? [color];
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-5" style={{ background: `radial-gradient(ellipse at 50% 60%, ${colors[0]}33, transparent 70%), #0a0a0b` }}>
        <span
          className="font-mono font-black tabular-nums"
          style={{
            fontSize: big ? 40 : 22,
            backgroundImage: `linear-gradient(90deg, ${colors.join(",")})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          358,214
        </span>
        <span className="flex h-2 w-full max-w-[12rem] overflow-hidden rounded-full">
          {colors.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center rounded-xl px-4 py-6" style={{ background: `radial-gradient(ellipse at 50% 60%, ${color}26, transparent 70%), #0a0a0b` }}>
      <span className={`font-black ${big ? "text-3xl" : "text-lg"} ${nameClass(item.id)}`} style={{ color: nameClass(item.id) ? undefined : color }}>
        {name ?? "You"}
      </span>
    </div>
  );
}

/** The shop: cosmetics bought with EP. They never change a roll, the odds or the score. */
export function ShopView() {
  const { status, user, displayName, cosmetics: equipped, balance, refreshProfile } = useAuth();
  const [items, setItems] = useState<Cosmetic[] | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<CosmeticKind>("aura");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const [cat, mine] = await Promise.all([
      supabase.from("cosmetics").select("*").order("sort"),
      supabase.from("player_cosmetics").select("item_id").eq("user_id", userId),
    ]);
    setItems((cat.data ?? []) as Cosmetic[]);
    setOwned(new Set((mine.data ?? []).map((r) => r.item_id)));
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") return <div className="h-64 lk-shimmer rounded-xl bg-zinc-900" />;
  if (status === "signedOut") return <SignInPrompt message="Sign in to visit the shop." />;
  if (!items) return <div className="h-64 lk-shimmer rounded-xl bg-zinc-900" />;

  const inKind = items.filter((i) => i.kind === kind);
  const current = inKind.find((i) => i.id === picked[kind]) ?? inKind[0];
  const slotValue = (k: CosmeticKind) => (k === "name" ? equipped.nameStyle : equipped[k]);
  const isEquipped = (i: Cosmetic) => slotValue(i.kind) === i.id;

  async function act(item: Cosmetic) {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (owned.has(item.id)) {
      // item null clears the slot; the generated type doesn't know the argument may be null.
      const { error } = await supabase.rpc("equip_cosmetic", { slot: item.kind, item: (isEquipped(item) ? null : item.id) as string });
      if (error) setMessage(friendly(error.message));
      else sfx.success();
    } else {
      const { error } = await supabase.rpc("buy_cosmetic", { item: item.id });
      if (error) setMessage(friendly(error.message));
      else {
        sfx.coin();
        setBurst((b) => b + 1);
      }
    }
    await Promise.all([load(), refreshProfile()]);
    setBusy(false);
  }

  const button = (item: Cosmetic) => {
    const base = "w-full rounded-xl px-4 py-3 text-lg font-bold transition active:scale-95 disabled:cursor-not-allowed";
    if (owned.has(item.id)) {
      return isEquipped(item) ? (
        <button type="button" disabled={busy} onClick={() => act(item)} className={`${base} border border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25`}>
          ✓ Equipped · tap to remove
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => act(item)} className={`${base} bg-violet-600 text-white hover:bg-violet-500`}>
          Equip
        </button>
      );
    }
    if (item.price == null) {
      return (
        <button type="button" disabled className={`${base} border border-zinc-700 bg-zinc-900 text-zinc-400`}>
          🔒 {item.unlock ?? "Earn it in game"}
        </button>
      );
    }
    return balance >= item.price ? (
      <button type="button" disabled={busy} onClick={() => act(item)} className={`${base} bg-amber-400 text-zinc-950 hover:bg-amber-300`}>
        Buy · {formatNumber(item.price)} EP
      </button>
    ) : (
      <button type="button" disabled className={`${base} border border-zinc-700 bg-zinc-900 text-zinc-400`}>
        Need {formatNumber(item.price - balance)} more EP · {formatNumber(item.price)} EP
      </button>
    );
  };

  return (
    <>
      {burst > 0 && <Confetti key={burst} color="#fbbf24" rank={4} />}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Shop</h1>
        <p className="text-sm text-zinc-400">
          Your EP <span className="font-bold tabular-nums text-amber-300">{formatNumber(balance)}</span>
        </p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Shop sections">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              sfx.click();
              setKind(k);
              setMessage(null);
            }}
            aria-pressed={kind === k}
            className={`rounded-full px-5 py-2 text-sm font-bold transition ${kind === k ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </nav>

      {current && (
        <section key={current.id} className="lk-pop flex flex-col gap-3 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
          <Swatch item={current} big name={displayName} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black tracking-tight">{current.name}</h2>
              <p className="text-sm text-zinc-400">{current.description}</p>
              {current.price != null && current.unlock && !owned.has(current.id) && (
                <p className="mt-1 text-xs text-zinc-500">Or earn it free: {current.unlock}</p>
              )}
            </div>
            {current.kind === "aura" && AURA_TAG[current.id] && (
              <span className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider" style={{ color: cosmeticColor(current), background: `${cosmeticColor(current)}26` }}>
                {AURA_TAG[current.id]}
              </span>
            )}
          </div>
          {button(current)}
          {message && (
            <p role="alert" className="text-sm text-rose-300">
              {message}
            </p>
          )}
        </section>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {inKind.map((item, i) => {
          const color = cosmeticColor(item);
          const sel = current?.id === item.id;
          const have = owned.has(item.id);
          return (
            <li key={item.id} className="lk-card" style={{ ["--i" as string]: i }}>
              <button
                type="button"
                onClick={() => {
                  sfx.click();
                  setPicked((p) => ({ ...p, [kind]: item.id }));
                  setMessage(null);
                }}
                aria-pressed={sel}
                className="lk-lift flex h-full w-full flex-col gap-2 rounded-2xl border bg-zinc-900/60 p-2 text-left"
                style={{ borderColor: sel ? color : have && isEquipped(item) ? "#10b981" : "rgb(39 39 42)", boxShadow: sel ? `0 0 18px ${color}40` : undefined }}
              >
                <Swatch item={item} name={displayName} />
                <span className="flex items-center justify-between gap-2 px-1 pb-1">
                  <span className="truncate font-bold">{item.name}</span>
                  {isEquipped(item) ? (
                    <span className="shrink-0 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-950">Equipped</span>
                  ) : have ? (
                    <span className="shrink-0 text-xs font-semibold text-emerald-300">Owned</span>
                  ) : item.price != null ? (
                    <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color }}>
                      {formatNumber(item.price)} EP
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-500">🔒 Earn</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-sm text-zinc-500">Cosmetics only. They never change your roll, your odds or your score.</p>
    </>
  );
}
