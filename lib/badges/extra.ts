// The big badge expansion (ids 97+). Same rules as the core catalogue in
// index.ts: pure tests over the number, one family each, best-per-family
// scoring. ORDER MATTERS: ids are assigned by position, so only ever append.

import { MAX_ROLL, isPalindrome, longestRepeat } from "./helpers";
import {
  aliquot,
  digitsOf,
  divisorCount,
  factorize,
  figurateSet,
  isHappy,
  isPrimeFast as isPrime,
  isSelfNumber,
  omegas,
  sequenceSet,
  sigmaOf,
  toRoman,
} from "./numberTheory";

export interface BadgeSpec {
  slug: string;
  name: string;
  emoji: string;
  family: string;
  description: string;
  test(n: number): boolean;
}

const s = (n: number) => String(n);
const has = (n: number, sub: string) => s(n).includes(sub);
const len = (n: number) => s(n).length;
const six = (n: number) => len(n) === 6;
const reverseNum = (n: number) => Number(s(n).split("").reverse().join(""));
const digitSum = (n: number) => digitsOf(n).reduce((a, b) => a + b, 0);
const countOf = (n: number, d: string) => s(n).split(d).length - 1;

const DIGIT_PLURAL = ["Zeros", "Ones", "Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines"];
const KEYCAP = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

const out: BadgeSpec[] = [];

// Replacements for badges that turned out to match exactly the same numbers as
// an earlier badge (found by the duplicate check in scripts/precompute.ts).
// A replacement takes the original's slot, so every later id stays put; the
// original slug is the key. Players' old badge rows are rebuilt by rescore_all().
const digitProduct = (n: number) => digitsOf(n).reduce((a, b) => a * b, 1);
const factorialsOfDigits = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
const REPLACEMENTS: Record<string, BadgeSpec> = {
  // was a copy of Pristine Hundred-K (multiples of 100,000)
  "penta-zeros": {
    slug: "square-mirror", name: "Square Mirror", emoji: "🪟", family: "square-mirror",
    description: "Its square is a palindrome (like 26² = 676).",
    test: (n) => n > 1 && isPalindrome(s(n * n)),
  },
  // was a copy of Pristine Hundred-K
  "zeros-takeover": {
    slug: "digit-factorials", name: "Digit Factorials", emoji: "🧪", family: "factorion",
    description: "Equals the sum of the factorials of its digits (like 145 = 1! + 4! + 5!).",
    test: (n) => n > 0 && digitsOf(n).reduce((t, d) => t + factorialsOfDigits[d], 0) === n,
  },
  // was a copy of Beastly (contains 666)
  "triple-sixes": {
    slug: "nine-lives", name: "Nine Lives", emoji: "🐈", family: "digital-root",
    description: "A multiple of 9: its digits add up to 9, 18, 27 …",
    test: (n) => n > 0 && n % 9 === 0,
  },
  // was a copy of Hollow (four or more zeros)
  "zeros-overload": {
    slug: "mirror-image", name: "Mirror Image", emoji: "🪞", family: "mirror-image",
    description: "Three or more digits, all 0, 1 or 8, reading the same in a mirror (like 818).",
    test: (n) => len(n) >= 3 && /^[018]+$/.test(s(n)) && isPalindrome(s(n)),
  },
  // was a copy of Quad Ones (contains 1111)
  "make-a-wish": {
    slug: "one-step-wonder", name: "One-Step Wonder", emoji: "👣", family: "reverse-add",
    description: "Add it to its own reverse and you get a palindrome (like 29 + 92 = 121).",
    test: (n) => {
      if (n < 10) return false;
      const r = reverseNum(n);
      return r !== n && isPalindrome(s(n + r));
    },
  },
  // was a copy of Double Nines (contains 99)
  "ninety-nine-problems": {
    slug: "product-power", name: "Product Power", emoji: "✖️", family: "digit-product",
    description: "Multiply all its digits together and get 100,000 or more (like 999,999).",
    test: (n) => digitProduct(n) >= 100_000,
  },
};
const add = (b: BadgeSpec) => out.push(REPLACEMENTS[b.slug] ?? b);

// ---------------------------------------------------------------------------
// Digit runs: the same digit 2/3/4/5 times in a row, per digit
// (7 and 8 already have Slot Machine / Jackpot and Double / Triple Fortune).
// ---------------------------------------------------------------------------
const RUN_PREFIX = ["Double", "Triple", "Quad", "Penta"];
for (const d of [0, 1, 2, 3, 4, 5, 6, 9]) {
  for (let k = 2; k <= 5; k++) {
    const run = String(d).repeat(k);
    add({
      slug: `${RUN_PREFIX[k - 2].toLowerCase()}-${DIGIT_PLURAL[d].toLowerCase()}`,
      name: `${RUN_PREFIX[k - 2]} ${DIGIT_PLURAL[d]}`,
      emoji: KEYCAP[d],
      family: `run-${d}`,
      description: `Contains ${run}.`,
      test: (n) => has(n, run),
    });
  }
}
add({ slug: "penta-sevens", name: "Penta Sevens", emoji: "🎰", family: "sevens", description: "Contains 77777.", test: (n) => has(n, "77777") });
add({ slug: "quad-eights", name: "Quad Fortune", emoji: "🐉", family: "eights", description: "Contains 8888.", test: (n) => has(n, "8888") });
add({ slug: "penta-eights", name: "Imperial Fortune", emoji: "🏯", family: "eights", description: "Contains 88888.", test: (n) => has(n, "88888") });

