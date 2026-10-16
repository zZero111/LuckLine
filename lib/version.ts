// Bump APP_VERSION and add an entry to CHANGELOG to show the "What's new"
// pop-up again to every player on their next visit.
export const APP_VERSION = "1.3";

export interface ChangelogEntry {
  version: string;
  title: string;
  items: { emoji: string; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.3",
    title: "A real die, glowing badges and a bigger roll",
    items: [
      { emoji: "🎲", text: "The logo is now a real 3D die, tumbling on every axis like it's been thrown. Hover to make it whirl." },
      { emoji: "💥", text: "Rolling takes over the whole screen. Slower, with a heavy thud, a shockwave and a screen shake as every digit lands. Tap to skip." },
      { emoji: "🌟", text: "Every badge has an aura. The rarer the badge, the bigger it glows, and the best ones get their own effects: flames, falling gold, code rain, black holes, lightning, rainbow borders and more." },
      { emoji: "🥇", text: "The top three on the leaderboard get a gold, silver and bronze frame." },
    ],
  },
  {
    version: "1.2",
    title: "Polish, new badges and a spinning die",
    items: [
      { emoji: "🧹", text: "No more twins: 6 badges that matched exactly the same numbers were replaced with brand-new ones. Past rolls were re-checked." },
      { emoji: "🙌", text: "New 67 badges: Six Seven (any number containing 67) and a mythic for rolling exactly 67." },
      { emoji: "🎲", text: "The dice logo spins! Hover over it to make it whizz, click it to rattle." },
      { emoji: "✨", text: "Everything moves smoother: pages slide in, the menu underline glides, lists cascade in, stats count up, and the top 3 get medals on the leaderboard." },
      { emoji: "🔊", text: "More sound: soft clicks, page whooshes, a dice rattle when you press ROLL and a coin clink when you reroll. Mute everything with the speaker button at the top." },
    ],
  },
  {
    version: "1.1",
    title: "The big update",
    items: [
      { emoji: "💎", text: "369 badges to collect (up from 30), with a searchable Badges page. Related badges form families: only the best one in each family counts." },
      { emoji: "📈", text: "Bigger EP: a badge now pays its odds, so a 1-in-5,000 badge is worth 5,000 EP." },
      { emoji: "🎰", text: "A dramatic new roll reveal: digits slam in one by one, rare rolls tease the last digit, and the rarest shake the screen." },
      { emoji: "🎲", text: "Rerolls: spend 400 EP for another roll, up to 3 a day. Your best roll of the day is the one that counts." },
      { emoji: "🎡", text: "The Lucky Wheel: one free spin a day after you roll. Win 2×, 3×, 5× or a 10× jackpot, +200 EP or a free reroll … or lose half." },
      { emoji: "📊", text: "Player stats: tap any name on the leaderboard to see their best roll ever, badges, streaks and more." },
      { emoji: "🖼️", text: "Profile pictures: add yours on the Account page." },
      { emoji: "🎨", text: "A brand-new dice logo, next to the title and on your browser tab." },
      { emoji: "📬", text: "Daily reminder emails if you haven't rolled by the evening. Turn them off any time on the Account page or with the link in the email." },
      { emoji: "🔥", text: "Streaks, NEW badge tags, the odds of every badge, how your roll ranks, and share text with coloured squares." },
      { emoji: "🗑️", text: "The Trash tier finally exists. Good luck avoiding it." },
    ],
  },
];
