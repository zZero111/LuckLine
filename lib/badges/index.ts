// Badge catalogue and scoring for Luckline.
//
// Every roll is an integer in [MIN_ROLL, MAX_ROLL]. Each badge is a pure
// predicate over that number and belongs to a family. A roll scores the
// best (highest-EP) badge it matches in each family; badges from different
// families add up. So 77777 earns Quintet, not Double Take + Triplet + Quartet
// + Quintet. Badge rarity and EP come from how many of the 1,000,001 possible
// numbers match the badge (see rarityFor / epFor), and are precomputed into
// supabase/seed.sql and number_stats by scripts/precompute.ts.
//
// IDs are stable: never renumber or reuse an id once shipped. Append new
// badges with the next free id.

import {
  FACTORIALS,
  MAX_ROLL,
  MIN_ROLL,
  countDigit,
  digitSum,
  digits,
  distinctPairs,
  isArithmetic,
  isFibonacci,
  isPalindrome,
  isPerfectCube,
  isPerfectSquare,
  isTriangular,
  longestRepeat,
  longestStep,
} from "./helpers";
import { EXTRA_BADGES } from "./extra";
import { isPrimeFast } from "./numberTheory";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "anomaly" | "mythic";
export type Tier = "trash" | Rarity;

export interface Badge {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  /** Badges in one family don't stack: only the best one a roll matches counts. */
  family: string;
  description: string;
  test(n: number): boolean;
}

/** Number of possible rolls (0..1,000,000 inclusive). */
export const TOTAL_NUMBERS = MAX_ROLL - MIN_ROLL + 1;

const s = digits;
const has = (n: number, sub: string) => s(n).includes(sub);
const multipleOf = (n: number, m: number) => n > 0 && n % m === 0;
const six = (n: number) => s(n).length === 6;

function reverseNumber(n: number) {
  return Number(s(n).split("").reverse().join(""));
}
function nonDecreasing(t: string) {
  for (let i = 1; i < t.length; i++) if (t[i] < t[i - 1]) return false;
  return true;
}
function strictlyIncreasing(t: string) {
  for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) return false;
  return true;
}
const reversed = (t: string) => t.split("").reverse().join("");
/** Strictly up to a peak strictly inside the number, then strictly down. */
function isMountain(t: string) {
  let i = 1;
  while (i < t.length && t[i] > t[i - 1]) i++;
  if (i === 1 || i === t.length) return false;
  while (i < t.length && t[i] < t[i - 1]) i++;
  return i === t.length;
}
function isValley(t: string) {
  return isMountain(t.split("").map((c) => String(9 - Number(c))).join(""));
}
/** Somewhere an ABAB run with A != B. */
function hasZigzag(t: string) {
  for (let i = 0; i + 3 < t.length; i++) {
    if (t[i] !== t[i + 1] && t[i] === t[i + 2] && t[i + 1] === t[i + 3]) return true;
  }
  return false;
}
function isArmstrong(n: number) {
  const t = s(n);
  if (t.length < 3) return false;
  let sum = 0;
  for (const c of t) sum += Number(c) ** t.length;
  return sum === n;
}
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Six digits that read as a real date, DDMMYY (Feb 29 allowed). */
function isDate(n: number) {
  if (!six(n)) return false;
  const t = s(n);
  const day = Number(t.slice(0, 2));
  const month = Number(t.slice(2, 4));
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}
/** Six digits that read as a 24-hour clock time, HHMMSS. */
function isClockTime(n: number) {
  if (!six(n)) return false;
  const t = s(n);
  return Number(t.slice(0, 2)) <= 23 && Number(t.slice(2, 4)) <= 59 && Number(t.slice(4, 6)) <= 59;
}
function isPowerOf(n: number, base: number) {
  if (n < 1) return false;
  while (n % base === 0) n /= base;
  return n === 1;
}
/** All digits but exactly one are the same digit. */
function oddOneOut(t: string) {
  const counts = new Map<string, number>();
  for (const c of t) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts.size === 2 && [...counts.values()].includes(1);
}