// ---------------------------------------------------------------------------
// Digit counts: 3/4/5+ of one digit anywhere in the number.
// ---------------------------------------------------------------------------
const COUNT_NAME: [number, string][] = [[3, "Galore"], [4, "Overload"], [5, "Takeover"]];
for (let d = 0; d <= 9; d++) {
  for (const [k, word] of COUNT_NAME) {
    if (d === 7 && k === 3) continue; // Seventh Heaven
    add({
      slug: `${DIGIT_PLURAL[d].toLowerCase()}-${word.toLowerCase()}`,
      name: `${DIGIT_PLURAL[d]} ${word}`,
      emoji: KEYCAP[d],
      family: d === 7 ? "sevens" : `count-${d}`,
      description: `${k} or more ${DIGIT_PLURAL[d].toLowerCase()} anywhere in the number.`,
      test: (n) => countOf(n, String(d)) >= k,
    });
  }
}

// ---------------------------------------------------------------------------
// Exact numbers (all mythic: 1 in 1,000,001).
// ---------------------------------------------------------------------------
const EXACT: [number, string, string, string, string][] = [
  [1, "unity", "Unity", "☝️", "Exactly 1. The loneliest number."],
  [2, "the-even-prime", "The Even Prime", "✌️", "Exactly 2, the only even prime."],
  [7, "exactly-seven", "Lucky Number Seven", "🍀", "Exactly 7."],
  [13, "friday-the-13th", "Friday the 13th", "🔪", "Exactly 13."],
  [21, "blackjack", "Blackjack", "🃏", "Exactly 21."],
  [23, "air-23", "Twenty-Three", "🏀", "Exactly 23."],
  [69, "very-nice", "Very Nice", "😎", "Exactly 69. Nothing more, nothing less."],
  [99, "ninety-nine", "Ninety-Nine", "🎈", "Exactly 99."],
  [100, "century", "Century", "🏏", "Exactly 100."],
  [101, "room-101", "Room 101", "🚪", "Exactly 101."],
  [123, "easy-as-123", "Easy as 1-2-3", "🔤", "Exactly 123."],
  [256, "full-byte", "Full Byte", "💾", "Exactly 256."],
  [360, "three-sixty", "Three-Sixty", "🛹", "Exactly 360."],
  [365, "every-day", "Every Day", "📆", "Exactly 365."],
  [404, "page-not-found", "Page Not Found", "🔍", "Exactly 404."],
  [420, "blaze-it", "Blaze It", "🔥", "Exactly 420."],
  [512, "half-k", "Half a K", "📀", "Exactly 512."],
  [640, "enough-for-anyone", "Enough for Anyone", "🖥️", "Exactly 640."],
  [666, "number-of-the-beast", "Number of the Beast", "👹", "Exactly 666."],
  [747, "jumbo-jet", "Jumbo Jet", "✈️", "Exactly 747."],
  [777, "lucky-strike", "Lucky Strike", "🎲", "Exactly 777."],
  [911, "nine-one-one", "Nine-One-One", "🚓", "Exactly 911."],
  [999, "triple-nine-exact", "All Nines (3)", "🔔", "Exactly 999."],
  [1000, "one-grand", "One Grand", "💵", "Exactly 1,000."],
  [1024, "kilobyte", "Kilobyte", "🧮", "Exactly 1,024."],
  [1066, "hastings", "Battle of Hastings", "⚔️", "Exactly 1,066."],
  [1234, "one-two-three-four", "One Two Three Four", "🔢", "Exactly 1,234."],
  [1337, "elite-exact", "True Elite", "🕹️", "Exactly 1,337."],
  [1492, "new-world", "New World", "⛵", "Exactly 1,492."],
  [1729, "taxicab-number", "Taxicab Number", "🚕", "Exactly 1,729, the smallest sum of two cubes in two ways."],
  [1776, "independence", "Independence", "🗽", "Exactly 1,776."],
  [1969, "moon-landing", "Moon Landing", "🌕", "Exactly 1,969."],
  [1984, "orwellian", "Orwellian", "📕", "Exactly 1,984."],
  [1999, "party-like-1999", "Party Like It's 1999", "🪩", "Exactly 1,999."],
  [2000, "y2k", "Y2K", "🐛", "Exactly 2,000."],
  [2012, "end-of-days", "End of Days", "🌋", "Exactly 2,012."],
  [2020, "hindsight", "Perfect Hindsight", "😷", "Exactly 2,020."],
  [3000, "love-you-3000", "Love You 3000", "❤️", "Exactly 3,000."],
  [5000, "five-grand", "Five Grand", "💰", "Exactly 5,000."],
  [8080, "port-8080", "Port 8080", "🔌", "Exactly 8,080."],
  [9000, "nine-thousand", "Nine Thousand", "🔋", "Exactly 9,000. Not quite over."],
  [9999, "four-nines", "Four Nines", "🔊", "Exactly 9,999."],
  [10000, "ten-grand", "Ten Grand", "🏦", "Exactly 10,000."],
  [12345, "straight-five", "Five-Card Straight", "🃏", "Exactly 12,345."],
  [31337, "eleet", "Eleet", "💻", "Exactly 31,337."],
  [42069, "meme-sum", "The Meme Sum", "🤡", "Exactly 42,069."],
  [54321, "blast-off", "Blast Off", "🚀", "Exactly 54,321."],
  [65535, "max-short", "Max Unsigned Short", "🧱", "Exactly 65,535."],
  [65536, "two-to-the-16", "Two to the Sixteen", "🎛️", "Exactly 65,536."],
  [69420, "meme-lord", "Meme Lord", "👑", "Exactly 69,420."],
  [99999, "five-nines", "Five Nines Uptime", "🖧", "Exactly 99,999."],
  [100000, "hundred-grand", "Hundred Grand", "🍫", "Exactly 100,000."],
  [101010, "answer-in-binary", "Answer in Binary", "🔟", "Exactly 101,010: 42 written in binary."],
  [111111, "all-ones", "All Ones", "🕯️", "Exactly 111,111."],
  [112358, "fibonacci-opening", "Fibonacci Opening", "🌀", "Exactly 112,358: 1, 1, 2, 3, 5, 8."],
  [123123, "encore", "Encore", "👏", "Exactly 123,123."],
  [123321, "round-trip", "Round Trip", "🔁", "Exactly 123,321."],
  [123456, "the-straight", "The Straight", "📏", "Exactly 123,456."],
  [142857, "cyclic-number", "Cyclic Number", "♻️", "Exactly 142,857, which cycles when multiplied by 1–6."],
  [161803, "golden-exact", "Golden Exact", "🌟", "Exactly 161,803: the golden ratio's digits."],
  [271828, "e-exact", "Euler Exact", "🧠", "Exactly 271,828: e's digits."],
  [299792, "speed-of-light", "Speed of Light", "💡", "Exactly 299,792 (km per second)."],
  [333333, "all-threes", "All Threes", "🔺", "Exactly 333,333."],
  [420420, "double-blaze", "Double Blaze", "🔥", "Exactly 420,420."],
  [424242, "triple-answer", "Triple Answer", "🌌", "Exactly 424,242."],
  [524288, "two-to-the-19", "Two to the Nineteen", "🎚️", "Exactly 524,288."],
  [555555, "all-fives", "All Fives", "🖐️", "Exactly 555,555."],
  [654321, "countdown", "Countdown", "⏱️", "Exactly 654,321."],
  [666666, "beast-mode", "Beast Mode", "😈", "Exactly 666,666."],
  [696969, "nice-nice-nice", "Nice Nice Nice", "😏", "Exactly 696,969."],
  [777777, "all-sevens", "All Sevens", "🎰", "Exactly 777,777."],
  [888888, "all-eights", "All Eights", "🧧", "Exactly 888,888."],
  [999999, "all-nines", "All Nines", "🔔", "Exactly 999,999."],
];
for (const [value, slug, name, emoji, description] of EXACT) {
  add({ slug, name, emoji, family: "exact", description, test: (n) => n === value });
}

