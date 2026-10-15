const $ = id => document.getElementById(id);
const KEY = 'rngdle-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
let data = load();
data.history = data.history || {};
data.found = data.found || [];

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const dailyNumber = day => Math.floor(mulberry(hash('rngdle:' + day))() * (MAX + 1));
const fmt = n => n.toLocaleString('en-US');

function badgeEl(b) {
  const el = document.createElement('div');
  el.className = 'badge ' + b.tier;
  el.title = b.desc;
  el.innerHTML = `<div class="bn"></div><div class="bd"></div><div class="be"></div>`;
  el.children[0].textContent = b.name;
  el.children[1].textContent = b.desc;
  el.children[2].textContent = `${b.tier} · ${fmt(b.ep)} EP · 1 in ${fmt(Math.round(1 / b.prob))}`;
  return el;
}
function render(container, list) { container.replaceChildren(...list.map(badgeEl)); }

const today = utcDay();
function showToday(entry) {
  $('numberBox').textContent = fmt(entry.n);
  const sc = scoreNumber(entry.n);
  render($('earned'), sc.earned);
  $('epTotal').textContent = fmt(sc.total);
  $('result').hidden = false;
  $('rollBtn').hidden = true;
}
function stats() {
  const days = Object.keys(data.history).sort();
  $('stDays').textContent = days.length;
  let streak = 0;
  let d = new Date(today + 'T00:00:00Z');
  if (!data.history[utcDay(d)]) d.setUTCDate(d.getUTCDate() - 1);
  while (data.history[utcDay(d)]) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  $('stStreak').textContent = streak;
  $('stBest').textContent = fmt(Math.max(0, ...days.map(k => data.history[k].ep)));
  $('stBadges').textContent = `${data.found.length}/${BADGES.length}`;
}
function roll() {
  const n = dailyNumber(today);
  const sc = scoreNumber(n);
  data.history[today] = { n, ep: sc.total };
  sc.earned.forEach(b => { if (!data.found.includes(b.id)) data.found.push(b.id); });
  save(data);
  // slot-machine reveal
  const box = $('numberBox'); $('rollBtn').disabled = true;
  let i = 0;
  const t = setInterval(() => {
    box.textContent = fmt(Math.floor(Math.random() * (MAX + 1)));
    if (++i > 20) { clearInterval(t); $('rollBtn').disabled = false; showToday(data.history[today]); stats(); buildBadges(); }
  }, 60);
}
$('rollBtn').onclick = roll;

$('shareBtn').onclick = async () => {
  const e = data.history[today]; const sc = scoreNumber(e.n);
  const text = `RNGdle ${today}\n🎲 ${fmt(e.n)}\n⭐ ${fmt(sc.total)} EP\n` +
    sc.earned.slice(0, 5).map(b => `• ${b.name} (${b.tier})`).join('\n') + '\n' + location.href;
  try { await navigator.clipboard.writeText(text); $('shareMsg').textContent = 'Copied to clipboard!'; }
  catch { $('shareMsg').textContent = 'Copy failed'; }
};

function buildBadges() {
  $('badgeSummary').textContent = `${data.found.length} of ${BADGES.length} found`;
  const order = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  const list = [...BADGES].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || b.ep - a.ep);
  $('badgeGrid').replaceChildren(...list.map(b => {
    const el = badgeEl(b);
    if (!data.found.includes(b.id)) el.classList.add('locked');
    return el;
  }));
}

// Tools
function check(n) { return scoreNumber(n); }
$('calcBtn').onclick = () => {
  const n = parseInt($('calcInput').value, 10);
  if (!(n >= 0 && n <= MAX)) { $('calcOut').textContent = 'Enter a number from 0 to 1,000,000.'; return; }
  const sc = check(n);
  const wrap = document.createDocumentFragment();
  const h = document.createElement('div'); h.className = 'ep'; h.innerHTML = `${fmt(n)} → <b>${fmt(sc.total)}</b> EP`;
  wrap.append(h);
  const list = document.createElement('div'); list.className = 'badgeList'; render(list, sc.earned); wrap.append(list);
  $('calcOut').replaceChildren(wrap);
};
$('practiceBtn').onclick = () => {
  const n = Math.floor(Math.random() * (MAX + 1)); const sc = check(n);
  $('practiceNum').textContent = `${fmt(n)} — ${fmt(sc.total)} EP`;
  render($('practiceOut'), sc.earned);
};
$('resetBtn').onclick = () => { if (confirm('Delete all saved progress?')) { try { localStorage.removeItem(KEY); } catch {} location.reload(); } };

// Tabs
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === b.dataset.tab));
});

// Countdown
function tick() {
  const now = new Date(), next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const s = Math.floor((next - now) / 1000), p = x => String(x).padStart(2, '0');
  $('countdown').textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  if (utcDay() !== today) location.reload();
}
setInterval(tick, 1000); tick();

if (data.history[today]) showToday(data.history[today]);
stats(); buildBadges();
