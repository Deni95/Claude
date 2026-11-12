'use strict';
(() => {
// ============================================================
//  ТЁМНАЯ ЧАЩА — survival game
// ============================================================
const WORLD = 3000;
const DAY_LEN = 240;            // seconds per full day
const SAVE_KEY = 'darkthicket_save_v1';
const MAX = { hp: 150, hunger: 150, san: 200 };
const INV_SIZE = 12;

// ---------- Items ----------
const ITEMS = {
  log:      { name: 'Бревно', fuel: 45 },
  twig:     { name: 'Ветка', fuel: 12 },
  grass:    { name: 'Трава', fuel: 15 },
  flint:    { name: 'Кремень' },
  rock:     { name: 'Камень' },
  rope:     { name: 'Верёвка' },
  berry:    { name: 'Ягоды', food: { h: 9, hp: 0, s: 0 }, cook: 'berry_c' },
  berry_c:  { name: 'Печёные ягоды', food: { h: 12, hp: 1, s: 0 } },
  carrot:   { name: 'Морковь', food: { h: 12, hp: 1, s: 0 }, cook: 'carrot_c' },
  carrot_c: { name: 'Печёная морковь', food: { h: 12, hp: 3, s: 0 } },
  meat:     { name: 'Сырое мясо', food: { h: 25, hp: -3, s: -10 }, cook: 'meat_c' },
  meat_c:   { name: 'Жареное мясо', food: { h: 25, hp: 3, s: 5 } },
  stew:     { name: 'Похлёбка', food: { h: 60, hp: 20, s: 15 } },
  axe:      { name: 'Топор', slot: 'hand', tool: 'axe', dur: 60, dmg: 20 },
  pickaxe:  { name: 'Кирка', slot: 'hand', tool: 'pickaxe', dur: 40, dmg: 20 },
  spear:    { name: 'Копьё', slot: 'hand', tool: 'weapon', dur: 90, dmg: 34 },
  torch:    { name: 'Факел', slot: 'hand', tool: 'light', dur: 100, dmg: 12, timed: true },
  armor:    { name: 'Деревянная броня', slot: 'body', dur: 350 },
};
const STACK = 40;
const isStackable = id => !ITEMS[id].slot;

const RECIPES = [
  { id: 'axe', need: { twig: 1, flint: 1 }, desc: 'Рубит деревья' },
  { id: 'pickaxe', need: { twig: 2, flint: 2 }, desc: 'Разбивает валуны' },
  { id: 'torch', need: { twig: 2, grass: 2 }, desc: 'Свет в руке, горит недолго' },
  { id: 'campfire', place: true, name: 'Костёр', need: { grass: 3, log: 2 }, desc: 'Свет и готовка. Подбрасывай топливо' },
  { id: 'rope', need: { grass: 3 }, desc: 'Материал' },
  { id: 'spear', need: { twig: 2, rope: 1, flint: 1 }, desc: 'Урон 34' },
  { id: 'firepit', place: true, name: 'Каменный очаг', need: { log: 2, rock: 8 }, desc: 'Горит дольше и ярче' },
  { id: 'armor', need: { log: 6, rope: 2 }, desc: 'Поглощает 60% урона' },
  { id: 'stew', need: { meat_c: 1, carrot: 2, berry: 2 }, desc: 'Сытная еда, лечит', nearFire: true },
];

// ---------- Resources ----------
const RES = {
  tree:    { r: 16, solid: true, label: 'Рубить', tool: 'axe', hits: 5 },
  sapling: { r: 8, label: 'Сорвать', give: 'twig', regrow: 1.0 },
  grass:   { r: 8, label: 'Сорвать', give: 'grass', regrow: 1.0 },
  bush:    { r: 14, label: 'Собрать', give: 'berry', regrow: 1.6 },
  carrot:  { r: 8, label: 'Выкопать', give: 'carrot' },
  boulder: { r: 22, solid: true, label: 'Добыть', tool: 'pickaxe', hits: 6 },
};
const SPAWN = {
  forest: [['tree', .42], ['sapling', .07], ['grass', .03], ['bush', .03]],
  meadow: [['grass', .16], ['sapling', .1], ['bush', .05], ['carrot', .035], ['tree', .04], ['flint', .012]],
  rock:   [['boulder', .17], ['flint', .06], ['grass', .03], ['tree', .015]],
};

// ---------- Mobs ----------
const MOBS = {
  rabbit: { hp: 25, speed: 150, wander: 55, r: 10, drop: [['meat', 1]] },
  boar:   { hp: 150, speed: 155, wander: 40, r: 22, dmg: 14, cd: 1.6, drop: [['meat', 2]] },
  wolf:   { hp: 90, speed: 215, r: 16, dmg: 11, cd: 1.1, drop: [['meat', 1]] },
  shade:  { hp: 80, speed: 125, r: 18, dmg: 16, cd: 1.7, drop: [] },
};

// ============================================================
//  Utilities
// ============================================================
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(ix, iy, s) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function biomeAt(x, y, s) {
  const r = vnoise(x / 450, y / 450, s + 11) * 0.7 + vnoise(x / 150, y / 150, s + 12) * 0.3;
  if (r > 0.64) return 'rock';
  const f = vnoise(x / 520, y / 520, s) * 0.75 + vnoise(x / 160, y / 160, s + 3) * 0.25;
  return f > 0.5 ? 'forest' : 'meadow';
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

// ============================================================
//  Canvas setup
// ============================================================
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const dark = document.createElement('canvas');
const dctx = dark.getContext('2d');
let W = 0, H = 0, DPR = 1, Z = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  dark.width = Math.round(W / 2); dark.height = Math.round(H / 2);
  Z = clamp(Math.min(W, H) / 480, 0.62, 1.5);
}
window.addEventListener('resize', resize);
resize();

// ============================================================
//  Item icons (drawn procedurally)
// ============================================================
function drawItem(c, id, s) {
  const k = s / 32;
  c.save(); c.scale(k, k); c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (col, w, pts) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); };
  const circ = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
  switch (id) {
    case 'log':
      c.fillStyle = '#6b4a2b'; c.fillRect(-12, -6, 22, 12);
      c.fillStyle = '#c9a66b'; c.beginPath(); c.ellipse(10, 0, 4, 6, 0, 0, 7); c.fill();
      c.strokeStyle = '#8a6a40'; c.lineWidth = 1; c.beginPath(); c.ellipse(10, 0, 2, 3, 0, 0, 7); c.stroke();
      line('#4b3220', 1.5, [-10, -2, 4, -2]); line('#4b3220', 1.5, [-8, 3, 6, 3]); break;
    case 'twig':
      line('#7a5634', 2.5, [-12, 10, 12, -10]); line('#7a5634', 2, [-2, 2, -6, -8]); line('#7a5634', 2, [5, -4, 10, 2]); break;
    case 'grass':
      for (let i = -3; i <= 3; i++) line(i % 2 ? '#b8b04a' : '#8fa040', 2, [i * 1.5, 12, i * 4, -12]);
      line('#7a5634', 3, [-6, 4, 6, 4]); break;
    case 'flint':
      c.fillStyle = '#3d3f46'; c.beginPath(); c.moveTo(-9, 9); c.lineTo(0, -11); c.lineTo(10, 8); c.closePath(); c.fill();
      c.fillStyle = '#7d818c'; c.beginPath(); c.moveTo(-2, 4); c.lineTo(0, -7); c.lineTo(4, 3); c.closePath(); c.fill(); break;
    case 'rock':
      c.fillStyle = '#7b7a76'; c.beginPath(); c.moveTo(-11, 6); c.lineTo(-8, -6); c.lineTo(3, -10); c.lineTo(11, -2); c.lineTo(9, 8); c.closePath(); c.fill();
      c.fillStyle = '#9c9b96'; c.beginPath(); c.moveTo(-6, -4); c.lineTo(3, -8); c.lineTo(6, -2); c.closePath(); c.fill(); break;
    case 'rope':
      c.strokeStyle = '#c2a36a'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, 11 - i * 3.5, 9 - i * 3, 0, 0, 7); c.stroke(); } break;
    case 'berry': case 'berry_c': {
      const col = id === 'berry' ? '#c4283a' : '#6e2a22';
      c.fillStyle = '#3f6e2e'; c.beginPath(); c.ellipse(-4, -9, 7, 3, -0.5, 0, 7); c.fill();
      circ(-5, 2, 6, col); circ(5, 0, 6, col); circ(0, 8, 6, col);
      circ(-6, 0, 1.5, 'rgba(255,255,255,.5)'); circ(4, -2, 1.5, 'rgba(255,255,255,.5)'); break; }
    case 'carrot': case 'carrot_c': {
      line('#4f8a33', 2.5, [6, -6, 12, -13]); line('#4f8a33', 2.5, [6, -6, 4, -14]); line('#4f8a33', 2.5, [6, -6, 13, -6]);
      c.fillStyle = id === 'carrot' ? '#e07a22' : '#9a4d1c'; c.beginPath(); c.moveTo(-12, 12); c.lineTo(3, -9); c.lineTo(9, -3); c.closePath(); c.fill();
      line('rgba(0,0,0,.3)', 1, [-3, 3, 0, 5]); line('rgba(0,0,0,.3)', 1, [1, -2, 4, 0]); break; }
    case 'meat': case 'meat_c':
      line('#eee6d4', 4, [6, 6, 13, 13]); circ(13, 12, 2.5, '#eee6d4'); circ(12, 14, 2.5, '#eee6d4');
      c.fillStyle = id === 'meat' ? '#c0434b' : '#7a4424'; c.beginPath(); c.ellipse(-2, -2, 11, 9, -0.6, 0, 7); c.fill();
      c.fillStyle = id === 'meat' ? '#e8a0a0' : '#a8693b'; c.beginPath(); c.ellipse(-4, -4, 5, 3, -0.6, 0, 7); c.fill(); break;
    case 'stew':
      c.fillStyle = '#5a4030'; c.beginPath(); c.ellipse(0, 4, 13, 8, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#8a5a2a'; c.beginPath(); c.ellipse(0, 3, 13, 4, 0, 0, 7); c.fill();
      circ(-4, 2, 2, '#e07a22'); circ(4, 3, 2, '#c4283a'); line('rgba(220,220,220,.5)', 1.5, [-3, -4, -1, -10]); line('rgba(220,220,220,.5)', 1.5, [3, -3, 5, -10]); break;
    case 'axe':
      line('#7a5634', 3, [-10, 13, 7, -10]);
      c.fillStyle = '#9aa0a8'; c.beginPath(); c.moveTo(3, -12); c.quadraticCurveTo(16, -12, 14, 2); c.lineTo(5, -6); c.closePath(); c.fill(); break;
    case 'pickaxe':
      line('#7a5634', 3, [-10, 13, 6, -8]);
      c.strokeStyle = '#9aa0a8'; c.lineWidth = 4; c.beginPath(); c.moveTo(-6, -12); c.quadraticCurveTo(6, -14, 14, -2); c.stroke(); break;
    case 'spear':
      line('#7a5634', 2.5, [-13, 13, 8, -8]);
      c.fillStyle = '#5a5d66'; c.beginPath(); c.moveTo(14, -14); c.lineTo(5, -9); c.lineTo(9, -5); c.closePath(); c.fill();
      line('#c2a36a', 2, [3, -5, 6, -2]); break;
    case 'torch':
      line('#7a5634', 3.5, [-6, 14, 4, -4]);
      c.fillStyle = '#f2a02a'; c.beginPath(); c.moveTo(1, -2); c.quadraticCurveTo(0, -14, 9, -16); c.quadraticCurveTo(12, -6, 7, -1); c.closePath(); c.fill();
      c.fillStyle = '#ffe07a'; c.beginPath(); c.ellipse(5, -6, 2, 4, 0.4, 0, 7); c.fill(); break;
    case 'armor':
      c.fillStyle = '#7a5634'; c.beginPath(); c.moveTo(-11, -10); c.lineTo(-4, -12); c.lineTo(0, -8); c.lineTo(4, -12); c.lineTo(11, -10); c.lineTo(10, 12); c.lineTo(-10, 12); c.closePath(); c.fill();
      for (let i = -6; i <= 6; i += 6) line('#4b3220', 1.5, [i, -8, i, 11]); line('#c2a36a', 2, [-10, 2, 10, 2]); break;
    case 'campfire': case 'firepit':
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; circ(Math.cos(a) * 11, 5 + Math.sin(a) * 5, 3.5, id === 'campfire' ? '#6b4a2b' : '#86857f'); }
      c.fillStyle = '#f2a02a'; c.beginPath(); c.moveTo(-6, 4); c.quadraticCurveTo(-4, -12, 0, -14); c.quadraticCurveTo(5, -8, 6, 4); c.closePath(); c.fill();
      c.fillStyle = '#ffe07a'; c.beginPath(); c.ellipse(0, 0, 2.5, 5, 0, 0, 7); c.fill(); break;
  }
  c.restore();
}
const iconCache = {};
function iconURL(id) {
  if (!iconCache[id]) {
    const cc = document.createElement('canvas'); cc.width = cc.height = 64;
    const x = cc.getContext('2d'); x.translate(32, 32); drawItem(x, id, 60);
    iconCache[id] = cc.toDataURL();
  }
  return iconCache[id];
}
const itemName = id => (ITEMS[id] && ITEMS[id].name) || (RECIPES.find(r => r.id === id) || {}).name || id;