// ---------------------------------------------------------------------------
// Contains: memes and famous digit strings.
// ---------------------------------------------------------------------------
const CONTAINS: [string, string, string, string, string, string?][] = [
  ["42", "deep-thought", "Deep Thought", "🤖", "Contains 42."],
  ["99", "ninety-nine-problems", "99 Problems", "🎤", "Contains 99."],
  ["321", "liftoff", "Liftoff", "🛫", "Contains 321."],
  ["112", "euro-emergency", "Euro Emergency", "🚑", "Contains 112."],
  ["12345", "counting-up", "Counting Up", "🧒", "Contains 12345."],
  ["314", "pi-somewhere", "Pi Somewhere", "🥧", "Contains 314 anywhere."],
  ["2468", "who-do-we-appreciate", "Who Do We Appreciate", "📣", "Contains 2468."],
  ["1357", "odd-steps", "Odd Steps", "👣", "Contains 1357."],
  ["8675", "jenny", "Jenny", "☎️", "Contains 8675 (309…)."],
  ["1729", "taxicab-inside", "Taxicab Inside", "🚖", "Contains 1729."],
  ["4815", "the-numbers", "The Numbers", "🏝️", "Contains 4815 (16 23 42)."],
  ["1001", "arabian-nights", "Arabian Nights", "📖", "Contains 1001."],
  ["1111", "make-a-wish", "Make a Wish", "🌠", "Contains 1111."],
  ["6969", "extra-nice", "Extra Nice", "😏", "Contains 6969.", "meme-69"],
  ["69420", "meme-combo", "Meme Combo", "🎭", "Contains 69420."],
  ["7734", "calc-hell", "Calculator: hELL", "🧮", "Contains 7734. Turn it upside down.", "calculator"],
  ["07734", "calc-hello", "Calculator: hELLO", "👋", "Contains 07734. Turn it upside down.", "calculator"],
  ["5508", "calc-boss", "Calculator: BOSS", "🕴️", "Contains 5508. Turn it upside down.", "calculator"],
];
for (const [sub, slug, name, emoji, description, family] of CONTAINS) {
  add({ slug, name, emoji, family: family ?? `has-${sub}`, description, test: (n) => has(n, sub) });
}