const CORE_BADGES: readonly Badge[] = [
  { id: 1, slug: "mirror", name: "Mirror", emoji: "🪞", family: "palindrome", description: "Reads the same forwards and backwards.", test: (n) => isPalindrome(s(n)) },
  { id: 2, slug: "grand-mirror", name: "Grand Mirror", emoji: "🔮", family: "palindrome", description: "A six-digit number that reads the same both ways.", test: (n) => six(n) && isPalindrome(s(n)) },
  { id: 3, slug: "indivisible", name: "Indivisible", emoji: "🧱", family: "prime", description: "A prime: only 1 and itself divide it.", test: (n) => isPrimeFast(n) },
  { id: 4, slug: "triplet", name: "Triplet", emoji: "🎲", family: "repeat", description: "The same digit three times in a row.", test: (n) => longestRepeat(s(n)) >= 3 },
  { id: 5, slug: "quartet", name: "Quartet", emoji: "🎻", family: "repeat", description: "The same digit four times in a row.", test: (n) => longestRepeat(s(n)) >= 4 },
  { id: 6, slug: "quintet", name: "Quintet", emoji: "🖐️", family: "repeat", description: "The same digit five times in a row.", test: (n) => longestRepeat(s(n)) >= 5 },
  { id: 7, slug: "monochrome", name: "Monochrome", emoji: "⬛", family: "repeat", description: "Two or more digits, every one identical.", test: (n) => s(n).length >= 2 && longestRepeat(s(n)) === s(n).length },
  { id: 8, slug: "tidy-hundred", name: "Tidy Hundred", emoji: "💯", family: "round", description: "A positive multiple of 100.", test: (n) => multipleOf(n, 100) },
  { id: 9, slug: "clean-thousand", name: "Clean Thousand", emoji: "🧼", family: "round", description: "A positive multiple of 1,000.", test: (n) => multipleOf(n, 1_000) },
  { id: 10, slug: "spotless-ten-k", name: "Spotless Ten-K", emoji: "✨", family: "round", description: "A positive multiple of 10,000.", test: (n) => multipleOf(n, 10_000) },
  { id: 11, slug: "pristine-hundred-k", name: "Pristine Hundred-K", emoji: "💎", family: "round", description: "A positive multiple of 100,000.", test: (n) => multipleOf(n, 100_000) },
  { id: 12, slug: "nice", name: "Nice", emoji: "😏", family: "meme-69", description: "Contains 69 somewhere in its digits.", test: (n) => has(n, "69") },
  { id: 13, slug: "four-twenty", name: "Four Twenty", emoji: "🌿", family: "meme-420", description: "Contains 420 somewhere in its digits.", test: (n) => has(n, "420") },
  { id: 14, slug: "elite-speak", name: "Elite Speak", emoji: "👾", family: "meme-1337", description: "Contains 1337, the hacker's favourite.", test: (n) => has(n, "1337") },
  { id: 15, slug: "calculator-joke", name: "Calculator Joke", emoji: "🧮", family: "meme-8008", description: "Contains 8008. Turn it upside down.", test: (n) => has(n, "8008") },
  { id: 16, slug: "slot-machine", name: "Slot Machine", emoji: "🎰", family: "sevens", description: "Contains 777: three sevens line up.", test: (n) => has(n, "777") },
  { id: 17, slug: "beastly", name: "Beastly", emoji: "😈", family: "meme-666", description: "Contains 666.", test: (n) => has(n, "666") },
  { id: 18, slug: "slice-of-pi", name: "Slice of Pi", emoji: "🥧", family: "pi", description: "Starts with 3141, the opening digits of pi.", test: (n) => s(n).startsWith("3141") },
  { id: 19, slug: "the-answer", name: "The Answer", emoji: "🌌", family: "the-answer", description: "Exactly 42.", test: (n) => n === 42 },
  { id: 20, slug: "staircase-up", name: "Staircase Up", emoji: "📈", family: "staircase", description: "Four or more digits climbing by one (like 3456).", test: (n) => longestStep(s(n), 1) >= 4 },
  { id: 21, slug: "staircase-down", name: "Staircase Down", emoji: "📉", family: "staircase", description: "Four or more digits falling by one (like 8765).", test: (n) => longestStep(s(n), -1) >= 4 },
  { id: 22, slug: "even-stride", name: "Even Stride", emoji: "📏", family: "progression", description: "Three or more digits forming one steady progression (like 2468).", test: (n) => isArithmetic(s(n)) },
  { id: 23, slug: "square-deal", name: "Square Deal", emoji: "🟩", family: "square", description: "A perfect square.", test: (n) => n > 0 && isPerfectSquare(n) },
  { id: 24, slug: "cubed", name: "Cubed", emoji: "🧊", family: "cube", description: "A perfect cube.", test: (n) => n > 0 && isPerfectCube(n) },
  { id: 25, slug: "golden-spiral", name: "Golden Spiral", emoji: "🐚", family: "fibonacci", description: "A Fibonacci number.", test: (n) => n > 0 && isFibonacci(n) },
  { id: 26, slug: "doubling", name: "Doubling", emoji: "💾", family: "power-of-two", description: "A power of two.", test: (n) => n > 0 && (n & (n - 1)) === 0 },
  { id: 27, slug: "void", name: "Void", emoji: "🕳️", family: "void", description: "Exactly zero. Nothing at all.", test: (n) => n === 0 },
  { id: 28, slug: "the-million", name: "The Million", emoji: "🏆", family: "the-million", description: "Exactly 1,000,000, the highest roll there is.", test: (n) => n === MAX_ROLL },
  { id: 29, slug: "lucky-seven", name: "Lucky Seven", emoji: "🍀", family: "sevens", description: "Has at least one 7 in it.", test: (n) => has(n, "7") },
  { id: 30, slug: "double-take", name: "Double Take", emoji: "👀", family: "repeat", description: "Two identical digits side by side.", test: (n) => longestRepeat(s(n)) >= 2 },
  // --- Added with the EP rework -------------------------------------------
  { id: 31, slug: "pi-day", name: "Pi Day", emoji: "📐", family: "pi", description: "Starts with 314.", test: (n) => s(n).startsWith("314") },
  { id: 32, slug: "perfect-pi", name: "Perfect Pi", emoji: "🔵", family: "pi", description: "Exactly 314,159: the first six digits of pi.", test: (n) => n === 314159 },
  { id: 33, slug: "eulers-number", name: "Euler's Number", emoji: "📘", family: "e", description: "Starts with 2718, the opening digits of e.", test: (n) => s(n).startsWith("2718") },
  { id: 34, slug: "golden-ratio", name: "Golden Ratio", emoji: "🌻", family: "phi", description: "Starts with 1618, the opening digits of φ.", test: (n) => s(n).startsWith("1618") },
  { id: 35, slug: "root-two", name: "Root Two", emoji: "✔️", family: "root-two", description: "Starts with 1414, the opening digits of √2.", test: (n) => s(n).startsWith("1414") },
  { id: 36, slug: "not-found", name: "Not Found", emoji: "🚫", family: "meme-404", description: "Contains 404. This roll could not be found.", test: (n) => has(n, "404") },
  { id: 37, slug: "emergency", name: "Emergency", emoji: "🚨", family: "meme-911", description: "Contains 911.", test: (n) => has(n, "911") },
  { id: 38, slug: "secret-agent", name: "Secret Agent", emoji: "🕶️", family: "meme-007", description: "Contains 007. Licensed to roll.", test: (n) => has(n, "007") },
  { id: 39, slug: "big-brother", name: "Big Brother", emoji: "👁️", family: "meme-1984", description: "Contains 1984. Someone is watching.", test: (n) => has(n, "1984") },
  { id: 40, slug: "space-odyssey", name: "Space Odyssey", emoji: "🚀", family: "meme-2001", description: "Contains 2001.", test: (n) => has(n, "2001") },
  { id: 41, slug: "over-nine-thousand", name: "Over 9000", emoji: "💥", family: "meme-9001", description: "Exactly 9,001. It's over nine thousand!", test: (n) => n === 9001 },
  { id: 42, slug: "kaprekar", name: "Kaprekar's Constant", emoji: "🔁", family: "meme-6174", description: "Contains 6174, where Kaprekar's routine always ends.", test: (n) => has(n, "6174") },
  { id: 43, slug: "year-round", name: "Year Round", emoji: "📅", family: "meme-365", description: "Contains 365.", test: (n) => has(n, "365") },
  { id: 44, slug: "full-circle", name: "Full Circle", emoji: "⭕", family: "meme-360", description: "Contains 360.", test: (n) => has(n, "360") },
  { id: 45, slug: "around-the-clock", name: "Around the Clock", emoji: "🏪", family: "meme-247", description: "Contains 247. Open all hours.", test: (n) => has(n, "247") },
  { id: 46, slug: "merge-master", name: "Merge Master", emoji: "🧩", family: "meme-2048", description: "Contains 2048.", test: (n) => has(n, "2048") },
  { id: 47, slug: "combination-lock", name: "Combination Lock", emoji: "🔐", family: "meme-1234", description: "Contains 1234, the world's worst password.", test: (n) => has(n, "1234") },
  { id: 48, slug: "dalmatians", name: "Dalmatians", emoji: "🐶", family: "meme-101", description: "Contains 101.", test: (n) => has(n, "101") },
  { id: 49, slug: "double-fortune", name: "Double Fortune", emoji: "🧧", family: "eights", description: "Contains 88, twice the luck.", test: (n) => has(n, "88") },
  { id: 50, slug: "triple-fortune", name: "Triple Fortune", emoji: "🏮", family: "eights", description: "Contains 888.", test: (n) => has(n, "888") },
  { id: 51, slug: "seventh-heaven", name: "Seventh Heaven", emoji: "😇", family: "sevens", description: "Three or more 7s anywhere in the number.", test: (n) => countDigit(s(n), "7") >= 3 },
  { id: 52, slug: "jackpot", name: "Jackpot", emoji: "💰", family: "sevens", description: "Contains 7777.", test: (n) => has(n, "7777") },
  { id: 53, slug: "two-pairs", name: "Two Pairs", emoji: "🤞", family: "pairs", description: "Two different doubled digits (like 1 77 2 33).", test: (n) => distinctPairs(s(n)) >= 2 },
  { id: 54, slug: "three-pairs", name: "Three Pairs", emoji: "🃏", family: "pairs", description: "Three different doubled digits (like 117733).", test: (n) => distinctPairs(s(n)) >= 3 },
  { id: 55, slug: "zigzag", name: "Zigzag", emoji: "⚡", family: "alternating", description: "Two digits taking turns, like 3737.", test: (n) => hasZigzag(s(n)) },
  { id: 56, slug: "ping-pong", name: "Ping Pong", emoji: "🏓", family: "alternating", description: "Six digits, two of them taking turns all the way: ABABAB.", test: (n) => six(n) && s(n)[0] !== s(n)[1] && s(n) === s(n).slice(0, 2).repeat(3) },
  { id: 57, slug: "copycat", name: "Copycat", emoji: "🐱", family: "halves", description: "Six digits whose two halves match, like 418418.", test: (n) => six(n) && s(n).slice(0, 3) === s(n).slice(3) },
  { id: 58, slug: "binary", name: "Binary", emoji: "💻", family: "binary", description: "Only 0s and 1s.", test: (n) => n > 1 && /^[01]+$/.test(s(n)) },
  { id: 59, slug: "even-steven", name: "Even Steven", emoji: "⚖️", family: "parity", description: "Four or more digits, every one even.", test: (n) => s(n).length >= 4 && /^[02468]+$/.test(s(n)) },
  { id: 60, slug: "odd-squad", name: "Odd Squad", emoji: "🦄", family: "parity", description: "Four or more digits, every one odd.", test: (n) => s(n).length >= 4 && /^[13579]+$/.test(s(n)) },
  { id: 61, slug: "six-different", name: "Six Different", emoji: "🌈", family: "distinct", description: "Six digits, no two the same.", test: (n) => six(n) && new Set(s(n)).size === 6 },
  { id: 62, slug: "two-tone", name: "Two-Tone", emoji: "🎨", family: "few-digits", description: "Five or more digits using only two different digits.", test: (n) => s(n).length >= 5 && new Set(s(n)).size === 2 },
  { id: 63, slug: "heavyweight", name: "Heavyweight", emoji: "🏋️", family: "digit-sum-high", description: "Digits add up to 45 or more.", test: (n) => digitSum(s(n)) >= 45 },
  { id: 64, slug: "featherweight", name: "Featherweight", emoji: "🪶", family: "digit-sum-low", description: "Digits add up to 3 or less (but more than 0).", test: (n) => n > 0 && digitSum(s(n)) <= 3 },
  { id: 65, slug: "neat-freak", name: "Neat Freak", emoji: "🗂️", family: "sorted", description: "Five or more digits that never go down (like 113558).", test: (n) => s(n).length >= 5 && nonDecreasing(s(n)) },
  { id: 66, slug: "climber", name: "Climber", emoji: "🧗", family: "sorted", description: "Five or more digits, each bigger than the last (like 13579).", test: (n) => s(n).length >= 5 && strictlyIncreasing(s(n)) },
  { id: 67, slug: "avalanche", name: "Avalanche", emoji: "🏔️", family: "sorted", description: "Five or more digits that never go up (like 985530).", test: (n) => s(n).length >= 5 && nonDecreasing(reversed(s(n))) },
  { id: 68, slug: "deep-dive", name: "Deep Dive", emoji: "🤿", family: "sorted", description: "Five or more digits, each smaller than the last (like 97420).", test: (n) => s(n).length >= 5 && strictlyIncreasing(reversed(s(n))) },
  { id: 69, slug: "escalator", name: "Escalator", emoji: "🛗", family: "staircase", description: "Five digits in a row stepping by one, up or down.", test: (n) => longestStep(s(n), 1) >= 5 || longestStep(s(n), -1) >= 5 },
  { id: 70, slug: "full-flight", name: "Full Flight", emoji: "🪜", family: "staircase", description: "All six digits stepping by one (like 456789).", test: (n) => longestStep(s(n), 1) >= 6 || longestStep(s(n), -1) >= 6 },
  { id: 71, slug: "prime-mirror", name: "Prime Mirror", emoji: "💠", family: "prime", description: "A prime that is also a palindrome.", test: (n) => n > 9 && isPrimeFast(n) && isPalindrome(s(n)) },
  { id: 72, slug: "twin-prime", name: "Twin Prime", emoji: "👯", family: "prime", description: "A prime with another prime exactly 2 away.", test: (n) => isPrimeFast(n) && (isPrimeFast(n - 2) || isPrimeFast(n + 2)) },
  { id: 73, slug: "emirp", name: "Emirp", emoji: "🔄", family: "prime", description: "A prime that turns into a different prime backwards.", test: (n) => isPrimeFast(n) && reverseNumber(n) !== n && isPrimeFast(reverseNumber(n)) },
  { id: 74, slug: "factorial", name: "Factorial", emoji: "❗", family: "factorial", description: "A factorial: 1, 2, 6, 24, 120, 720 …", test: (n) => FACTORIALS.includes(n) },
  { id: 75, slug: "triangular", name: "Triangular", emoji: "🔺", family: "triangular", description: "A triangular number: 1 + 2 + 3 + … + k.", test: (n) => n > 0 && isTriangular(n) },
  { id: 76, slug: "perfect", name: "Perfect", emoji: "🌟", family: "perfect", description: "A perfect number: the sum of its own divisors (6, 28, 496, 8128).", test: (n) => n === 6 || n === 28 || n === 496 || n === 8128 },
  { id: 77, slug: "sixth-power", name: "Sixth Power", emoji: "🎯", family: "sixth-power", description: "Both a perfect square and a perfect cube.", test: (n) => n > 0 && isPerfectSquare(n) && isPerfectCube(n) },
  { id: 78, slug: "tripling", name: "Tripling", emoji: "🔱", family: "power-of-three", description: "A power of three.", test: (n) => n > 1 && isPowerOf(n, 3) },
  { id: 79, slug: "narcissist", name: "Narcissist", emoji: "🦚", family: "armstrong", description: "Equals the sum of its digits, each raised to the number of digits (like 153).", test: (n) => isArmstrong(n) },
  { id: 80, slug: "harshad", name: "Harshad", emoji: "➗", family: "harshad", description: "Divisible by the sum of its own digits.", test: (n) => n > 0 && n % digitSum(s(n)) === 0 },
  { id: 81, slug: "repunit", name: "Repunit", emoji: "1️⃣", family: "repeat", description: "Nothing but 1s (11, 111, … 111111).", test: (n) => n > 1 && /^1+$/.test(s(n)) },
  { id: 82, slug: "single-digit", name: "Single Digit", emoji: "☝️", family: "small", description: "Less than 10.", test: (n) => n < 10 },
  { id: 83, slug: "double-digit", name: "Double Digit", emoji: "🔟", family: "small", description: "Less than 100.", test: (n) => n < 100 },
  { id: 84, slug: "triple-digit", name: "Triple Digit", emoji: "🥉", family: "small", description: "Less than 1,000.", test: (n) => n < 1_000 },
  { id: 85, slug: "high-roller", name: "High Roller", emoji: "🎩", family: "high", description: "900,000 or more.", test: (n) => n >= 900_000 },
  { id: 86, slug: "top-shelf", name: "Top Shelf", emoji: "🍾", family: "high", description: "999,000 or more.", test: (n) => n >= 999_000 },
  { id: 87, slug: "so-close", name: "So Close", emoji: "😩", family: "high", description: "999,990 to 999,999. Almost a million.", test: (n) => n >= 999_990 && n < MAX_ROLL },
  { id: 88, slug: "halfway-there", name: "Halfway There", emoji: "🌗", family: "half", description: "Exactly 500,000.", test: (n) => n === 500_000 },
  { id: 89, slug: "date-stamp", name: "Date Stamp", emoji: "🗓️", family: "date", description: "Six digits that read as a real date, DD MM YY.", test: (n) => isDate(n) },
  { id: 90, slug: "clockwork", name: "Clockwork", emoji: "🕰️", family: "clock", description: "Six digits that read as a 24-hour time, HH MM SS.", test: (n) => isClockTime(n) },
  { id: 91, slug: "bookends", name: "Bookends", emoji: "📚", family: "bookends", description: "Three or more digits, starting and ending with the same one.", test: (n) => s(n).length >= 3 && s(n)[0] === s(n).at(-1) },
  { id: 92, slug: "odd-one-out", name: "Odd One Out", emoji: "🐑", family: "odd-one-out", description: "Five or more digits, all the same except one.", test: (n) => s(n).length >= 5 && oddOneOut(s(n)) },
  { id: 93, slug: "mountain", name: "Mountain", emoji: "⛰️", family: "shape", description: "Five or more digits that climb to a peak, then fall (like 13862).", test: (n) => s(n).length >= 5 && isMountain(s(n)) },
  { id: 94, slug: "valley", name: "Valley", emoji: "🏞️", family: "shape", description: "Five or more digits that fall to a low, then climb (like 85148).", test: (n) => s(n).length >= 5 && isValley(s(n)) },
  { id: 95, slug: "hollow", name: "Hollow", emoji: "🍩", family: "zeros", description: "Four or more zeros.", test: (n) => countDigit(s(n), "0") >= 4 },
  { id: 96, slug: "unlucky-thirteen", name: "Unlucky Thirteen", emoji: "🐈‍⬛", family: "meme-13", description: "Contains 13.", test: (n) => has(n, "13") },
];

