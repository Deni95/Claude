'use strict';
(() => {
// ============================================================
//  ШЁПОТ ЛЕСА — survival game
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
  petals:   { name: 'Лепестки', food: { h: 1, hp: 1, s: 4 } },
  cone:     { name: 'Шишка', fuel: 8, plant: true },
  salve:    { name: 'Целебная мазь', heal: 35 },
  trap:     { name: 'Силок', place: 'trap' },
  bedroll:  { name: 'Лежанка', sleep: true },
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
  { id: 'trap', need: { grass: 4, twig: 2 }, desc: 'Поставь на лугу — ловит зайцев' },
  { id: 'salve', need: { petals: 4, grass: 1 }, desc: 'Лечит 35 здоровья' },
  { id: 'bedroll', need: { grass: 6, rope: 1 }, desc: 'Сон у костра: пропустить ночь' },
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
  flower:  { r: 7, label: 'Сорвать', give: 'petals' },
  boulder: { r: 22, solid: true, label: 'Добыть', tool: 'pickaxe', hits: 6 },
};
const SPAWN = {
  forest: [['tree', .42], ['sapling', .07], ['grass', .03], ['bush', .03], ['flower', .012]],
  meadow: [['grass', .16], ['sapling', .1], ['bush', .05], ['carrot', .035], ['tree', .04], ['flint', .012], ['flower', .06]],
  rock:   [['boulder', .17], ['flint', .06], ['grass', .03], ['tree', .015]],
};

// ---------- Mobs ----------
const MOBS = {
  rabbit: { hp: 25, speed: 160, wander: 55, r: 10, drop: [['meat', 1]] },
  boar:   { hp: 150, speed: 155, wander: 40, r: 22, dmg: 18, cd: 1.5, wind: 0.6, drop: [['meat', 2]] },
  wolf:   { hp: 90, speed: 215, r: 16, dmg: 13, cd: 1.0, wind: 0.42, drop: [['meat', 1]] },
  shade:  { hp: 80, speed: 125, r: 18, dmg: 18, cd: 1.6, wind: 0.55, drop: [] },
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
//  Sound (fully synthesized with WebAudio — no audio files)
// ============================================================
const Sfx = (() => {
  let ac = null, master, nbuf, windF, windG, fireG, muted = false;
  let tBird = 3, tCricket = 2, tNote = 2, tCrackle = 0, tStep = 0, tGust = 0;
  try { muted = localStorage.getItem('darkthicket_muted') === '1'; } catch (_) {}
  function init() {
    if (ac) { ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ac.destination);
    nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = () => { const n = ac.createBufferSource(); n.buffer = nbuf; n.loop = true; n.start(); return n; };
    // wind bed
    windF = ac.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 350;
    windG = ac.createGain(); windG.gain.value = 0.05; loop().connect(windF); windF.connect(windG); windG.connect(master);
    // fire bed
    const ff = ac.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 900; ff.Q.value = 0.6;
    fireG = ac.createGain(); fireG.gain.value = 0; loop().connect(ff); ff.connect(fireG); fireG.connect(master);
  }
  function tone(freq, dur, o = {}) {
    if (!ac) return;
    const t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!ac) return;
    const t = ac.currentTime + (o.delay || 0), n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = nbuf; n.loopStart = Math.random(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
  }
  const S = {
    pick() { noise(0.09, { freq: 3000, type: 'highpass', vol: 0.12 }); tone(620, 0.09, { to: 940, vol: 0.08 }); },
    pickup() { tone(740, 0.07, { vol: 0.1 }); tone(1100, 0.1, { vol: 0.1, delay: 0.06 }); },
    chop() { noise(0.12, { freq: 700, type: 'lowpass', vol: 0.35 }); tone(170, 0.1, { to: 80, type: 'triangle', vol: 0.25 }); },
    fall() { noise(0.5, { freq: 400, type: 'lowpass', vol: 0.35 }); tone(120, 0.4, { to: 50, type: 'triangle', vol: 0.3 }); },
    mine() { tone(1500, 0.05, { type: 'triangle', vol: 0.18 }); tone(2300, 0.08, { type: 'sine', vol: 0.08 }); noise(0.08, { freq: 2500, vol: 0.2 }); },
    crumble() { for (let i = 0; i < 4; i++) noise(0.12, { freq: 500 + i * 200, vol: 0.25, delay: i * 0.06 }); },
    miss() { noise(0.12, { freq: 1800, type: 'highpass', vol: 0.1 }); },
    hit() { noise(0.1, { freq: 500, vol: 0.3 }); tone(160, 0.1, { to: 70, type: 'square', vol: 0.08 }); },
    kill() { tone(500, 0.25, { to: 150, type: 'triangle', vol: 0.15 }); },
    hurt() { tone(320, 0.22, { to: 120, type: 'sawtooth', vol: 0.14 }); noise(0.1, { freq: 300, vol: 0.2 }); },
    dark() { tone(70, 0.7, { type: 'sawtooth', vol: 0.2 }); tone(74, 0.7, { type: 'sawtooth', vol: 0.2 }); noise(0.3, { freq: 2000, type: 'highpass', vol: 0.12 }); },
    eat() { noise(0.07, { freq: 900, vol: 0.2 }); noise(0.07, { freq: 1100, vol: 0.2, delay: 0.13 }); noise(0.07, { freq: 800, vol: 0.2, delay: 0.26 }); },
    craft() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.07 })); },
    fire() { noise(0.4, { freq: 600, type: 'lowpass', vol: 0.12 }); tone(200, 0.4, { to: 500, vol: 0.06 }); },
    cook() { noise(0.5, { freq: 5000, type: 'highpass', vol: 0.1 }); },
    equip() { tone(400, 0.06, { type: 'triangle', vol: 0.12 }); tone(600, 0.08, { type: 'triangle', vol: 0.12, delay: 0.05 }); },
    snap() { noise(0.15, { freq: 1500, vol: 0.3 }); tone(300, 0.15, { to: 100, type: 'square', vol: 0.08 }); },
    ui() { tone(880, 0.04, { vol: 0.06 }); },
    warn() { tone(420, 0.9, { to: 300, vol: 0.12, attack: 0.2 }); tone(630, 0.9, { to: 440, vol: 0.06, attack: 0.2, delay: 0.25 }); },
    death() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.16, delay: i * 0.28 })); },
    dawn() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.7, { vol: 0.09, delay: i * 0.16, attack: 0.05 })); },
  };
  function play(n) { if (ac && !muted && S[n]) try { S[n](); } catch (_) {} }
  const DAY = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];      // G major pentatonic
  const NIGHT = [196, 220, 261.63, 293.66, 329.63, 392];
  // ambient soundscape, called every frame
  function tick(dt, st) {
    if (!ac || muted) return;
    const now = ac.currentTime;
    tGust -= dt;
    if (tGust <= 0) { tGust = rand(3, 7); windF.frequency.setTargetAtTime(rand(220, 650), now, 1.5); windG.gain.setTargetAtTime(rand(0.03, 0.09), now, 1.5); }
    fireG.gain.setTargetAtTime(st.fire * st.fire * 0.022, now, 0.3);
    if (st.fire > 0.05) { tCrackle -= dt; if (tCrackle <= 0) { tCrackle = rand(0.15, 0.9); noise(0.025, { freq: rand(1500, 3500), type: 'highpass', vol: 0.05 * st.fire }); } }
    if (st.dark < 0.4) { // birds
      tBird -= dt;
      if (tBird <= 0) { tBird = rand(2.5, 8); const base = rand(2200, 3600), k = 2 + (Math.random() * 3 | 0); for (let i = 0; i < k; i++) tone(base * rand(0.9, 1.1), 0.09, { to: base * rand(1.15, 1.5), vol: 0.035, delay: i * rand(0.11, 0.16) }); }
    } else if (st.dark > 0.6) { // crickets + an owl now and then
      tCricket -= dt;
      if (tCricket <= 0) {
        tCricket = rand(0.8, 2.5);
        if (Math.random() < 0.08) { tone(330, 0.35, { vol: 0.05, attack: 0.05 }); tone(294, 0.5, { vol: 0.05, attack: 0.05, delay: 0.45 }); }
        else { const f = rand(4200, 4800); for (let i = 0; i < 4; i++) tone(f, 0.035, { vol: 0.018, delay: i * 0.06 }); }
      }
    }
    tNote -= dt; // sparse kalimba-like melody
    if (tNote <= 0) {
      const night = st.dark > 0.6; tNote = night ? rand(2.5, 6) : rand(0.9, 3.2);
      const sc = night ? NIGHT : DAY, f = pick(sc);
      tone(f, 1.6, { type: 'triangle', vol: night ? 0.035 : 0.045 }); tone(f * 2, 0.9, { vol: 0.012 });
      if (Math.random() < 0.3) tone(pick(sc), 1.4, { type: 'triangle', vol: 0.03, delay: 0.22 });
    }
    if (st.moving) { tStep -= dt; if (tStep <= 0) { tStep = 0.27; noise(0.05, { freq: 500, type: 'lowpass', vol: 0.09 }); } } else tStep = 0;
  }
  return {
    init, play, tick,
    suspend() { if (ac) ac.suspend(); }, resume() { if (ac) ac.resume(); },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('darkthicket_muted', muted ? '1' : '0'); } catch (_) {} if (master) master.gain.value = muted ? 0 : 0.7; return muted; },
  };
})();

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
    case 'petals':
      for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * 1.57 + 0.4); c.fillStyle = i % 2 ? '#a8454a' : '#c4686a'; c.beginPath(); c.ellipse(0, -7, 4.5, 7, 0, 0, 7); c.fill(); c.restore(); }
      circ(0, 0, 2.5, '#c99a3a'); break;
    case 'cone':
      c.fillStyle = '#6b4a2b'; c.beginPath(); c.ellipse(0, 1, 8, 12, 0, 0, 7); c.fill();
      for (let y = -7; y <= 8; y += 5) line('#3b2a1a', 1.5, [-7, y, 0, y + 4, 7, y]);
      line('#4f6a3a', 2.5, [0, -11, 3, -15]); break;
    case 'salve':
      c.fillStyle = '#8a7a5a'; c.fillRect(-8, -4, 16, 14); c.fillStyle = '#6f9a5a'; c.fillRect(-8, 0, 16, 10);
      c.fillStyle = '#5a4630'; c.fillRect(-10, -8, 20, 5); line('#f1ead8', 2, [-3, 5, 3, 5]); line('#f1ead8', 2, [0, 2, 0, 8]); break;
    case 'trap':
      c.fillStyle = '#b5a26a'; c.beginPath(); c.moveTo(-13, 9); c.quadraticCurveTo(-12, -11, 0, -12); c.quadraticCurveTo(12, -11, 13, 9); c.closePath(); c.fill();
      for (const x of [-8, -3, 3, 8]) line('#5a4a2c', 1.3, [x, 8, x * 0.7, -10]); line('#5a4a2c', 1.3, [-12, 2, 12, 2]); line('#5a4a2c', 1.3, [-10, -5, 10, -5]); break;
    case 'bedroll':
      c.fillStyle = '#b5a26a'; c.fillRect(-10, -7, 20, 14); c.fillStyle = '#93904c'; c.beginPath(); c.ellipse(10, 0, 4, 7, 0, 0, 7); c.fill();
      c.strokeStyle = '#5a4a2c'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(10, 0, 2, 3.5, 0, 0, 7); c.stroke();
      line('#6e2a26', 2.5, [-5, -7, -5, 7]); line('#6e2a26', 2.5, [3, -7, 3, 7]); break;
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
    res: [], drops: [], mobs: [], fires: [], traps: [],
    wolvesDay: 0, warnDay: 0,
  };
  genWorld();
  buildDerived();
  say('Скоро стемнеет. Нужны ветки и кремень.');
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
  ring('sapling', 5, 120, 260); ring('grass', 6, 120, 280); ring('flint', 4, 130, 300); ring('bush', 2, 160, 300); ring('tree', 4, 200, 340); ring('flower', 4, 140, 320);
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
  const COL = { forest: [62, 78, 56], meadow: [122, 124, 76], rock: [116, 110, 98] };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const wx = x * S, wy = y * S;
    const c = COL[biomeAt(wx, wy, G.seed)];
    // painterly: broad light patches + brush-like mid noise + fine grain
    const broad = (vnoise(wx / 260, wy / 260, G.seed + 21) - 0.5) * 34;
    const mid = (vnoise(wx / 45, wy / 18, G.seed + 5) - 0.5) * 18;
    const v = broad + mid + (hash2(x, y, 77) - 0.5) * 5;
    const i = (y * n + x) * 4;
    img.data[i] = c[0] + v * 0.8; img.data[i + 1] = c[1] + v; img.data[i + 2] = c[2] + v * 0.5; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // soften biome edges into watercolor-like blends
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = n;
  const t2 = tmp.getContext('2d'); t2.filter = 'blur(3px)'; t2.drawImage(groundCanvas, 0, 0);
  g.drawImage(tmp, 0, 0);
  const rnd = mulberry32(G.seed + 99);
  decor = [];
  for (let i = 0; i < 4200; i++) {
    const x = rnd() * WORLD, y = rnd() * WORLD, b = biomeAt(x, y, G.seed), v = rnd();
    let t = 'grass';
    if (b === 'meadow' && v < 0.12) t = 'pebble';
    else if (b === 'forest' && v < 0.1) t = 'mush';
    else if (b === 'forest' && v < 0.45) t = 'fern';
    else if (b === 'rock') t = v < 0.35 ? 'moss' : 'pebble';
    decor.push({ x, y, b, v, t, c: pick(['#fffaf0', '#ffe27a', '#f7a8c0', '#c9b8f0', '#fffaf0']) });
  }
  clouds = [];
  for (let i = 0; i < 26; i++) clouds.push({ x: rnd() * WORLD, y: rnd() * WORLD, r: 160 + rnd() * 220, k: 0.6 + rnd() * 0.6 });
}
let clouds = [];
const fireflies = [];

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
  if (p.hand.dur <= 0) { say(`${itemName(p.hand.id)}: сломалось`); p.hand = null; Sfx.play('snap'); }
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
  if (t.kind === 'trap') return G.traps.includes(t);
  return false;
}
function reachOf(t) {
  if (t.kind === 'res') return RES[t.type].r * t.s + 26;
  if (t.kind === 'drop') return 30;
  if (t.kind === 'trap') return 34;
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
  for (const tr of G.traps) { const d = dist(p, tr) - (tr.caught ? 40 : -60); if (d < radius && d < bd) { best = tr; bd = d; } }
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
  if (t.kind === 'trap') return t.caught ? 'Достать' : 'Забрать';
  return RES[t.type].label;
}