// Endings and openings.
const ENDS: [string, string, string, string][] = [
  ["99", "price-tag", "Price Tag", "🏷️"],
  ["999", "just-under", "Just Under", "💸"],
  ["001", "squeaked-in", "Squeaked In", "🐭"],
  ["50", "half-mark", "Half Mark", "🌓"],
  ["77", "lucky-ending", "Lucky Ending", "🌈"],
];
for (const [suffix, slug, name, emoji] of ENDS) {
  add({ slug, name, emoji, family: "ending", description: `Ends in ${suffix} (four or more digits).`, test: (n) => len(n) >= 4 && s(n).endsWith(suffix) });
}
const STARTS: [string, string, string, string][] = [
  ["69", "nice-opener", "Nice Opener", "😏"],
  ["420", "blazing-start", "Blazing Start", "🌿"],
  ["777", "lucky-opener", "Lucky Opener", "🎰"],
  ["123", "good-start", "Good Start", "🏁"],
  ["999", "top-of-the-range", "Top of the Range", "📶"],
  ["100", "century-start", "Century Start", "💯"],
];
for (const [prefix, slug, name, emoji] of STARTS) {
  add({ slug, name, emoji, family: "opening", description: `Starts with ${prefix} (five or more digits).`, test: (n) => len(n) >= 5 && s(n).startsWith(prefix) });
}

// ---------------------------------------------------------------------------
// More primes (family "prime": only the best one counts).
// ---------------------------------------------------------------------------
const MERSENNE = new Set([3, 7, 31, 127, 8191, 131071, 524287]);
const FERMAT = new Set([3, 5, 17, 257, 65537]);
const rotations = (n: number) => {
  const t = s(n);
  return t.split("").map((_, i) => Number(t.slice(i) + t.slice(0, i)));
};
const leftTruncatable = (n: number) => {
  const t = s(n);
  if (t.includes("0")) return false;
  for (let i = 0; i < t.length; i++) if (!isPrime(Number(t.slice(i)))) return false;
  return true;
};
const rightTruncatable = (n: number) => {
  for (let m = n; m > 0; m = Math.floor(m / 10)) if (!isPrime(m)) return false;
  return true;
};
const PRIMES: [string, string, string, string, (n: number) => boolean][] = [
  ["sophie-germain", "Sophie Germain", "👩‍🔬", "A prime p where 2p + 1 is prime too.", (n) => isPrime(n) && isPrime(2 * n + 1)],
  ["safe-prime", "Safe Prime", "🔐", "A prime p where (p − 1) / 2 is prime too.", (n) => n > 4 && isPrime(n) && isPrime((n - 1) / 2)],
  ["cousin-prime", "Cousin Prime", "👫", "A prime with another prime exactly 4 away.", (n) => isPrime(n) && (isPrime(n - 4) || isPrime(n + 4))],
  ["sexy-prime", "Sexy Prime", "💃", "A prime with another prime exactly 6 away.", (n) => isPrime(n) && (isPrime(n - 6) || isPrime(n + 6))],
  ["circular-prime", "Circular Prime", "🎡", "Every rotation of its digits is prime.", (n) => isPrime(n) && rotations(n).every(isPrime)],
  ["left-truncatable", "Left Truncatable", "✂️", "Stays prime as you chop digits off the left.", (n) => n > 9 && isPrime(n) && leftTruncatable(n)],
  ["right-truncatable", "Right Truncatable", "🔪", "Stays prime as you chop digits off the right.", (n) => n > 9 && rightTruncatable(n)],
  ["mersenne-prime", "Mersenne Prime", "🧬", "A prime one less than a power of two.", (n) => MERSENNE.has(n)],
  ["fermat-prime", "Fermat Prime", "🏛️", "A prime one more than 2 to a power of two.", (n) => FERMAT.has(n)],
  ["all-prime-digits", "Prime Through and Through", "💎", "A prime made only of the digits 2, 3, 5 and 7.", (n) => n > 9 && isPrime(n) && /^[2357]+$/.test(s(n))],
];
for (const [slug, name, emoji, description, test] of PRIMES) add({ slug, name, emoji, family: "prime", description, test });