/** Core badges (1-96) plus the expansion in extra.ts (97+, ids by position). */
export const BADGES: readonly Badge[] = [
  ...CORE_BADGES,
  ...EXTRA_BADGES.map((b, i) => ({ ...b, id: CORE_BADGES.length + 1 + i })),
];

// ---------------------------------------------------------------------------
// Rarity and EP
// ---------------------------------------------------------------------------

/** Lower-exclusive probability bounds: a badge is `rarity` when p > bound (checked in order). */
export const RARITY_THRESHOLDS: readonly (readonly [Rarity, number])[] = [
  ["common", 0.1],
  ["uncommon", 0.01],
  ["rare", 0.001],
  ["epic", 0.0001],
  ["anomaly", 0.00001],
];

/** common p>0.10, uncommon 0.01<p<=0.10, rare 0.001<p<=0.01, epic 0.0001<p<=0.001, anomaly 0.00001<p<=0.0001, mythic p<=0.00001. */
export function rarityFor(p: number): Rarity {
  for (const [rarity, bound] of RARITY_THRESHOLDS) if (p > bound) return rarity;
  return "mythic";
}

/**
 * EP = round(1 / p): a badge's EP is its "1 in N" odds, so a 1-in-5,525 badge
 * pays 5,525 EP. Equivalent to 100 divided by the chance in percent.
 */