function interact(t) {
  const p = G.player;
  p.face = t.x >= p.x ? 1 : -1;
  if (t.kind === 'drop') {
    const left = addItem(t.id, t.n, t.dur);
    if (left === t.n) { say('Инвентарь полон'); p.cd = 0.6; return; }
    if (left > 0) t.n = left; else G.drops.splice(G.drops.indexOf(t), 1);
    p.cd = 0.2; p.swing = 0.2; Sfx.play('pickup'); return;
  }
  if (t.kind === 'trap') {
    if (t.caught) { t.caught = false; giveOrDrop('meat', 1); say('Попался!', 1.5); Sfx.play('pickup'); }
    else { G.traps.splice(G.traps.indexOf(t), 1); giveOrDrop('trap', 1); Sfx.play('pickup'); lockTarget = null; actionHeld = false; }
    p.cd = 0.5; p.swing = 0.2; return;
  }
  if (t.kind === 'mob') {
    const dmg = p.hand ? (ITEMS[p.hand.id].dmg || 10) : 10;
    t.hp -= dmg; t.hitT = 0.2;
    const d = dist(p, t) || 1; t.x += (t.x - p.x) / d * 12; t.y += (t.y - p.y) / d * 12;
    if (t.type === 'boar') t.aggro = true;
    burst(t.x, t.y, t.type === 'shade' ? '#000' : '#a02020', 5);
    if (p.hand && !ITEMS[p.hand.id].timed) useHand(1);
    p.cd = 0.55; p.swing = 0.25; Sfx.play('hit');
    if (t.hp <= 0) killMob(t);
    return;
  }
  // resource
  const def = RES[t.type];
  if (def.tool) {
    if (!p.hand || ITEMS[p.hand.id].tool !== def.tool) { say(def.tool === 'axe' ? 'Нужен топор' : 'Нужна кирка'); p.cd = 0.8; actionHeld && (lockTarget = null); return; }
    t.hits++; t.shake = 0.25; useHand(1); p.cd = 0.45; p.swing = 0.25; Sfx.play(t.type === 'tree' ? 'chop' : 'mine');
    burst(t.x, t.y - (t.type === 'tree' ? 30 : 5), t.type === 'tree' ? '#3d5a2a' : '#8a8a84', 5);
    if (t.hits >= def.hits) {
      t.hits = 0; Sfx.play(t.type === 'tree' ? 'fall' : 'crumble');
      if (t.type === 'tree') {
        const n = t.s > 1.05 ? 3 : 2;
        for (let i = 0; i < n; i++) dropItem('log', 1, undefined, t.x, t.y);
        if (Math.random() < 0.65) dropItem('cone', 1, undefined, t.x, t.y);
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
  giveOrDrop(def.give, n); Sfx.play('pick');
  burst(t.x, t.y, t.type === 'bush' ? '#c4283a' : '#9aa04a', 4, 40);
  if (t.type === 'flower') G.player.san = Math.min(MAX.san, G.player.san + 4);
  if (t.type === 'carrot' || t.type === 'flower') G.res.splice(G.res.indexOf(t), 1);
  else { t.state = 'picked'; t.timer = DAY_LEN * def.regrow * rand(0.8, 1.2); }
  p.cd = 0.35; p.swing = 0.2;
}

function killMob(m) {
  for (const [id, n] of MOBS[m.type].drop) for (let i = 0; i < n; i++) dropItem(id, 1, undefined, m.x, m.y);
  if (m.type === 'shade') { G.player.san = Math.min(MAX.san, G.player.san + 25); burst(m.x, m.y, '#000', 14, 90); }
  G.mobs.splice(G.mobs.indexOf(m), 1); Sfx.play('kill');
}

function hurtPlayer(dmg, ignoreArmor) {
  const p = G.player;
  if (p.inv_t > 0) return;
  if (p.body && !ignoreArmor) {
    const abs = dmg * 0.6; p.body.dur -= abs; dmg -= abs;
    if (p.body.dur <= 0) { p.body = null; say('Броня развалилась'); }
    invDirty = true;
  }
  p.hp -= dmg; p.inv_t = 0.4; hurtFlash = 0.35; Sfx.play(ignoreArmor ? 'dark' : 'hurt');
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
    if (pp > 0.55 && G.warnDay !== day) { G.warnDay = day; say('Вдали воют волки... Ночью они придут.', 3.5); Sfx.play('warn'); }
    if (pp > 0.74 && G.wolvesDay !== day) {
      G.wolvesDay = day;
      const n = Math.min(1 + Math.floor(day / 3), 6);
      for (let i = 0; i < n; i++) { const a = rand(0, 7); const w = spawnMob('wolf', clamp(p.x + Math.cos(a) * 650, 30, WORLD - 30), clamp(p.y + Math.sin(a) * 650, 30, WORLD - 30)); w.aggro = true; }
      say('Они здесь!'); Sfx.play('warn');
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
    if (G.res.filter(r => r.type === 'flower').length < 70) {
      for (let k = 0; k < 20; k++) { const x = rand(60, WORLD - 60), y = rand(60, WORLD - 60); if (biomeAt(x, y, G.seed) === 'meadow' && Math.hypot(x - p.x, y - p.y) > 500) { spawnRes('flower', x, y); break; } }
    }
    if (G.res.filter(r => r.type === 'boulder').length < 60) {
      for (let k = 0; k < 20; k++) { const x = rand(60, WORLD - 60), y = rand(60, WORLD - 60); if (biomeAt(x, y, G.seed) === 'rock' && Math.hypot(x - p.x, y - p.y) > 600) { spawnRes('boulder', x, y); break; } }
    }
  }

  // ---- particles ----
  for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; if (q.life <= 0) particles.splice(i, 1); }
  for (let i = fireflies.length - 1; i >= 0; i--) { const f = fireflies[i]; f.life += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.life > f.max) fireflies.splice(i, 1); }
  const isDayNow = darkness() < 0.3;
  if (fireflies.length < (isDayNow ? 18 : 40) && Math.random() < 0.3) {
    const a = rand(0, 7), r = rand(40, 500);
    fireflies.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, vx: rand(-12, 12) + (isDayNow ? 10 : 0), vy: rand(-8, 8), life: 0, max: rand(3, 7), s: rand(0.8, 2), o: rand(0, 7), day: isDayNow });
  }
  if (speech) { speech.t -= dt; if (speech.t <= 0) speech = null; }
  hurtFlash = Math.max(0, hurtFlash - dt); darkFlash = Math.max(0, darkFlash - dt); sleepFade = Math.max(0, sleepFade - dt);

  // ---- ambient sound ----
  { let fk = 0; for (const f of G.fires) if (f.fuel > 0) fk = Math.max(fk, clamp(1 - dist(f, p) / 240, 0, 1));
    Sfx.tick(dt, { dark: dk, fire: fk, moving: p.moving });
    if (dayPhase() < 0.04 && G.dawnDay !== day && G.t > DAY_LEN) { G.dawnDay = day; Sfx.play('dawn'); } }

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
      if (m.wind > 0) { // wind-up: stands still, then strikes — step away to dodge
        m.wind -= dt; sp = 0;
        if (m.wind <= 0) { m.lunge = 0.22; m.cd = d.cd; if (dp < d.r + 36) hurtPlayer(d.dmg); else Sfx.play('miss'); }
        return;
      }
      vx = dx / dp; vy = dy / dp; sp = d.speed;
      if (dp < d.r + 24) { sp = 0; if (m.cd <= 0) m.wind = d.wind; }
    };
    switch (m.type) {
      case 'rabbit':
        if (dp < 150) { vx = -dx / dp; vy = -dy / dp; sp = d.speed; }
        else {
          let tr = null, td = 190;
          for (const t of G.traps) if (!t.caught) { const q = dist(t, m); if (q < td) { td = q; tr = t; } }
          if (tr) {
            if (td < 12) { tr.caught = true; G.mobs.splice(i, 1); burst(tr.x, tr.y, '#c9b88a', 6, 40); if (dist(tr, p) < 500) Sfx.play('snap'); continue; }
            vx = (tr.x - m.x) / td; vy = (tr.y - m.y) / td; sp = d.wander;
          } else wander();
        }
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
  ctx.fillStyle = '#1f3038'; ctx.fillRect(0, 0, cvs.width, cvs.height);
  const sk = DPR * Z;
  ctx.setTransform(sk, 0, 0, sk, -cam.x * sk, -cam.y * sk);

  // ground
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(groundCanvas, 0, 0, WORLD, WORLD);
  ctx.strokeStyle = 'rgba(40,36,30,.9)'; ctx.lineWidth = 24; ctx.strokeRect(-12, -12, WORLD + 24, WORLD + 24);
  ctx.strokeStyle = 'rgba(200,210,210,.18)'; ctx.lineWidth = 3; ctx.strokeRect(-30 - Math.sin(G.t) * 4, -30 - Math.sin(G.t) * 4, WORLD + 60 + Math.sin(G.t) * 8, WORLD + 60 + Math.sin(G.t) * 8);

  const x0 = cam.x - 80, y0 = cam.y - 80, x1 = cam.x + vw + 80, y1 = cam.y + vh + 140;
  const inView = o => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1;

  // decor (sways in the wind)
  for (const dcr of decor) {
    if (!inView(dcr)) continue;
    const sw = Math.sin(G.t * 1.8 + dcr.x * 0.012 + dcr.y * 0.004) * 2.5;
    const { x, y, v } = dcr;
    switch (dcr.t) {
      case 'pebble': ctx.fillStyle = 'rgba(50,44,38,.5)'; ctx.beginPath(); ctx.ellipse(x, y, 2 + v * 3, 1.5 + v * 2, 0, 0, 7); ctx.fill(); break;
      case 'moss': ctx.fillStyle = 'rgba(80,92,60,.4)'; ctx.beginPath(); ctx.ellipse(x, y, 6 + v * 8, 3 + v * 3, 0, 0, 7); ctx.fill(); break;
      case 'fern':
        ctx.strokeStyle = 'rgba(28,40,30,.8)'; ctx.lineWidth = 1.6;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + k * 4, y - 8, x + k * 7 + sw, y - 10 - (2 - Math.abs(k)) * 3); ctx.stroke(); }
        break;
      case 'mush':
        ctx.fillStyle = '#f2ead8'; ctx.fillRect(x - 1.2, y - 5, 2.4, 5);
        ctx.fillStyle = v < 0.05 ? '#8e2e2a' : '#8a6a44'; ctx.beginPath(); ctx.ellipse(x, y - 5, 4.5, 3, 0, Math.PI, 0); ctx.fill(); break;
      case 'flower':
        ctx.strokeStyle = 'rgba(60,110,50,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sw, y - 8); ctx.stroke();
        ctx.fillStyle = dcr.c; for (let k = 0; k < 5; k++) { const a = k * 1.2566; ctx.beginPath(); ctx.arc(x + sw + Math.cos(a) * 2.2, y - 8 + Math.sin(a) * 2.2, 1.8, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#f2b640'; ctx.beginPath(); ctx.arc(x + sw, y - 8, 1.2, 0, 7); ctx.fill(); break;
      default:
        ctx.strokeStyle = dcr.b === 'forest' ? 'rgba(26,36,26,.75)' : 'rgba(70,68,40,.7)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x - 4, y - 4, x - 4 + sw, y - 7 - v * 4); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - 5, x + 1 + sw, y - 10 - v * 4); ctx.moveTo(x + 3, y); ctx.quadraticCurveTo(x + 4, y - 3, x + 5 + sw, y - 6 - v * 3); ctx.stroke();
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
  for (const t of G.traps) if (inView(t)) objs.push(t);
  objs.push(p);
  objs.sort((a, b) => a.y - b.y);
  for (const o of objs) {
    if (o === p) drawPlayer(p);
    else if (o.kind === 'res') drawRes(o);
    else if (o.kind === 'drop') drawDrop(o);
    else if (o.kind === 'fire') drawFire(o);
    else if (o.kind === 'mob') drawMob(o);
    else if (o.kind === 'trap') drawTrap(o);
  }
  for (const q of particles) { ctx.globalAlpha = clamp(q.life * 2, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz); }
  ctx.globalAlpha = 1;

  // ---- drifting cloud shadows ----
  const dk = darkness();
  if (dk < 0.6) {
    const a = 0.16 * (1 - dk / 0.6);
    for (const c of clouds) {
      const cx = ((c.x + G.t * 14) % (WORLD + 800)) - 400, cy = c.y + Math.sin(G.t * 0.05 + c.x) * 30;
      if (cx + c.r < cam.x || cx - c.r > cam.x + vw || cy + c.r < cam.y || cy - c.r > cam.y + vh) continue;
      const g = ctx.createRadialGradient(cx, cy, c.r * 0.2, cx, cy, c.r);
      g.addColorStop(0, `rgba(30,60,90,${a * c.k})`); g.addColorStop(1, 'rgba(30,60,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, c.r * 1.4, c.r, 0, 0, 7); ctx.fill();
    }
  }

  // ---- darkness overlay ----
  const L = lights();
  if (dk > 0.01) {
    const s = 0.5; // dark canvas is half resolution
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillStyle = `rgba(5,6,16,${dk})`;
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
  // fireflies at dusk/night, pollen motes by day
  for (const f of fireflies) {
    const fx = f.x + Math.sin(G.t * f.s + f.o) * 14, fy = f.y + Math.cos(G.t * f.s * 0.7 + f.o) * 10;
    const al = clamp(Math.min(f.life, f.max - f.life) * 1.5, 0, 1) * (0.5 + 0.5 * Math.sin(G.t * 4 + f.o));
    if (f.day) { ctx.fillStyle = `rgba(255,250,220,${al * 0.5})`; ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, 7); ctx.fill(); continue; }
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10);
    g.addColorStop(0, `rgba(220,255,140,${al})`); g.addColorStop(1, 'rgba(160,255,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 10, 0, 7); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // speech bubble
  if (speech) {
    ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(speech.t * 2, 0, 1);
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(60,40,25,.85)'; ctx.strokeText(speech.text, p.x, p.y - 78);
    ctx.fillStyle = '#fffaf0'; ctx.fillText(speech.text, p.x, p.y - 78);
    ctx.globalAlpha = 1;
  }

  // ---- screen space effects ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // dusk tint
  const ph = dayPhase();
  if (ph > 0.42 && ph < 0.75) { const k = Math.sin((ph - 0.42) / 0.33 * Math.PI); ctx.fillStyle = `rgba(190,80,40,${0.16 * k})`; ctx.fillRect(0, 0, W, H); }
  else if (ph > 0.04 && ph < 0.42) { ctx.fillStyle = 'rgba(110,90,60,.10)'; ctx.fillRect(0, 0, W, H); }
  // sanity vignette
  const sk2 = 1 - p.san / MAX.san;
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, sk2 > 0.6 ? `rgba(40,10,50,${0.3 + sk2 * 0.5})` : `rgba(8,8,10,${0.42 + sk2 * 0.4})`);
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  if (hurtFlash > 0) { ctx.fillStyle = `rgba(160,0,0,${hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (darkFlash > 0) {
    ctx.fillStyle = `rgba(0,0,0,${darkFlash})`; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(220,220,255,${darkFlash})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(W / 2 - 40 + i * 25, H / 2 - 50); ctx.lineTo(W / 2 - 20 + i * 25, H / 2 + 40); ctx.stroke(); }
  }

  // arrow pointing home (nearest campfire) when it is off-screen
  { let home = null, hd = Infinity; for (const f of G.fires) { const d = dist(f, p); if (d < hd) { hd = d; home = f; } }
    if (home && (Math.abs(home.x - p.x) > vw / 2 || Math.abs(home.y - p.y) > vh / 2)) {
      const a = Math.atan2(home.y - p.y, home.x - p.x), R2 = Math.min(W, H) * 0.36, ax = W / 2 + Math.cos(a) * R2, ay = H / 2 + Math.sin(a) * R2;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.globalAlpha = 0.8;
      ctx.fillStyle = home.fuel > 0 ? '#e89a3a' : '#8a8478'; ctx.strokeStyle = '#1c1611'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    } }
  if (sleepFade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${clamp(sleepFade / 1.2, 0, 1)})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(230,220,190,${clamp(sleepFade / 1.2, 0, 1)})`; ctx.font = 'italic 28px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('Z  z  z ...', W / 2, H / 2);
  }
  // joystick
  if (joy.active) {
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 55, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.strokeStyle = '#fbf3e0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fbf3e0'; ctx.beginPath(); ctx.arc(joy.ox + joy.x * 55, joy.oy + joy.y * 55, 22, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawHUD();
}

// ---------- world draws ----------
function shadow(x, y, rx, ry) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }

const INK = '#1a1410';
function blob(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
// fill current path and give it a hand-inked outline
function ink(col, lw = 2) { ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function hatch(pts, lw = 1.1, col = 'rgba(26,20,16,.55)') { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < pts.length; i += 4) { ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[i + 2], pts[i + 3]); } ctx.stroke(); }
function drawRes(r) {
  const s = r.s;
  ctx.save(); ctx.translate(r.x, r.y);
  if (r.shake > 0) ctx.translate(Math.sin(r.shake * 60) * 3, 0);
  const sway = Math.sin(G.t * 1.3 + r.x * 0.01) * 1.4;
  switch (r.type) {
    case 'tree':
      if (r.state === 'stump') {
        shadow(0, 2, 13 * s, 5 * s);
        ctx.beginPath(); ctx.moveTo(-11 * s, 1); ctx.lineTo(-7 * s, -11 * s); ctx.lineTo(7 * s, -11 * s); ctx.lineTo(11 * s, 1); ctx.closePath(); ink('#4a3728');
        ctx.beginPath(); ctx.ellipse(0, -11 * s, 7.5 * s, 3.2 * s, 0, 0, 7); ink('#b89a6a', 1.6);
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -11 * s, 3.5 * s, 1.4 * s, 0, 0, 7); ctx.stroke();
        break;
      }
      if (r.state === 'young') {
        shadow(0, 1, 8, 3);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(-4, -8); ctx.lineTo(-6, -14); ctx.lineTo(sway, -26); ctx.lineTo(6, -14); ctx.lineTo(4, -8); ctx.lineTo(9, -6); ctx.closePath(); ink('#3a5140', 1.6);
        break;
      }
      shadow(0, 3, 30 * s, 10 * s);
      // gnarled trunk
      ctx.beginPath(); ctx.moveTo(-10 * s, 2); ctx.quadraticCurveTo(-4 * s, -8 * s, -5 * s, -34 * s); ctx.lineTo(5 * s, -34 * s); ctx.quadraticCurveTo(4 * s, -8 * s, 11 * s, 2); ctx.closePath(); ink('#3b2c22');
      hatch([-1 * s, -6 * s, -2 * s, -22 * s, 2 * s, -10 * s, 2 * s, -28 * s]);
      // ragged pine tiers
      for (let i = 0; i < 3; i++) {
        const w = (34 - i * 8) * s, yb = (-22 - i * 26) * s, h = 46 * s, sw = sway * (i + 1) * 0.5;
        ctx.beginPath(); ctx.moveTo(-w, yb + 4 * s);
        const n = 7; for (let k = 1; k < n; k++) ctx.lineTo(-w + 2 * w * k / n, yb + (k % 2 ? -5 : 5) * s);
        ctx.lineTo(w, yb + 4 * s); ctx.lineTo(w * 0.45 + sw, yb - h * 0.45); ctx.lineTo(w * 0.6 + sw, yb - h * 0.42); ctx.lineTo(sw, yb - h);
        ctx.lineTo(-w * 0.6 + sw, yb - h * 0.42); ctx.lineTo(-w * 0.45 + sw, yb - h * 0.45); ctx.closePath();
        ink(['#263528', '#2e4032', '#374b3a'][i], 2.2);
        hatch([-w * 0.5, yb - 4 * s, -w * 0.25 + sw, yb - h * 0.4, w * 0.15, yb - 6 * s, w * 0.3 + sw, yb - h * 0.35], 1.2, 'rgba(15,22,16,.6)');
      }
      break;
    case 'sapling':
      shadow(0, 1, 8, 3);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      if (r.state === 'ready') {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-1, -12, -2 + sway, -24); ctx.moveTo(-1, -9); ctx.lineTo(-9 + sway, -18); ctx.moveTo(-1, -14); ctx.lineTo(7 + sway, -23); ctx.moveTo(-5, -14); ctx.lineTo(-10 + sway, -12); ctx.stroke();
        ctx.strokeStyle = '#6a4e36'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(-1, -12, -2 + sway, -23); ctx.stroke();
        for (const [lx, ly] of [[-9, -19], [7, -24], [-2, -26]]) { ctx.beginPath(); ctx.ellipse(lx + sway, ly, 3.4, 2, 0.5, 0, 7); ink('#5f6f3a', 1.2); }
      } else { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.moveTo(0, -3); ctx.lineTo(3, -6); ctx.stroke(); }
      break;
    case 'grass':
      shadow(0, 1, 9, 3);
      if (r.state === 'ready') {
        for (let i = -3; i <= 3; i++) { ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.quadraticCurveTo(i * 3, -10, i * 5 + sway * 1.5, -20 + Math.abs(i)); ctx.stroke(); }
        for (let i = -3; i <= 3; i++) { ctx.strokeStyle = i % 2 ? '#b9a85c' : '#93904c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.quadraticCurveTo(i * 3, -10, i * 5 + sway * 1.5, -20 + Math.abs(i)); ctx.stroke(); }
      } else { ctx.strokeStyle = '#4a4430'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.lineTo(i * 2.4, -4); ctx.stroke(); } }
      break;
    case 'bush':
      shadow(0, 2, 19 * s, 6 * s);
      ctx.beginPath(); ctx.moveTo(-18 * s, -2 * s);
      for (const [x, y] of [[-22, -12], [-15, -14], [-14, -24], [-5, -23], [0, -32], [6, -24], [14, -25], [15, -15], [22, -12], [18, -2]]) ctx.lineTo(x * s, y * s);
      ctx.closePath(); ink('#33452f', 2.2);
      hatch([-10 * s, -8 * s, -6 * s, -18 * s, 2 * s, -8 * s, 5 * s, -20 * s, 11 * s, -7 * s, 12 * s, -14 * s], 1.2, 'rgba(15,22,16,.55)');
      if (r.state === 'ready') for (const [bx, by] of [[-10, -12], [6, -16], [-1, -22], [11, -8], [-4, -6]]) { ctx.beginPath(); ctx.arc(bx * s, by * s, 3, 0, 7); ink('#8e2430', 1.2); }
      break;
    case 'carrot':
      ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5 + sway, -12); ctx.moveTo(0, 0); ctx.lineTo(sway, -14); ctx.moveTo(0, 0); ctx.lineTo(5 + sway, -11); ctx.stroke();
      ctx.strokeStyle = '#5b7a3a'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.5, 0, 0, 7); ink('#b8642a', 1.3);
      break;
    case 'flower':
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(1, -6, sway, -12); ctx.stroke();
      for (let k = 0; k < 5; k++) { const a = k * 1.2566 + 0.3; ctx.beginPath(); ctx.ellipse(sway + Math.cos(a) * 3.4, -12 + Math.sin(a) * 3.4, 3, 2, a, 0, 7); ink(r.uid % 2 ? '#a8454a' : '#c9b9a0', 1.1); }
      blob(sway, -12, 1.8, '#c99a3a');
      break;
    case 'boulder':
      shadow(0, 3, 27 * s, 8 * s);
      ctx.beginPath(); ctx.moveTo(-24 * s, 1); ctx.lineTo(-22 * s, -18 * s); ctx.lineTo(-8 * s, -32 * s); ctx.lineTo(12 * s, -30 * s); ctx.lineTo(25 * s, -10 * s); ctx.lineTo(21 * s, 3 * s); ctx.closePath(); ink('#6f6a62', 2.4);
      ctx.beginPath(); ctx.moveTo(-17 * s, -18 * s); ctx.lineTo(-7 * s, -28 * s); ctx.lineTo(8 * s, -26 * s); ctx.lineTo(-2 * s, -16 * s); ctx.closePath(); ctx.fillStyle = '#8f8a80'; ctx.fill();
      hatch([8 * s, -4 * s, 16 * s, -14 * s, 12 * s, -2 * s, 20 * s, -10 * s, -2 * s, -16 * s, 6 * s, -8 * s, 6 * s, -8 * s, 2 * s, 0], 1.3);
      if (r.hits > 0) hatch([-12 * s, -18 * s, -5 * s, -8 * s, -5 * s, -8 * s, -11 * s, 0, -5 * s, -8 * s, 2 * s, -5 * s], 2, INK);
      break;
  }
  ctx.restore();
}