// ---------------------------------------------------------------------------
// Number sequences and number theory (each its own family).
// ---------------------------------------------------------------------------
const LUCAS = sequenceSet((q) => q[q.length - 1] + q[q.length - 2], [2, 1]);
const TRIBONACCI = sequenceSet((q) => q[q.length - 1] + q[q.length - 2] + q[q.length - 3], [0, 0, 1]);
const PELL = sequenceSet((q) => 2 * q[q.length - 1] + q[q.length - 2], [0, 1]);
const CATALAN = new Set([1, 2, 5, 14, 42, 132, 429, 1430, 4862, 16796, 58786, 208012, 742900]);
const BELL = new Set([1, 2, 5, 15, 52, 203, 877, 4140, 21147, 115975, 678570]);
const PRIMORIAL = new Set([2, 6, 30, 210, 2310, 30030, 510510]);
const HIGHLY_COMPOSITE = new Set([
  1, 2, 4, 6, 12, 24, 36, 48, 60, 120, 180, 240, 360, 720, 840, 1260, 1680, 2520, 5040, 7560, 10080, 15120,
  20160, 25200, 27720, 45360, 50400, 55440, 83160, 110880, 166320, 221760, 277200, 332640, 498960, 554400,
  665280, 720720,
]);
const PENTAGONAL = figurateSet((k) => (k * (3 * k - 1)) / 2);
const HEXAGONAL = figurateSet((k) => k * (2 * k - 1));
const TETRAHEDRAL = figurateSet((k) => (k * (k + 1) * (k + 2)) / 6);
const SQUARE_PYRAMIDAL = figurateSet((k) => (k * (k + 1) * (2 * k + 1)) / 6);
const STAR = figurateSet((k) => 6 * k * (k - 1) + 1);
const CENTERED_SQUARE = figurateSet((k) => k * k + (k - 1) * (k - 1));
const FOURTH = figurateSet((k) => k ** 4, 2);
const FIFTH = figurateSet((k) => k ** 5, 2);
const POW5 = figurateSet((k) => 5 ** k);
const POW7 = figurateSet((k) => 7 ** k);
const PERFECT_POWER = (() => {
  const set = new Set<number>();
  for (let b = 2; b * b <= MAX_ROLL; b++) for (let v = b * b; v <= MAX_ROLL; v *= b) set.add(v);
  return set;
})();
const isKaprekar = (n: number) => {
  if (n < 1) return false;
  const sq = BigInt(n) * BigInt(n);
  const t = sq.toString();
  for (let i = 1; i < t.length; i++) {
    const right = BigInt(t.slice(i));
    if (right > BigInt(0) && BigInt(t.slice(0, i)) + right === BigInt(n)) return true;
  }
  return n === 1;
};
const isAutomorphic = (n: number) => n > 0 && (BigInt(n) * BigInt(n)).toString().endsWith(s(n));
const isSmith = (n: number) => {
  if (n < 4 || isPrime(n)) return false;
  const f = factorize(n);
  let sum = 0;
  for (const [p, e] of f) sum += digitSum(p) * e;
  return sum === digitSum(n);
};
const isAmicable = (n: number) => {
  if (n < 2) return false;
  const m = aliquot(n);
  return m !== n && m > 1 && aliquot(m) === n;
};