export function epFor(p: number): number {
  return Math.max(1, Math.round(1 / p));
}

export interface BadgeStat {
  badge: Badge;
  count: number;
  probability: number;
  rarity: Rarity;
  ep: number;
}

/** Badge ids matched by n, ascending. */
export function matchBadges(n: number): number[] {
  const ids: number[] = [];
  for (const b of BADGES) if (b.test(n)) ids.push(b.id);
  return ids;
}

/** Full scan of 0..MAX_ROLL. Returns per-badge stats and each number's badge ids. */
export function computeBadgeStats(): { stats: BadgeStat[]; matches: number[][] } {
  const counts = new Map<number, number>(BADGES.map((b) => [b.id, 0]));
  const matches: number[][] = new Array(TOTAL_NUMBERS);
  for (let n = MIN_ROLL; n <= MAX_ROLL; n++) {
    const ids = matchBadges(n);
    for (const id of ids) counts.set(id, counts.get(id)! + 1);
    matches[n - MIN_ROLL] = ids;
  }
  const stats = BADGES.map((badge) => {
    const count = counts.get(badge.id)!;
    const probability = count / TOTAL_NUMBERS;
    return { badge, count, probability, rarity: rarityFor(probability), ep: epFor(probability) };
  });
  return { stats, matches };
}