function drawTrap(t) {
  ctx.save(); ctx.translate(t.x, t.y);
  shadow(0, 2, 14, 4);
  ctx.beginPath(); ctx.moveTo(-13, 0); ctx.quadraticCurveTo(-12, -18, 0, -19); ctx.quadraticCurveTo(12, -18, 13, 0); ctx.closePath(); ink(t.caught ? '#9a8658' : '#b5a26a', 2);
  hatch([-8, -1, -6, -14, -3, -1, -2, -18, 3, -1, 2, -18, 8, -1, 6, -14, -12, -6, 12, -6, -10, -12, 10, -12], 1.2);
  if (t.caught) { const j = Math.sin(G.t * 14) * 1.5; ctx.beginPath(); ctx.ellipse(-3 + j, -24, 2, 6, -0.3, 0, 7); ink('#7d6f5e', 1.2); ctx.beginPath(); ctx.ellipse(3 + j, -24, 2, 6, 0.3, 0, 7); ink('#7d6f5e', 1.2); }
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

function eye(x, y, r, pupil = 0.45, px = 0.3) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ink('#f1ead8', 1.2); blob(x + r * px, y, r * pupil, INK); }
function drawMob(m) {
  const d = MOBS[m.type];
  ctx.save(); ctx.translate(m.x, m.y);
  const bob = m.moving ? Math.abs(Math.sin(m.anim * 12)) * 3 : 0;
  const flash = m.hitT > 0, W_ = m.wind > 0;
  const toP = G.player.x > m.x ? 1 : -1;
  if (m.lunge > 0) ctx.translate(toP * 10, 0);
  if (W_) { ctx.translate(-toP * 5 + Math.sin(G.t * 70) * 1.2, 0); m.face = toP; }
  if (m.type !== 'shade') shadow(0, 2, d.r * 1.1, d.r * 0.4);
  ctx.scale(m.face, 1);
  const C = c => flash ? '#f4eee0' : c;
  switch (m.type) {
    case 'rabbit': { // scruffy hare
      const hop = m.moving ? Math.abs(Math.sin(m.anim * 9)) * 7 : 0;
      ctx.translate(0, -hop);
      ctx.beginPath(); ctx.ellipse(-9, -7, 3.5, 3, 0, 0, 7); ink(C('#cfc4ae'), 1.4);
      ctx.beginPath(); ctx.ellipse(0, -8, 10, 7.5, -0.15, 0, 7); ink(C('#7b6c5a'));
      ctx.beginPath(); ctx.ellipse(2, -24, 2.4, 9, -0.25 + Math.sin(m.anim * 4) * 0.08, 0, 7); ink(C('#6b5d4d'), 1.6);
      ctx.beginPath(); ctx.ellipse(8, -23, 2.4, 9, 0.3, 0, 7); ink(C('#7b6c5a'), 1.6);
      ctx.beginPath(); ctx.ellipse(8, -13, 7, 6.5, 0, 0, 7); ink(C('#84745f'));
      hatch([-5, -6, -2, -11, 0, -4, 3, -9]);
      eye(10, -14, 2.6, 0.55, 0.25);
      blob(14.5, -11.5, 1.3, INK);
      ctx.fillStyle = '#f1ead8'; ctx.fillRect(12.5, -9.5, 2.2, 2.6);
      break; }
    case 'boar': { // hunched shaggy boar
      const b = bob * 0.5, lg = m.moving ? Math.sin(m.anim * 10) * 2.5 : 0;
      for (const [lx, l] of [[-15, lg], [-8, -lg], [8, lg], [14, -lg]]) { ctx.beginPath(); ctx.rect(lx, -9, 5, 9 + l); ink(C('#2e241e'), 1.6); }
      ctx.beginPath(); ctx.moveTo(-26, -14 - b);
      for (const [x, y] of [[-25, -28], [-21, -27], [-19, -36], [-14, -33], [-10, -42], [-5, -37], [0, -45], [4, -38], [9, -42], [12, -34], [18, -34], [22, -24], [24, -10], [10, -4], [-16, -4]]) ctx.lineTo(x, y - b);
      ctx.closePath(); ink(C(m.aggro ? '#4a2f28' : '#463830'), 2.4);
      hatch([-16, -14 - b, -12, -28 - b, -8, -12 - b, -4, -30 - b, 0, -12 - b, 4, -30 - b, 8, -12 - b, 11, -26 - b], 1.3);
      ctx.beginPath(); ctx.moveTo(14, -28 - b); ctx.lineTo(30, -22 - b); ctx.lineTo(36, -12 - b); ctx.lineTo(33, -6 - b); ctx.lineTo(18, -6 - b); ctx.closePath(); ink(C('#54433a'), 2.2);
      ctx.beginPath(); ctx.ellipse(34.5, -10 - b, 3, 4, 0, 0, 7); ink(C('#6a5548'), 1.5);
      ctx.beginPath(); ctx.moveTo(27, -8 - b); ctx.quadraticCurveTo(30, -18 - b, 33, -22 - b); ctx.quadraticCurveTo(32, -14 - b, 31, -8 - b); ctx.closePath(); ink('#e6dcc2', 1.3);
      ctx.beginPath(); ctx.moveTo(15, -28 - b); ctx.lineTo(12, -38 - b); ctx.lineTo(20, -30 - b); ctx.closePath(); ink(C('#463830'), 1.6);
      ctx.beginPath(); ctx.arc(24, -19 - b, 3, 0, 7); ink(m.aggro ? '#f0d0c0' : '#f1ead8', 1.2); blob(25, -19 - b, 1.3, m.aggro ? '#b01a10' : INK);
      hatch([20, -24 - b, 28, -22 - b], 2, INK);
      break; }
    case 'wolf': { // gaunt wolf
      const b = bob * 0.4, lg = m.moving ? Math.sin(m.anim * 14) * 4 : 0;
      ctx.beginPath(); ctx.moveTo(-17, -20 - b); ctx.lineTo(-34, -30 - b + Math.sin(m.anim * 5) * 2); ctx.lineTo(-30, -24 - b); ctx.lineTo(-36, -20 - b); ctx.lineTo(-18, -13 - b); ctx.closePath(); ink(C('#2c2c32'), 1.8);
      for (const [lx, l] of [[-14, lg], [-9, -lg], [8, lg], [13, -lg]]) { ctx.beginPath(); ctx.moveTo(lx, -11); ctx.lineTo(lx + l, 0); ctx.lineTo(lx + 3.5 + l, 0); ctx.lineTo(lx + 4, -11); ctx.closePath(); ink(C('#26262b'), 1.5); }
      ctx.beginPath(); ctx.moveTo(-20, -14 - b);
      for (const [x, y] of [[-20, -24], [-14, -23], [-11, -29], [-6, -25], [-2, -31], [3, -26], [8, -32], [12, -27], [18, -26], [20, -14], [8, -8], [-10, -9]]) ctx.lineTo(x, y - b);
      ctx.closePath(); ink(C('#3a3a42'), 2.2);
      hatch([-8, -12 - b, -6, -20 - b, -3, -11 - b, -1, -20 - b, 2, -11 - b, 4, -20 - b], 1.2);
      ctx.beginPath(); ctx.moveTo(12, -30 - b); ctx.lineTo(13, -42 - b); ctx.lineTo(19, -33 - b); ctx.lineTo(23, -41 - b); ctx.lineTo(25, -30 - b); ctx.lineTo(38, -22 - b); ctx.lineTo(37, -18 - b); ctx.lineTo(24, -15 - b); ctx.lineTo(13, -18 - b); ctx.closePath(); ink(C('#3a3a42'), 2.2);
      ctx.fillStyle = '#f1ead8'; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(25 + k * 3, -17.5 - b); ctx.lineTo(26.5 + k * 3, -13.5 - b); ctx.lineTo(28 + k * 3, -18 - b); } ctx.fill();
      blob(37.5, -21 - b, 1.6, INK);
      ctx.beginPath(); ctx.ellipse(22, -26 - b, 3.2, 2.4, 0.3, 0, 7); ink('#f1ead8', 1.2);
      hatch([18, -30 - b, 26, -27 - b], 2, INK);
      break; }
    case 'shade': { // tall hollow-eyed nightmare
      const a = m.fade ? Math.max(0, 1 - m.fade / 1.5) : 1, wv = i => Math.sin(m.anim * 4 + i) * 3;
      ctx.globalAlpha = 0.86 * a; ctx.fillStyle = flash ? '#4a4a55' : '#07070b';
      ctx.beginPath(); ctx.moveTo(-12 + wv(0), 2);
      ctx.quadraticCurveTo(-16 + wv(1), -30, -10, -58); ctx.quadraticCurveTo(-12, -74, 0, -76); ctx.quadraticCurveTo(13, -74, 10, -58);
      ctx.quadraticCurveTo(17 + wv(2), -30, 13 + wv(3), 2); ctx.quadraticCurveTo(6, -4 + wv(4), 2, 3); ctx.quadraticCurveTo(-4, -4 + wv(5), -12 + wv(0), 2); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(9, -50); ctx.quadraticCurveTo(26, -40, 22 + wv(2), -14); ctx.moveTo(22 + wv(2), -14); ctx.lineTo(27 + wv(2), -8); ctx.moveTo(22 + wv(2), -14); ctx.lineTo(20 + wv(2), -6);
      ctx.moveTo(-9, -50); ctx.quadraticCurveTo(-22, -40, -18 + wv(1), -18); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, -72); ctx.lineTo(-13, -90); ctx.moveTo(-10, -82); ctx.lineTo(-17, -84); ctx.moveTo(6, -72); ctx.lineTo(13, -90); ctx.moveTo(10, -82); ctx.lineTo(17, -86); ctx.stroke();
      ctx.globalAlpha = a; ctx.fillStyle = '#f4f0e2';
      ctx.beginPath(); ctx.ellipse(1, -62, 3.4, 4.6, 0.2, 0, 7); ctx.ellipse(9, -61, 2.8, 4, -0.1, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, -52); for (let k = 0; k < 6; k++) ctx.lineTo(-0.5 + k * 2.4, k % 2 ? -52 : -48.5); ctx.lineTo(12, -52); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; break; }
  }
  ctx.restore();
  if (W_) { ctx.font = 'bold 22px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; const ey = m.y - (m.type === 'shade' ? 98 : 54); ctx.strokeText('!', m.x, ey); ctx.fillStyle = '#e8482a'; ctx.fillText('!', m.x, ey); }
  if (m.hp < MOBS[m.type].hp && m.type !== 'rabbit') {
    const w = 30; ctx.fillStyle = INK; ctx.fillRect(m.x - w / 2 - 1, m.y + 5, w + 2, 6);
    ctx.fillStyle = '#a8302a'; ctx.fillRect(m.x - w / 2, m.y + 6, w * clamp(m.hp / MOBS[m.type].hp, 0, 1), 4);
  }
}