const SEQ: [string, string, string, string, (n: number) => boolean][] = [
  ["lucas", "Lucas Number", "🌿", "In the Lucas sequence: 2, 1, 3, 4, 7, 11, 18 …", (n) => LUCAS.has(n)],
  ["tribonacci", "Tribonacci", "🔱", "Each term the sum of the previous three: 1, 1, 2, 4, 7, 13 …", (n) => n > 0 && TRIBONACCI.has(n)],
  ["pell", "Pell Number", "🧷", "In the Pell sequence: 1, 2, 5, 12, 29, 70 …", (n) => n > 0 && PELL.has(n)],
  ["catalan", "Catalan Number", "🌳", "A Catalan number: 1, 2, 5, 14, 42, 132 …", (n) => CATALAN.has(n)],
  ["bell", "Bell Number", "🛎️", "A Bell number: 1, 2, 5, 15, 52, 203 …", (n) => BELL.has(n)],
  ["primorial", "Primorial", "🌱", "The product of the first few primes: 2, 6, 30, 210 …", (n) => PRIMORIAL.has(n)],
  ["highly-composite", "Divisor Royalty", "👑", "Has more divisors than any smaller number.", (n) => HIGHLY_COMPOSITE.has(n)],
  ["pentagonal", "Pentagonal", "⬟", "A pentagonal number: 1, 5, 12, 22, 35 …", (n) => PENTAGONAL.has(n)],
  ["hexagonal", "Hexagonal", "⬢", "A hexagonal number: 1, 6, 15, 28, 45 …", (n) => HEXAGONAL.has(n)],
  ["tetrahedral", "Tetrahedral", "🔺", "A stack of balls in a triangular pyramid: 1, 4, 10, 20 …", (n) => TETRAHEDRAL.has(n)],
  ["square-pyramid", "Cannonball Stack", "🎯", "A square pyramid of balls: 1, 5, 14, 30, 55 …", (n) => SQUARE_PYRAMIDAL.has(n)],
  ["star-number", "Star Number", "✡️", "A centred hexagram: 1, 13, 37, 73 …", (n) => STAR.has(n)],
  ["centered-square", "Centred Square", "🔳", "A centred square number: 1, 5, 13, 25, 41 …", (n) => CENTERED_SQUARE.has(n)],
  ["fourth-power", "Fourth Power", "4️⃣", "A whole number to the fourth power.", (n) => FOURTH.has(n)],
  ["fifth-power", "Fifth Power", "5️⃣", "A whole number to the fifth power.", (n) => FIFTH.has(n)],
  ["power-of-five", "Power of Five", "🖐️", "5, 25, 125, 625 …", (n) => POW5.has(n)],
  ["power-of-seven", "Power of Seven", "🌈", "7, 49, 343, 2401 …", (n) => POW7.has(n)],
  ["perfect-power", "Perfect Power", "💪", "Some whole number raised to a power of 2 or more.", (n) => PERFECT_POWER.has(n)],
  ["prime-squared", "Prime Squared", "🟪", "The square of a prime.", (n) => n > 3 && Number.isInteger(Math.sqrt(n)) && isPrime(Math.sqrt(n))],
  ["semiprime", "Semiprime", "🧩", "The product of exactly two primes.", (n) => omegas(n).total === 2],
  ["sphenic", "Sphenic", "🔺", "The product of three different primes.", (n) => {
    const o = omegas(n);
    return o.distinct === 3 && o.total === 3;
  }],
  ["many-divisors", "Crowd Pleaser", "🎉", "Has 64 or more divisors.", (n) => divisorCount(n) >= 64],
  ["huge-divisors", "Divisor Army", "🪖", "Has 128 or more divisors.", (n) => divisorCount(n) >= 128],
  ["abundant", "Generous", "🎁", "Its proper divisors add up to more than itself.", (n) => n > 0 && aliquot(n) > n],
  ["very-abundant", "Overflowing", "🌊", "Its divisors add up to more than three times itself.", (n) => n > 0 && sigmaOf(n) > 4 * n],
  ["amicable", "Best Friends", "🤝", "Part of an amicable pair: each one's divisors sum to the other.", isAmicable],
  ["kaprekar-number", "Kaprekar Number", "✂️", "Square it, split the digits, add the halves: you get it back (like 297).", isKaprekar],
  ["automorphic", "Automorphic", "🪞", "Its square ends in itself (like 376² = 141376).", isAutomorphic],
  ["happy", "Happy Number", "😊", "Summing the squares of its digits over and over reaches 1.", isHappy],
  ["smith", "Smith Number", "🔨", "Its digit sum equals the digit sum of its prime factors.", isSmith],
  ["moran", "Moran Number", "🎓", "Dividing by its digit sum gives a prime.", (n) => n > 0 && n % digitSum(n) === 0 && isPrime(n / digitSum(n))],
  ["self-number", "Self-Made", "🧍", "No number plus its own digit sum produces it.", isSelfNumber],
  ["reversal-multiple", "Reversal Multiple", "🔃", "A multiple of its own reverse (like 8712 = 4 × 2178).", (n) => {
    const r = reverseNum(n);
    return n > 9 && r !== n && n % 10 !== 0 && n % r === 0;
  }],
];
for (const [slug, name, emoji, description, test] of SEQ) add({ slug, name, emoji, family: slug, description, test });

// Multiples of primes 7..97 (one family: only the biggest counts).
for (const p of [7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]) {
  add({
    slug: `multiple-of-${p}`,
    name: `Multiple of ${p}`,
    emoji: "➗",
    family: "multiple-of-prime",
    description: `Divisible by ${p}.`,
    test: (n) => n > 0 && n % p === 0,
  });
}