let epCache: Map<number, number> | null = null;

/** EP per badge id. Computed lazily with one full scan (about a second) and cached. */
export function badgeEpMap(): Map<number, number> {
  if (!epCache) {
    epCache = new Map(computeBadgeStats().stats.map((st) => [st.badge.id, st.ep]));
  }
  return epCache;
}

const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

/**
 * Keep the best badge per family: highest EP, lowest id on a tie.
 * Returns the kept ids, ascending.
 */
export function bestPerFamily(ids: readonly number[], epById: Map<number, number>): number[] {
  const best = new Map<string, number>();
  for (const id of ids) {
    const fam = BADGE_BY_ID.get(id)!.family;
    const cur = best.get(fam);
    if (cur === undefined || epById.get(id)! > epById.get(cur)! || (epById.get(id)! === epById.get(cur)! && id < cur)) {
      best.set(fam, id);
    }
  }
  return [...best.values()].sort((a, b) => a - b);
}

/** Score one roll: the counted badge ids (best per family) and their summed EP. */
export function scoreNumber(n: number, epById: Map<number, number> = badgeEpMap()): { badgeIds: number[]; ep: number } {
  const badgeIds = bestPerFamily(matchBadges(n), epById);
  let ep = 0;
  for (const id of badgeIds) ep += epById.get(id)!;
  return { badgeIds, ep };
}