// ============================================================
//  Game state
// ============================================================
let G = null;
let running = false;
let groundCanvas = null, decor = [];
const particles = [];

function newGame() {
  G = {
    seed: (Math.random() * 1e9) | 0,
    t: DAY_LEN * 0.03,
    nextId: 1,
    player: {
      x: WORLD / 2, y: WORLD / 2, hp: MAX.hp, hunger: MAX.hunger, san: MAX.san,
      inv: new Array(INV_SIZE).fill(null), hand: null, body: null, face: 1,
    },
    res: [], drops: [], mobs: [], fires: [],
    wolvesDay: 0, warnDay: 0,
  };
  genWorld();
  buildDerived();
  say('Надо найти ветки и кремень...');
}

function spawnRes(type, x, y, rnd = Math.random) {
  if (type === 'flint') { G.drops.push({ kind: 'drop', id: 'flint', n: 1, x, y }); return; }
  G.res.push({ kind: 'res', uid: G.nextId++, type, x, y, state: 'ready', timer: 0, hits: 0, s: 0.85 + rnd() * 0.35 });
}
function spawnMob(type, x, y) {
  const d = MOBS[type];
  const m = { kind: 'mob', uid: G.nextId++, type, x, y, hp: d.hp, vx: 0, vy: 0, t: 0, cd: 1, hitT: 0, aggro: false, face: 1, anim: Math.random() * 10 };
  G.mobs.push(m); return m;
}

function genWorld() {
  const rnd = mulberry32(G.seed);
  const step = 55, C = WORLD / 2;
  for (let gy = step / 2; gy < WORLD; gy += step) {
    for (let gx = step / 2; gx < WORLD; gx += step) {
      const x = gx + (rnd() - 0.5) * step * 0.9, y = gy + (rnd() - 0.5) * step * 0.9;
      if (x < 50 || y < 50 || x > WORLD - 50 || y > WORLD - 50) continue;
      if (Math.hypot(x - C, y - C) < 110) continue;
      const tbl = SPAWN[biomeAt(x, y, G.seed)];
      const r = rnd(); let acc = 0;
      for (const [type, p] of tbl) { acc += p; if (r < acc) { spawnRes(type, x, y, rnd); break; } }
    }
  }
  // starter kit nearby
  const ring = (type, n, r0, r1) => { for (let i = 0; i < n; i++) { const a = rnd() * 7, r = r0 + rnd() * (r1 - r0); spawnRes(type, C + Math.cos(a) * r, C + Math.sin(a) * r, rnd); } };
  ring('sapling', 5, 120, 260); ring('grass', 6, 120, 280); ring('flint', 4, 130, 300); ring('bush', 2, 160, 300); ring('tree', 4, 200, 340);
  // animals
  for (let i = 0; i < 14; i++) spawnMobInBiome('rabbit', 'meadow', 300);
  for (let i = 0; i < 8; i++) spawnMobInBiome('boar', 'forest', 600);
}

function spawnMobInBiome(type, biome, minDist) {
  for (let tries = 0; tries < 40; tries++) {
    const x = rand(80, WORLD - 80), y = rand(80, WORLD - 80);
    if (G.player && Math.hypot(x - G.player.x, y - G.player.y) < minDist) continue;
    if (biomeAt(x, y, G.seed) !== biome) continue;
    return spawnMob(type, x, y);
  }
  return null;
}

// Ground texture + decorations: derived from seed, not saved
function buildDerived() {
  const S = 6, n = WORLD / S;
  groundCanvas = document.createElement('canvas');
  groundCanvas.width = groundCanvas.height = n;
  const g = groundCanvas.getContext('2d');
  const img = g.createImageData(n, n);
  const COL = { forest: [42, 52, 30], meadow: [78, 82, 44], rock: [84, 80, 70] };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const wx = x * S, wy = y * S;
    const c = COL[biomeAt(wx, wy, G.seed)];
    const v = (vnoise(wx / 40, wy / 40, G.seed + 5) - 0.5) * 22 + (hash2(x, y, 77) - 0.5) * 6;
    const i = (y * n + x) * 4;
    img.data[i] = c[0] + v; img.data[i + 1] = c[1] + v; img.data[i + 2] = c[2] + v * 0.6; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const rnd = mulberry32(G.seed + 99);
  decor = [];
  for (let i = 0; i < 3500; i++) {
    const x = rnd() * WORLD, y = rnd() * WORLD;
    decor.push({ x, y, b: biomeAt(x, y, G.seed), v: rnd() });
  }
}