function drawPlayer(p) { // the Wanderer: battered wide-brim hat, long coat, hollow eyes
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.inv_t > 0 && Math.floor(p.inv_t * 20) % 2) ctx.globalAlpha = 0.5;
  shadow(0, 2, 15, 5);
  const w = p.moving ? Math.sin(p.walk * 12) : 0, bob = Math.abs(w) * 2, mad = p.san < MAX.san * 0.3;
  ctx.scale(p.face, 1);
  // thin legs + boots
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(-4 + w * 5, -2); ctx.moveTo(4, -14); ctx.lineTo(4 - w * 5, -2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-3 + w * 5, -1, 4.5, 2.6, 0, 0, 7); ink('#2a211b', 1.4); ctx.beginPath(); ctx.ellipse(5 - w * 5, -1, 4.5, 2.6, 0, 0, 7); ink('#2a211b', 1.4);
  ctx.translate(0, -bob);
  // long coat with ragged hem (or plank armor)
  const fl = Math.sin(G.t * 4) * 1.2;
  ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(8, -40); ctx.lineTo(13, -14); ctx.lineTo(9 + fl, -10); ctx.lineTo(5, -13); ctx.lineTo(1 + fl, -9); ctx.lineTo(-4, -13); ctx.lineTo(-9 + fl, -9); ctx.lineTo(-13, -14); ctx.closePath();
  ink(p.body ? '#6a4c30' : '#3b3431', 2.2);
  if (p.body) hatch([-5, -37, -7, -14, 0, -38, 0, -13, 5, -37, 7, -14, -10, -26, 10, -26], 1.5, INK);
  else { hatch([0, -38, 0, -14], 1.4, INK); blob(0, -32, 1.1, '#b8a888'); blob(0, -26, 1.1, '#b8a888'); blob(0, -20, 1.1, '#b8a888'); }
  // scarf
  ctx.beginPath(); ctx.moveTo(-9, -43); ctx.lineTo(9, -43); ctx.lineTo(9, -37); ctx.lineTo(-6, -37); ctx.lineTo(-13 - w * 2 + fl, -24); ctx.lineTo(-17 - w * 2 + fl, -27); ctx.lineTo(-10, -38); ctx.closePath(); ink('#6e2a26', 1.8);
  // big pale head
  ctx.beginPath(); ctx.moveTo(-11, -52); ctx.quadraticCurveTo(-12, -66, 1, -66); ctx.quadraticCurveTo(14, -66, 13, -53); ctx.quadraticCurveTo(12, -43, 2, -42); ctx.quadraticCurveTo(-9, -42, -11, -52); ctx.closePath(); ink('#e2d6c0', 2.2);
  // sunken eyes
  const tw = mad ? Math.sin(G.t * 30) * 0.6 : 0, blink = (G.t % 4.5) < 0.12;
  blob(4, -52, 4.6, 'rgba(60,45,50,.35)'); blob(10.5, -52, 4, 'rgba(60,45,50,.35)');
  if (blink) hatch([1, -53, 7, -53, 8, -53, 13, -53], 1.8, INK);
  else { eye(4 + tw, -53, 3.4, mad ? 0.22 : 0.42, 0.3); eye(10.5 + tw, -53, 2.9, mad ? 0.22 : 0.42, 0.3); }
  hatch(mad ? [0, -59, 7, -57, 8, -57, 14, -59] : [0, -57.5, 7, -58.5, 8, -58.5, 13.5, -57.5], 1.8, INK);
  hatch([5, -46, 10, mad ? -45 : -46.5], 1.6, INK);
  hatch([-6, -50, -4, -46, -8, -54, -6, -51], 1, 'rgba(26,20,16,.45)');
  // battered wide-brim hat
  ctx.beginPath(); ctx.ellipse(1, -63, 19, 4.6, -0.06, 0, 7); ink('#27201c', 2.2);
  ctx.beginPath(); ctx.moveTo(-10, -64); ctx.lineTo(-8, -78); ctx.quadraticCurveTo(-2, -84, 3, -80); ctx.lineTo(6, -82); ctx.lineTo(11, -65); ctx.closePath(); ink('#27201c', 2.2);
  ctx.beginPath(); ctx.moveTo(-10, -66); ctx.lineTo(11, -67); ctx.lineTo(11.5, -64); ctx.lineTo(-10, -63); ctx.closePath(); ctx.fillStyle = '#6e2a26'; ctx.fill();
  hatch([-5, -76, -3, -70, 2, -78, 3, -71], 1, 'rgba(240,230,210,.18)');
  // arm + held item
  const swing = p.swing > 0 ? Math.sin((1 - p.swing / 0.25) * Math.PI) : 0;
  ctx.save(); ctx.translate(8, -35); ctx.rotate(-0.4 + swing * 1.6);
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 11); ctx.stroke();
  ctx.strokeStyle = p.body ? '#6a4c30' : '#3b3431'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(4.5, 13, 2.4, 0, 7); ink('#e2d6c0', 1.2);
  if (p.hand) { ctx.translate(6, 13); ctx.rotate(0.6); drawItem(ctx, p.hand.id, 26); }
  ctx.restore();
  ctx.restore();
}

