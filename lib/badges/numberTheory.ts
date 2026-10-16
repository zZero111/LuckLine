// Precomputed number-theory tables for badge tests. Built lazily on first use
// (well under a second), so tests that never touch them pay nothing.

import { MAX_ROLL } from "./helpers";

const PRIME_LIMIT = 2 * MAX_ROLL + 10; // Sophie Germain checks need 2p + 1

let primeSieve: Uint8Array | null = null;
let spf: Int32Array | null = null; // smallest prime factor, 0..MAX_ROLL
let sigma: Float64Array | null = null; // sum of all divisors, 0..MAX_ROLL
let ndiv: Uint16Array | null = null; // number of divisors, 0..MAX_ROLL

function primes() {
  if (!primeSieve) {
    const s = new Uint8Array(PRIME_LIMIT + 1).fill(1);
    s[0] = 0;
    s[1] = 0;
    for (let i = 2; i * i <= PRIME_LIMIT; i++) {
      if (s[i]) for (let j = i * i; j <= PRIME_LIMIT; j += i) s[j] = 0;
    }
    primeSieve = s;
  }
  return primeSieve;
}

/** Fast primality for 0 <= n <= 2,000,010. */
export function isPrimeFast(n: number): boolean {
  return n >= 0 && n <= PRIME_LIMIT && primes()[n] === 1;
}

function smallestFactors() {
  if (!spf) {
    const a = new Int32Array(MAX_ROLL + 1);
    for (let i = 2; i <= MAX_ROLL; i++) {
      if (a[i] === 0) for (let j = i; j <= MAX_ROLL; j += i) if (a[j] === 0) a[j] = i;
    }
    spf = a;
  }
  return spf;
}

/** Prime factorisation as [prime, exponent] pairs (n >= 2, n <= MAX_ROLL). */
export function factorize(n: number): [number, number][] {
  const f = smallestFactors();
  const out: [number, number][] = [];
  while (n > 1) {
    const p = f[n];
    let e = 0;
    while (n % p === 0) {
      n /= p;
      e++;
    }
    out.push([p, e]);
  }
  return out;
}

function divisorTables() {
  if (!sigma || !ndiv) {
    const s = new Float64Array(MAX_ROLL + 1);
    const d = new Uint16Array(MAX_ROLL + 1);
    for (let i = 1; i <= MAX_ROLL; i++) {
      for (let j = i; j <= MAX_ROLL; j += i) {
        s[j] += i;
        d[j]++;
      }
    }
    sigma = s;
    ndiv = d;
  }
  return { sigma, ndiv };
}

/** Sum of divisors, for any positive n (table up to MAX_ROLL, trial division above). */
export function sigmaOf(n: number): number {
  if (n <= MAX_ROLL) return divisorTables().sigma[n];
  let total = 1;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p) continue;
    let term = 1;
    let pk = 1;
    while (m % p === 0) {
      m /= p;
      pk *= p;
      term += pk;
    }
    total *= term;
  }
  if (m > 1) total *= 1 + m;
  return total;
}

export function divisorCount(n: number): number {
  return n >= 1 && n <= MAX_ROLL ? divisorTables().ndiv[n] : 0;
}

/** Sum of proper divisors (aliquot sum). */
export function aliquot(n: number): number {
  return n >= 1 ? sigmaOf(n) - n : 0;
}

/** Number of distinct prime factors and total prime factors (with multiplicity). */
export function omegas(n: number): { distinct: number; total: number } {
  if (n < 2) return { distinct: 0, total: 0 };
  const f = factorize(n);
  return { distinct: f.length, total: f.reduce((t, [, e]) => t + e, 0) };
}

/** Members of a sequence up to MAX_ROLL, generated once. */
export function sequenceSet(next: (prev: number[]) => number, seed: number[]): ReadonlySet<number> {
  const seq = [...seed];
  for (;;) {
    const v = next(seq);
    if (v > MAX_ROLL) break;
    seq.push(v);
  }
  return new Set(seq.filter((v) => v >= 0 && v <= MAX_ROLL));
}

/** All values f(k) for k = start, start+1, ... while f(k) <= MAX_ROLL. */
export function figurateSet(f: (k: number) => number, start = 1): ReadonlySet<number> {
  const s = new Set<number>();
  for (let k = start; ; k++) {
    const v = f(k);
    if (v > MAX_ROLL) break;
    s.add(v);
  }
  return s;
}

export function digitsOf(n: number): number[] {
  return String(n).split("").map(Number);
}

export function toRoman(n: number): string | null {
  if (n < 1 || n > 3999) return null;
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, sym] of table) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

/** Repeatedly sum squared digits; happy numbers reach 1. */
export function isHappy(n: number): boolean {
  if (n < 1) return false;
  const seen = new Set<number>();
  while (n !== 1 && !seen.has(n)) {
    seen.add(n);
    let s = 0;
    while (n > 0) {
      const d = n % 10;
      s += d * d;
      n = Math.floor(n / 10);
    }
    n = s;
  }
  return n === 1;
}

let selfTable: Uint8Array | null = null;
/** Self numbers: no m satisfies m + digitsum(m) = n. */
export function isSelfNumber(n: number): boolean {
  if (!selfTable) {
    const generated = new Uint8Array(MAX_ROLL + 1);
    for (let m = 0; m <= MAX_ROLL; m++) {
      let s = m;
      let x = m;
      while (x > 0) {
        s += x % 10;
        x = Math.floor(x / 10);
      }
      if (s <= MAX_ROLL) generated[s] = 1;
    }
    selfTable = generated;
  }
  return selfTable[n] === 0;
}
