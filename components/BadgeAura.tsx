"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { auraFor, seeded, type AuraKind, type AuraSpec } from "@/lib/game/auras";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const CODE_CHARS = "01ABCDEF<>/{}#$%";

/** Points for a small jagged bolt in a 40x40 box, pointing up. */
function boltPoints(rand: () => number) {
  const pts: string[] = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const y = 40 - (40 * i) / steps;
    const x = 20 + (i === 0 || i === steps ? (rand() - 0.5) * 6 : (rand() - 0.5) * 22);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

/** A point just outside the card: edge 0 top, 1 right, 2 bottom, 3 left. */
function outside(rand: () => number, reach: number, size: number): { style: Vars; edge: number } {
  const edge = Math.floor(rand() * 4);
  const out = 2 + rand() * Math.max(6, reach);
  const along = `${(rand() * 100).toFixed(1)}%`;
  const style: Vars = {};
  if (edge === 0) {
    style.left = along;
    style.top = `${-out - size}px`;
  } else if (edge === 2) {
    style.left = along;
    style.top = `calc(100% + ${out}px)`;
  } else if (edge === 1) {
    style.top = along;
    style.left = `calc(100% + ${out}px)`;
  } else {
    style.top = along;
    style.left = `${-out - size}px`;
  }
  return { style, edge };
}

function Layers({ spec }: { spec: AuraSpec }) {
  const nodes = useMemo(() => {
    const rand = seeded(spec.seed);
    const n = (base: number) => Math.max(2, Math.round(base * spec.count));
    const out: ReactNode[] = [];
    const reach = spec.size * 0.75;
    const has = (k: AuraKind) => spec.kinds.includes(k);

    if (has("ripple")) {
      for (let i = 0; i < 2 + (spec.rank > 2 ? 1 : 0); i++) out.push(<span key={`r${i}`} className="lk-fx lk-fx-ring" style={{ "--i": i }} />);
    }
    if (has("void")) {
      out.push(<span key="vortex" className="lk-fx lk-fx-vortex" />);
      for (let i = 0; i < 3; i++) out.push(<span key={`pull${i}`} className="lk-fx lk-fx-pull" style={{ "--i": i }} />);
    }
    if (has("prism")) {
      out.push(<span key="prism" className="lk-fx lk-fx-prism" />);
      out.push(<span key="sheen" className="lk-fx lk-fx-sheen" />);
    }
    if (has("gold")) {
      out.push(<span key="goldsheen" className="lk-fx lk-fx-sheen lk-fx-sheen-gold" />);
      for (let i = 0; i < n(7); i++) {
        const p = outside(rand, reach, 8);
        out.push(
          <span
            key={`g${i}`}
            className="lk-fx lk-fx-coin"
            style={{ ...p.style, "--d": `${(rand() * 2.4).toFixed(2)}s`, "--t": `${(1.6 + rand() * 1.4).toFixed(2)}s`, "--fall": `${(26 + rand() * (30 + spec.size)).toFixed(0)}px`, "--spin": `${(rand() * 720 - 360).toFixed(0)}deg` }}
          />,
        );
      }
    }
    if (has("orbit")) out.push(<span key="orbit" className="lk-fx lk-fx-orbit" style={{ "--t": `${(2.2 + rand() * 1.6).toFixed(2)}s` }} />);
    if (has("embers")) {
      for (let i = 0; i < n(10); i++) {
        out.push(
          <span
            key={`e${i}`}
            className="lk-fx lk-fx-ember"
            style={{
              left: `${(4 + rand() * 92).toFixed(1)}%`,
              "--rise": `${(34 + rand() * 46 + spec.size * 0.9).toFixed(0)}px`,
              "--dx": `${((rand() - 0.5) * 36).toFixed(0)}px`,
              "--d": `${(rand() * 2.6).toFixed(2)}s`,
              "--t": `${(1.3 + rand() * 1.6).toFixed(2)}s`,
              "--s": `${(3 + rand() * 4).toFixed(1)}px`,
            }}
          />,
        );
      }
    }
    if (has("sparkle")) {
      for (let i = 0; i < n(7); i++) {
        const s = (5 + rand() * 8) * (0.8 + spec.rank / 8);
        const p = outside(rand, reach, s / 2);
        out.push(<span key={`s${i}`} className="lk-fx lk-fx-spark" style={{ ...p.style, "--s": `${s.toFixed(1)}px`, "--d": `${(rand() * 2.2).toFixed(2)}s`, "--t": `${(1.2 + rand() * 1.4).toFixed(2)}s` }} />);
      }
    }
    if (has("lightning")) {
      for (let i = 0; i < Math.max(2, Math.round(3 * spec.count)); i++) {
        const p = outside(rand, 2, 14);
        const rot = [0, 90, 180, 270][p.edge];
        out.push(
          <svg key={`b${i}`} className="lk-fx lk-fx-bolt" viewBox="0 0 40 40" style={{ ...p.style, "--rot": `${rot + (rand() - 0.5) * 40}deg`, "--d": `${(rand() * 2.4).toFixed(2)}s`, "--t": `${(1.4 + rand() * 1.8).toFixed(2)}s` }}>
            <polyline points={boltPoints(rand)} />
          </svg>,
        );
      }
    }
    if (has("code")) {
      for (let i = 0; i < n(9); i++) {
        const left = rand() < 0.5;
        const off = 3 + rand() * Math.max(4, reach);
        out.push(
          <span
            key={`c${i}`}
            className="lk-fx lk-fx-code"
            style={{
              [left ? "left" : "right"]: `${-off - 8}px`,
              top: `${(rand() * 60 - 20).toFixed(0)}%`,
              "--d": `${(rand() * 2.4).toFixed(2)}s`,
              "--t": `${(1.3 + rand() * 1.5).toFixed(2)}s`,
              "--fall": `${(30 + rand() * 40).toFixed(0)}px`,
            }}
          >
            {CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]}
          </span>,
        );
      }
    }
    return out;
  }, [spec]);
  return <>{nodes}</>;
}

interface Props {
  slug?: string;
  rarity?: string;
  /** A ready-made aura (for cosmetics); replaces the one worked out from slug and rarity. */
  spec?: AuraSpec;
  /** Mounts the effects (so they start when the badge appears). */
  active?: boolean;
  /** 0..1: lower for busy lists such as the collection page. */
  intensity?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a badge card in an aura. The card keeps its own background; the glow
 * and effects sit around and over it. Bigger and wilder for rarer badges.
 */
export function BadgeAura({ slug = "", rarity = "common", spec: given, active = true, intensity = 1, className = "", children }: Props) {
  const spec = useMemo(() => given ?? auraFor(slug, rarity, intensity), [given, slug, rarity, intensity]);
  const style: Vars = {
    "--aura": spec.color,
    "--aura-size": `${spec.size}px`,
    "--aura-alpha": spec.alpha,
    "--hue": `${spec.hue}deg`,
    "--radius": "0.75rem",
  };
  return (
    <div className={`lk-aura lk-aura-r${spec.rank} ${spec.theme ? `lk-theme-${spec.theme}` : ""} ${className}`} style={style} data-aura={spec.kinds.join(" ")}>
      {active && (
        <>
          <span aria-hidden className="lk-aura-glow" />
          <span aria-hidden className="lk-aura-burst" />
          <span aria-hidden className="lk-fx-layer">
            <Layers spec={spec} />
          </span>
        </>
      )}
      {children}
    </div>
  );
}