// ---------- HUD (canvas) ----------
function gauge(x, y, val, max, col, icon) {
  const r = 21, k = clamp(val / max, 0, 1);
  ctx.fillStyle = '#d9c9a0'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  ctx.fillStyle = col; ctx.fillRect(x - r, y + r - 2 * r * k, 2 * r, 2 * r * k); ctx.restore();
  ctx.strokeStyle = k < 0.25 && Math.sin(G.t * 8) > 0 ? '#e03020' : '#1a1410'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.stroke();
  ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(icon, x, y - 1);
  ctx.font = 'bold 11px Georgia, serif'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(Math.ceil(val), x, y + r + 10); ctx.fillStyle = '#fffaf0'; ctx.fillText(Math.ceil(val), x, y + r + 10);
  ctx.textBaseline = 'alphabetic';
}
function drawHUD() {
  const p = G.player;
  const top = 32, left = 34;
  gauge(left, top, p.hp, MAX.hp, '#9a2e2a', '❤');
  gauge(left + 56, top, p.hunger, MAX.hunger, '#b5742a', '🍖');
  gauge(left + 112, top, p.san, MAX.san, '#6a4f8a', '🧠');
  // clock
  const cx = W - 92, cy = 38, r = 27;
  const seg = (a0, a1, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2 + a0 * Math.PI * 2, -Math.PI / 2 + a1 * Math.PI * 2); ctx.closePath(); ctx.fill(); };
  ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.fill();
  seg(0, 0.5, '#c9a64a'); seg(0.5, 0.68, '#a8562a'); seg(0.68, 1, '#25264a');
  const a = -Math.PI / 2 + dayPhase() * Math.PI * 2;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2)); ctx.stroke();
  ctx.fillStyle = '#d9c9a0'; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill(); ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1a1410'; ctx.font = 'bold 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(dayNum(), cx, cy); ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 11px Georgia, serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,40,20,.7)'; ctx.strokeText('День', cx, cy + r + 13); ctx.fillStyle = '#fffaf0'; ctx.fillText('День', cx, cy + r + 13);
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
  if (def.cook && fire) acts.push(['Приготовить', () => { take(); giveOrDrop(def.cook, 1); burst(fire.x, fire.y, '#ffb347', 5); Sfx.play('cook'); }]);
  if (def.food) acts.push(['Съесть', () => eat(i)]);
  const anyFire = nearAnyFire();
  if (def.fuel && anyFire) acts.push(['В костёр', () => { take(); anyFire.fuel = Math.min(anyFire.max, anyFire.fuel + def.fuel); burst(anyFire.x, anyFire.y, '#ffb347', 8); Sfx.play('fire'); }]);
  if (def.slot) acts.push(['Экипировать', () => equip(i)]);
  if (def.heal) acts.push(['Применить', () => { take(); p.hp = Math.min(MAX.hp, p.hp + def.heal); say('Полегчало.', 1.5); Sfx.play('equip'); }]);
  if (def.plant) acts.push(['Посадить', () => { take(); G.res.push({ kind: 'res', uid: G.nextId++, type: 'tree', x: p.x + p.face * 30, y: p.y + 6, state: 'young', timer: DAY_LEN * rand(1.3, 1.8), hits: 0, s: rand(0.85, 1.2) }); Sfx.play('pick'); }]);
  if (def.place === 'trap') acts.push(['Поставить', () => { take(); G.traps.push({ kind: 'trap', x: p.x + p.face * 30, y: p.y + 6, caught: false }); Sfx.play('equip'); }]);
  if (def.sleep) acts.push(['Спать', () => trySleep(i)]);
  acts.push(['Выбросить', () => { dropItem(s.id, s.n, s.dur, p.x, p.y); p.inv[i] = null; }]);
  if (s.n > 1) acts.push(['Выбросить 1', () => { dropItem(s.id, 1, s.dur, p.x, p.y); take(); }]);
  return acts;
}
let sleepFade = 0;
function trySleep(i) {
  const p = G.player, day = dayNum();
  if (phaseName() === 'day') return say('Ещё светло — не уснуть');
  if (!nearFire(150)) return say('Нужен горящий костёр рядом');
  if (G.mobs.some(m => (m.type === 'wolf' || m.type === 'shade' || (m.type === 'boar' && m.aggro)) && dist(m, p) < 420)) return say('Слишком опасно, чтобы спать');
  if (day % 3 === 0 && G.wolvesDay !== day) return say('Волки близко... Не уснуть');
  if (p.hunger < 30) return say('Слишком голодно, чтобы спать');
  const target = day * DAY_LEN + DAY_LEN * 0.05, skip = target - G.t;
  G.t = target;
  for (const r of G.res) if (r.state !== 'ready') r.timer -= skip;
  for (const f of G.fires) f.fuel = Math.max(0, f.fuel - 60);
  p.hunger = Math.max(10, p.hunger - 40); p.san = Math.min(MAX.san, p.san + 70); p.hp = Math.min(MAX.hp, p.hp + 25);
  const s = p.inv[i]; s.n--; if (s.n <= 0) p.inv[i] = null;
  G.dawnDay = dayNum(); sleepFade = 2.4; say('Утро. Я жив.', 3.5); Sfx.play('dawn');
}
function quickUse(i) {
  const s = G.player.inv[i]; const def = ITEMS[s.id];
  if (def.slot) equip(i); else if (def.food) eat(i);
}
function eat(i) {
  const p = G.player, s = p.inv[i], f = ITEMS[s.id].food;
  p.hunger = clamp(p.hunger + f.h, 0, MAX.hunger); p.hp = clamp(p.hp + f.hp, 0, MAX.hp); p.san = clamp(p.san + f.s, 0, MAX.san);
  s.n--; if (s.n <= 0) p.inv[i] = null;
  say(f.hp < 0 ? 'Фу, сырое...' : 'Ням.', 1.4); Sfx.play('eat');
  invDirty = true;
}
function equip(i) {
  const p = G.player, s = p.inv[i], slot = ITEMS[s.id].slot;
  const old = p[slot]; p[slot] = s; p.inv[i] = old || null; invDirty = true; Sfx.play('equip');
}

