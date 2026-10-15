// Pure number helpers used by the badge tests. Results are precomputed into
// public.number_stats by scripts/precompute.ts; the database never re-derives them.

export const MIN_ROLL = 0;
export const MAX_ROLL = 1_000_000;

export function digits(n: number): string {
  return String(n);
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function isPerfectSquare(n: number): boolean {
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

export function isPerfectCube(n: number): boolean {
  const r = Math.round(Math.cbrt(n));
  return r * r * r === n;
}

export function isPalindrome(s: string): boolean {
  return s.length >= 2 && s === s.split("").reverse().join("");
}

/** Longest run of one repeated digit. */
export function longestRepeat(s: string): number {
  let best = 1;
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Longest run where each digit differs from the previous by exactly `step`. */
export function longestStep(s: string, step: number): number {
  let best = 1;
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    run = Number(s[i]) - Number(s[i - 1]) === step ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Digits form one arithmetic progression with a non-zero step (e.g. 13579). */
export function isArithmetic(s: string): boolean {
  if (s.length < 3) return false;
  const d = Number(s[1]) - Number(s[0]);
  if (d === 0) return false;
  for (let i = 2; i < s.length; i++) {
    if (Number(s[i]) - Number(s[i - 1]) !== d) return false;
  }
  return true;
}

/** Count of non-overlapping adjacent equal pairs whose digits are all different (e.g. 112233 -> 3). */
export function distinctPairs(s: string): number {
  const seen = new Set<string>();
  let i = 0;
  while (i < s.length - 1) {
    if (s[i] === s[i + 1]) {
      seen.add(s[i]);
      i += 2;
    } else {
      i += 1;
    }
  }
  return seen.size;
}

export function digitSum(s: string): number {
  let t = 0;
  for (const c of s) t += Number(c);
  return t;
}

export function countDigit(s: string, d: string): number {
  let c = 0;
  for (const ch of s) if (ch === d) c++;
  return c;
}

const FIBS: ReadonlySet<number> = (() => {
  const set = new Set<number>();
  let a = 0;
  let b = 1;
  while (a <= MAX_ROLL) {
    set.add(a);
    [a, b] = [b, a + b];
  }
  return set;
})();

export function isFibonacci(n: number): boolean {
  return FIBS.has(n);
}

export function isTriangular(n: number): boolean {
  const k = Math.round((Math.sqrt(8 * n + 1) - 1) / 2);
  return (k * (k + 1)) / 2 === n;
}

export const FACTORIALS: readonly number[] = [1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
