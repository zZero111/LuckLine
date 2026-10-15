// Badge definitions. Each badge: id, name, family, desc, test(n, s) where s = String(n).
const MAX = 1000000;
const isPrime = n => {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
};
const isSquare = n => { const r = Math.round(Math.sqrt(n)); return r * r === n; };
const isCube = n => { const r = Math.round(Math.cbrt(n)); return r * r * r === n; };
const isPow2 = n => n > 0 && (n & (n - 1)) === 0;
const fibs = new Set(); { let a = 0, b = 1; while (a <= MAX) { fibs.add(a); [a, b] = [b, a + b]; } }
const isTri = n => { const k = Math.round((Math.sqrt(8 * n + 1) - 1) / 2); return k * (k + 1) / 2 === n; };
const isPal = s => s.length > 1 && s === [...s].reverse().join('');
const maxRun = s => { let m = 1, c = 1; for (let i = 1; i < s.length; i++) { c = s[i] === s[i - 1] ? c + 1 : 1; if (c > m) m = c; } return m; };
const asc = (s, k) => { let c = 1; for (let i = 1; i < s.length; i++) { c = +s[i] === +s[i - 1] + 1 ? c + 1 : 1; if (c >= k) return true; } return false; };
const desc = (s, k) => { let c = 1; for (let i = 1; i < s.length; i++) { c = +s[i] === +s[i - 1] - 1 ? c + 1 : 1; if (c >= k) return true; } return false; };
const sevens = s => [...s].filter(c => '7' === c).length;