// ============================================================
//  Time of day
// ============================================================
function dayPhase() { return (G.t % DAY_LEN) / DAY_LEN; }
function dayNum() { return Math.floor(G.t / DAY_LEN) + 1; }
function phaseName() { const p = dayPhase(); return p < 0.5 ? 'day' : p < 0.68 ? 'dusk' : 'night'; }
function darkness() {
  const p = dayPhase();
  if (p < 0.04) return 0.95 * (1 - p / 0.04);
  if (p < 0.5) return 0;
  if (p < 0.68) return 0.55 * (p - 0.5) / 0.18;
  if (p < 0.72) return 0.55 + 0.42 * (p - 0.68) / 0.04;
  return 0.97;
}

// ============================================================
//  Inventory
// ============================================================
let invDirty = true;
function addItem(id, n = 1, dur) {
  const inv = G.player.inv;
  if (isStackable(id)) {
    for (const s of inv) if (s && s.id === id && s.n < STACK) { const k = Math.min(n, STACK - s.n); s.n += k; n -= k; if (!n) break; }
    for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { const k = Math.min(n, STACK); inv[i] = { id, n: k }; n -= k; }
  } else {
    for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { inv[i] = { id, n: 1, dur: dur ?? ITEMS[id].dur }; n--; }
  }
  invDirty = true;
  return n;
}
function giveOrDrop(id, n = 1, dur) {
  const left = addItem(id, n, dur);
  if (left > 0) { dropItem(id, left, dur, G.player.x, G.player.y); say('Инвентарь полон'); }
}
function dropItem(id, n, dur, x, y) {
  G.drops.push({ kind: 'drop', id, n, dur, x: x + rand(-14, 14), y: y + rand(-6, 14) });
}
function countItem(id) { let c = 0; for (const s of G.player.inv) if (s && s.id === id) c += s.n; return c; }
function removeItem(id, n) {
  const inv = G.player.inv;
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i]; if (!s || s.id !== id) continue;
    const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) inv[i] = null;
  }
  invDirty = true;
}
function useHand(amount) {
  const p = G.player;
  if (!p.hand) return;
  p.hand.dur -= amount;
  if (p.hand.dur <= 0) { say(`${itemName(p.hand.id)}: сломалось`); p.hand = null; }
  invDirty = true;
}

// ============================================================
//  Messages & effects
// ============================================================
let speech = null;
function say(text, time = 2.6) { speech = { text, t: time }; }
function burst(x, y, col, n = 6, spd = 60) {
  for (let i = 0; i < n; i++) particles.push({ x, y: y - 10, vx: rand(-spd, spd), vy: rand(-spd * 1.5, -spd * 0.3), life: rand(0.4, 0.8), col, sz: rand(2, 4) });
}
let hurtFlash = 0, darkFlash = 0;

// ============================================================
//  Input
// ============================================================
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
const keys = {};
let actionHeld = false;
let lockTarget = null;

cvs.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    if (joy.id === null && t.clientX < W * 0.6) {
      joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; joy.active = true;
    }
  }
  closePopup();
  e.preventDefault();
}, { passive: false });
cvs.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === joy.id) {
    let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const m = Math.hypot(dx, dy), R = 55;
    if (m > R) { joy.ox += dx * (1 - R / m); joy.oy += dy * (1 - R / m); dx = t.clientX - joy.ox; dy = t.clientY - joy.oy; }
    joy.x = dx / R; joy.y = dy / R;
  }
  e.preventDefault();
}, { passive: false });
const endTouch = e => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.active = false; joy.x = joy.y = 0; } };
cvs.addEventListener('touchend', endTouch);
cvs.addEventListener('touchcancel', endTouch);
cvs.addEventListener('mousedown', closePopup);

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!running) return;
  if (e.code === 'Space') actionHeld = true;
  if (e.code === 'KeyC') toggleCraft();
  if (e.code === 'Escape') pauseGame();
  const m = /^Digit(\d)$/.exec(e.code); if (m) { const i = (+m[1] + 9) % 10; if (G.player.inv[i]) quickUse(i); }
});
window.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') { actionHeld = false; lockTarget = null; } });

const actBtn = document.getElementById('actBtn');
actBtn.addEventListener('pointerdown', e => { actionHeld = true; closePopup(); e.preventDefault(); });
const actUp = () => { actionHeld = false; lockTarget = null; };
actBtn.addEventListener('pointerup', actUp);
actBtn.addEventListener('pointercancel', actUp);
actBtn.addEventListener('pointerleave', actUp);
actBtn.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
//  Targeting & interaction
// ============================================================
function harvestable(r) { return r.state === 'ready'; }
function targetValid(t) {
  if (!t) return false;
  if (t.kind === 'res') return G.res.includes(t) && harvestable(t);
  if (t.kind === 'drop') return G.drops.includes(t);
  if (t.kind === 'mob') return G.mobs.includes(t) && t.hp > 0;
  return false;
}
function reachOf(t) {
  if (t.kind === 'res') return RES[t.type].r * t.s + 26;
  if (t.kind === 'drop') return 30;
  return MOBS[t.type].r + 30;
}
function findTarget(radius = 230) {
  const p = G.player;
  let best = null, bd = Infinity;
  // hostile mobs that are close come first
  for (const m of G.mobs) {
    const d = dist(p, m);
    if ((m.type === 'wolf' || m.type === 'shade' || (m.type === 'boar' && m.aggro)) && d < 140 && d < bd) { best = m; bd = d; }
  }
  if (best) return best;
  for (const dr of G.drops) { const d = dist(p, dr) - 25; if (d < radius && d < bd) { best = dr; bd = d; } }
  for (const r of G.res) {
    if (!harvestable(r)) continue;
    const dx = Math.abs(r.x - p.x), dy = Math.abs(r.y - p.y); if (dx > radius || dy > radius) continue;
    let d = Math.hypot(dx, dy);
    if (RES[r.type].tool && !(p.hand && p.hand.id && ITEMS[p.hand.id].tool === RES[r.type].tool)) d += 120; // prefer stuff we can use
    if (d < radius && d < bd) { best = r; bd = d; }
  }
  for (const m of G.mobs) { const d = dist(p, m); if (d < radius && d < bd) { best = m; bd = d; } }
  return best;
}
function actionLabel(t) {
  if (!t) return 'Действие';
  if (t.kind === 'drop') return 'Поднять';
  if (t.kind === 'mob') return 'Атака';
  return RES[t.type].label;
}

function interact(t) {
  const p = G.player;
  p.face = t.x >= p.x ? 1 : -1;
  if (t.kind === 'drop') {
    const left = addItem(t.id, t.n, t.dur);
    if (left === t.n) { say('Инвентарь полон'); p.cd = 0.6; return; }
    if (left > 0) t.n = left; else G.drops.splice(G.drops.indexOf(t), 1);
    p.cd = 0.2; p.swing = 0.2; return;
  }
  if (t.kind === 'mob') {
    const dmg = p.hand ? (ITEMS[p.hand.id].dmg || 10) : 10;
    t.hp -= dmg; t.hitT = 0.2;
    const d = dist(p, t) || 1; t.x += (t.x - p.x) / d * 12; t.y += (t.y - p.y) / d * 12;
    if (t.type === 'boar') t.aggro = true;
    burst(t.x, t.y, t.type === 'shade' ? '#000' : '#a02020', 5);
    if (p.hand && !ITEMS[p.hand.id].timed) useHand(1);
    p.cd = 0.55; p.swing = 0.25;
    if (t.hp <= 0) killMob(t);
    return;
  }
  // resource
  const def = RES[t.type];
  if (def.tool) {
    if (!p.hand || ITEMS[p.hand.id].tool !== def.tool) { say(def.tool === 'axe' ? 'Нужен топор' : 'Нужна кирка'); p.cd = 0.8; actionHeld && (lockTarget = null); return; }
    t.hits++; t.shake = 0.25; useHand(1); p.cd = 0.45; p.swing = 0.25;
    burst(t.x, t.y - (t.type === 'tree' ? 30 : 5), t.type === 'tree' ? '#3d5a2a' : '#8a8a84', 5);
    if (t.hits >= def.hits) {
      t.hits = 0;
      if (t.type === 'tree') {
        const n = t.s > 1.05 ? 3 : 2;
        for (let i = 0; i < n; i++) dropItem('log', 1, undefined, t.x, t.y);
        t.state = 'stump'; t.timer = DAY_LEN * rand(2.5, 4);
      } else {
        for (let i = 0, n = 2 + (Math.random() < 0.5); i < n; i++) dropItem('rock', 1, undefined, t.x, t.y);
        for (let i = 0, n = 1 + (Math.random() < 0.4); i < n; i++) dropItem('flint', 1, undefined, t.x, t.y);
        G.res.splice(G.res.indexOf(t), 1);
      }
    }
    return;
  }
  // hand pick
  let n = 1;
  if (t.type === 'bush') n = Math.random() < 0.4 ? 2 : 1;
  giveOrDrop(def.give, n);
  burst(t.x, t.y, t.type === 'bush' ? '#c4283a' : '#9aa04a', 4, 40);
  if (t.type === 'carrot') G.res.splice(G.res.indexOf(t), 1);
  else { t.state = 'picked'; t.timer = DAY_LEN * def.regrow * rand(0.8, 1.2); }
  p.cd = 0.35; p.swing = 0.2;
}