// ---------------------------------------------------------------------------
// Overall tier of a number
// ---------------------------------------------------------------------------
//
// A number's tier depends on where its total EP ranks among all 1,000,001
// numbers. Let
//   atOrAbove = share of numbers with EP >= this number's EP
//   atOrBelow = share of numbers with EP <= this number's EP
// Then, checked in order:
//   mythic   atOrAbove <= 1%
//   anomaly  atOrAbove <= 5%
//   epic     atOrAbove <= 10%
//   rare     atOrAbove <= 25%
//   uncommon atOrAbove <= 50%
//   trash    atOrBelow <= 1%
//   common   otherwise
// Equal EP always means equal tier, so ties are never split; a tie group that
// straddles a cutoff falls to the lower tier. (Using "share strictly above"
// instead would rank the huge EP-0 group as rare, since only ~25% of numbers
// beat it.) Trash is the bottom 1% only when the lowest-EP group itself is
// within 1%; with this catalogue the EP-0 group is far bigger, so in practice
// no number is trash.

export const TIER_CUTOFFS = {
  mythic: 0.01,
  anomaly: 0.05,
  epic: 0.1,
  rare: 0.25,
  uncommon: 0.5,
  trash: 0.01,
} as const;

export function tierFromShares(atOrAbove: number, atOrBelow: number): Tier {
  if (atOrAbove <= TIER_CUTOFFS.mythic) return "mythic";
  if (atOrAbove <= TIER_CUTOFFS.anomaly) return "anomaly";
  if (atOrAbove <= TIER_CUTOFFS.epic) return "epic";
  if (atOrAbove <= TIER_CUTOFFS.rare) return "rare";
  if (atOrAbove <= TIER_CUTOFFS.uncommon) return "uncommon";
  if (atOrBelow <= TIER_CUTOFFS.trash) return "trash";
  return "common";
}

/** Map every distinct EP value in `eps` to its tier. */
export function tiersForEps(eps: ArrayLike<number>): Map<number, Tier> {
  const hist = new Map<number, number>();
  for (let i = 0; i < eps.length; i++) hist.set(eps[i], (hist.get(eps[i]) ?? 0) + 1);
  const values = [...hist.keys()].sort((a, b) => a - b);
  const total = eps.length;
  const out = new Map<number, Tier>();
  let below = 0;
  for (const v of values) {
    const c = hist.get(v)!;
    out.set(v, tierFromShares((total - below) / total, (below + c) / total));
    below += c;
  }
  return out;
}