// ============================================================
//  Crafting UI
// ============================================================
const craftEl = document.getElementById('craft');
const recipesEl = document.getElementById('recipes');
function toggleCraft() { Sfx.play('ui'); if (craftEl.classList.contains('hidden')) { craftEl.classList.remove('hidden'); renderRecipes(); } else craftEl.classList.add('hidden'); closePopup(); }
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
    say('Тепло...', 1.5); Sfx.play('fire');
  } else { giveOrDrop(r.id, 1, ITEMS[r.id].dur); Sfx.play('craft'); }
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
  try { const s = localStorage.getItem(SAVE_KEY); if (!s) return false; G = JSON.parse(s); G.traps = G.traps || []; buildDerived(); return true; }
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
  Sfx.init(); buildInvUI(); invDirty = true; running = true; particles.length = 0; lockTarget = null; actionHeld = false;
  requestFullscreen();
}
function requestFullscreen() {
  const el = document.documentElement;
  try { if (!document.fullscreenElement && el.requestFullscreen && matchMedia('(pointer: coarse)').matches) el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (_) {}
}
function pauseGame() { if (!running) return; running = false; closePopup(); pauseScr.classList.remove('hidden'); Sfx.suspend(); }
function showMenu() {
  running = false; hud.classList.add('hidden'); pauseScr.classList.add('hidden'); over.classList.add('hidden'); menu.classList.remove('hidden');
  $('contBtn').classList.toggle('hidden', !hasSave());
}
function gameOver() {
  Sfx.play('death');
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
$('resumeBtn').addEventListener('click', () => { pauseScr.classList.add('hidden'); running = true; Sfx.resume(); });
const soundBtn = $('soundBtn');
const soundLabel = () => { soundBtn.textContent = Sfx.muted ? 'Звук: выкл' : 'Звук: вкл'; };
soundBtn.addEventListener('click', () => { Sfx.toggle(); soundLabel(); });
soundLabel();
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
  else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#15171a'; ctx.fillRect(0, 0, cvs.width, cvs.height); }
  requestAnimationFrame(frame);
}
showMenu();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

// debug hook for automated tests
window.__game = { get G() { return G; }, update, addItem, craft: id => craft(RECIPES.find(r => r.id === id)) };
})();