function killMob(m) {
  for (const [id, n] of MOBS[m.type].drop) for (let i = 0; i < n; i++) dropItem(id, 1, undefined, m.x, m.y);
  if (m.type === 'shade') { G.player.san = Math.min(MAX.san, G.player.san + 25); burst(m.x, m.y, '#000', 14, 90); }
  G.mobs.splice(G.mobs.indexOf(m), 1);
}

function hurtPlayer(dmg, ignoreArmor) {
  const p = G.player;
  if (p.inv_t > 0) return;
  if (p.body && !ignoreArmor) {
    const abs = dmg * 0.6; p.body.dur -= abs; dmg -= abs;
    if (p.body.dur <= 0) { p.body = null; say('Броня развалилась'); }
    invDirty = true;
  }
  p.hp -= dmg; p.inv_t = 0.4; hurtFlash = 0.35;
  burst(p.x, p.y - 10, '#a02020', 6);
  if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) {}
}

// ============================================================
//  Lights
// ============================================================
function fireRadius(f) { if (f.fuel <= 0) return 0; const k = f.fuel / f.max; return (f.type === 'firepit' ? 110 : 90) + k * (f.type === 'firepit' ? 230 : 190); }
function lights() {
  const L = [];
  const fl = Math.sin(G.t * 13) * 4 + Math.sin(G.t * 7.3) * 3;
  for (const f of G.fires) { const r = fireRadius(f); if (r > 0) L.push({ x: f.x, y: f.y - 8, r: r + fl }); }
  const p = G.player;
  if (p.hand && p.hand.id === 'torch') L.push({ x: p.x + p.face * 10, y: p.y - 30, r: 210 + fl });
  return L;
}
function isLit(x, y) { for (const l of lights()) if (Math.hypot(l.x - x, l.y - y) < l.r * 0.72) return true; return false; }
function nearFire(range = 95) { for (const f of G.fires) if (f.fuel > 0 && dist(f, G.player) < range) return f; return null; }
function nearAnyFire(range = 95) { for (const f of G.fires) if (dist(f, G.player) < range) return f; return null; }

// ============================================================
//  Update
// ============================================================
let spawnTimer = 0, shadeTimer = 8, saveTimer = 20;
function update(dt) {
  const p = G.player;
  G.t += dt;
  const ph = phaseName(), day = dayNum();

  // ---- movement & action ----
  let mx = joy.x, my = joy.y;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  let mag = Math.hypot(mx, my); if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
  const manual = mag > 0.15;

  p.cd = (p.cd || 0) - dt; p.swing = Math.max(0, (p.swing || 0) - dt); p.inv_t = (p.inv_t || 0) - dt;
  let tgt = null;
  if (actionHeld) {
    if (!targetValid(lockTarget)) lockTarget = findTarget();
    tgt = lockTarget;
  }
  G.hint = actionHeld ? tgt : findTarget();

  let moveX = 0, moveY = 0;
  if (manual) { moveX = mx; moveY = my; }
  if (tgt) {
    const d = dist(p, tgt);
    if (d > reachOf(tgt)) { if (!manual) { moveX = (tgt.x - p.x) / d; moveY = (tgt.y - p.y) / d; } }
    else if (p.cd <= 0) interact(tgt);
  }
  const speed = 165;
  p.moving = moveX !== 0 || moveY !== 0;
  if (p.moving) {
    p.x += moveX * speed * dt; p.y += moveY * speed * dt;
    if (Math.abs(moveX) > 0.1) p.face = moveX > 0 ? 1 : -1;
    p.walk = (p.walk || 0) + dt;
  }
  // collisions
  for (const r of G.res) {
    if (!RES[r.type].solid || r.state !== 'ready') continue;
    const dx = p.x - r.x, dy = p.y - r.y; if (Math.abs(dx) > 60 || Math.abs(dy) > 60) continue;
    const min = RES[r.type].r * r.s + 9, d = Math.hypot(dx, dy);
    if (d < min && d > 0.01) { p.x = r.x + dx / d * min; p.y = r.y + dy / d * min; }
  }
  p.x = clamp(p.x, 20, WORLD - 20); p.y = clamp(p.y, 20, WORLD - 20);

  // ---- stats ----
  p.hunger -= 0.33 * dt;
  if (p.hunger <= 0) { p.hunger = 0; p.hp -= 1.4 * dt; if (!speech) say('Я умираю от голода!'); }
  else if (p.hunger > MAX.hunger * 0.66) p.hp = Math.min(MAX.hp, p.hp + 0.08 * dt);
  const lit = isLit(p.x, p.y), dk = darkness();
  let ds = 0;
  if (ph === 'day') ds = 0.06; else if (ph === 'dusk') ds = -0.15; else ds = lit ? -0.3 : -1.1;
  if (nearFire(160) && ph !== 'day') ds += 0.25;
  for (const m of G.mobs) if (m.type === 'shade' && dist(m, p) < 260) ds -= 0.7;
  p.san = clamp(p.san + ds * dt, 0, MAX.san);

  // ---- darkness ----
  if (dk > 0.85 && !lit) {
    p.darkT = (p.darkT || 0) + dt;
    if (p.darkT > 0.3 && p.darkT - dt <= 0.3) say('Слишком темно...');
    if (p.darkT > 3) {
      p.darkHit = (p.darkHit || 0) - dt;
      if (p.darkHit <= 0) { hurtPlayer(20, true); darkFlash = 0.6; p.darkHit = 1.8; say(pick(['Что-то царапнуло меня в темноте!', 'Нужен свет!', 'Оно рядом!'])); }
    }
  } else { p.darkT = 0; p.darkHit = 0; }

  // ---- torch burn ----
  if (p.hand && ITEMS[p.hand.id].timed) { p.hand.dur -= dt; if (p.hand.dur <= 0) { p.hand = null; say('Факел догорел'); } if ((G.t * 2 | 0) !== ((G.t - dt) * 2 | 0)) invDirty = true; }

  // ---- fires ----
  for (const f of G.fires) f.fuel = Math.max(0, f.fuel - dt * (f.type === 'firepit' ? 0.75 : 1));

  // ---- resources regrow ----
  for (const r of G.res) {
    if (r.state !== 'ready') { r.timer -= dt; if (r.timer <= 0) { r.state = 'ready'; r.hits = 0; } }
    if (r.shake > 0) r.shake -= dt;
  }

  // ---- mobs ----
  updateMobs(dt, ph, day);

  // ---- wolf nights ----
  if (day % 3 === 0) {
    const pp = dayPhase();
    if (pp > 0.55 && G.warnDay !== day) { G.warnDay = day; say('Вдали воют волки... Ночью они придут.', 3.5); }
    if (pp > 0.74 && G.wolvesDay !== day) {
      G.wolvesDay = day;
      const n = Math.min(1 + Math.floor(day / 3), 6);
      for (let i = 0; i < n; i++) { const a = rand(0, 7); const w = spawnMob('wolf', clamp(p.x + Math.cos(a) * 650, 30, WORLD - 30), clamp(p.y + Math.sin(a) * 650, 30, WORLD - 30)); w.aggro = true; }
      say('Они здесь!');
    }
  }

  // ---- shades ----
  shadeTimer -= dt;
  const shades = G.mobs.filter(m => m.type === 'shade').length;
  if (p.san < MAX.san * 0.3 && shadeTimer <= 0 && shades < (p.san < MAX.san * 0.15 ? 3 : 1)) {
    const a = rand(0, 7); spawnMob('shade', clamp(p.x + Math.cos(a) * 380, 30, WORLD - 30), clamp(p.y + Math.sin(a) * 380, 30, WORLD - 30));
    shadeTimer = 14;
  }

  // ---- population upkeep ----
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = 25;
    const cnt = t => G.mobs.filter(m => m.type === t).length;
    if (cnt('rabbit') < 14) spawnMobInBiome('rabbit', 'meadow', 600);
    if (cnt('boar') < 8) spawnMobInBiome('boar', 'forest', 700);
    if (G.res.filter(r => r.type === 'carrot').length < 30) {
      for (let k = 0; k < 20; k++) { const x = rand(60, WORLD - 60), y = rand(60, WORLD - 60); if (biomeAt(x, y, G.seed) === 'meadow' && Math.hypot(x - p.x, y - p.y) > 500) { spawnRes('carrot', x, y); break; } }
    }
    if (G.res.filter(r => r.type === 'boulder').length < 60) {
      for (let k = 0; k < 20; k++) { const x = rand(60, WORLD - 60), y = rand(60, WORLD - 60); if (biomeAt(x, y, G.seed) === 'rock' && Math.hypot(x - p.x, y - p.y) > 600) { spawnRes('boulder', x, y); break; } }
    }
  }

  // ---- particles ----
  for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; if (q.life <= 0) particles.splice(i, 1); }
  if (speech) { speech.t -= dt; if (speech.t <= 0) speech = null; }
  hurtFlash = Math.max(0, hurtFlash - dt); darkFlash = Math.max(0, darkFlash - dt);

  // ---- autosave ----
  saveTimer -= dt; if (saveTimer <= 0) { saveTimer = 20; saveGame(); }

  if (p.hp <= 0) gameOver();
}