// ---------------------------------------------------------------------------
// Digit games.
// ---------------------------------------------------------------------------
const halves = (n: number) => [s(n).slice(0, 3), s(n).slice(3)];
const DIGIT_GAMES: [string, string, string, string, string, (n: number) => boolean][] = [
  ["lucky-ticket", "Lucky Ticket", "🎟️", "lucky-ticket", "Six digits where both halves add up to the same.", (n) => {
    if (!six(n)) return false;
    const [a, b] = halves(n);
    return digitSum(Number(a)) === digitSum(Number(b));
  }],
  ["double-up", "Double Up", "⏫", "double-up", "Six digits where the second half is twice the first (like 123246).", (n) => {
    if (!six(n)) return false;
    const [a, b] = halves(n).map(Number);
    return b === 2 * a;
  }],
  ["split-primes", "Split Primes", "🪓", "split-primes", "Six digits whose two halves are both prime.", (n) => {
    if (!six(n)) return false;
    const [a, b] = halves(n).map(Number);
    return isPrime(a) && isPrime(b);
  }],
  ["square-halves", "Square Halves", "🔲", "square-halves", "Six digits whose two halves are both perfect squares.", (n) => {
    if (!six(n)) return false;
    return halves(n).map(Number).every((h) => Number.isInteger(Math.sqrt(h)));
  }],
  ["checkerboard", "Checkerboard", "🏁", "checkerboard", "Five or more digits alternating odd and even.", (n) => {
    const d = digitsOf(n);
    return d.length >= 5 && d.every((x, i) => i === 0 || x % 2 !== d[i - 1] % 2);
  }],
  ["sawtooth", "Sawtooth", "🪚", "sawtooth", "Five or more digits going up, down, up, down …", (n) => {
    const d = digitsOf(n);
    if (d.length < 5) return false;
    for (let i = 2; i < d.length; i++) {
      const a = Math.sign(d[i - 1] - d[i - 2]);
      const b = Math.sign(d[i] - d[i - 1]);
      if (a === 0 || b === 0 || a === b) return false;
    }
    return true;
  }],
  ["upside-down", "Upside Down", "🙃", "upside-down", "Reads the same turned upside down (only 0, 1, 6, 8, 9, like 6119).", (n) => {
    const flip: Record<string, string> = { "0": "0", "1": "1", "6": "9", "8": "8", "9": "6" };
    const t = s(n);
    if (t.length < 2 || [...t].some((c) => !(c in flip))) return false;
    return [...t].reverse().map((c) => flip[c]).join("") === t;
  }],
  ["balanced", "Balanced", "⚖️", "balanced", "Three or more digits whose sum equals their product (like 1124).", (n) => {
    const d = digitsOf(n);
    return d.length >= 3 && d.reduce((a, b) => a + b, 0) === d.reduce((a, b) => a * b, 1);
  }],
  ["high-digits", "High Digits", "⬆️", "digit-range", "Six digits, all 5 or above.", (n) => six(n) && /^[5-9]+$/.test(s(n))],
  ["low-digits", "Low Digits", "⬇️", "digit-range", "Six digits, all 4 or below.", (n) => six(n) && /^[1-4][0-4]{5}$/.test(s(n))],
  ["prime-digits", "Prime Digits", "🔹", "prime-digits", "Five or more digits, all 2, 3, 5 or 7.", (n) => len(n) >= 5 && /^[2357]+$/.test(s(n))],
  ["split-decision", "Split Decision", "🌗", "split-decision", "Six digits: three of one, then three of another (like 444777).", (n) => {
    const t = s(n);
    return six(n) && t[0] !== t[3] && longestRepeat(t.slice(0, 3)) === 3 && longestRepeat(t.slice(3)) === 3;
  }],
  ["abba", "ABBA", "🕺", "abba", "Contains a four-digit ABBA pattern (like 3443).", (n) => {
    const t = s(n);
    for (let i = 0; i + 3 < t.length; i++) if (t[i] !== t[i + 1] && t[i] === t[i + 3] && t[i + 1] === t[i + 2]) return true;
    return false;
  }],
  ["lucky-sum", "Lucky Sum", "🍀", "digit-sum-exact", "Digits add up to exactly 7.", (n) => digitSum(n) === 7],
  ["unlucky-sum", "Unlucky Sum", "🐈‍⬛", "digit-sum-exact", "Digits add up to exactly 13.", (n) => digitSum(n) === 13],
  ["blackjack-sum", "Blackjack Sum", "🂡", "digit-sum-exact", "Digits add up to exactly 21.", (n) => digitSum(n) === 21],
  ["prime-sum", "Prime Sum", "➕", "prime-sum", "Its digits add up to a prime.", (n) => isPrime(digitSum(n))],
];
for (const [slug, name, emoji, family, description, test] of DIGIT_GAMES) add({ slug, name, emoji, family, description, test });