const BADGES = [
  // Special values
  { id: 'zero', name: 'Nothing', family: 'extreme', desc: 'Rolled exactly 0', test: n => n === 0 },
  { id: 'million', name: 'Millionaire', family: 'extreme', desc: 'Rolled exactly 1,000,000', test: n => n === MAX },
  { id: 'low', name: 'Tiny', family: 'extreme', desc: 'Under 100', test: n => n < 100 },
  { id: 'high', name: 'Huge', family: 'extreme', desc: 'Over 999,900', test: n => n > 999900 },
  // Round numbers
  { id: 'r100k', name: 'Hundred Thousand', family: 'round', desc: 'Multiple of 100,000', test: n => n % 100000 === 0 },
  { id: 'r10k', name: 'Ten Thousand', family: 'round', desc: 'Multiple of 10,000', test: n => n % 10000 === 0 },
  { id: 'r1k', name: 'Thousand', family: 'round', desc: 'Multiple of 1,000', test: n => n % 1000 === 0 },
  { id: 'r100', name: 'Hundred', family: 'round', desc: 'Multiple of 100', test: n => n % 100 === 0 },
  { id: 'r10', name: 'Tens', family: 'round', desc: 'Multiple of 10', test: n => n % 10 === 0 },
  // Repeated digits
  { id: 'rep6', name: 'Perfect Repdigit', family: 'repeat', desc: 'All six digits identical (e.g. 444444)', test: (n, s) => s.length === 6 && maxRun(s) === 6 },
  { id: 'rep5', name: 'Five of a Kind', family: 'repeat', desc: '5 identical digits in a row', test: (n, s) => maxRun(s) >= 5 },
  { id: 'rep4', name: 'Four of a Kind', family: 'repeat', desc: '4 identical digits in a row', test: (n, s) => maxRun(s) >= 4 },
  { id: 'rep3', name: 'Triple', family: 'repeat', desc: '3 identical digits in a row', test: (n, s) => maxRun(s) >= 3 },
  { id: 'rep2', name: 'Double', family: 'repeat', desc: '2 identical digits in a row', test: (n, s) => maxRun(s) >= 2 },
  // Sequences
  { id: 'seq6', name: 'Staircase', family: 'seq', desc: '6 consecutive ascending or descending digits', test: (n, s) => asc(s, 6) || desc(s, 6) },
  { id: 'seq5', name: 'Long Run', family: 'seq', desc: '5 consecutive ascending or descending digits', test: (n, s) => asc(s, 5) || desc(s, 5) },
  { id: 'seq4', name: 'Short Run', family: 'seq', desc: '4 consecutive ascending or descending digits', test: (n, s) => asc(s, 4) || desc(s, 4) },
  { id: 'seq3', name: 'Mini Run', family: 'seq', desc: '3 consecutive ascending or descending digits', test: (n, s) => asc(s, 3) || desc(s, 3) },
  // Palindromes & symmetry
  { id: 'pal6', name: 'Grand Palindrome', family: 'pal', desc: 'A 6-digit palindrome', test: (n, s) => s.length === 6 && isPal(s) },
  { id: 'pal5', name: 'Palindrome (5)', family: 'pal', desc: 'A 5-digit palindrome', test: (n, s) => s.length === 5 && isPal(s) },
  { id: 'pal', name: 'Palindrome', family: 'pal', desc: 'Reads the same backwards', test: (n, s) => isPal(s) },
  { id: 'mirror', name: 'Twin Halves', family: 'pal', desc: 'Both halves identical (e.g. 123123)', test: (n, s) => s.length === 6 && s.slice(0, 3) === s.slice(3) },
  { id: 'abab', name: 'Alternator', family: 'pal', desc: 'Two digits alternating (e.g. 121212)', test: (n, s) => s.length === 6 && s[0] !== s[1] && s === (s[0] + s[1]).repeat(3) },
  // Sevens
  { id: 'sev4', name: 'Jackpot', family: 'seven', desc: 'Four or more 7s', test: (n, s) => sevens(s) >= 4 },
  { id: 'sev3', name: 'Lucky Sevens', family: 'seven', desc: 'Three or more 7s', test: (n, s) => sevens(s) >= 3 },
  { id: 'sev2', name: 'Lucky Pair', family: 'seven', desc: 'Two or more 7s', test: (n, s) => sevens(s) >= 2 },
  // Math
  { id: 'fact', name: 'Factorial', family: 'math1', desc: 'A factorial (120, 720, 5040, 40320, 362880)', test: n => [1, 2, 6, 24, 120, 720, 5040, 40320, 362880].includes(n) },
  { id: 'pow2', name: 'Power of Two', family: 'math2', desc: 'Exactly 2ⁿ', test: n => isPow2(n) },
  { id: 'fib', name: 'Fibonacci', family: 'math3', desc: 'A Fibonacci number', test: n => fibs.has(n) },
  { id: 'cube', name: 'Perfect Cube', family: 'math4', desc: 'n³ for some integer n', test: n => n > 1 && isCube(n) },
  { id: 'sq', name: 'Perfect Square', family: 'math5', desc: 'n² for some integer n', test: n => n > 1 && isSquare(n) },
  { id: 'tri', name: 'Triangular', family: 'math6', desc: 'A triangular number', test: n => n > 1 && isTri(n) },
  { id: 'prime', name: 'Prime', family: 'math7', desc: 'Divisible only by 1 and itself', test: n => isPrime(n) },
  // Culture
  { id: 'pi', name: 'Pi Day', family: 'cult1', desc: 'Starts with 31415', test: (n, s) => s.startsWith('31415') },
  { id: 'leet', name: 'Elite', family: 'cult2', desc: 'Contains 1337', test: (n, s) => s.includes('1337') },
  { id: 'beast', name: 'Number of the Beast', family: 'cult3', desc: 'Contains 666', test: (n, s) => s.includes('666') },
  { id: 'blaze', name: 'Blaze It', family: 'cult4', desc: 'Contains 420', test: (n, s) => s.includes('420') },
  { id: 'nice', name: 'Nice', family: 'cult5', desc: 'Contains 69', test: (n, s) => s.includes('69') },
  { id: 'hex', name: 'Binary Brain', family: 'cult6', desc: 'Digits only use 0 and 1 (binary-looking)', test: (n, s) => n > 1 && /^[01]+$/.test(s) },
  // Digit sums / misc
  { id: 'sum', name: 'Heavy', family: 'misc1', desc: 'Digit sum of 45 or more', test: (n, s) => [...s].reduce((a, c) => a + +c, 0) >= 45 },
  { id: 'light', name: 'Featherweight', family: 'misc1', desc: 'Digit sum of 3 or less', test: (n, s) => n > 0 && [...s].reduce((a, c) => a + +c, 0) <= 3 },
  { id: 'uniq', name: 'All Different', family: 'misc2', desc: 'Six unique digits', test: (n, s) => s.length === 6 && new Set(s).size === 6 },
  { id: 'two', name: 'Two-Tone', family: 'misc3', desc: 'Uses only two different digits', test: (n, s) => s.length >= 5 && new Set(s).size === 2 },
];

// Exact probability of each badge by exhaustive enumeration.
const counts = new Array(BADGES.length).fill(0);
for (let n = 0; n <= MAX; n++) {
  const s = String(n);
  for (let i = 0; i < BADGES.length; i++) if (BADGES[i].test(n, s)) counts[i]++;
}
const TOTAL = MAX + 1;
BADGES.forEach((b, i) => {
  b.count = counts[i];
  b.prob = counts[i] / TOTAL;
  b.ep = Math.max(1, Math.round(1 / b.prob));
  b.tier = b.prob < 1e-5 ? 'mythic' : b.prob < 1e-4 ? 'legendary' : b.prob < 1e-3 ? 'epic' : b.prob < 1e-2 ? 'rare' : b.prob < 0.1 ? 'uncommon' : 'common';
});

// Score a number: best badge per family.
function scoreNumber(n) {
  const s = String(n);
  const best = {};
  for (const b of BADGES) {
    if (b.test(n, s) && (!best[b.family] || b.ep > best[b.family].ep)) best[b.family] = b;
  }
  const earned = Object.values(best).sort((a, b) => b.ep - a.ep);
  return { earned, total: earned.reduce((a, b) => a + b.ep, 0) };
}
