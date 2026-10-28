// Draws the weekly recap as a PNG for "Save as image" (no libraries: plain canvas).

import { tierColor } from "./tiers";

export interface RecapDay {
  date: string;
  number: number | null;
  ep: number | null;
  tier: string | null;
}

export interface Recap {
  week_start: string;
  week_end: string;
  week_number: number;
  is_current: boolean;
  total_ep: number;
  last_week_ep: number;
  days: RecapDay[];
  best: { number: number; ep: number; tier: string; date: string } | null;
  rarest_badge: { name: string; emoji: string; rarity: string; ep: number; one_in: number } | null;
  streak: number;
  shields_used: number;
  rank: number | null;
  players: number;
  luckier_than_pct: number | null;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10] ?? "th"}`;
}

export function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

export function dayMonth(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "+38%", "-12%" or null when there is nothing to compare with. */
export function changePct(r: Pick<Recap, "total_ep" | "last_week_ep">): number | null {
  if (r.last_week_ep <= 0) return null;
  return Math.round((100 * (r.total_ep - r.last_week_ep)) / r.last_week_ep);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderRecapPng(r: Recap, name: string): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas unavailable"));
  const font = (size: number, weight = 700) => `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#4c1d95");
  bg.addColorStop(0.55, "#1e1b4b");
  bg.addColorStop(1, "#0b0a14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 120, 120, 10, W - 120, 120, 420);
  glow.addColorStop(0, "rgba(167,139,250,0.45)");
  glow.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 80;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c4b5fd";
  ctx.font = font(34, 800);
  ctx.fillText(`WEEK ${r.week_number} RECAP`, pad, 130);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = font(34, 500);
  ctx.textAlign = "right";
  ctx.fillText(`${dayMonth(r.week_start)} to ${dayMonth(r.week_end)}`, W - pad, 130);
  ctx.textAlign = "left";

  ctx.fillStyle = "#e4e4e7";
  ctx.font = font(44, 500);
  ctx.fillText("Total EP this week", pad, 220);
  ctx.fillStyle = "#ffffff";
  // Shrink the big number until it fits, however many digits it has.
  let size = 190;
  ctx.font = font(size, 900);
  while (size > 60 && ctx.measureText(fmt(r.total_ep)).width > W - pad * 2) {
    size -= 6;
    ctx.font = font(size, 900);
  }
  ctx.fillText(fmt(r.total_ep), pad, 400);
  const pct = changePct(r);
  if (pct !== null) {
    ctx.fillStyle = pct >= 0 ? "#34d399" : "#fb7185";
    ctx.font = font(44, 800);
    ctx.fillText(pct >= 0 ? `Up ${pct}% on last week` : `Down ${Math.abs(pct)}% on last week`, pad, 470);
  }

  ctx.fillStyle = "#a1a1aa";
  ctx.font = font(34, 800);
  ctx.fillText("YOUR SEVEN ROLLS", pad, 560);
  const gap = 14;
  const cell = (W - pad * 2 - gap * 6) / 7;
  r.days.forEach((d, i) => {
    const x = pad + i * (cell + gap);
    ctx.fillStyle = d.tier ? tierColor(d.tier) : "#2a2740";
    roundRect(ctx, x, 590, cell, 100, 22);
    ctx.fill();
    ctx.fillStyle = "#a1a1aa";
    ctx.font = font(28, 500);
    ctx.textAlign = "center";
    ctx.fillText(weekday(d.date), x + cell / 2, 740);
    ctx.textAlign = "left";
  });

  const tile = (x: number, y: number, label: string, value: string, sub: string, subColor: string) => {
    const w = (W - pad * 2 - 24) / 2;
    ctx.fillStyle = "rgba(9,9,11,0.7)";
    roundRect(ctx, x, y, w, 210, 32);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#d4d4d8";
    ctx.font = font(32, 500);
    ctx.fillText(label, x + 36, y + 58);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(value.length > 12 ? 46 : 62, 900);
    ctx.fillText(value, x + 36, y + 128);
    ctx.fillStyle = subColor;
    ctx.font = font(32, 800);
    ctx.fillText(sub, x + 36, y + 180);
  };
  const colW = (W - pad * 2 - 24) / 2;
  tile(pad, 790, "Best roll", r.best ? fmt(r.best.number) : "None yet", r.best ? `${r.best.tier[0].toUpperCase()}${r.best.tier.slice(1)}` : "", r.best ? tierColor(r.best.tier) : "#a1a1aa");
  tile(pad + colW + 24, 790, "Rarest badge", r.rarest_badge?.name ?? "None yet", r.rarest_badge ? `1 in ${fmt(r.rarest_badge.one_in)}` : "", "#a78bfa");
  tile(pad, 1024, "Streak", `${r.streak} ${r.streak === 1 ? "day" : "days"}`, r.shields_used ? `${r.shields_used} shield used` : "Keep it going", "#38bdf8");
  tile(pad + colW + 24, 1024, "Rank this week", r.rank ? ordinal(r.rank) : "None yet", r.players ? `of ${fmt(r.players)} players` : "", "#34d399");

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.moveTo(pad, 1262);
  ctx.lineTo(W - pad, 1262);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = font(36, 800);
  ctx.fillText(`${name} on Luckline`, pad, 1316);
  if (r.luckier_than_pct !== null) {
    ctx.fillStyle = "#a1a1aa";
    ctx.font = font(32, 500);
    ctx.textAlign = "right";
    ctx.fillText(`Luckier than ${r.luckier_than_pct}% of players`, W - pad, 1316);
    ctx.textAlign = "left";
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not make the image"))), "image/png"));
}