// ---------------------------------------------------------------------------
// Other bases: binary, octal, hex, Roman.
// ---------------------------------------------------------------------------
const popcount = (n: number) => n.toString(2).split("1").length - 1;
add({ slug: "binary-mirror", name: "Binary Mirror", emoji: "🔁", family: "base-palindrome", description: "A palindrome in binary (at least 10 bits).", test: (n) => n >= 512 && isPalindrome(n.toString(2)) });
add({ slug: "octal-mirror", name: "Octal Mirror", emoji: "🐙", family: "base-palindrome", description: "A palindrome in base 8 (at least 4 digits).", test: (n) => n >= 512 && isPalindrome(n.toString(8)) });
add({ slug: "hex-mirror", name: "Hex Mirror", emoji: "🔮", family: "base-palindrome", description: "A palindrome in hexadecimal (at least 4 digits).", test: (n) => n >= 4096 && isPalindrome(n.toString(16)) });
add({ slug: "sparse-bits", name: "Sparse Bits", emoji: "🕳️", family: "bits", description: "Exactly two 1s in binary.", test: (n) => popcount(n) === 2 });
add({ slug: "bit-heavy", name: "Bit Heavy", emoji: "🏋️", family: "bits", description: "17 or more 1s in binary.", test: (n) => popcount(n) >= 17 });
const HEX_WORDS: [string, string, string][] = [
  ["dead", "Hex: DEAD", "💀"],
  ["beef", "Hex: BEEF", "🥩"],
  ["cafe", "Hex: CAFE", "☕"],
  ["face", "Hex: FACE", "🙂"],
  ["c0de", "Hex: C0DE", "👨‍💻"],
  ["f00d", "Hex: F00D", "🍔"],
  ["bad", "Hex: BAD", "👎"],
  ["ace", "Hex: ACE", "🂡"],
  ["dad", "Hex: DAD", "👨"],
  ["fed", "Hex: FED", "🍽️"],
  ["bed", "Hex: BED", "🛏️"],
  ["add", "Hex: ADD", "➕"],
];
for (const [word, name, emoji] of HEX_WORDS) {
  add({
    slug: `hex-${word}`,
    name,
    emoji,
    family: "hexspeak",
    description: `Spells ${word.toUpperCase()} when written in hexadecimal.`,
    test: (n) => n.toString(16).includes(word),
  });
}
add({ slug: "roman-mirror", name: "Roman Mirror", emoji: "🏛️", family: "roman", description: "Its Roman numeral reads the same backwards (like XIX).", test: (n) => {
  const r = toRoman(n);
  return !!r && r.length >= 2 && isPalindrome(r);
} });
add({ slug: "roman-epic", name: "Roman Epic", emoji: "📜", family: "roman", description: "Takes 13 or more letters in Roman numerals (like MMMDCCCLXXXVIII).", test: (n) => (toRoman(n)?.length ?? 0) >= 13 });

// ---------------------------------------------------------------------------
// Calendar and clock.
// ---------------------------------------------------------------------------
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
add({ slug: "retro-year", name: "Retro Year", emoji: "📼", family: "year", description: "A year from 1900 to 1999.", test: (n) => n >= 1900 && n <= 1999 });
add({ slug: "this-century", name: "This Century", emoji: "📱", family: "year", description: "A year from 2000 to 2026.", test: (n) => n >= 2000 && n <= 2026 });
add({ slug: "future-year", name: "Future Year", emoji: "🛸", family: "year", description: "A year from 2027 to 2099.", test: (n) => n >= 2027 && n <= 2099 });
add({ slug: "leap-year", name: "Leap Year", emoji: "🐸", family: "leap-year", description: "A four-digit leap year.", test: (n) => n >= 1000 && n <= 9999 && isLeap(n) });
add({ slug: "clock-face", name: "Clock Face", emoji: "⏰", family: "clock", description: "Four digits that read as a 24-hour time, HH MM.", test: (n) => n >= 1000 && n <= 2359 && n % 100 <= 59 });
add({ slug: "birthday", name: "Birthday", emoji: "🎂", family: "date", description: "Four digits that read as a day and month, DD MM.", test: (n) => {
  if (n < 1000 || n > 9999) return false;
  const day = Math.floor(n / 100);
  const month = n % 100;
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
} });

// ---------------------------------------------------------------------------
// Appended later (new ids at the end).
// ---------------------------------------------------------------------------
add({ slug: "six-seven", name: "Six Seven", emoji: "🙌", family: "meme-67", description: "Contains 67.", test: (n) => has(n, "67") });
add({ slug: "exactly-sixty-seven", name: "Exactly Six Seven", emoji: "🏅", family: "exact", description: "Exactly 67. The meme itself.", test: (n) => n === 67 });

export const EXTRA_BADGES: readonly BadgeSpec[] = out;