function updateMobs(dt, ph, day) {
  const p = G.player;
  for (let i = G.mobs.length - 1; i >= 0; i--) {
    const m = G.mobs[i], d = MOBS[m.type];
    m.cd -= dt; m.t -= dt; m.hitT -= dt; m.anim += dt;
    const dx = p.x - m.x, dy = p.y - m.y, dp = Math.hypot(dx, dy) || 1;
    let vx = 0, vy = 0, sp = 0;
    const wander = () => {
      if (m.t <= 0) { m.t = rand(1, 3.5); if (Math.random() < 0.35) { m.wx = 0; m.wy = 0; } else { const a = rand(0, 7); m.wx = Math.cos(a); m.wy = Math.sin(a); } }
      vx = m.wx || 0; vy = m.wy || 0; sp = d.wander;
    };
    const chase = () => {
      vx = dx / dp; vy = dy / dp; sp = d.speed;
      if (dp < d.r + 24) { sp = 0; if (m.cd <= 0) { m.cd = d.cd; m.lunge = 0.2; hurtPlayer(d.dmg); } }
    };
    switch (m.type) {
      case 'rabbit':
        if (dp < 150) { vx = -dx / dp; vy = -dy / dp; sp = d.speed; } else wander();
        break;
      case 'boar':
        if (!m.aggro && (dp < 70 || (ph === 'night' && dp < 170))) m.aggro = true;
        if (m.aggro && dp > 520) m.aggro = false;
        if (m.aggro) { chase(); sp *= 0.75; } else wander();
        break;
      case 'wolf':
        if (ph === 'day') { vx = -dx / dp; vy = -dy / dp; sp = d.speed; if (dp > 800) { G.mobs.splice(i, 1); continue; } }
        else chase();
        break;
      case 'shade':
        if (p.san > MAX.san * 0.45) { m.fade = (m.fade || 0) + dt; if (m.fade > 1.5) { G.mobs.splice(i, 1); continue; } }
        else chase();
        break;
    }
    m.x = clamp(m.x + vx * sp * dt, 20, WORLD - 20);
    m.y = clamp(m.y + vy * sp * dt, 20, WORLD - 20);
    if (Math.abs(vx) > 0.1) m.face = vx > 0 ? 1 : -1;
    m.moving = sp > 0;
    if (m.lunge > 0) m.lunge -= dt;
  }
}

