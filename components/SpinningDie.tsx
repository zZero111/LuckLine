"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Group, Object3D } from "three";
import { BASE_PATH } from "@/lib/base-path";

export interface DieProps {
  size?: number;
  /** Idle tumble speed in degrees per second (on the fastest axis). */
  speed?: number;
  /** Tumble faster (like on hover). The change eases in and out. */
  fast?: boolean;
  /** Increase to give the die a whirl that gradually slows back down. */
  kick?: number;
  className?: string;
}

// Opposite faces add up to 7, like a real die. [pip count, face transform]
const FACES: [number, string][] = [
  [1, "rotateY(0deg)"],
  [6, "rotateY(180deg)"],
  [2, "rotateY(90deg)"],
  [5, "rotateY(-90deg)"],
  [3, "rotateX(90deg)"],
  [4, "rotateX(-90deg)"],
];

// Which cells of a 3x3 grid hold a pip for each number.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Slightly different shading per face so the cube reads as solid.
const SHADE = [1, 0.62, 0.86, 0.74, 1.12, 0.55];

/** CSS-only 3D cube, used if WebGL or the model is unavailable. */
function CssDie({ size = 30, speed = 45, fast = false, kick = 0, className = "" }: DieProps) {
  const cube = useRef<HTMLDivElement>(null);
  const motion = useRef({ x: -24, y: 38, z: 0, impulse: 0, boost: 0, fast });

  useEffect(() => {
    motion.current.fast = fast;
  }, [fast]);

  useEffect(() => {
    if (kick > 0) motion.current.impulse = 1400;
  }, [kick]);

  useEffect(() => {
    const draw = () => {
      const m = motion.current;
      if (cube.current) cube.current.style.transform = `rotateX(${m.x.toFixed(1)}deg) rotateY(${m.y.toFixed(1)}deg) rotateZ(${m.z.toFixed(1)}deg)`;
    };
    draw();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = motion.current;
      m.impulse *= Math.pow(0.2, dt); // a kick fades over about a second
      const target = (m.fast ? 6 : 1) + m.impulse / Math.max(1, speed);
      m.boost += (target - m.boost) * Math.min(1, dt * 5);
      // Three different rates, so the die never repeats the same tumble.
      m.x = (m.x + speed * 0.9 * m.boost * dt) % 360;
      m.y = (m.y + speed * 1.15 * m.boost * dt) % 360;
      m.z = (m.z + speed * 0.5 * m.boost * dt) % 360;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const half = size / 2;
  const pip = Math.max(2.2, size * 0.15);
  const radius = size * 0.2;

  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size, perspective: size * 5 }}
    >
      <div ref={cube} style={{ width: size, height: size, position: "relative", transformStyle: "preserve-3d", willChange: "transform" }}>
        {/* Solid core so the rounded corners never show daylight. */}
        {["rotateY(0deg)", "rotateY(90deg)", "rotateX(90deg)"].map((t) => (
          <div key={t} style={{ position: "absolute", inset: size * 0.06, background: "#4c1d95", transform: t }} />
        ))}
        {FACES.map(([n, t], i) => (
          <div
            key={n}
            style={{
              position: "absolute",
              inset: 0,
              transform: `${t} translateZ(${half}px)`,
              borderRadius: radius,
              background: "linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 55%, #6d28d9 100%)",
              filter: `brightness(${SHADE[i]})`,
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18), inset 0 -2px 4px rgb(76 29 149 / 0.5)",
              display: "grid",
              gridTemplate: "repeat(3, 1fr) / repeat(3, 1fr)",
              padding: size * 0.16,
              backfaceVisibility: "hidden",
            }}
          >
            {Array.from({ length: 9 }, (_, cell) => (
              <span key={cell} style={{ display: "grid", placeItems: "center" }}>
                {PIPS[n].includes(cell) && (
                  <span style={{ width: pip, height: pip, borderRadius: "50%", background: "#fff", boxShadow: "inset 0 -1px 1px rgb(76 29 149 / 0.4)" }} />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </span>
  );
}

const MODEL_URL = `${BASE_PATH}/models/dice.glb`;
const PURPLE = "#7c3aed";

/** One shared download + parse of the model, cloned for each logo on the page. */
let modelPromise: Promise<Object3D> | null = null;
function loadModel(): Promise<Object3D> {
  modelPromise ??= (async () => {
    const [THREE, { GLTFLoader }] = await Promise.all([import("three"), import("three/examples/jsm/loaders/GLTFLoader.js")]);
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const root = gltf.scene;
    // The model is red with grey pips: recolour to purple with white pips and a softer sheen.
    root.traverse((o) => {
      const mesh = o as import("three").Mesh;
      if (!mesh.isMesh) return;
      const old = mesh.material as import("three").MeshStandardMaterial;
      const body = old.color.r > 0.3 && old.color.g < 0.2;
      mesh.material = new THREE.MeshStandardMaterial({
        color: body ? PURPLE : "#f5f3ff",
        roughness: body ? 0.35 : 0.5,
        metalness: body ? 0.15 : 0,
        side: THREE.DoubleSide,
      });
      old.dispose();
    });
    // Centre it and scale so the whole die fits a sphere of radius 1 (it never clips while spinning).
    const box = new THREE.Box3().setFromObject(root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const holder = new THREE.Group();
    root.position.sub(sphere.center);
    holder.add(root);
    holder.scale.setScalar(1 / sphere.radius);
    return holder;
  })();
  modelPromise.catch(() => (modelPromise = null));
  return modelPromise;
}

function GlDie({ size, speed, fast, kick, className, onFail }: DieProps & { size: number; speed: number; onFail: () => void }) {
  const host = useRef<HTMLSpanElement>(null);
  const motion = useRef({ impulse: 0, boost: 0, fast: !!fast });

  useEffect(() => {
    motion.current.fast = !!fast;
  }, [fast]);
  useEffect(() => {
    if ((kick ?? 0) > 0) motion.current.impulse = 1400;
  }, [kick]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => {};
    (async () => {
      try {
        const THREE = await import("three");
        const model = await loadModel();
        if (dead) return;
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(size, size);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        el.appendChild(renderer.domElement);
        renderer.domElement.style.display = "block";

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
        camera.position.z = 1 / Math.sin((30 / 2) * (Math.PI / 180)) + 0.05; // sphere of radius 1 just fits
        scene.add(new THREE.HemisphereLight("#ede9fe", "#2e1065", 1.5));
        const key = new THREE.DirectionalLight("#ffffff", 2.4);
        key.position.set(2, 3, 4);
        scene.add(key);
        const rim = new THREE.DirectionalLight("#a78bfa", 1.2);
        rim.position.set(-3, -1, -2);
        scene.add(rim);

        const spinner: Group = new THREE.Group();
        const instance = model.clone(true);
        spinner.add(instance);
        spinner.rotation.set(0.5, 0.7, 0);
        scene.add(spinner);

        const render = () => renderer.render(scene, camera);
        render();
        if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
          let last = performance.now();
          const loop = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const m = motion.current;
            m.impulse *= Math.pow(0.2, dt);
            const target = (m.fast ? 6 : 1) + m.impulse / Math.max(1, speed);
            m.boost += (target - m.boost) * Math.min(1, dt * 5);
            const k = (Math.PI / 180) * speed * m.boost * dt;
            // Three different rates on three axes: a proper tumble.
            spinner.rotation.x += k * 0.9;
            spinner.rotation.y += k * 1.15;
            spinner.rotation.z += k * 0.5;
            render();
            raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
        }
        cleanup = () => {
          cancelAnimationFrame(raf);
          renderer.dispose();
          renderer.domElement.remove();
        };
        if (dead) cleanup();
      } catch {
        if (!dead) onFail();
      }
    })();
    return () => {
      dead = true;
      cleanup();
    };
  }, [size, speed, onFail]);

  return <span ref={host} aria-hidden className={`inline-block shrink-0 ${className ?? ""}`} style={{ width: size, height: size }} />;
}

/** The 3D dice model, tumbling on all axes. Falls back to a CSS cube if WebGL is unavailable. */
export function SpinningDie({ size = 30, speed = 45, ...rest }: DieProps) {
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  if (failed) return <CssDie size={size} speed={speed} {...rest} />;
  return <GlDie size={size} speed={speed} {...rest} onFail={onFail} />;
}