// ============================================================
//  Rendering
// ============================================================
let cam = { x: 0, y: 0 };
function render() {
  const p = G.player;
  const vw = W / Z, vh = H / Z;
  cam.x = p.x - vw / 2; cam.y = p.y - vh / 2 - 20;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d1418'; ctx.fillRect(0, 0, cvs.width, cvs.height);
  const sk = DPR * Z;
  ctx.setTransform(sk, 0, 0, sk, -cam.x * sk, -cam.y * sk);

  // ground
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(groundCanvas, 0, 0, WORLD, WORLD);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 30; ctx.strokeRect(-15, -15, WORLD + 30, WORLD + 30);

  const x0 = cam.x - 80, y0 = cam.y - 80, x1 = cam.x + vw + 80, y1 = cam.y + vh + 140;
  const inView = o => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1;

  // decor
  for (const dcr of decor) {
    if (!inView(dcr)) continue;
    if (dcr.b === 'rock') { ctx.fillStyle = 'rgba(40,38,34,.5)'; ctx.beginPath(); ctx.arc(dcr.x, dcr.y, 1.5 + dcr.v * 2.5, 0, 7); ctx.fill(); }
    else {
      ctx.strokeStyle = dcr.b === 'forest' ? 'rgba(20,32,14,.7)' : 'rgba(120,120,60,.55)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(dcr.x - 3, dcr.y); ctx.lineTo(dcr.x - 4, dcr.y - 6 - dcr.v * 4); ctx.moveTo(dcr.x, dcr.y); ctx.lineTo(dcr.x + 1, dcr.y - 8 - dcr.v * 4); ctx.moveTo(dcr.x + 3, dcr.y); ctx.lineTo(dcr.x + 5, dcr.y - 5 - dcr.v * 3); ctx.stroke();
    }
  }

  // target marker
  const hint = G.hint;
  if (hint && targetValid(hint)) {
    ctx.strokeStyle = 'rgba(255,240,200,.55)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    const r = hint.kind === 'res' ? RES[hint.type].r * hint.s + 8 : hint.kind === 'mob' ? MOBS[hint.type].r + 6 : 14;
    ctx.beginPath(); ctx.ellipse(hint.x, hint.y, r, r * 0.45, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }

  // sortable objects
  const objs = [];
  for (const r of G.res) if (inView(r)) objs.push(r);
  for (const dr of G.drops) if (inView(dr)) objs.push(dr);
  for (const f of G.fires) if (inView(f)) objs.push(f);
  for (const m of G.mobs) if (inView(m)) objs.push(m);
  objs.push(p);
  objs.sort((a, b) => a.y - b.y);
  for (const o of objs) {
    if (o === p) drawPlayer(p);
    else if (o.kind === 'res') drawRes(o);
    else if (o.kind === 'drop') drawDrop(o);
    else if (o.kind === 'fire') drawFire(o);
    else if (o.kind === 'mob') drawMob(o);
  }
  for (const q of particles) { ctx.globalAlpha = clamp(q.life * 2, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz); }
  ctx.globalAlpha = 1;

  // ---- darkness overlay ----
  const dk = darkness();
  const L = lights();
  if (dk > 0.01) {
    const s = 0.5; // dark canvas is half resolution
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillStyle = `rgba(4,4,14,${dk})`;
    dctx.fillRect(0, 0, dark.width, dark.height);
    dctx.globalCompositeOperation = 'destination-out';
    for (const l of L) {
      const sx = (l.x - cam.x) * Z * s, sy = (l.y - cam.y) * Z * s, sr = l.r * Z * s;
      const g = dctx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g; dctx.beginPath(); dctx.arc(sx, sy, sr, 0, 7); dctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0, cvs.width, cvs.height);
  }
  // warm glow
  ctx.setTransform(sk, 0, 0, sk, -cam.x * sk, -cam.y * sk);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of L) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.6);
    g.addColorStop(0, `rgba(255,150,50,${0.18 + dk * 0.12})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 0.6, 0, 7); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // speech bubble
  if (speech) {
    ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(speech.t * 2, 0, 1);
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(speech.text, p.x, p.y - 72);
    ctx.fillStyle = '#f3e6c8'; ctx.fillText(speech.text, p.x, p.y - 72);
    ctx.globalAlpha = 1;
  }

  // ---- screen space effects ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // dusk tint
  const ph = dayPhase();
  if (ph > 0.45 && ph < 0.75) { const k = Math.sin((ph - 0.45) / 0.3 * Math.PI); ctx.fillStyle = `rgba(160,70,20,${0.12 * k})`; ctx.fillRect(0, 0, W, H); }
  // sanity vignette
  const sk2 = 1 - p.san / MAX.san;
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(${sk2 > 0.6 ? 30 : 0},0,${sk2 > 0.6 ? 20 : 0},${0.35 + sk2 * 0.45})`);
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  if (hurtFlash > 0) { ctx.fillStyle = `rgba(160,0,0,${hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (darkFlash > 0) {
    ctx.fillStyle = `rgba(0,0,0,${darkFlash})`; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(220,220,255,${darkFlash})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(W / 2 - 40 + i * 25, H / 2 - 50); ctx.lineTo(W / 2 - 20 + i * 25, H / 2 + 40); ctx.stroke(); }
  }

  // joystick
  if (joy.active) {
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 55, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.arc(joy.ox + joy.x * 55, joy.oy + joy.y * 55, 22, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawHUD();
}

// ---------- world draws ----------
function shadow(x, y, rx, ry) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }

function drawRes(r) {
  const s = r.s;
  ctx.save(); ctx.translate(r.x, r.y);
  if (r.shake > 0) ctx.translate(Math.sin(r.shake * 60) * 3, 0);
  switch (r.type) {
    case 'tree':
      if (r.state === 'stump') {
        shadow(0, 2, 12 * s, 5 * s);
        ctx.fillStyle = '#4b3220'; ctx.fillRect(-8 * s, -8 * s, 16 * s, 9 * s);
        ctx.fillStyle = '#a07c4c'; ctx.beginPath(); ctx.ellipse(0, -8 * s, 8 * s, 3.5 * s, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -8 * s, 4 * s, 1.8 * s, 0, 0, 7); ctx.stroke();
        break;
      }
      shadow(0, 2, 26 * s, 9 * s);
      ctx.fillStyle = '#3d2a1a'; ctx.fillRect(-5 * s, -26 * s, 10 * s, 27 * s);
      { const cols = ['#1d2c17', '#25381c', '#2e4522'];
        for (let i = 0; i < 3; i++) {
          const w = (30 - i * 7) * s, yb = (-18 - i * 22) * s, h = 40 * s;
          ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(-w, yb);
          for (let k = 1; k < 6; k++) ctx.lineTo(-w + (2 * w) * k / 6, yb + (k % 2 ? 5 : 0) * s);
          ctx.lineTo(w, yb); ctx.lineTo(0, yb - h); ctx.closePath(); ctx.fill();
        }
      }
      break;
    case 'sapling':
      shadow(0, 1, 8, 3);
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
      if (r.state === 'ready') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, -22); ctx.moveTo(-1, -10); ctx.lineTo(-8, -18); ctx.moveTo(-1, -14); ctx.lineTo(6, -22); ctx.stroke();
        ctx.fillStyle = '#5a7a34'; for (const [lx, ly] of [[-8, -19], [6, -23], [-2, -24]]) { ctx.beginPath(); ctx.ellipse(lx, ly, 3, 2, 0.5, 0, 7); ctx.fill(); } }
      else { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.stroke(); }
      break;
    case 'grass':
      shadow(0, 1, 9, 3);
      ctx.lineWidth = 2;
      if (r.state === 'ready') for (let i = -3; i <= 3; i++) { ctx.strokeStyle = i % 2 ? '#a8a246' : '#7f9a3c'; ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.quadraticCurveTo(i * 3, -10, i * 5, -18 - Math.abs(i) * -1); ctx.stroke(); }
      else { ctx.strokeStyle = '#6a6a36'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.lineTo(i * 2.4, -4); ctx.stroke(); } }
      break;
    case 'bush':
      shadow(0, 2, 18 * s, 6 * s);
      ctx.fillStyle = '#24391c'; ctx.beginPath(); ctx.arc(-8 * s, -10 * s, 11 * s, 0, 7); ctx.arc(8 * s, -10 * s, 11 * s, 0, 7); ctx.arc(0, -18 * s, 12 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#2f4a24'; ctx.beginPath(); ctx.arc(-3 * s, -19 * s, 7 * s, 0, 7); ctx.fill();
      if (r.state === 'ready') { ctx.fillStyle = '#c4283a'; for (const [bx, by] of [[-9, -12], [6, -16], [-1, -22], [10, -8], [-4, -6]]) { ctx.beginPath(); ctx.arc(bx * s, by * s, 2.6, 0, 7); ctx.fill(); } }
      break;
    case 'carrot':
      ctx.strokeStyle = '#4f8a33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -12); ctx.moveTo(0, 0); ctx.lineTo(0, -14); ctx.moveTo(0, 0); ctx.lineTo(5, -11); ctx.stroke();
      ctx.fillStyle = '#e07a22'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.5, 0, 0, 7); ctx.fill();
      break;
    case 'boulder':
      shadow(0, 3, 26 * s, 8 * s);
      ctx.fillStyle = '#6d6c67'; ctx.beginPath(); ctx.moveTo(-24 * s, 0); ctx.lineTo(-20 * s, -20 * s); ctx.lineTo(-4 * s, -32 * s); ctx.lineTo(16 * s, -26 * s); ctx.lineTo(25 * s, -6 * s); ctx.lineTo(20 * s, 3 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8b8a84'; ctx.beginPath(); ctx.moveTo(-16 * s, -18 * s); ctx.lineTo(-4 * s, -28 * s); ctx.lineTo(10 * s, -22 * s); ctx.lineTo(-2 * s, -14 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4a4945'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6 * s, -6 * s); ctx.lineTo(4 * s, -16 * s); ctx.lineTo(12 * s, -10 * s); ctx.stroke();
      if (r.hits > 0) { ctx.strokeStyle = '#2a2a28'; ctx.beginPath(); ctx.moveTo(-12 * s, -20 * s); ctx.lineTo(-4 * s, -8 * s); ctx.lineTo(-10 * s, 0); ctx.stroke(); }
      break;
  }
  ctx.restore();
}

function drawDrop(d) {
  shadow(d.x, d.y + 2, 9, 3);
  ctx.save(); ctx.translate(d.x, d.y - 8 + Math.sin(G.t * 3 + d.x) * 1.5); drawItem(ctx, d.id, 22); ctx.restore();
  if (d.n > 1) { ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(d.n, d.x + 10, d.y + 4); }
}

function drawFire(f) {
  ctx.save(); ctx.translate(f.x, f.y);
  const stone = f.type === 'firepit';
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ctx.fillStyle = stone ? (i % 2 ? '#7b7a76' : '#8f8e88') : (i % 2 ? '#4b3220' : '#5f4029'); ctx.beginPath(); ctx.ellipse(Math.cos(a) * 20, Math.sin(a) * 9, stone ? 7 : 6, stone ? 5 : 3.5, a, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#1e1a16'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, 0, 0, 7); ctx.fill();
  if (f.fuel > 0) {
    const k = f.fuel / f.max, h = 14 + k * 26;
    for (let i = 0; i < 3; i++) {
      const w = (10 - i * 3) * (0.7 + k * 0.5), hh = h * (1 - i * 0.25) * (0.9 + Math.sin(G.t * 12 + i * 2) * 0.1);
      ctx.fillStyle = ['#d5541a', '#f2a02a', '#ffe07a'][i];
      ctx.beginPath(); ctx.moveTo(-w, -2); ctx.quadraticCurveTo(-w * 0.8, -hh * 0.6, Math.sin(G.t * 9 + i) * 3, -hh); ctx.quadraticCurveTo(w * 0.8, -hh * 0.6, w, -2); ctx.closePath(); ctx.fill();
    }
    if (Math.random() < 0.15) particles.push({ x: f.x + rand(-6, 6), y: f.y - h * 0.6, vx: rand(-10, 10), vy: rand(-80, -40), life: rand(0.4, 0.9), col: '#ffb347', sz: 2 });
  } else {
    ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(8, -3); ctx.moveTo(-6, -4); ctx.lineTo(6, 1); ctx.stroke();
  }
  ctx.restore();
}

function drawMob(m) {
  const d = MOBS[m.type];
  ctx.save(); ctx.translate(m.x, m.y);
  const bob = m.moving ? Math.abs(Math.sin(m.anim * 12)) * 3 : 0;
  const flash = m.hitT > 0;
  if (m.lunge > 0) ctx.translate((G.player.x > m.x ? 1 : -1) * 8, 0);
  if (m.type !== 'shade') shadow(0, 2, d.r * 1.1, d.r * 0.4);
  ctx.scale(m.face, 1);
  switch (m.type) {
    case 'rabbit':
      ctx.fillStyle = flash ? '#fff' : '#8a7058';
      ctx.beginPath(); ctx.ellipse(0, -8 - bob, 10, 7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, -14 - bob, 5, 4.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, -24 - bob, 2, 7, -0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(10, -23 - bob, 2, 7, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(-10, -8 - bob, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(10, -15 - bob, 1.2, 0, 7); ctx.fill();
      break;
    case 'boar':
      ctx.fillStyle = flash ? '#fff' : (m.aggro ? '#5a3424' : '#4a3426');
      ctx.beginPath(); ctx.ellipse(0, -18 - bob * 0.5, 24, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#3a281c';
      for (let i = -14; i <= 10; i += 6) { ctx.beginPath(); ctx.moveTo(i, -31); ctx.lineTo(i + 3, -38); ctx.lineTo(i + 6, -31); ctx.fill(); }
      ctx.fillRect(-16, -8, 6, 9 + (m.moving ? Math.sin(m.anim * 12) * 2 : 0)); ctx.fillRect(10, -8, 6, 9 - (m.moving ? Math.sin(m.anim * 12) * 2 : 0));
      ctx.fillStyle = flash ? '#fff' : '#5a3e2c'; ctx.beginPath(); ctx.ellipse(22, -16 - bob * 0.5, 10, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(26, -12); ctx.lineTo(33, -22); ctx.lineTo(29, -11); ctx.fill();
      ctx.fillStyle = m.aggro ? '#e03020' : '#111'; ctx.beginPath(); ctx.arc(24, -20, 1.8, 0, 7); ctx.fill();
      break;
    case 'wolf':
      ctx.fillStyle = flash ? '#fff' : '#3b3d44';
      ctx.beginPath(); ctx.ellipse(0, -16 - bob * 0.4, 20, 9, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(-32, -26); ctx.lineTo(-20, -12); ctx.fill();
      ctx.fillRect(-14, -9, 4, 10); ctx.fillRect(10, -9, 4, 10);
      ctx.beginPath(); ctx.ellipse(20, -22 - bob * 0.4, 9, 7, 0.2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(24, -20); ctx.lineTo(34, -17); ctx.lineTo(24, -15); ctx.fill();
      ctx.beginPath(); ctx.moveTo(15, -27); ctx.lineTo(17, -35); ctx.lineTo(21, -28); ctx.fill();
      ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(23, -24, 1.8, 0, 7); ctx.fill();
      break;
    case 'shade': {
      const a = m.fade ? Math.max(0, 1 - m.fade / 1.5) : 1;
      ctx.globalAlpha = 0.75 * a;
      ctx.fillStyle = flash ? '#444' : '#050508';
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const an = i / 16 * Math.PI * 2, rr = 18 + Math.sin(m.anim * 5 + i * 1.7) * 5; const px = Math.cos(an) * rr, py = -26 + Math.sin(an) * rr * 1.3; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = a; ctx.fillStyle = '#f4f0e0';
      ctx.beginPath(); ctx.ellipse(4, -32, 3, 5, 0, 0, 7); ctx.ellipse(12, -31, 2.5, 4, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; break; }
  }
  ctx.restore();
  if (m.hp < MOBS[m.type].hp && m.type !== 'rabbit') {
    const w = 30; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(m.x - w / 2, m.y + 6, w, 4);
    ctx.fillStyle = '#c03030'; ctx.fillRect(m.x - w / 2, m.y + 6, w * clamp(m.hp / MOBS[m.type].hp, 0, 1), 4);
  }
}

function drawPlayer(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.inv_t > 0 && Math.floor(p.inv_t * 20) % 2) ctx.globalAlpha = 0.5;
  shadow(0, 2, 15, 5);
  const w = p.moving ? Math.sin(p.walk * 12) : 0, bob = Math.abs(w) * 2;
  ctx.scale(p.face, 1);
  // legs
  ctx.strokeStyle = '#1c1a20'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4 + w * 5, 0); ctx.moveTo(4, -12); ctx.lineTo(4 - w * 5, 0); ctx.stroke();
  ctx.translate(0, -bob);
  // armor or coat
  ctx.fillStyle = p.body ? '#6b4a2b' : '#2e2b35';
  ctx.beginPath(); ctx.moveTo(-10, -38); ctx.lineTo(10, -38); ctx.lineTo(14, -10); ctx.lineTo(-14, -10); ctx.closePath(); ctx.fill();
  if (p.body) { ctx.strokeStyle = '#4b3220'; ctx.lineWidth = 1.5; for (const x of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x, -36); ctx.lineTo(x * 1.3, -11); ctx.stroke(); } }
  // scarf
  ctx.fillStyle = '#8e2a2a'; ctx.fillRect(-9, -40, 18, 5); ctx.beginPath(); ctx.moveTo(-8, -37); ctx.lineTo(-15 - w * 2, -27); ctx.lineTo(-10, -26); ctx.closePath(); ctx.fill();
  // head
  ctx.fillStyle = '#e6d8c0'; ctx.beginPath(); ctx.ellipse(0, -50, 10, 11, 0, 0, 7); ctx.fill();
  // hair (wild dark tufts)
  ctx.fillStyle = '#1a1716'; ctx.beginPath(); ctx.moveTo(-11, -50);
  const tufts = [[-12, -62], [-6, -58], [-4, -68], [1, -60], [5, -69], [8, -59], [13, -63], [11, -50]];
  for (const [tx, ty] of tufts) ctx.lineTo(tx, ty);
  ctx.quadraticCurveTo(4, -56, -11, -50); ctx.fill();
  // eyes
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(3, -49, 1.6, 0, 7); ctx.arc(8, -49, 1.6, 0, 7); ctx.fill();
  if (p.san < MAX.san * 0.3) { ctx.strokeStyle = '#5a3a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(3, -47, 2.5, 0.2, 2.9); ctx.arc(8, -47, 2.5, 0.2, 2.9); ctx.stroke(); }
  // arms + held item
  const swing = p.swing > 0 ? Math.sin((1 - p.swing / 0.25) * Math.PI) : 0;
  ctx.save(); ctx.translate(10, -32); ctx.rotate(-0.4 + swing * 1.6);
  ctx.strokeStyle = '#2e2b35'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 12); ctx.stroke();
  if (p.hand) { ctx.translate(6, 12); ctx.rotate(0.6); drawItem(ctx, p.hand.id, 26); }
  ctx.restore();
  ctx.restore();
}

// ---------- HUD (canvas) ----------
function gauge(x, y, val, max, col, icon) {
  const r = 21, k = clamp(val / max, 0, 1);
  ctx.fillStyle = 'rgba(15,12,10,.85)'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  ctx.fillStyle = col; ctx.fillRect(x - r, y + r - 2 * r * k, 2 * r, 2 * r * k); ctx.restore();
  ctx.strokeStyle = k < 0.25 && Math.sin(G.t * 8) > 0 ? '#ff4040' : '#6b5a43'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.stroke();
  ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(icon, x, y - 1);
  ctx.font = 'bold 11px Georgia, serif'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(Math.ceil(val), x, y + r + 10); ctx.fillStyle = '#eee3cf'; ctx.fillText(Math.ceil(val), x, y + r + 10);
  ctx.textBaseline = 'alphabetic';
}
function drawHUD() {
  const p = G.player;
  const top = 32, left = 34;
  gauge(left, top, p.hp, MAX.hp, '#a82c2c', '❤');
  gauge(left + 56, top, p.hunger, MAX.hunger, '#c27a2a', '🍖');
  gauge(left + 112, top, p.san, MAX.san, '#7a4fa0', '🧠');
  // clock
  const cx = W - 92, cy = 38, r = 27;
  const seg = (a0, a1, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2 + a0 * Math.PI * 2, -Math.PI / 2 + a1 * Math.PI * 2); ctx.closePath(); ctx.fill(); };
  ctx.fillStyle = 'rgba(15,12,10,.85)'; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.fill();
  seg(0, 0.5, '#c9a64a'); seg(0.5, 0.68, '#a8562a'); seg(0.68, 1, '#25264a');
  const a = -Math.PI / 2 + dayPhase() * Math.PI * 2;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2)); ctx.stroke();
  ctx.fillStyle = 'rgba(15,12,10,.9)'; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
  ctx.fillStyle = '#eee3cf'; ctx.font = 'bold 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(dayNum(), cx, cy); ctx.textBaseline = 'alphabetic';
  ctx.font = '10px Georgia, serif'; ctx.fillText('День', cx, cy + r + 13);
}

// ============================================================
//  Inventory UI
// ============================================================
const invEl = document.getElementById('inv');
const popup = document.getElementById('popup');
let slotEls = [];
function buildInvUI() {
  invEl.innerHTML = ''; slotEls = [];
  for (let i = 0; i < INV_SIZE + 2; i++) {
    const el = document.createElement('div'); el.className = 'slot';
    if (i >= INV_SIZE) { el.classList.add('eq'); if (i === INV_SIZE) el.classList.add('sep'); const l = document.createElement('div'); l.className = 'lbl'; l.textContent = i === INV_SIZE ? 'Рука' : 'Тело'; el.appendChild(l); }
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); slotTap(i, el); });
    invEl.appendChild(el); slotEls.push(el);
  }
}
function slotData(i) { const p = G.player; return i < INV_SIZE ? p.inv[i] : i === INV_SIZE ? p.hand : p.body; }
function refreshInv() {
  for (let i = 0; i < slotEls.length; i++) {
    const el = slotEls[i], s = slotData(i);
    const lbl = el.querySelector('.lbl');
    el.innerHTML = ''; if (lbl) el.appendChild(lbl);
    if (!s) continue;
    const img = document.createElement('img'); img.src = iconURL(s.id); el.appendChild(img);
    if (s.n > 1) { const n = document.createElement('div'); n.className = 'n'; n.textContent = s.n; el.appendChild(n); }
    if (s.dur !== undefined && ITEMS[s.id].dur) { const d = document.createElement('div'); d.className = 'dur'; const b = document.createElement('i'); const k = clamp(s.dur / ITEMS[s.id].dur, 0, 1); b.style.width = (k * 100) + '%'; b.style.background = k < 0.25 ? '#d05040' : '#7fc06a'; d.appendChild(b); el.appendChild(d); }
  }
  if (!craftEl.classList.contains('hidden')) renderRecipes();
}

let popupSlot = -1;
function closePopup() { popup.classList.add('hidden'); popupSlot = -1; for (const e of slotEls) e.classList.remove('sel'); }
function slotTap(i, el) {
  if (!G || !running) return;
  const s = slotData(i);
  if (!s) { closePopup(); return; }
  if (popupSlot === i) { closePopup(); return; }
  closePopup(); popupSlot = i; el.classList.add('sel');
  const acts = slotActions(i, s);
  popup.innerHTML = '';
  const t = document.createElement('div'); t.className = 't'; t.textContent = itemName(s.id); popup.appendChild(t);
  for (const [label, fn] of acts) {
    const b = document.createElement('button'); b.textContent = label;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); closePopup(); invDirty = true; });
    popup.appendChild(b);
  }
  popup.classList.remove('hidden');
  const rc = el.getBoundingClientRect(), pr = popup.getBoundingClientRect();
  popup.style.left = clamp(rc.left + rc.width / 2 - pr.width / 2, 4, W - pr.width - 4) + 'px';
  popup.style.top = (rc.top - pr.height - 8) + 'px';
}
function slotActions(i, s) {
  const p = G.player, def = ITEMS[s.id], acts = [];
  const take = () => { if (i < INV_SIZE) { s.n--; if (s.n <= 0) p.inv[i] = null; } };
  if (i >= INV_SIZE) {
    acts.push(['Снять', () => { if (addItem(s.id, 1, s.dur) === 0) { if (i === INV_SIZE) p.hand = null; else p.body = null; } else say('Инвентарь полон'); }]);
    acts.push(['Выбросить', () => { dropItem(s.id, 1, s.dur, p.x, p.y); if (i === INV_SIZE) p.hand = null; else p.body = null; }]);
    return acts;
  }
  const fire = nearFire();
  if (def.cook && fire) acts.push(['Приготовить', () => { take(); giveOrDrop(def.cook, 1); burst(fire.x, fire.y, '#ffb347', 5); }]);
  if (def.food) acts.push(['Съесть', () => eat(i)]);
  const anyFire = nearAnyFire();
  if (def.fuel && anyFire) acts.push(['В костёр', () => { take(); anyFire.fuel = Math.min(anyFire.max, anyFire.fuel + def.fuel); burst(anyFire.x, anyFire.y, '#ffb347', 8); }]);
  if (def.slot) acts.push(['Экипировать', () => equip(i)]);
  acts.push(['Выбросить', () => { dropItem(s.id, s.n, s.dur, p.x, p.y); p.inv[i] = null; }]);
  if (s.n > 1) acts.push(['Выбросить 1', () => { dropItem(s.id, 1, s.dur, p.x, p.y); take(); }]);
  return acts;
}
function quickUse(i) {
  const s = G.player.inv[i]; const def = ITEMS[s.id];
  if (def.slot) equip(i); else if (def.food) eat(i);
}
function eat(i) {
  const p = G.player, s = p.inv[i], f = ITEMS[s.id].food;
  p.hunger = clamp(p.hunger + f.h, 0, MAX.hunger); p.hp = clamp(p.hp + f.hp, 0, MAX.hp); p.san = clamp(p.san + f.s, 0, MAX.san);
  s.n--; if (s.n <= 0) p.inv[i] = null;
  say(f.hp < 0 ? 'Фу, сырое...' : 'Ням.', 1.4);
  invDirty = true;
}
function equip(i) {
  const p = G.player, s = p.inv[i], slot = ITEMS[s.id].slot;
  const old = p[slot]; p[slot] = s; p.inv[i] = old || null; invDirty = true;
}

// ============================================================
//  Crafting UI
// ============================================================
const craftEl = document.getElementById('craft');
const recipesEl = document.getElementById('recipes');
function toggleCraft() { if (craftEl.classList.contains('hidden')) { craftEl.classList.remove('hidden'); renderRecipes(); } else craftEl.classList.add('hidden'); closePopup(); }
document.getElementById('craftBtn').addEventListener('click', toggleCraft);
document.getElementById('craftClose').addEventListener('click', toggleCraft);
function canCraft(r) {
  for (const id in r.need) if (countItem(id) < r.need[id]) return false;
  if (r.nearFire && !nearFire()) return false;
  return true;
}
function renderRecipes() {
  const sc = recipesEl.scrollTop;
  recipesEl.innerHTML = '';
  for (const r of RECIPES) {
    const row = document.createElement('div'); row.className = 'rec';
    const img = document.createElement('img'); img.src = iconURL(r.id); row.appendChild(img);
    const info = document.createElement('div'); info.className = 'info';
    info.innerHTML = `<div class="nm">${itemName(r.id)}</div><div class="ds">${r.desc}${r.nearFire ? ' (у огня)' : ''}</div>`;
    const need = document.createElement('div'); need.className = 'need';
    for (const id in r.need) {
      const have = countItem(id), sp = document.createElement('span'); sp.className = have >= r.need[id] ? 'ok' : 'no';
      sp.innerHTML = `<img src="${iconURL(id)}">${Math.min(have, 99)}/${r.need[id]}`; sp.title = itemName(id); need.appendChild(sp);
    }
    info.appendChild(need); row.appendChild(info);
    const b = document.createElement('button'); b.textContent = 'Создать'; b.disabled = !canCraft(r);
    b.addEventListener('click', () => craft(r)); row.appendChild(b);
    recipesEl.appendChild(row);
  }
  recipesEl.scrollTop = sc;
}
function craft(r) {
  if (!canCraft(r)) return;
  for (const id in r.need) removeItem(id, r.need[id]);
  const p = G.player;
  if (r.place) {
    const max = r.id === 'firepit' ? 300 : 180;
    G.fires.push({ kind: 'fire', type: r.id, x: clamp(p.x + p.face * 45, 30, WORLD - 30), y: p.y + 10, fuel: max * 0.6, max });
    say('Тепло...', 1.5);
  } else giveOrDrop(r.id, 1, ITEMS[r.id].dur);
  invDirty = true;
}

// ============================================================
//  Save / load
// ============================================================
function saveGame() {
  if (!G || G.player.hp <= 0) return;
  try {
    const data = { ...G, mobs: G.mobs.filter(m => m.type !== 'shade') };
    delete data.hint;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (_) {}
}
function loadGame() {
  try { const s = localStorage.getItem(SAVE_KEY); if (!s) return false; G = JSON.parse(s); buildDerived(); return true; }
  catch (_) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { saveGame(); pauseGame(); } });

// ============================================================
//  Screens & loop
// ============================================================
const $ = id => document.getElementById(id);
const hud = $('hud'), menu = $('menu'), pauseScr = $('pause'), over = $('over');
function startRunning() {
  menu.classList.add('hidden'); over.classList.add('hidden'); pauseScr.classList.add('hidden'); hud.classList.remove('hidden');
  buildInvUI(); invDirty = true; running = true; particles.length = 0; lockTarget = null; actionHeld = false;
  requestFullscreen();
}
function requestFullscreen() {
  const el = document.documentElement;
  try { if (!document.fullscreenElement && el.requestFullscreen && matchMedia('(pointer: coarse)').matches) el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (_) {}
}
function pauseGame() { if (!running) return; running = false; closePopup(); pauseScr.classList.remove('hidden'); }
function showMenu() {
  running = false; hud.classList.add('hidden'); pauseScr.classList.add('hidden'); over.classList.add('hidden'); menu.classList.remove('hidden');
  $('contBtn').classList.toggle('hidden', !hasSave());
}
function gameOver() {
  running = false; clearSave(); hud.classList.add('hidden'); craftEl.classList.add('hidden'); closePopup();
  const d = dayNum();
  let best = 0; try { best = +localStorage.getItem('darkthicket_best') || 0; if (d > best) { best = d; localStorage.setItem('darkthicket_best', d); } } catch (_) {}
  $('overText').textContent = `Ты продержался ${d} ${d % 10 === 1 && d % 100 !== 11 ? 'день' : (d % 10 >= 2 && d % 10 <= 4 && (d % 100 < 10 || d % 100 >= 20)) ? 'дня' : 'дней'}. Рекорд: ${best}.`;
  over.classList.remove('hidden');
}
$('newBtn').addEventListener('click', () => { newGame(); startRunning(); });
$('contBtn').addEventListener('click', () => { if (loadGame()) startRunning(); else { newGame(); startRunning(); } });
$('againBtn').addEventListener('click', () => { newGame(); startRunning(); });
$('pauseBtn').addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', () => { pauseScr.classList.add('hidden'); running = true; });
$('saveExitBtn').addEventListener('click', () => { saveGame(); showMenu(); });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G && running) {
    update(dt);
    if (invDirty) { invDirty = false; refreshInv(); }
    actBtn.textContent = actionLabel(G.hint);
  }
  if (G) render();
  else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0b0f'; ctx.fillRect(0, 0, cvs.width, cvs.height); }
  requestAnimationFrame(frame);
}
showMenu();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

// debug hook for automated tests
window.__game = { get G() { return G; }, update, addItem, craft: id => craft(RECIPES.find(r => r.id === id)) };
})();
