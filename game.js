'use strict';

// ======================================================================
// Jira Blaster — a top-down office arcade shooter.
// You are a developer in a rolling office chair, laptop on your legs,
// blasting incoming Jira tickets before they land in your backlog.
// ======================================================================

// ---------------------------------------------------------------- canvas
// Internal pixel-art resolution. 640×360 lands on an exact integer upscale at
// every common display (2× at 720p, 3× at 1080p, 4× at 1440p, 6× at 4K), so
// pixels stay square and sharp. Raising this shrinks every element on screen
// and widens the arena — world speeds below are sized to match it.
const VW = 640, VH = 360;
const canvas = document.getElementById('game');
canvas.width = VW; canvas.height = VH;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  canvas.style.width = VW * s + 'px';
  canvas.style.height = VH * s + 'px';
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- helpers
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------- sprites
// Pixel-art sprites defined as character grids ('.' = transparent).
function sprite(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const k = rows[y][x];
      if (k !== '.' && pal[k]) { g.fillStyle = pal[k]; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}

// ------------------------------------------------------------ art palette
// "1a NEON DEADLINE" from the Pixel Art Lab design (claude.ai/design project
// "Developer Defense Game Concept"): dark office, glowing teal rim light.
// Kept verbatim, so it still carries the dev's original seat/shirt/skin/hair
// entries even though those are now picked on the CREATE YOUR DEV screen —
// what PAL owns is the world; what `look` owns is the person in the chair.
const PAL = {
  floor: '#141f38', floorLine: '#1d2c4d', outline: '#080c18',
  base: '#0f1a30', seat: '#6b4bd6', seatHi: '#a98cff', back: '#2a2140', rim: '#2fe4c8',
  shirt: '#28c9b0', shirtHi: '#5cf2d6', skin: '#f0b088', hair: '#241f34',
  laptop: '#1b2c4e', laptopHi: '#33507f', screen: '#5cf2d6',
  bug: '#ff5a6e', story: '#3fe08a', epic: '#a06bff', hp: '#3fe08a', hpBg: '#2a2140',
  paper: '#dfe6ff', gray: '#5a6a90', leaf: '#3fe08a', pot: '#c96a4a',
  letter: '#5cf2d6', cup: '#ff8a5c', desk: '#243a5e', deskHi: '#33507f', monitor: '#0b1120',
};

const cvOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rf = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const disc = (g, cx, cy, r, c, cond) => {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r * r && (!cond || cond(dx, dy))) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  }
};

// ------------------------------------------------------------- the dev's look
// Eight choices made on the CREATE YOUR DEV screen and remembered in
// localStorage. They drive both views of the same person: the 3/4 portrait on
// that screen, and the 34×34 top-down chair sprite you actually play as.
const SKINS  = ['#ffd9b3', '#f0b088', '#d69a6a', '#a86b43', '#71482c', '#4a2f1e'];
const HAIRC  = ['#2b1d12', '#5a3a22', '#a8642f', '#d9b45a', '#3a3a44', '#c94f6b', '#3f6fd0', '#e8e8f0'];
const HAIRS  = ['short', 'buzz', 'long', 'bun', 'mohawk', 'bald'];
const SHIRTS = ['#e0554f', '#3d9bff', '#2fbf62', '#ffb43d', '#8a63ff', '#20c9b0', '#2a2a33', '#f2f2f7'];
const PANTS  = ['#3a4a63', '#2a2a33', '#5a3a24', '#4f6f3a', '#7a3a5a'];
const CHAIRS = ['#ff8a3d', '#e0554f', '#3d9bff', '#2fbf62', '#8a63ff', '#2a2a33'];
const LAPS   = ['#c7d0dd', '#e0554f', '#2a2a33', '#8a63ff', '#20c9b0'];

// One row per option on the customizer: a strip of colors or a strip of words.
// `key` indexes into `look`; whichever list is present gives the value count.
const LOOK_GROUPS = [
  { key: 'skin',    label: 'SKIN',       colors: SKINS },
  { key: 'hairS',   label: 'HAIR',       words: ['SHORT', 'BUZZ', 'LONG', 'BUN', 'MOHAWK', 'BALD'] },
  { key: 'hairC',   label: 'HAIR COLOR', colors: HAIRC },
  { key: 'glasses', label: 'GLASSES',    words: ['NO', 'YES'] },
  { key: 'shirt',   label: 'SHIRT',      colors: SHIRTS },
  { key: 'pants',   label: 'PANTS',      colors: PANTS },
  { key: 'chair',   label: 'CHAIR',      colors: CHAIRS },
  { key: 'lap',     label: 'LAPTOP',     colors: LAPS },
];
const groupLen = (gr) => (gr.colors || gr.words).length;

let look = { skin: 1, hairS: 0, hairC: 1, glasses: 1, shirt: 1, pants: 0, chair: 0, lap: 0 };
try {
  // Every field is re-validated: a look saved by an older build may name an
  // index that no longer exists, and an out-of-range index draws nothing.
  const saved = JSON.parse(localStorage.getItem('jiraBlasterLook') || 'null');
  if (saved) for (const gr of LOOK_GROUPS) {
    const v = saved[gr.key];
    if (Number.isInteger(v) && v >= 0 && v < groupLen(gr)) look[gr.key] = v;
  }
} catch (e) { /* private mode, or a corrupt entry */ }

// '#rrggbb' darkened (f < 1) or lightened (f > 1). The whole dev is derived
// from the picked colors, so every shade of them comes from here.
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; } else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
}

// Developer in the chair, ported from the kit's personLocal() generator.
// Drawn facing up/north — the game rotates it by angle + π/2. Every material
// color comes from `look`; PAL keeps only the outline and the teal rim light,
// which belong to the art direction rather than to the person.
function buildDevImg(o) {
  const c = cvOf(34, 34), g = c.getContext('2d'), cx = 17, cy = 18;
  const skin = SKINS[o.skin];
  const hair = HAIRC[o.hairC], hairHi = shade(hair, 1.3), style = HAIRS[o.hairS];
  const shirt = SHIRTS[o.shirt], shirtHi = shade(shirt, 1.28);
  const chair = CHAIRS[o.chair], seatHi = shade(chair, 1.35);
  const base = shade(chair, 0.62), back = shade(chair, 0.4);
  const lap = LAPS[o.lap], lapHi = shade(lap, 1.35);

  disc(g, cx, cy, 13, back, (dx, dy) => dy >= 3);
  disc(g, cx, cy, 13, PAL.rim, (dx, dy) => dy >= 3 && dx * dx + dy * dy > 132);
  disc(g, cx, cy, 12, PAL.outline, (dx, dy) => dx * dx + dy * dy > 100);
  disc(g, cx, cy, 11, base);
  disc(g, cx, cy, 10, chair);
  disc(g, cx, cy, 10, seatHi, (dx, dy) => dy < 0 && dx * dx + dy * dy > 66);
  rf(g, cx - 12, cy - 1, 3, 5, base); rf(g, cx + 9, cy - 1, 3, 5, base);
  disc(g, cx, cy - 1, 8, PAL.outline, (dx, dy) => dx * dx + dy * dy > 40);
  disc(g, cx, cy - 1, 7, shirt);
  disc(g, cx, cy - 1, 7, shirtHi, (dx, dy) => dy < 0 && dx * dx + dy * dy > 34);
  rf(g, cx - 6, cy - 9, 3, 7, shirt); rf(g, cx + 3, cy - 9, 3, 7, shirt);
  rf(g, cx - 6, cy - 10, 3, 2, skin); rf(g, cx + 3, cy - 10, 3, 2, skin);
  // head: hair covers the back of the skull, the face peeks out to the north.
  // Long hair spills past the head's own outline, so it gets a wider one.
  if (style === 'long') {
    disc(g, cx, cy - 4, 6, PAL.outline, (dx, dy) => dy >= 0 && dx * dx + dy * dy > 20);
    disc(g, cx, cy - 4, 5, hair, (dx, dy) => dy >= 0);
  }
  disc(g, cx, cy - 4, 5, PAL.outline, (dx, dy) => dx * dx + dy * dy > 12);
  disc(g, cx, cy - 4, 4, style === 'bald' ? skin : style === 'buzz' ? shade(hair, 0.75) : hair);
  disc(g, cx, cy - 4, 4, skin, (dx, dy) => dy < -1);
  if (style === 'bun') disc(g, cx, cy + 1, 2, hairHi);         // knot at the back
  if (style === 'mohawk') rf(g, cx - 1, cy - 8, 2, 6, hairHi); // crest runs front-to-back
  if (o.glasses) rf(g, cx - 2, cy - 7, 5, 1, '#241a2e');       // one dark bar across the face
  rf(g, cx - 7, cy - 17, 14, 6, PAL.outline);
  rf(g, cx - 6, cy - 16, 12, 3, lap);
  rf(g, cx - 6, cy - 13, 12, 2, lapHi);
  rf(g, cx - 5, cy - 15, 10, 2, PAL.screen);
  disc(g, cx, cy, 11, PAL.rim, (dx, dy) => dy < -2 && dx * dx + dy * dy >= 108);
  return c;
}
let devImg = buildDevImg(look);

function applyLook() {
  devImg = buildDevImg(look);
  try { localStorage.setItem('jiraBlasterLook', JSON.stringify(look)); } catch (e) { /* private mode */ }
}
function setLook(key, v) { look[key] = v; applyLook(); }
function randomizeLook() {
  for (const gr of LOOK_GROUPS) look[gr.key] = Math.floor(Math.random() * groupLen(gr));
  applyLook();
}

// ---------------------------------------------------------------- portrait
// The same dev seen from the front, for the CREATE YOUR DEV screen — ported
// from the Player Customizer's character() generator. Draws into a 100×120
// box at `a` radians of turn (0 = facing the camera); the screen upscales it.
// This is the only place pants and glasses are legible, so it is the
// one view that shows every option.
function drawAvatar(g, a, o) {
  const S = Math.sin(a), C = Math.cos(a);
  const OUT = '#1c1320';
  const CX = 50;
  const skin = SKINS[o.skin], skinS = shade(skin, 0.78);
  const hair = HAIRC[o.hairC], hairS = shade(hair, 0.72);
  const shirt = SHIRTS[o.shirt], shirtS = shade(shirt, 0.78), shirtH = shade(shirt, 1.2);
  const pants = PANTS[o.pants], pantsS = shade(pants, 0.78);
  const chair = CHAIRS[o.chair], chairS = shade(chair, 0.74), chairH = shade(chair, 1.25);
  const lap = LAPS[o.lap], lapS = shade(lap, 0.74), lapH = shade(lap, 1.3);

  const poly = (pts, c, oc) => {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); if (oc) { g.strokeStyle = oc; g.lineWidth = 1.6; g.stroke(); } g.fillStyle = c; g.fill();
  };
  const oval = (cx, cy, r, c, oc) => { g.beginPath(); g.arc(cx, cy, r, 0, 7); if (oc) { g.strokeStyle = oc; g.lineWidth = 1.6; g.stroke(); } g.fillStyle = c; g.fill(); };
  const rrect = (px, py, w, h, r, c, oc) => {
    g.beginPath(); g.moveTo(px + r, py);
    g.arcTo(px + w, py, px + w, py + h, r); g.arcTo(px + w, py + h, px, py + h, r);
    g.arcTo(px, py + h, px, py, r); g.arcTo(px, py, px + w, py, r); g.closePath();
    if (oc) { g.strokeStyle = oc; g.lineWidth = 1.6; g.stroke(); } g.fillStyle = c; g.fill();
  };

  // anchors
  const shoulderR = 15, hipR = 11, backOff = 9;
  const shoulderY = 46, hipY = 66, baseY = 99;
  const fwdX = S; // screen-x per unit of body-forward
  // Comfy recline: the torso leans back into the backrest — hips stay put,
  // shoulders sit `lean` px behind them (against facing), the head a bit more.
  const lean = 6;
  const topX = CX - fwdX * lean;
  const rShX = topX + shoulderR * C, lShX = topX - shoulderR * C;
  const rHipX = CX + hipR * C, lHipX = CX - hipR * C;
  const isBack = C < -0.02;

  // ---- chair base (5-star, rotates) ----
  // Screen y points down, so `+a` would walk the star clockwise seen from
  // above — while the body's fwdX = sin(a) turn is counter-clockwise. The
  // customizer shipped with that mismatch (base visibly counter-spinning the
  // person); the star takes -a so both rotate together.
  const legs = [];
  for (let i = 0; i < 5; i++) {
    const ang = i * (Math.PI * 2 / 5) - a;
    legs.push({ dx: Math.cos(ang), dy: Math.sin(ang) });
  }
  legs.sort((p, q) => p.dy - q.dy);
  for (const l of legs) {
    const ex = CX + l.dx * 26, ey = baseY + l.dy * 9;
    g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(CX, baseY); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = chairS; g.lineWidth = 3.5; g.beginPath(); g.moveTo(CX, baseY); g.lineTo(ex, ey); g.stroke();
    oval(ex, ey + 1, 3.2, OUT); oval(ex, ey + 0.5, 2.2, shade(chair, 0.6));
  }
  // ---- gas cylinder + seat ----
  // One unit, called from the paint-order block: the back view draws the legs
  // first and lets this cover everything above the knee.
  const drawSeat = () => {
    rrect(CX - 3, hipY + 4, 6, baseY - hipY - 3, 1.5, chairS, OUT);
    g.fillStyle = chairH; g.fillRect(CX - 2, hipY + 5, 1.6, baseY - hipY - 5);
    g.save(); g.translate(CX, hipY + 2); g.scale(1, 0.5);
    oval(0, 0, 18, chair, OUT); g.restore();
    g.save(); g.translate(CX, hipY + 1); g.scale(1, 0.5); oval(0, 0, 16, chairH); g.restore();
  };

  const drawBackrest = () => {
    const bx = CX - fwdX * backOff;
    const bw = 10 + 14 * Math.abs(C);
    const top = shoulderY - 6, h = hipY - top + 2;
    // tilted back around its base, so the recline is the chair's, not a slouch
    g.save();
    g.translate(bx, hipY); g.rotate(-fwdX * 0.14); g.translate(-bx, -hipY);
    rrect(bx - bw / 2, top, bw, h, 5, chairS, OUT);
    rrect(bx - bw / 2 + 2, top + 2, Math.max(2, bw - 4), h - 4, 4, chair);
    g.fillStyle = chairH; g.fillRect(bx - bw / 2 + 3, top + 3, Math.max(1, bw * 0.16), h - 6);
    // lumbar seam
    g.fillStyle = chairS; g.fillRect(bx - bw / 2 + 2, top + h / 2, Math.max(2, bw - 4), 1);
    // headrest pad
    rrect(bx - bw / 2 + 1, top - 8, Math.max(3, bw - 2), 7, 3, chairS, OUT);
    g.restore();
  };

  const drawLegs = () => {
    // Seated at a true right angle: the thigh runs level along body-forward,
    // the shin drops straight down from the knee. (The customizer projected
    // the legs through a sagittal transform whose fSY = 0.6 sloped the thigh
    // ~35° toward the floor, so the knee never read as 90° on screen.)
    const thighLen = 17, shinLen = 21;
    for (const sgn of [-1, 1]) {
      const hipx = CX + sgn * hipR * C;
      const hipy = hipY - 2;
      const kx = hipx + thighLen * fwdX * 0.95 + sgn * 4 * C;
      const ky = hipy + 4 + 2 * Math.abs(C); // a small foreshortening drop, not a slope
      const fx = kx;
      const fy = ky + shinLen;
      // thigh
      g.lineCap = 'round';
      g.strokeStyle = OUT; g.lineWidth = 11; g.beginPath(); g.moveTo(hipx, hipy); g.lineTo(kx, ky); g.stroke();
      g.strokeStyle = pants; g.lineWidth = 8; g.beginPath(); g.moveTo(hipx, hipy); g.lineTo(kx, ky); g.stroke();
      g.strokeStyle = pantsS; g.lineWidth = 2.5; g.beginPath(); g.moveTo(hipx, hipy); g.lineTo(kx, ky); g.stroke();
      // shin
      g.strokeStyle = OUT; g.lineWidth = 9; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = pantsS; g.lineWidth = 6; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      // knee cap highlight
      oval(kx, ky, 2, pants, OUT);
      // shoe (points forward)
      const toe = fwdX >= 0 ? 1 : -1;
      rrect(Math.min(fx, fx + toe * 4) - 3, fy - 2, 7 + Math.abs(S) * 3, 5, 2, '#2f2740', OUT);
    }
    g.lineCap = 'butt';
  };

  const drawTorso = () => {
    poly([[lShX, shoulderY], [rShX, shoulderY], [rHipX + 1, hipY], [lHipX - 1, hipY]], shirt, OUT);
    // shading on far side + center seam
    const litSgn = S >= 0 ? 1 : -1;
    g.fillStyle = shirtS;
    poly([[topX, shoulderY], [Math.max(rShX, lShX), shoulderY], [rHipX + 1, hipY], [CX, hipY]], (litSgn > 0 ? shirtS : shirt));
    g.fillStyle = shirtH; g.fillRect(topX - 6 * Math.abs(C), shoulderY + 2, 2, 14);
    // collar
    rrect(topX - 4 * Math.abs(C) - 1, shoulderY - 2, 8 * Math.abs(C) + 2, 4, 1.5, shirtS, OUT);
  };

  const drawArms = () => {
    // Two segments with a real elbow at 90°: the upper arm hangs straight
    // down from the reclined shoulder, the forearm runs LEVEL to the hands on
    // the laptop — elbow and hands share a height. The source drew one
    // straight shoulder-to-hand stick, which left the arms stubby and
    // elbow-less.
    for (const sgn of [-1, 1]) {
      const shx = topX + sgn * shoulderR * C * 0.9;
      const shy = shoulderY + 3;
      const hy = hipY - 6;
      const ex = shx - fwdX * 2 + sgn * 1.5 * C;   // elbow, tucked slightly back
      const ey = hy;                               // same height as the hands = 90°
      const hx = CX + fwdX * 12 + sgn * 6 * C;     // hand on the keyboard
      g.lineCap = 'round';
      // upper arm (sleeve)
      g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.moveTo(shx, shy); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = shirt; g.lineWidth = 5.5; g.beginPath(); g.moveTo(shx, shy); g.lineTo(ex, ey); g.stroke();
      // forearm (shaded sleeve, slightly thinner — gives the elbow its bend)
      g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = shirtS; g.lineWidth = 4.5; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx, hy); g.stroke();
      oval(hx, hy, 2.6, skin, OUT); // hand
    }
    g.lineCap = 'butt';
  };

  const drawLaptop = () => {
    const cx2 = CX + fwdX * 13;
    const ly = hipY - 7;
    const lw = 7 + 20 * Math.abs(C);
    // base/keyboard deck (tilted)
    poly([[cx2 - lw / 2, ly + 6], [cx2 + lw / 2, ly + 6], [cx2 + lw / 2 - 1, ly + 10], [cx2 - lw / 2 + 1, ly + 10]], lapS, OUT);
    // lid (back faces camera when front)
    rrect(cx2 - lw / 2, ly - 8, lw, 14, 2, lap, OUT);
    if (C > 0.15) { oval(cx2, ly - 1, 2.2, lapH); } // logo on back
    else if (C < -0.15) { g.fillStyle = '#8fe6ff'; g.fillRect(cx2 - lw / 2 + 2, ly - 6, Math.max(1, lw - 4), 10); }
    g.fillStyle = lapH; g.fillRect(cx2 - lw / 2 + 1, ly - 7, Math.max(1, lw * 0.12), 12);
  };

  const drawHead = () => {
    // rests back with the recline — a touch further than the shoulders
    g.save(); g.translate(-fwdX * (lean + 3), 0);
    // hy puts the neck's bottom edge exactly on the torso top (shoulderY):
    // (hy + hr - 2) + 6 = 46 — no gap between neck and shirt
    const hy = 31, hr = 11;
    const faceShift = S * 5;
    oval(CX, hy, hr, skin, OUT);
    // ear on trailing side
    if (Math.abs(S) > 0.25) { const es = S > 0 ? -1 : 1; oval(CX + es * (hr - 1), hy + 1, 2.4, skinS, OUT); }
    if (isBack) {
      // back of head: hair blob
      hairShape(g, oval, rrect, CX, hy, hr, hair, hairS, OUT, o.hairS, 'back', C, S);
    } else {
      // eyes
      const eyeC = '#241a2e';
      const sep = 3.4 * Math.abs(C) + 0.6;
      const ecx = CX + faceShift, ey = hy - 1;
      if (o.glasses) {
        g.strokeStyle = '#241a2e'; g.lineWidth = 1.2;
        g.strokeRect(ecx - sep - 2.4, ey - 1.6, 3.2, 3.2);
        if (sep > 1.2) g.strokeRect(ecx + sep - 0.8, ey - 1.6, 3.2, 3.2);
        g.beginPath(); g.moveTo(ecx - sep + 0.8, ey); g.lineTo(ecx + sep - 0.8, ey); g.stroke();
        g.fillStyle = eyeC; g.fillRect(ecx - sep - 1, ey, 1.4, 1.4); if (sep > 1.2) g.fillRect(ecx + sep + 0.4, ey, 1.4, 1.4);
      } else {
        g.fillStyle = eyeC; g.fillRect(ecx - sep - 0.7, ey - 0.5, 1.6, 2); if (sep > 1) g.fillRect(ecx + sep - 0.9, ey - 0.5, 1.6, 2);
      }
      // brows
      g.fillStyle = hairS; g.fillRect(ecx - sep - 1.4, ey - 3, 2.4, 1); if (sep > 1.2) g.fillRect(ecx + sep - 1, ey - 3, 2.4, 1);
      // nose (profile bump)
      if (Math.abs(S) > 0.5) { const ns = S > 0 ? 1 : -1; g.fillStyle = skinS; g.fillRect(CX + ns * (hr - 1), hy, 2, 2); }
      // mouth
      g.fillStyle = skinS; g.fillRect(ecx - 1.6, hy + 4, 3.4, 1);
      // hair (front)
      hairShape(g, oval, rrect, CX, hy, hr, hair, hairS, OUT, o.hairS, 'front', C, S);
    }
    // neck
    g.fillStyle = skinS; g.fillRect(CX - 2.5, hy + hr - 2, 5, 6);
    g.restore();
  };

  // ---- paint order ----
  // Facing away, the legs point beyond the chair: drawn first, under the
  // cylinder and seat, so the thighs disappear behind the chair and only the
  // shins hang into view below the seat. Facing us, they go on top as usual.
  if (isBack) drawLegs();
  drawSeat();
  if (!isBack) drawBackrest();
  if (!isBack) drawLegs();
  drawTorso();
  drawArms();
  drawHead();
  if (C > -0.02) drawLaptop();
  if (isBack) drawBackrest();
}

// `style` is an index into HAIRS. The customizer passed that index straight
// into name comparisons, so every style silently rendered as 'short'; resolving
// it here is the one deliberate change to the ported art.
function hairShape(g, oval, rrect, CX, hy, hr, hair, hairS, OUT, style, side, C, S) {
  const fs = S * 5;
  if (HAIRS[style] === 'bald') return;
  if (side === 'back') {
    if (HAIRS[style] === 'buzz') { oval(CX, hy - 1, hr, hairS); return; }
    oval(CX, hy - 1, hr + 0.5, hair, OUT);
    if (HAIRS[style] === 'long') { rrect(CX - hr, hy, hr * 2, 12, 3, hair, OUT); }
    if (HAIRS[style] === 'bun') { oval(CX, hy - hr - 1, 3.5, hairS, OUT); }
    if (HAIRS[style] === 'mohawk') { g.fillStyle = hairS; g.fillRect(CX - 1.5, hy - hr - 4, 3, 6); }
    return;
  }
  // front hair caps the top of the face
  if (HAIRS[style] === 'buzz') {
    g.fillStyle = hairS; g.beginPath(); g.arc(CX + fs * 0.5, hy - 1, hr - 0.5, Math.PI, 0); g.fill(); return;
  }
  g.fillStyle = hair; g.beginPath(); g.arc(CX + fs * 0.4, hy - 1, hr + 0.5, Math.PI + 0.3, -0.3); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.arc(CX + fs * 0.4, hy - 1, hr + 0.5, Math.PI + 0.3, -0.3); g.stroke();
  // fringe
  g.fillStyle = hair; g.fillRect(CX + fs - 4, hy - hr + 2, 8, 3);
  if (HAIRS[style] === 'long') { rrect(CX - hr - 0.5, hy - 2, 3, 13, 1.5, hairS, OUT); rrect(CX + hr - 2.5, hy - 2, 3, 13, 1.5, hairS, OUT); }
  if (HAIRS[style] === 'bun') { oval(CX - S * 3, hy - hr - 1, 3.2, hairS, OUT); }
  if (HAIRS[style] === 'mohawk') { g.fillStyle = hairS; g.fillRect(CX + fs - 1.5, hy - hr - 4, 3, 6); }
}

// Jira ticket cards in the kit's language: outlined paper card, colored
// header band, grey title lines, size pips. Size IS the threat tier.
function ticketCard(w, h, color, pips) {
  const c = cvOf(w, h), g = c.getContext('2d');
  rf(g, 0, 0, w, h, PAL.outline);
  rf(g, 1, 1, w - 2, h - 2, PAL.paper);
  rf(g, 1, 1, w - 2, 2, color);
  rf(g, 2, 5, w - 4, 1, PAL.gray);
  if (h > 11) rf(g, 2, 7, w - 6, 1, PAL.gray);
  for (let i = 0; i < pips; i++) rf(g, 2 + i * 3, h - 4, 2, 2, color);
  return c;
}

// Top-down coffee mug from the kit (HP cups + pickup).
const coffeeImg = (() => {
  const c = cvOf(9, 9), g = c.getContext('2d');
  disc(g, 4, 4, 4, PAL.outline);
  disc(g, 4, 4, 3, PAL.cup);
  disc(g, 4, 4, 2, '#3a251a');
  rf(g, 3, 2, 1, 1, PAL.rim);
  rf(g, 8, 3, 1, 3, PAL.outline);
  rf(g, 7, 4, 1, 1, PAL.cup);
  return c;
})();

// 3×5 code-glyph font from the kit — the bullets are literal letter-streams.
const FONT = {
  '{': ['011', '010', '110', '010', '011'], '}': ['110', '010', '011', '010', '110'],
  ';': ['010', '000', '000', '010', '100'], '<': ['001', '010', '100', '010', '001'],
  '>': ['100', '010', '001', '010', '100'], '/': ['001', '001', '010', '100', '100'],
  '(': ['011', '100', '100', '100', '011'], ')': ['110', '001', '001', '001', '110'],
  '=': ['000', '111', '000', '111', '000'],
};
// Areas & weapons: every ticket belongs to an area (left-edge stripe);
// weapons are languages (keys 1/2/3) that recolor the letters. Letter color
// matching the stripe color = double damage. One glance = the matchup.
const AREAS = {
  fe:    { color: '#ff5a6e' },   // Frontend — red
  be:    { color: '#3fe08a' },   // Backend — green
  infra: { color: '#5c9dff' },   // Infrastructure — blue
};
const AREA_KEYS = Object.keys(AREAS);
const LANGS = [
  { name: 'HTML', area: 'fe',    color: AREAS.fe.color },
  { name: 'NODE', area: 'be',    color: AREAS.be.color },
  { name: 'GO',   area: 'infra', color: AREAS.infra.color },
];

const GLYPHS = Object.keys(FONT);
const GLYPH_IMG = LANGS.map((L) => {
  const set = {};
  for (const ch of GLYPHS) {
    const c = cvOf(5, 7), g = c.getContext('2d');
    const plot = (ox, oy, col) => {
      for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++)
        if (FONT[ch][r][k] === '1') rf(g, ox + k, oy + r, 1, 1, col);
    };
    plot(0, 1, PAL.outline); plot(2, 1, PAL.outline); plot(1, 2, PAL.outline);
    plot(1, 1, L.color);
    set[ch] = c;
  }
  return set;
});

const canImg = sprite([
  '.gggg.',
  '.cccc.',
  '.cycc.',
  '.ccyc.',
  '.cycc.',
  '.cccc.',
  '.gggg.',
], { g: '#8f8fa8', c: '#06b6d4', y: '#ffd23f' });

const duckImg = sprite([
  '....yyy..',
  '...yyyyy.',
  '...yeyyoo',
  'yy.yyyyo.',
  'yyyyyyyy.',
  '.yyyyyyy.',
  '..yyyyy..',
  '...yyy...',
], { y: '#ffd23f', e: '#1c1c1c', o: '#ff8a5c' });

// Office props from the kit (background decor only — nothing collides).
const plantImg = (() => {
  const c = cvOf(16, 20), g = c.getContext('2d');
  rf(g, 5, 12, 6, 7, PAL.outline); rf(g, 6, 13, 4, 5, PAL.pot);
  rf(g, 6, 13, 4, 1, PAL.rim); rf(g, 6, 15, 4, 1, PAL.outline);
  const L = PAL.leaf;
  rf(g, 7, 3, 2, 10, L); rf(g, 4, 5, 2, 6, L); rf(g, 10, 5, 2, 6, L);
  rf(g, 5, 7, 2, 5, L); rf(g, 9, 7, 2, 5, L); rf(g, 6, 4, 1, 1, L); rf(g, 9, 4, 1, 1, L);
  rf(g, 7, 2, 1, 1, PAL.rim); rf(g, 4, 5, 1, 1, PAL.outline); rf(g, 11, 5, 1, 1, PAL.outline);
  return c;
})();

const whiteboardImg = (() => {
  const c = cvOf(26, 16), g = c.getContext('2d');
  rf(g, 1, 1, 24, 12, PAL.outline); rf(g, 2, 2, 22, 10, PAL.paper);
  rf(g, 3, 3, 10, 1, PAL.gray); rf(g, 3, 5, 14, 1, PAL.gray); rf(g, 3, 7, 8, 1, PAL.gray);
  rf(g, 17, 5, 6, 5, PAL.outline); rf(g, 18, 6, 4, 3, PAL.story);
  rf(g, 2, 13, 22, 2, PAL.outline);
  return c;
})();

const deskImg = (() => {
  const c = cvOf(28, 18), g = c.getContext('2d');
  rf(g, 1, 3, 26, 13, PAL.outline); rf(g, 2, 4, 24, 11, PAL.desk);
  rf(g, 2, 4, 24, 1, PAL.deskHi);
  rf(g, 9, 2, 10, 6, PAL.outline); rf(g, 10, 3, 8, 4, PAL.screen);
  rf(g, 13, 8, 2, 1, PAL.outline);
  rf(g, 9, 11, 10, 3, PAL.outline); rf(g, 10, 12, 8, 1, PAL.laptop);
  for (let x = 10; x < 18; x += 2) rf(g, x, 12, 1, 1, PAL.deskHi);
  rf(g, 21, 11, 2, 3, PAL.outline); rf(g, 21, 12, 1, 1, PAL.laptop);
  return c;
})();

const IMG = {
  bug: ticketCard(8, 10, PAL.bug, 1),        // S — red
  story: ticketCard(11, 14, PAL.story, 2),   // M — green
  hotfix: ticketCard(8, 10, PAL.cup, 1),     // flashing orange
  epic: (() => {                             // L — purple, kit's full card layout
    const c = cvOf(22, 28), g = c.getContext('2d');
    rf(g, 0, 0, 22, 28, PAL.outline);
    rf(g, 1, 1, 20, 26, PAL.paper);
    rf(g, 1, 1, 20, 5, PAL.epic);
    rf(g, 10, 9, 2, 1, PAL.epic); rf(g, 9, 10, 4, 1, PAL.epic);   // diamond icon
    rf(g, 8, 11, 6, 2, PAL.epic); rf(g, 9, 13, 4, 1, PAL.epic); rf(g, 10, 14, 2, 1, PAL.epic);
    rf(g, 3, 17, 16, 1, PAL.gray); rf(g, 3, 19, 12, 1, PAL.gray);
    for (let i = 0; i < 3; i++) rf(g, 3 + i * 3, 22, 2, 2, PAL.epic);
    return c;
  })(),
  meeting: (() => {                          // grey calendar invite — non-lethal cover
    const c = cvOf(10, 8), g = c.getContext('2d');
    rf(g, 0, 0, 10, 8, PAL.outline);
    rf(g, 1, 1, 8, 6, PAL.paper);
    rf(g, 1, 1, 8, 2, PAL.gray);
    for (let y = 4; y <= 6; y += 2) for (let x = 2; x <= 7; x += 2) rf(g, x, y, 1, 1, PAL.gray);
    return c;
  })(),

  // ---- bosses: oversized tickets, same visual language (outline, paper body,
  // colored header band) so a boss still reads as a ticket — a monstrous one.
  monolith: (() => {                         // stacked strata of a codebase nobody dares touch
    const c = cvOf(34, 42), g = c.getContext('2d');
    rf(g, 0, 0, 34, 42, PAL.outline);
    rf(g, 1, 1, 32, 40, PAL.paper);
    rf(g, 1, 1, 32, 6, '#5a6a90');
    const strata = ['#8fa8d8', '#6f86b4', '#566a90', '#41506e'];
    for (let i = 0; i < 4; i++) rf(g, 3, 10 + i * 7, 28, 5, strata[i]);
    rf(g, 10, 10, 1, 26, PAL.outline); rf(g, 21, 10, 1, 26, PAL.outline); // cracks
    rf(g, 3, 23, 28, 1, PAL.outline);
    for (let i = 0; i < 3; i++) rf(g, 3 + i * 4, 38, 3, 2, '#5a6a90');
    return c;
  })(),
  screep: (() => {                           // arrows shoving outward in every direction
    const c = cvOf(22, 28), g = c.getContext('2d');
    rf(g, 0, 0, 22, 28, PAL.outline);
    rf(g, 1, 1, 20, 26, PAL.paper);
    rf(g, 1, 1, 20, 5, PAL.bug);
    rf(g, 10, 9, 2, 12, PAL.bug); rf(g, 5, 14, 12, 2, PAL.bug);
    rf(g, 9, 8, 4, 1, PAL.bug); rf(g, 9, 21, 4, 1, PAL.bug);
    rf(g, 4, 13, 1, 4, PAL.bug); rf(g, 17, 13, 1, 4, PAL.bug);
    rf(g, 3, 24, 16, 1, PAL.gray);
    return c;
  })(),
  conflict: (() => {                         // <<<< and >>>> facing off across a divider
    const c = cvOf(18, 24), g = c.getContext('2d');
    rf(g, 0, 0, 18, 24, PAL.outline);
    rf(g, 1, 1, 16, 22, PAL.paper);
    rf(g, 1, 1, 16, 4, PAL.story);
    for (let i = 0; i < 3; i++) {
      rf(g, 4 + i * 2, 8, 1, 1, PAL.story); rf(g, 3 + i * 2, 9, 1, 1, PAL.story); rf(g, 4 + i * 2, 10, 1, 1, PAL.story);
    }
    rf(g, 3, 13, 12, 1, PAL.outline);
    for (let i = 0; i < 3; i++) {
      rf(g, 9 + i * 2, 16, 1, 1, PAL.bug); rf(g, 10 + i * 2, 17, 1, 1, PAL.bug); rf(g, 9 + i * 2, 18, 1, 1, PAL.bug);
    }
    return c;
  })(),
  mtgboss: (() => {                          // a wall-sized recurring invite
    const c = cvOf(38, 30), g = c.getContext('2d');
    rf(g, 0, 0, 38, 30, PAL.outline);
    rf(g, 1, 1, 36, 28, PAL.paper);
    rf(g, 1, 1, 36, 5, PAL.gray);
    rf(g, 7, 0, 2, 4, PAL.outline); rf(g, 29, 0, 2, 4, PAL.outline); // binder rings
    for (let y = 9; y <= 25; y += 4) for (let x = 3; x <= 33; x += 4) rf(g, x, y, 2, 2, '#c3cbe0');
    return c;
  })(),
  outage: (() => {                           // one enormous exclamation between siren bars
    const c = cvOf(24, 30), g = c.getContext('2d');
    rf(g, 0, 0, 24, 30, PAL.outline);
    rf(g, 1, 1, 22, 28, PAL.paper);
    rf(g, 1, 1, 22, 5, PAL.cup);
    rf(g, 10, 9, 4, 12, PAL.cup); rf(g, 10, 23, 4, 3, PAL.cup);
    rf(g, 3, 8, 2, 18, '#ff5a6e'); rf(g, 19, 8, 2, 18, '#ff5a6e');
    return c;
  })(),
  flaky: (() => {                            // a check mark that never quite commits
    const c = cvOf(20, 26), g = c.getContext('2d');
    rf(g, 0, 0, 20, 26, PAL.outline);
    rf(g, 1, 1, 18, 24, PAL.paper);
    rf(g, 1, 1, 18, 5, PAL.epic);
    rf(g, 5, 15, 2, 2, PAL.epic); rf(g, 7, 17, 2, 2, PAL.epic);
    rf(g, 9, 15, 2, 2, PAL.epic); rf(g, 11, 12, 2, 2, PAL.epic); rf(g, 13, 10, 2, 2, PAL.epic);
    rf(g, 3, 21, 14, 1, PAL.gray);
    return c;
  })(),
};

// ---------------------------------------------------------------- office floor
const bgCanvas = (() => {
  const c = cvOf(VW, VH), g = c.getContext('2d');
  let seed = 1337;
  const R = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // office floor per the kit: dark navy with a tile grid
  rf(g, 0, 0, VW, VH, PAL.floor);
  g.strokeStyle = PAL.floorLine;
  g.lineWidth = 1;
  for (let x = 0; x <= VW; x += 22) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, VH); g.stroke(); }
  for (let y = 0; y <= VH; y += 22) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(VW, y + 0.5); g.stroke(); }
  // a few accented tiles + carpet lint, scaled to the floor area
  g.globalAlpha = 0.3;
  for (let i = 0; i < 25; i++) rf(g, Math.floor(R() * (VW / 22)) * 22 + 1, Math.floor(R() * (VH / 22)) * 22 + 1, 21, 21, PAL.floorLine);
  g.globalAlpha = 1;
  for (let i = 0; i < 70; i++) rf(g, Math.floor(R() * VW), Math.floor(R() * VH), 1, 1, R() < 0.5 ? PAL.floorLine : PAL.base);
  // furniture around the edges (decor only — nothing collides)
  g.drawImage(plantImg, 8, 30); g.drawImage(plantImg, VW - 24, 30);
  // no plant bottom-left: that corner belongs to the weapon bar and the
  // AUTO-AIM / AUTO-SHOOT lines, and decor behind them kills legibility.
  g.drawImage(plantImg, VW - 24, VH - 24);
  g.drawImage(deskImg, 64, 4); g.drawImage(deskImg, VW - 120, 4);
  g.drawImage(whiteboardImg, VW - 110, VH - 20);
  return c;
})();

// ---------------------------------------------------------------- audio
let actx = null, muted = false;
function initAudio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}
function beep(f0, f1, dur, type, vol, at) {
  if (!actx || muted) return;
  const t0 = actx.currentTime + (at || 0);
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(vol || 0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
const sfx = {
  shoot: () => beep(rnd(700, 900), 180, 0.06, 'square', 0.07),
  hit: () => beep(220, 160, 0.05, 'square', 0.1),
  crit: () => beep(880, 1320, 0.06, 'square', 0.1),
  kill: () => beep(520, 90, 0.16, 'sawtooth', 0.14),
  pickup: () => beep(660, 1100, 0.13, 'sine', 0.18),
  hurt: () => beep(160, 55, 0.28, 'sawtooth', 0.28),
  quack: () => beep(300, 200, 0.1, 'square', 0.2),
  ding: () => { beep(1320, 1280, 0.05, 'sine', 0.05); beep(1760, 1700, 0.07, 'sine', 0.04, 0.055); },
  siren: () => { beep(980, 380, 0.3, 'sawtooth', 0.12); beep(1240, 460, 0.26, 'sawtooth', 0.07, 0.09); },
  block: () => beep(150, 95, 0.07, 'square', 0.09),
  graze: () => beep(740, 1480, 0.09, 'sine', 0.09),
  epicDie: () => { beep(400, 30, 0.5, 'sawtooth', 0.3); beep(600, 60, 0.4, 'square', 0.2, 0.05); },
  wave: () => { beep(440, 440, 0.09, 'triangle', 0.16); beep(550, 550, 0.09, 'triangle', 0.16, 0.11); beep(660, 660, 0.14, 'triangle', 0.18, 0.22); },
  over: () => { beep(320, 40, 0.9, 'sawtooth', 0.25); beep(240, 30, 1.1, 'triangle', 0.2, 0.1); },
  bossIn: () => { beep(120, 60, 0.7, 'sawtooth', 0.3); beep(180, 90, 0.6, 'square', 0.16, 0.12); beep(90, 45, 0.9, 'triangle', 0.22, 0.26); },
  bossDown: () => { beep(220, 880, 0.5, 'square', 0.22); beep(330, 1320, 0.6, 'triangle', 0.18, 0.13); beep(440, 1760, 0.7, 'sine', 0.2, 0.27); },
};

// ---------------------------------------------------------------- input
const keys = {};
const mouse = { down: false };

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  initAudio();
  // The setup screen owns the keyboard — every printable key is text there, so
  // none of the shortcuts below (M, I, O, 1-3, P, R) may fire while typing.
  if (state === 'setup') { setupKey(e); return; }
  if (k === 'm') muted = !muted;
  if (k === 'i' && state === 'play') {
    autoAim = !autoAim;
    addFloater(player.x, player.y - 16, 'AUTO-AIM ' + (autoAim ? 'ON' : 'OFF'), '#2fe4c8');
  }
  if (k === 'o' && state === 'play') {
    autoShoot = !autoShoot;
    addFloater(player.x, player.y - 16, 'AUTO-SHOOT ' + (autoShoot ? 'ON' : 'OFF'), '#2fe4c8');
  }
  if ((k === '1' || k === '2' || k === '3') && state === 'play') {
    lang = +k - 1;
    addFloater(player.x, player.y - 16, LANGS[lang].name + ' EQUIPPED', LANGS[lang].color);
  }
  if (k === 'p' || k === 'escape') {
    if (state === 'play') { paused = !paused; if (paused) loadBoard(); }
  }
  if (k === 'r' && state === 'over') startGame();
  if (state === 'menu' && k === ' ') openSetup();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// Pointer → the 640×360 internal grid. The canvas is CSS-upscaled by a whole
// number, but the measured rect is the honest source — it also covers a zoomed
// page and a phone that scaled the canvas to fit.
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * VW / r.width, y: (e.clientY - r.top) * VH / r.height };
}

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (state === 'menu') { openSetup(); return; }
  if (state === 'setup') {
    // the click that opened the screen would land on whatever is under it
    if (menuT - setupShownAt < 0.4) return;
    const q = canvasPos(e);
    for (const h of setupHits) {
      if (q.x >= h.x && q.x <= h.x + h.w && q.y >= h.y && q.y <= h.y + h.h) { h.act(); return; }
    }
    return;
  }
  if (state === 'over') { if (overTimer > 0.8) startGame(); return; }
  mouse.down = true; // click/tap = fire along the current facing
});
addEventListener('pointerup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- state
let state = 'menu'; // 'menu' | 'setup' | 'play' | 'over'
let paused = false;
let autoAim = false, autoShoot = false; // assist toggles (I / O) — persist across runs
let lang = 0; // equipped language (keys 1/2/3) — persists across runs
let t = 0;              // in-game time
let menuT = 0;          // menu animation clock
let overTimer = 0;      // time since game over
let shake = 0;

let player, bullets, enemies, particles, floaters, pickups;
let sprint, phase, breakTimer, spawnQueue, spawnTimer, spawnInterval, meetingCd;
let combo, comboT, hitFreeze, culprit;
// The boss fight in progress: its live parts (Merge Conflict has two), the
// roster entry driving the name/colour, and the title card's fade timer.
let bossParts = [], bossDef = null, bossMaxHp = 0, bossBanner = 0;
let score = 0, kills = 0, clearMsg = '';
let high = 0;
try { high = parseInt(localStorage.getItem('jiraBlasterHigh') || '0', 10) || 0; } catch (e) { /* private mode */ }

// Name on the standup board: entered on the 'setup' screen, drawn above the
// chair in-game. Remembered so a returning dev just presses ENTER.
const NAME_MAX = 12;
const DEFAULT_NAME = 'DEV';
let playerName = '';
try { playerName = (localStorage.getItem('jiraBlasterName') || '').slice(0, NAME_MAX); } catch (e) { /* private mode */ }
let nameInput = playerName;
let setupShownAt = 0;  // menuT when the screen opened — swallows the click that opened it
let setupRow = 0;      // which LOOK_GROUPS row the arrow keys are on
const setupHits = [];  // click targets, rebuilt by drawSetup() every frame

// The single most important tuning knob: chair turn rate vs. telegraph time.
// π rad/s → a worst-case 180° aim takes 1.0s; the 1.5s wind-up plus letter
// travel time keeps every death theoretically avoidable.
const CHAIR_TURN = Math.PI;   // rad/s
const WINDUP_TIME = 1.5;      // seconds-from-contact when a ticket flashes red
const CHAIN_WINDOW = 1.2;     // seconds between kills to keep the chain alive
const CHAIN_MAX = 8;
const GRAZE_PX = 8;           // near-miss distance that pays out

// Size IS the type — one glance = full information.
const ENEMY_TYPES = {
  bug:     { hp: 2,  sp: 56,  r: 4,  score: 10,  img: IMG.bug,     wobAmp: 0.9,  wobFreq: [5, 8] },  // S red: fast, erratic
  story:   { hp: 5,  sp: 29,  r: 6,  score: 25,  img: IMG.story,   wobAmp: 0,    wobFreq: [1, 1] },  // M green: straight line
  epic:    { hp: 15, sp: 15,  r: 12, score: 300, img: IMG.epic,    wobAmp: 0.1,  wobFreq: [1, 2] },  // L purple: splits on death
  hotfix:  { hp: 3,  sp: 104, r: 5,  score: 75,  img: IMG.hotfix,  wobAmp: 0.05, wobFreq: [2, 3] },  // orange: screams in, no wind-up
  meeting: { hp: 1,  sp: 19,  r: 9,  score: 0,   img: IMG.meeting, wobAmp: 0,    wobFreq: [1, 1], scale: 2 }, // grey: ∞ HP, blocks letters

  // Bosses. Ordinary enemies plus a small state machine, so collision, letters,
  // graze and separation all work on them unchanged — see bossBehave().
  monolith: { hp: 130, sp: 9,  r: 17, score: 3000, img: IMG.monolith, wobAmp: 0.05, wobFreq: [1, 1], boss: 'monolith' },
  screep:   { hp: 55,  sp: 24, r: 10, score: 2600, img: IMG.screep,   wobAmp: 0.2,  wobFreq: [2, 3], boss: 'screep' },
  conflict: { hp: 42,  sp: 27, r: 9,  score: 1400, img: IMG.conflict, wobAmp: 0.3,  wobFreq: [2, 4], boss: 'conflict' },
  mtgboss:  { hp: 70,  sp: 13, r: 16, score: 2800, img: IMG.mtgboss,  wobAmp: 0,    wobFreq: [1, 1], boss: 'mtgboss' },
  outage:   { hp: 75,  sp: 30, r: 12, score: 3200, img: IMG.outage,   wobAmp: 0,    wobFreq: [1, 1], boss: 'outage' },
  flaky:    { hp: 85,  sp: 44, r: 9,  score: 3000, img: IMG.flaky,    wobAmp: 0.7,  wobFreq: [3, 5], boss: 'flaky' },
};

// Every 5th sprint is a boss instead of a Sprint Planning burst: one named
// nightmare from the dev world, alone on screen — no edge burst, no meetings.
// The roster cycles, and each full lap makes them tougher.
const BOSSES = [
  { type: 'monolith', area: 'infra', color: '#8fa8d8', name: 'THE LEGACY MONOLITH', tag: 'opened 2009 · nobody knows what it does' },
  { type: 'screep',   area: 'fe',    color: '#ff5a6e', name: 'SCOPE CREEP',         tag: 'just one more little thing…' },
  { type: 'conflict', area: 'be',    color: '#3fe08a', name: 'MERGE CONFLICT',      tag: 'resolve both sides — together' },
  { type: 'mtgboss',  area: null,    color: '#b9c4dd', name: 'THE ENDLESS MEETING', tag: 'this could have been an email' },
  { type: 'outage',   area: 'infra', color: '#ff8a5c', name: 'P0 MEGAOUTAGE',       tag: 'prod is down. everyone is watching.' },
  { type: 'flaky',    area: 'be',    color: '#c9a8ff', name: 'THE FLAKY TEST',      tag: 'passes locally. sometimes.' },
];

const PAIN = ['PROD IS DOWN!', 'SCOPE CREEP!', 'MERGE CONFLICT!', 'P0! P0! P0!',
  'REGRESSION!', 'HOTFIX TIME!', 'BLOCKED!', 'IT WORKED LOCALLY…'];

// What Scope Creep says every time it grows another limb.
const CREEP = ['…AND A DARK MODE', '…AND ON MOBILE TOO', '…CAN IT BE REALTIME?',
  '…ALSO EXPORT TO PDF', '…AND AN AI FEATURE', '…SMALL CHANGE, PROMISE'];

// ---------------------------------------------------------------- leaderboard
// The standup board lives in Cloudflare D1 behind a Pages Function; the game
// only ever POSTs one run and draws what comes back. Every failure path just
// draws a line of text — the game never waits on the network.
const SCORES_URL = '/api/jira-blaster/scores';
const BOARD_TIMEOUT = 6000;
let board = null;    // null | { status: 'sending' | 'ok' | 'error', rows, rank }
let boardGen = 0;    // ignores a slow reply from an earlier run
let boardAt = -1e9;  // menuT of the last good read — the pause screen reuses it

// Read-only board, for the pause screen: the same rows the death screen draws,
// without recording anything. `rank` stays null — it belongs to a finished run.
function loadBoard() {
  if (AUTOTEST) return;
  if (!/^https?:$/.test(location.protocol)) {        // opened from disk: no API
    board = { status: 'error', rows: [], rank: null };
    return;
  }
  if (board && board.status === 'sending') return;
  if (board && board.status === 'ok' && menuT - boardAt < 20) return; // fresh enough

  const gen = ++boardGen;
  board = { status: 'sending', rows: [], rank: null };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), BOARD_TIMEOUT);
  fetch(SCORES_URL, { signal: ctl.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((d) => {
      if (gen !== boardGen) return;
      board = { status: 'ok', rows: d.top || [], rank: null };
      boardAt = menuT;
    })
    .catch(() => {
      if (gen !== boardGen) return;
      board = { status: 'error', rows: [], rank: null };
    })
    .then(() => clearTimeout(timer));
}

function submitScore() {
  board = null;
  if (AUTOTEST) return;                              // never write to the live board
  // Nothing to record — but the board is still what the death screen owes you.
  if (!/^https?:$/.test(location.protocol) || score <= 0) { loadBoard(); return; }

  const gen = ++boardGen;
  board = { status: 'sending', rows: [], rank: null };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), BOARD_TIMEOUT);
  fetch(SCORES_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: playerName, score }),
    signal: ctl.signal,
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((d) => {
      if (gen !== boardGen) return;
      board = { status: 'ok', rows: d.top || [], rank: d.rank || null };
    })
    .catch(() => {
      if (gen !== boardGen) return;
      board = { status: 'error', rows: [], rank: null };
    })
    .then(() => clearTimeout(timer));
}

// '2026-07-23T12:34:56Z' → '2026-07-23 14:34' in the player's own timezone.
function fmtWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '').replace('T', ' ').slice(0, 16);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// ---------------------------------------------------------------- setup screen
function openSetup() {
  state = 'setup';
  setupShownAt = menuT;
}

function setupKey(e) {
  const k = e.key;
  if (k === 'Enter') { confirmSetup(); return; }
  if (k === 'Escape') { state = 'menu'; return; }
  if (k === 'Tab') { e.preventDefault(); randomizeLook(); return; }
  if (k === 'Backspace') { e.preventDefault(); nameInput = nameInput.slice(0, -1); return; }
  if (k === 'ArrowUp' || k === 'ArrowDown') {
    const n = LOOK_GROUPS.length;
    setupRow = (setupRow + (k === 'ArrowDown' ? 1 : n - 1)) % n;
    return;
  }
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    const gr = LOOK_GROUPS[setupRow], n = groupLen(gr);
    setLook(gr.key, (look[gr.key] + (k === 'ArrowRight' ? 1 : n - 1)) % n);
    return;
  }
  // one printable character per event; modifier combos stay with the browser
  if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && nameInput.length < NAME_MAX) {
    nameInput += k;
  }
}

function confirmSetup() {
  playerName = nameInput.trim() || DEFAULT_NAME;
  nameInput = playerName;
  try { localStorage.setItem('jiraBlasterName', playerName); } catch (e) { /* private mode */ }
  startGame();
}

function startGame() {
  state = 'play';
  paused = false;
  t = 0; shake = 0; score = 0; kills = 0; overTimer = 0; clearMsg = '';
  player = {
    x: VW / 2, y: VH / 2, vx: 0, vy: 0, angle: 0, r: 7,
    hp: 3, maxHp: 3, fireCd: 0, invuln: 0, rapidT: 0, duckT: 0, // 3 coffee cups, no passive regen
  };
  bullets = []; enemies = []; particles = []; floaters = []; pickups = [];
  sprint = 1; phase = 'break'; breakTimer = 2.5;
  spawnQueue = []; spawnTimer = 0; spawnInterval = 1; meetingCd = 6;
  combo = 1; comboT = 0; hitFreeze = 0; culprit = null;
  bossParts = []; bossDef = null; bossMaxHp = 0; bossBanner = 0;
}

// ---------------------------------------------------------------- sprints
// Escalating density, never new rules after sprint 3:
// sprint 1 = Bugs, 2 = +Stories (meetings start drifting in), 3 = +Epics & Hotfixes.
function buildSprint(n) {
  if (n % 5 === 0) return []; // boss sprint: the boss is the whole wave
  const q = [];
  const count = Math.min(6 + n * 3, 40);
  for (let i = 0; i < count; i++) {
    const w = [['bug', 10]];
    if (n >= 2) w.push(['story', 3 + n]);
    if (n >= 3) w.push(['hotfix', 1 + n * 0.35]);
    const total = w.reduce((s, e) => s + e[1], 0);
    let r = Math.random() * total;
    for (const [type, wt] of w) { r -= wt; if (r <= 0) { q.push(type); break; } }
  }
  if (n >= 3) {
    const epics = Math.min(1 + Math.floor((n - 3) / 3), 4);
    for (let i = 0; i < epics; i++) q.splice(Math.floor(Math.random() * (q.length + 1)), 0, 'epic');
  }
  return q;
}

function makeEnemy(type, x, y) {
  const def = ENEMY_TYPES[type];
  const e = {
    type, x, y,
    area: type === 'meeting' ? null : pick(AREA_KEYS),
    hp: def.hp, maxHp: def.hp,
    sp: def.sp * rnd(0.9, 1.1),
    r: def.r, score: def.score, img: def.img, scale: def.scale || 1,
    wobPhase: rnd(0, TAU), wobFreq: rnd(def.wobFreq[0], def.wobFreq[1]), wobAmp: def.wobAmp,
    touchCd: 0, spawnT: 0.4, windup: false, grazed: false, grazeArmed: false, vx: 0, vy: 0,
    boss: def.boss || null,
  };
  enemies.push(e);
  return e;
}

// ---------------------------------------------------------------- bosses
// Per-boss state, set after the HP scaling in spawnBoss so thresholds match.
function bossInit(e) {
  if (e.boss === 'monolith') { e.langT = 3.2; e.shedT = 4.5; e.shedStep = Math.round(e.maxHp / 7); e.nextShed = e.maxHp - e.shedStep; }
  if (e.boss === 'screep') { e.growT = 3; e.grown = 0; }
  if (e.boss === 'conflict') { e.reviveT = 0; e.twin = null; e.revive = null; }
  if (e.boss === 'mtgboss') { e.cycleT = 3; e.open = false; e.callT = 4; }
  if (e.boss === 'outage') { e.mode = 'aim'; e.phaseT = 1.6; e.dx = 0; e.dy = 0; }
  if (e.boss === 'flaky') { e.pass = true; e.phaseT = 1.7; }
}

function spawnBoss(n) {
  const step = Math.floor(n / 5) - 1;
  const def = BOSSES[step % BOSSES.length];
  const mul = 1 + 0.55 * Math.floor(step / BOSSES.length); // each full lap is meaner
  bossDef = def;
  bossParts = [];
  bossBanner = 2.8;

  const make = (x, y) => {
    const e = makeEnemy(def.type, x, y);
    e.hp = e.maxHp = Math.round(ENEMY_TYPES[def.type].hp * mul);
    e.score = Math.round(ENEMY_TYPES[def.type].score * mul);
    e.area = def.area;
    e.spawnT = 1.4;   // long materialize — the title card plays over it
    bossInit(e);
    bossParts.push(e);
    return e;
  };

  if (def.type === 'conflict') {
    const a = make(VW * 0.24, VH * 0.5), b = make(VW * 0.76, VH * 0.5);
    a.twin = b; b.twin = a;
  } else {
    make(VW / 2, 46);
  }
  bossMaxHp = bossParts.reduce((s, e) => s + e.maxHp, 0);
  sfx.bossIn();
  shake += 8;
}

// Minions a boss calls in. They are ordinary tickets, so the sprint is not
// clear until they are gone too.
function spawnMinion(type, from, n) {
  for (let k = 0; k < n; k++) {
    const a = rnd(0, TAU);
    const m = makeEnemy(type,
      clamp(from.x + Math.cos(a) * (from.r + 12), 12, VW - 12),
      clamp(from.y + Math.sin(a) * (from.r + 12), 12, VH - 12));
    m.spawnT = 0.45; // materializes with a flash — readable, not a cheap shot
  }
}

function shedDebt(e, n) {
  spawnMinion('bug', e, n);
  addFloater(e.x, e.y - e.r - 6, 'TECH DEBT!', '#8fa8d8');
}

// A Merge Conflict twin killed alone comes back at half strength.
function reviveTwin(e) {
  const src = e.revive;
  e.reviveT = 0; e.revive = null;
  if (!src) return;
  const t = makeEnemy('conflict',
    clamp(e.x + rnd(-70, 70), 24, VW - 24),
    clamp(e.y + rnd(-50, 50), 24, VH - 24));
  t.maxHp = src.maxHp;
  t.hp = src.hp;
  t.score = src.score;
  t.area = src.area;
  t.spawnT = 0.5;
  bossInit(t);
  t.reopens = src.reopens; // so the next reopen is weaker again
  t.twin = e; e.twin = t;
  bossParts.push(t);
  addFloater(t.x, t.y - 16, 'CONFLICT REOPENED!', '#ff5a6e', true);
  sfx.siren();
  shake += 5;
}

// Returns true when the boss moved itself this frame (skipping the generic seek).
function bossBehave(e, dt, ux, uy) {
  if (e.boss === 'monolith') {
    // the matchup keeps moving, so your language has to as well
    e.langT -= dt;
    if (e.langT <= 0) {
      e.langT = 3.2;
      e.area = AREA_KEYS[(AREA_KEYS.indexOf(e.area) + 1) % AREA_KEYS.length];
      const L = LANGS.find((l) => l.area === e.area);
      addFloater(e.x, e.y - e.r - 8, 'REFACTORED → ' + L.name, AREAS[e.area].color);
      sfx.ding();
    }
    e.shedT -= dt;
    if (e.shedT <= 0) { e.shedT = 4.5; shedDebt(e, 1); }
    return false;
  }
  if (e.boss === 'screep') {
    e.growT -= dt;
    if (e.growT <= 0 && e.grown < 6) {
      e.growT = 3;
      e.grown++;
      e.scale += 0.22; e.r += 2; e.sp += 3;
      e.maxHp += 10; e.hp += 10;
      addFloater(e.x, e.y - e.r - 6, CREEP[(e.grown - 1) % CREEP.length], '#ff8fa0');
      spawnMinion('story', e, 1);
      shake += 2;
    }
    return false;
  }
  if (e.boss === 'conflict') {
    if (e.reviveT > 0) {
      e.reviveT -= dt;
      if (e.reviveT <= 0) reviveTwin(e);
    }
    return false;
  }
  if (e.boss === 'mtgboss') {
    // letters bounce off the agenda; they land only while someone derails it
    e.cycleT -= dt;
    if (e.cycleT <= 0) {
      e.open = !e.open;
      e.cycleT = e.open ? 2.6 : 2.6; // half the meeting is derailed — hit it then
      addFloater(e.x, e.y - e.r - 8, e.open ? 'SOMEONE ASKED A QUESTION' : 'AGENDA RESUMES',
        e.open ? '#3fe08a' : '#8f8fa8');
      if (e.open) sfx.crit(); else sfx.block();
    }
    e.callT -= dt;
    if (e.callT <= 0) { e.callT = 4; spawnMinion('story', e, 1); }
    return false;
  }
  if (e.boss === 'outage') {
    // aim (telegraph) → dash → down (the incident window: double damage)
    e.phaseT -= dt;
    if (e.mode === 'aim') {
      if (e.phaseT <= 0) { e.mode = 'dash'; e.phaseT = 0.45; e.dx = ux; e.dy = uy; sfx.siren(); }
      return true;
    }
    if (e.mode === 'dash') {
      e.x += e.dx * 430 * dt; e.y += e.dy * 430 * dt;
      if (e.phaseT <= 0) { e.mode = 'down'; e.phaseT = 1.6; shake += 3; }
      return true;
    }
    if (e.phaseT <= 0) { e.mode = 'aim'; e.phaseT = 1.3; }
    return true;
  }
  if (e.boss === 'flaky') {
    e.phaseT -= dt;
    if (e.phaseT <= 0) {
      e.pass = !e.pass;
      e.phaseT = e.pass ? 1.7 : 1.2;
      addFloater(e.x, e.y - e.r - 8, e.pass ? 'PASS' : 'FAIL — IMMUNE', e.pass ? '#3fe08a' : '#ff5a6e');
      sfx.ding();
    }
    return false;
  }
  return false;
}

// Letters a boss currently ignores. Both cases are telegraphed on screen.
function bossBlocks(e) {
  return (e.boss === 'mtgboss' && !e.open) || (e.boss === 'flaky' && !e.pass);
}

// Returns true when that was the last live part — the fight is over.
function killBoss(e, gained) {
  const i = bossParts.indexOf(e);
  if (i >= 0) bossParts.splice(i, 1);
  addParticles(e.x, e.y, '#ffffff', 34, 150);
  addParticles(e.x, e.y, bossDef ? bossDef.color : PAL.paper, 22, 100);
  shake += 9;

  if (e.boss === 'screep') {
    // everything it accreted comes back as tickets
    spawnMinion('story', e, clamp(2 + e.grown, 2, 7));
  }
  if (e.boss === 'conflict' && e.twin && enemies.includes(e.twin)) {
    // Killed alone: it reopens unless the other side goes down too, fast. The
    // window is winnable by construction — the surviving side takes double
    // damage while it is open, and each reopen comes back half as strong as
    // the last, so the fight always converges even on a bad burst.
    const twin = e.twin;
    const reopens = (e.reopens || 0) + 1;
    twin.reviveT = 3.2;
    twin.revive = { maxHp: e.maxHp, hp: Math.max(1, Math.round(e.maxHp * Math.pow(0.5, reopens))), score: e.score, area: e.area, reopens };
    twin.twin = null;
    addFloater(twin.x, twin.y - twin.r - 12, 'RESOLVE THE OTHER SIDE — ×2 DAMAGE!', '#ffd23f', true);
    sfx.siren();
    shake += 4;
    return false;
  }

  const over = !bossParts.length;
  if (over) {
    addFloater(e.x, e.y, (bossDef ? bossDef.name : 'BOSS') + ' RESOLVED! +' + gained, '#ffd23f', true);
    sfx.bossDown();
    // a boss always pays out — no dice roll
    pickups.push({ kind: 'coffee', x: clamp(e.x - 16, 12, VW - 12), y: e.y, life: 16, phase: rnd(0, TAU) });
    pickups.push({ kind: 'duck', x: clamp(e.x + 16, 12, VW - 12), y: e.y, life: 16, phase: rnd(0, TAU) });
    pickups.push({ kind: 'can', x: clamp(e.x, 12, VW - 12), y: clamp(e.y + 18, 12, VH - 12), life: 16, phase: rnd(0, TAU) });
  } else {
    addFloater(e.x, e.y, 'ONE SIDE DOWN! +' + gained, '#ffd23f');
    sfx.epicDie();
  }
  return over;
}

function spawnEnemy(type, side) {
  if (side === undefined) side = Math.floor(Math.random() * 4);
  const def = ENEMY_TYPES[type];
  const inset = def.r + 4; // materialize just inside the edge — visibly
  let x, y;
  if (side === 0) { x = rnd(16, VW - 16); y = inset; }
  else if (side === 1) { x = rnd(16, VW - 16); y = VH - inset; }
  else if (side === 2) { x = inset; y = rnd(16, VH - 16); }
  else { x = VW - inset; y = rnd(16, VH - 16); }

  const e = makeEnemy(type, x, y);
  if (type === 'meeting') {
    // meetings don't hunt you — they drift across the office, soaking up letters
    const tx = side === 2 ? VW + 24 : side === 3 ? -24 : rnd(VW * 0.2, VW * 0.8);
    const ty = side === 0 ? VH + 24 : side === 1 ? -24 : rnd(VH * 0.2, VH * 0.8);
    const d = Math.hypot(tx - x, ty - y) || 1;
    e.vx = (tx - x) / d * e.sp; e.vy = (ty - y) / d * e.sp;
  }
  if (type === 'epic') {
    addFloater(clamp(x, 30, VW - 30), clamp(y, 20, VH - 20), 'AN EPIC APPEARS!', '#c9a8ff', true);
    shake += 4;
  }
  if (type === 'hotfix') {
    addFloater(clamp(x, 24, VW - 24), clamp(y, 16, VH - 16), 'HOTFIX!!', '#ff8a5c');
    sfx.siren(); // it screams in — that IS its telegraph
  } else {
    sfx.ding(); // new-ticket notification
  }
}

// ---------------------------------------------------------------- effects
function addFloater(x, y, text, color, big) {
  floaters.push({ x, y, text, color, big: !!big, life: big ? 1.6 : 1 });
}
function addParticles(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(0.2, 1) * (speed || 60);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rnd(0.25, 0.6), color, size: Math.random() < 0.3 ? 2 : 1,
    });
  }
}

// ---------------------------------------------------------------- combat
function fire() {
  const a = player.angle + rnd(-0.05, 0.05);
  const nx = player.x + Math.cos(player.angle) * 15; // just past the laptop edge
  const ny = player.y + Math.sin(player.angle) * 15;
  bullets.push({ x: nx, y: ny, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 1.9, ch: pick(GLYPHS), lang });
  player.vx -= Math.cos(a) * 6.7; // chair recoil
  player.vy -= Math.sin(a) * 6.7;
  addParticles(nx, ny, LANGS[lang].color, 2, 40);
  sfx.shoot();
}

function damagePlayer(e) {
  if (player.invuln > 0 || player.duckT > 0) return;
  player.hp -= 1;               // every hit costs one coffee cup
  player.invuln = 1.2;
  shake += 5;
  hitFreeze = 0.5;              // freeze frame — see exactly what got you
  culprit = e;
  addFloater(player.x, player.y - 12, pick(PAIN), '#ff5a6e');
  sfx.hurt();
  if (player.hp <= 0) {
    player.hp = 0;
    hitFreeze = 0; culprit = null;
    state = 'over';
    overTimer = 0;
    mouse.down = false;
    if (score > high) {
      high = score;
      try { localStorage.setItem('jiraBlasterHigh', String(high)); } catch (err) { /* ignore */ }
    }
    submitScore();
    addParticles(player.x, player.y, '#f0b088', 24, 90);
    sfx.over();
  }
}

// Chain: kills (and grazes) within CHAIN_WINDOW of each other build ×1→×8.
function comboTick() {
  if (comboT > 0) combo = Math.min(CHAIN_MAX, combo + 1);
  comboT = CHAIN_WINDOW;
}

function killEnemy(e, silent) {
  enemies.splice(enemies.indexOf(e), 1);
  kills++;
  comboTick();
  const gained = e.score * combo;
  score += gained;
  const shredColor = { bug: PAL.bug, story: PAL.story, epic: PAL.epic, hotfix: PAL.cup }[e.type] || PAL.paper;
  addParticles(e.x, e.y, '#dfe6ff', e.type === 'epic' ? 30 : 8, e.type === 'epic' ? 120 : 70);
  addParticles(e.x, e.y, shredColor, e.type === 'epic' ? 16 : 4, 60);
  if (e.boss) {
    killBoss(e, gained);
  } else if (e.type === 'epic') {
    // an Epic never dies quietly — it splits into 3 Stories
    for (let k = 0; k < 3; k++) {
      const a = TAU * (k / 3) + rnd(0, TAU / 3);
      const s = makeEnemy('story',
        clamp(e.x + Math.cos(a) * 14, 10, VW - 10),
        clamp(e.y + Math.sin(a) * 14, 10, VH - 10));
      s.spawnT = 0.45; // they materialize with a flash — readable, not a cheap shot
      s.area = e.area; // subtasks inherit the epic's area
    }
    addFloater(e.x, e.y, 'EPIC SPLITS! +' + gained, '#c9a8ff', true);
    shake += 6;
    sfx.epicDie();
  } else if (!silent) {
    addFloater(e.x, e.y, '+' + gained + (combo > 1 ? ' ×' + combo : ''), combo > 1 ? '#ffd23f' : '#dfe6ff');
    sfx.kill();
  }
  // pickup drops (bosses hand out their own guaranteed haul, see killBoss)
  if (!e.boss) {
    const r = Math.random();
    if (r < 0.05) pickups.push({ kind: 'coffee', x: e.x, y: e.y, life: 12, phase: rnd(0, TAU) });
    else if (r < 0.085) pickups.push({ kind: 'can', x: e.x, y: e.y, life: 12, phase: rnd(0, TAU) });
    else if (r < 0.11) pickups.push({ kind: 'duck', x: e.x, y: e.y, life: 12, phase: rnd(0, TAU) });
  }
}

// ---------------------------------------------------------------- update
function update(dt) {
  shake = Math.max(0, shake - dt * 18);

  if (state === 'over') { menuT += dt; overTimer += dt; updateFx(dt); return; }
  if (state !== 'play') { menuT += dt; return; }

  // freeze frame after a hit: the world stops, the culprit stays highlighted
  if (hitFreeze > 0) {
    hitFreeze -= dt;
    if (hitFreeze <= 0 && culprit) {
      if (culprit.type !== 'epic') {
        const idx = enemies.indexOf(culprit);
        if (idx >= 0) enemies.splice(idx, 1);
        addParticles(culprit.x, culprit.y, '#dfe6ff', 6, 70);
      }
      culprit = null;
    }
    return;
  }

  menuT += dt;
  t += dt;
  bossBanner = Math.max(0, bossBanner - dt);
  const p = player;

  // --- chair movement (rolly-chair physics: accelerate + drift) — arrows
  let ax = 0, ay = 0;
  if (keys['arrowup']) ay -= 1;
  if (keys['arrowdown']) ay += 1;
  if (keys['arrowleft']) ax -= 1;
  if (keys['arrowright']) ax += 1;
  if (ax || ay) {
    const len = Math.hypot(ax, ay);
    p.vx += ax / len * 933 * dt;
    p.vy += ay / len * 933 * dt;
  }
  const damp = Math.exp(-5.5 * dt);
  p.vx *= damp; p.vy *= damp;
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > 160) { p.vx = p.vx / spd * 160; p.vy = p.vy / spd * 160; }
  p.x = clamp(p.x + p.vx * dt, p.r, VW - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, VH - p.r);
  // chair spin: D = clockwise, A = counter-clockwise; both held = facing
  // locked. With auto-aim on, the chair tracks the nearest ticket unless
  // A/D override. CHAIR_TURN stays the committed turn rate either way.
  if (keys['a'] || keys['d']) {
    const spin = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
    p.angle += spin * CHAIR_TURN * dt;
  } else if (autoAim) {
    let best = null, bd = Infinity;
    for (const e of enemies) {
      if (e.type === 'meeting' || e.spawnT > 0) continue;
      const dd = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    if (best) {
      const want = Math.atan2(best.y - p.y, best.x - p.x);
      const diff = ((want - p.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
      p.angle += clamp(diff, -CHAIR_TURN * dt, CHAIR_TURN * dt);
    }
  }

  // --- timers
  p.invuln = Math.max(0, p.invuln - dt);
  p.rapidT = Math.max(0, p.rapidT - dt);
  p.duckT = Math.max(0, p.duckT - dt);
  comboT = Math.max(0, comboT - dt);
  if (comboT === 0) combo = 1;

  // --- firing: Space, click, or the auto-shoot assist
  p.fireCd -= dt;
  if ((mouse.down || keys[' '] || autoShoot) && p.fireCd <= 0) {
    fire();
    p.fireCd = 1 / (p.rapidT > 0 ? 16 : 8);
  }

  // --- bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -10 || b.x > VW + 10 || b.y < -10 || b.y > VH + 10) bullets.splice(i, 1);
  }

  // --- sprint flow
  if (phase === 'break') {
    breakTimer -= dt;
    if (breakTimer <= 0) {
      phase = 'wave';
      spawnQueue = buildSprint(sprint);
      // density is the dial: interval decays 8% per sprint, floored at 0.3s
      spawnInterval = Math.max(0.3, 1.1 * Math.pow(0.92, sprint - 1));
      spawnTimer = 0;
      sfx.wave();
      if (sprint % 5 === 0) spawnBoss(sprint); // boss sprints are the boss, alone
    }
  } else {
    spawnTimer -= dt;
    if (spawnQueue.length && spawnTimer <= 0) {
      spawnEnemy(spawnQueue.shift());
      spawnTimer = spawnInterval * rnd(0.7, 1.3);
    }
    // meeting invites drift in on their own calendar — but never mid-boss
    meetingCd -= dt;
    if (sprint >= 2 && sprint % 5 !== 0 && meetingCd <= 0) {
      if (enemies.filter(e => e.type === 'meeting').length < 2) spawnEnemy('meeting');
      meetingCd = rnd(8, 14);
    }
    if (!spawnQueue.length && !enemies.some(e => e.type !== 'meeting')) {
      const wasBoss = sprint % 5 === 0;
      const bonus = (50 + sprint * 25) * (wasBoss ? 3 : 1);
      score += bonus;
      if (wasBoss) { bossDef = null; bossMaxHp = 0; }
      clearMsg = (wasBoss ? 'BOSS DOWN!  +' : 'SPRINT ' + sprint + ' CLEAR!  +') + bonus;
      addFloater(p.x, p.y - 14, '+' + bonus, '#3fe08a');
      sprint++;
      phase = 'break';
      breakTimer = sprint % 5 === 0 ? 3.5 : 3; // extra beat before a boss
      // every 5 sprints cleared = a promotion: +1 max cup, poured full
      if ((sprint - 1) % 5 === 0) {
        p.maxHp++;
        p.hp++;
        addFloater(p.x, p.y - 24, 'PROMOTION! +1 MAX CUP', '#ffd23f');
        sfx.pickup();
      }
    }
  }

  // --- enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // materializing: pulsing outline, inert — the player gets a fix on it first
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }

    if (e.type === 'meeting') {
      // non-lethal cover: drifts across the office, soaking up letters
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.x < -45 || e.x > VW + 45 || e.y < -45 || e.y > VH + 45) enemies.splice(i, 1);
      continue;
    }

    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    // bosses run a state machine first, and may take over their own movement
    const selfMoved = e.boss ? bossBehave(e, dt, ux, uy) : false;
    if (!selfMoved) {
      // seek player; wobble amplitude is part of the type's identity
      const wob = e.wobAmp ? Math.sin(t * e.wobFreq + e.wobPhase) * e.wobAmp : 0;
      e.x += (ux + -uy * wob) * e.sp * dt;
      e.y += (uy + ux * wob) * e.sp * dt;
    }
    if (e.boss) { // a dashing boss must not leave the office
      e.x = clamp(e.x, e.r, VW - e.r);
      e.y = clamp(e.y, e.r, VH - e.r);
    }
    e.touchCd = Math.max(0, e.touchCd - dt);

    // impact wind-up: ~1.5s from contact the card flashes red (hotfixes scream instead)
    e.windup = e.type !== 'hotfix' && (d - (e.r + p.r)) / e.sp < WINDUP_TIME;

    // graze: pays out when a ticket leaves the near-miss ring without touching you
    if (!e.grazed) {
      const ring = e.r + p.r + GRAZE_PX;
      if (e.grazeArmed && d >= ring) {
        e.grazed = true; e.grazeArmed = false;
        score += 50;
        comboTick();
        addFloater(e.x, e.y - 8, 'GRAZE +50', '#2fe4c8');
        addParticles(e.x, e.y, '#2fe4c8', 4, 40);
        sfx.graze();
      } else if (d < ring && d >= e.r + p.r) {
        e.grazeArmed = true;
      }
    }

    // contact with player
    if (d < e.r + p.r) {
      e.grazeArmed = false; // it hit you — that's no graze
      if (p.duckT > 0) {
        if (e.boss) {
          // the duck deflects a boss and chips it — it does not delete it
          if (e.touchCd <= 0) {
            e.touchCd = 0.5;
            e.hp -= 3;
            e.x -= ux * 16; e.y -= uy * 16;
            addFloater(e.x, e.y - e.r, 'QUACK!', '#ffd23f');
            sfx.quack();
            if (e.hp <= 0) killEnemy(e);
          }
          continue;
        }
        addFloater(e.x, e.y, 'QUACK!', '#ffd23f');
        sfx.quack();
        killEnemy(e, true);
        continue;
      }
      if (e.type === 'epic' || e.boss) {
        if (e.touchCd <= 0) { damagePlayer(e); e.touchCd = 0.8; }
      } else if (p.invuln > 0) {
        // harmlessly shredded on invuln frames
        addParticles(e.x, e.y, '#dfe6ff', 6, 70);
        enemies.splice(i, 1);
        continue;
      } else {
        damagePlayer(e); // freeze frame; the culprit is removed when it ends
        if (state !== 'play') break;
      }
    }
  }

  // keep tickets from stacking into one blob
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (a.spawnT > 0 || b.spawnT > 0) continue; // materializing tickets aren't solid yet
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d > 0 && d < min) {
        const push = (min - d) / d * 0.5;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
      }
    }
  }

  // --- bullets vs enemies
  outer:
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.spawnT > 0) continue; // still materializing — not solid yet
      const dx = b.x - e.x, dy = b.y - e.y;
      if (dx * dx + dy * dy < (e.r + 2) * (e.r + 2)) {
        bullets.splice(i, 1);
        if (e.type === 'meeting' || bossBlocks(e)) {
          // meeting invites block your letters — infinite HP, zero shame.
          // A boss in its immune window shrugs them off the same way.
          addParticles(b.x, b.y, '#5a6a90', 3, 40);
          sfx.block();
          continue outer;
        }
        const matched = e.area && LANGS[b.lang].area === e.area;
        let dmg = matched ? 2 : 1; // right language for the area = double damage
        if (e.boss === 'outage' && e.mode === 'down') dmg *= 2; // the incident window
        if (e.boss === 'conflict' && e.reviveT > 0) dmg *= 2;   // one side already resolved
        e.hp -= dmg;
        if (!e.boss) { // bosses are too heavy to shove around
          e.x += Math.cos(player.angle) * 1.5; // knockback nudge
          e.y += Math.sin(player.angle) * 1.5;
        }
        // the Monolith sheds debt as it comes apart, not just on a timer
        if (e.boss === 'monolith' && e.hp > 0 && e.hp <= e.nextShed) {
          e.nextShed -= e.shedStep;
          shedDebt(e, 2);
        }
        addParticles(b.x, b.y, LANGS[b.lang].color, matched ? 6 : 3, matched ? 70 : 50);
        if (e.hp <= 0) killEnemy(e); else (matched ? sfx.crit() : sfx.hit());
        continue outer;
      }
    }
  }

  // --- pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) { pickups.splice(i, 1); continue; }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 14) {
      if (pk.kind === 'coffee') { p.hp = Math.min(p.maxHp, p.hp + 1); addFloater(pk.x, pk.y, 'REFILL +1 CUP', '#dfe6ff'); }
      if (pk.kind === 'can') { p.rapidT = 8; addFloater(pk.x, pk.y, 'CRUNCH MODE!', '#2fe4c8'); }
      if (pk.kind === 'duck') { p.duckT = 6; addFloater(pk.x, pk.y, 'DUCK SHIELD!', '#ffd23f'); }
      pickups.splice(i, 1);
      sfx.pickup();
    }
  }

  updateFx(dt);
}

function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const pa = particles[i];
    pa.x += pa.vx * dt; pa.y += pa.vy * dt;
    pa.vx *= 0.92; pa.vy *= 0.92;
    pa.life -= dt;
    if (pa.life <= 0) particles.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= 18 * dt; f.life -= dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}

// ---------------------------------------------------------------- draw
function draw() {
  ctx.save();
  if (shake > 0.3) ctx.translate(rnd(-shake, shake) * 0.6, rnd(-shake, shake) * 0.6);

  ctx.drawImage(bgCanvas, 0, 0);

  if (state === 'menu') { drawMenu(); ctx.restore(); return; }
  if (state === 'setup') { drawSetup(); ctx.restore(); return; }

  // pickups
  for (const pk of pickups) {
    if (pk.life < 3 && Math.floor(pk.life * 6) % 2 === 0) continue; // blink before despawn
    const bob = Math.sin(menuT * 4 + pk.phase) * 1.5;
    const img = pk.kind === 'coffee' ? coffeeImg : pk.kind === 'can' ? canImg : duckImg;
    ctx.drawImage(img, Math.round(pk.x - img.width / 2), Math.round(pk.y - img.height / 2 + bob));
  }

  // approach trails: dotted threat vectors toward the chair
  for (const e of enemies) {
    if (e.type === 'meeting') continue;
    const ddx = player.x - e.x, ddy = player.y - e.y;
    const dd = Math.hypot(ddx, ddy) || 1;
    if (dd < 45) continue;
    const tux = ddx / dd, tuy = ddy / dd;
    ctx.fillStyle = e.windup ? '#ff8fa0' : '#dfe6ff';
    for (let k = 0; k < 4; k++) {
      const dist = e.r + 6 + k * 10;
      if (dist > dd - 18) break;
      ctx.globalAlpha = 0.4 - k * 0.08;
      ctx.fillRect(Math.round(e.x + tux * dist), Math.round(e.y + tuy * dist), 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  // enemies
  for (const e of enemies) {
    const w = e.img.width * e.scale, h = e.img.height * e.scale;
    const ex = Math.round(e.x - w / 2), ey = Math.round(e.y - h / 2);

    if (e.spawnT > 0) {
      // spawn flash: the ticket materializes before it can move or be hit
      const pulse = Math.abs(Math.sin(e.spawnT * 26));
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      ctx.drawImage(e.img, ex, ey, w, h);
      if (e.area) { ctx.fillStyle = AREAS[e.area].color; ctx.fillRect(ex + 1, ey + 1, 2, h - 2); }
      ctx.globalAlpha = 0.4 + 0.6 * pulse;
      ctx.strokeStyle = '#dfe6ff';
      ctx.strokeRect(ex - 1.5, ey - 1.5, w + 3, h + 3);
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    ctx.rotate(Math.sin(menuT * 2 + e.wobPhase) * 0.14);
    ctx.drawImage(e.img, -w / 2, -h / 2, w, h);
    // area stripe on the left edge: red = FE, green = BE, blue = INFRA
    if (e.area) { ctx.fillStyle = AREAS[e.area].color; ctx.fillRect(-w / 2 + 1, -h / 2 + 1, 2, h - 2); }
    ctx.restore();

    // hotfixes flash orange the whole way in
    if (e.type === 'hotfix' && Math.floor(t * 12) % 2 === 0) {
      ctx.strokeStyle = '#ff8a5c';
      ctx.strokeRect(ex - 1.5, ey - 1.5, w + 3, h + 3);
    }
    // impact wind-up: red flash + thickened border inside the reaction budget
    if (e.windup && Math.floor(t * 8) % 2 === 0) {
      ctx.strokeStyle = '#ff5a6e';
      ctx.strokeRect(ex - 1.5, ey - 1.5, w + 3, h + 3);
      ctx.strokeRect(ex - 3.5, ey - 3.5, w + 7, h + 7);
    }
    // freeze frame: highlight exactly which ticket got you
    if (e === culprit && hitFreeze > 0) {
      ctx.strokeStyle = Math.floor(hitFreeze * 16) % 2 === 0 ? '#ffffff' : '#ff5a6e';
      ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
      ctx.strokeRect(ex - 4.5, ey - 4.5, w + 9, h + 9);
    }

    if (e.boss) drawBossTells(e, ex, ey, w, h);

    // bosses get the big bar at the top of the screen instead of a stub
    if (!e.boss && e.hp < e.maxHp && e.maxHp > 1) {
      const bw = e.r * 2;
      ctx.fillStyle = '#080c18';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 5, bw, 2);
      ctx.fillStyle = e.type === 'epic' ? '#a06bff' : '#ff5a6e';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 5, bw * (e.hp / e.maxHp), 2);
    }
  }

  // player
  const p = player;
  if (state !== 'over') {
    if (p.duckT > 0) {
      ctx.strokeStyle = 'rgba(255,210,63,' + (p.duckT < 1.5 ? 0.3 + 0.4 * Math.abs(Math.sin(menuT * 10)) : 0.6) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, 13 + Math.sin(menuT * 6), 0, TAU); ctx.stroke();
    }
    if (!(p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0)) {
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      ctx.rotate(p.angle + Math.PI / 2); // sprite faces north; angle 0 = east
      ctx.drawImage(devImg, -17, -17);
      ctx.restore();
    }
    // facing dots trace the firing line
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#5cf2d6';
    ctx.fillRect(Math.round(p.x + Math.cos(p.angle) * 12), Math.round(p.y + Math.sin(p.angle) * 12), 1, 1);
    ctx.fillRect(Math.round(p.x + Math.cos(p.angle) * 16), Math.round(p.y + Math.sin(p.angle) * 16), 1, 1);
    ctx.globalAlpha = 1;
    // name tag above the head — never rotates with the chair, and stays on
    // screen when you scoot into the top edge
    if (playerName) {
      const nx = Math.round(p.x), ny = Math.max(9, Math.round(p.y) - 22);
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#080c18';
      ctx.fillText(playerName, nx + 1, ny + 1);
      ctx.fillStyle = '#8f8fa8'; // muted: it's a label, not a threat cue
      ctx.fillText(playerName, nx, ny);
    }
  }

  // bullets: streams of code letters in the equipped language's color
  for (const b of bullets) {
    ctx.drawImage(GLYPH_IMG[b.lang][b.ch], Math.round(b.x) - 2, Math.round(b.y) - 3);
  }

  // particles
  for (const pa of particles) {
    ctx.globalAlpha = clamp(pa.life * 3, 0, 1);
    ctx.fillStyle = pa.color;
    ctx.fillRect(pa.x, pa.y, pa.size, pa.size);
  }
  ctx.globalAlpha = 1;

  // floaters
  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.life * 2, 0, 1);
    ctx.font = f.big ? 'bold 10px monospace' : 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#080c18';
    ctx.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
  }
  ctx.globalAlpha = 1;

  drawHud();

  if (state === 'play' && bossBanner > 0 && bossDef) drawBossBanner();

  if (state === 'play' && phase === 'break') {
    ctx.textAlign = 'center';
    if (clearMsg && breakTimer > 1.4) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#3fe08a';
      ctx.fillText(clearMsg, VW / 2, VH / 2 - 20);
    }
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#dfe6ff';
    ctx.fillText('SPRINT ' + sprint, VW / 2, VH / 2 + 2);
    ctx.font = '8px monospace';
    if (sprint % 5 === 0) {
      const next = BOSSES[(Math.floor(sprint / 5) - 1) % BOSSES.length];
      ctx.fillStyle = '#ff8a5c';
      ctx.fillText('ESCALATED TO ' + next.name + ' — ' + Math.ceil(breakTimer) + '…', VW / 2, VH / 2 + 14);
    } else {
      ctx.fillStyle = '#8f8fa8';
      ctx.fillText('standup in ' + Math.ceil(breakTimer) + '…', VW / 2, VH / 2 + 14);
    }
  }

  if (paused) {
    // laid out top-down like the death screen: the board below is 0–12 rows
    // tall, so nothing here can be positioned from the centre
    ctx.fillStyle = 'rgba(8,12,24,0.82)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    let y = 48;
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#dfe6ff';
    ctx.fillText('PAUSED', VW / 2, y);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#8f8fa8';
    y += 14; ctx.fillText('(in a meeting — press P to escape)', VW / 2, y);
    drawBoard(y + 26, false); // a mid-run rank would be a lie — rows only
  }

  if (state === 'over') drawGameOver();

  // no aim reticle: the letter stream already draws the firing line.

  ctx.restore();
}

// Each boss's state, drawn on the card itself: what it is doing now and
// whether letters will land. Every immune window is visible before it matters.
function drawBossTells(e, ex, ey, w, h) {
  const cx = Math.round(e.x);
  if (e.boss === 'mtgboss') {
    // the organizer pip — green means someone derailed the agenda, hit it now
    ctx.fillStyle = e.open ? '#3fe08a' : '#5a6a90';
    ctx.fillRect(cx - 3, Math.round(e.y) - 3, 6, 6);
    ctx.strokeStyle = '#080c18';
    ctx.strokeRect(cx - 3.5, Math.round(e.y) - 3.5, 7, 7);
    if (!e.open) { ctx.strokeStyle = '#5a6a90'; ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5); }
  }
  if (e.boss === 'flaky') {
    ctx.strokeStyle = e.pass ? '#3fe08a' : '#ff5a6e';
    ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
    ctx.textAlign = 'center';
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = e.pass ? '#3fe08a' : '#ff5a6e';
    ctx.fillText(e.pass ? 'PASS' : 'FAIL', cx, ey - 6);
  }
  if (e.boss === 'outage' && e.mode === 'aim') {
    // the charge it is about to make, drawn before it makes it
    ctx.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(t * 12));
    ctx.strokeStyle = '#ff5a6e';
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + (player.x - e.x) * 4, e.y + (player.y - e.y) * 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (e.boss === 'outage' && e.mode === 'down') {
    ctx.strokeStyle = Math.floor(t * 10) % 2 === 0 ? '#ffd23f' : '#3fe08a';
    ctx.strokeRect(ex - 3.5, ey - 3.5, w + 7, h + 7);
  }
  if (e.boss === 'conflict') {
    if (e.twin && enemies.includes(e.twin)) {
      ctx.strokeStyle = 'rgba(63,224,138,0.35)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.twin.x, e.twin.y); ctx.stroke();
    }
    if (e.reviveT > 0) { // the window to finish the other side, at double damage
      ctx.strokeStyle = Math.floor(t * 10) % 2 === 0 ? '#ffd23f' : '#3fe08a';
      ctx.strokeRect(ex - 3.5, ey - 3.5, w + 7, h + 7);
      ctx.textAlign = 'center';
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(e.reviveT.toFixed(1) + 's', cx, ey - 6);
    }
  }
}

function drawBossBar() {
  const hp = bossParts.reduce((s, e) => s + Math.max(0, e.hp), 0);
  const w = 250, x = Math.round((VW - w) / 2), y = 25;
  ctx.textAlign = 'center';
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = bossDef.color;
  ctx.fillText(bossDef.name, VW / 2, y - 3);
  ctx.fillStyle = '#2a2140';
  ctx.fillRect(x, y, w, 5);
  ctx.fillStyle = bossDef.color;
  ctx.fillRect(x, y, Math.max(0, Math.round(w * hp / bossMaxHp)), 5);
  ctx.strokeStyle = '#080c18';
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, 6);
}

// Title card over the boss's long materialize, fading as it becomes solid.
function drawBossBanner() {
  ctx.globalAlpha = clamp(bossBanner * 1.3, 0, 1);
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#080c18';
  ctx.fillText(bossDef.name, VW / 2 + 2, VH / 2 + 42);
  ctx.fillStyle = bossDef.color;
  ctx.fillText(bossDef.name, VW / 2, VH / 2 + 40);
  ctx.font = '8px monospace';
  ctx.fillStyle = '#dfe6ff';
  ctx.fillText(bossDef.tag, VW / 2, VH / 2 + 56);
  ctx.globalAlpha = 1;
}

function drawHud() {
  const p = player;
  // coffee cups = HP. Panel grows with promotions (+1 max cup per 5 sprints).
  ctx.fillStyle = 'rgba(8,12,24,0.6)';
  ctx.fillRect(4, 4, 6 + p.maxHp * 12, 15);
  for (let i = 0; i < p.maxHp; i++) {
    ctx.globalAlpha = i < p.hp ? 1 : 0.18;
    ctx.drawImage(coffeeImg, 8 + i * 12, 7);
  }
  ctx.globalAlpha = 1;

  // active buffs
  let bx = 7;
  if (p.rapidT > 0) {
    ctx.drawImage(canImg, bx, 26);
    ctx.fillStyle = '#2fe4c8'; ctx.fillRect(bx, 35, Math.round(8 * p.rapidT / 8), 1);
    bx += 12;
  }
  if (p.duckT > 0) {
    ctx.drawImage(duckImg, bx, 26);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx, 35, Math.round(9 * p.duckT / 6), 1);
  }

  // sprint + remaining
  ctx.textAlign = 'center';
  ctx.fillStyle = '#dfe6ff';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('SPRINT ' + sprint, VW / 2, 12);
  if (phase === 'wave' && bossParts.length) {
    drawBossBar(); // the boss owns this strip while it lives
  } else if (phase === 'wave') {
    ctx.font = '8px monospace';
    ctx.fillStyle = '#8f8fa8';
    ctx.fillText((spawnQueue.length + enemies.length) + ' in backlog', VW / 2, 21);
  }

  // score
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#dfe6ff';
  ctx.fillText(score + ' SP', VW - 6, 12);
  ctx.font = '8px monospace';
  ctx.fillStyle = '#8f8fa8';
  ctx.fillText('BEST ' + Math.max(high, score), VW - 6, 21);

  // chain multiplier + its remaining window
  if (combo > 1 && comboT > 0) {
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = combo >= 8 ? '#ff5a6e' : combo >= 6 ? '#ff8a5c' : combo >= 4 ? '#ffd23f' : '#dfe6ff';
    ctx.fillText('CHAIN ×' + combo, VW - 6, 33);
    const cw = Math.round(30 * comboT / CHAIN_WINDOW);
    ctx.fillRect(VW - 6 - cw, 36, cw, 2);
  }

  // weapon bar: equipped language lit in its color
  ctx.textAlign = 'left';
  ctx.font = '8px monospace';
  let lx = 6;
  for (let i = 0; i < LANGS.length; i++) {
    const s = (i + 1) + ':' + LANGS[i].name;
    ctx.fillStyle = i === lang ? LANGS[i].color : '#5a6a90';
    ctx.fillText(s, lx, VH - 25);
    lx += ctx.measureText(s).width + 8;
  }
  // assist toggles (lit teal when on)
  ctx.fillStyle = autoAim ? '#2fe4c8' : '#5a6a90';
  ctx.fillText('[I] AUTO-AIM', 6, VH - 15);
  ctx.fillStyle = autoShoot ? '#2fe4c8' : '#5a6a90';
  ctx.fillText('[O] AUTO-SHOOT', 6, VH - 5);
}

function drawMenu() {
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(0, 0, VW, VH);
  const cx = VW / 2, cy = VH / 2; // laid out from the centre so it survives a resolution change

  // spinning chair
  ctx.save();
  ctx.translate(cx, cy - 84);
  ctx.rotate(menuT * 1.2);
  ctx.scale(2, 2);
  ctx.drawImage(devImg, -17, -17);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = '#080c18';
  ctx.fillText('JIRA BLASTER', cx + 2, cy - 6);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('JIRA BLASTER', cx, cy - 8);

  ctx.font = '8px monospace';
  ctx.fillStyle = '#8f8fa8';
  ctx.fillText('The sprint never ends. The backlog is coming for you.', cx, cy + 8);

  ctx.fillStyle = '#dfe6ff';
  ctx.fillText('ARROWS — scoot the chair  ·  A / D — spin it  ·  SPACE — ship code', cx, cy + 30);
  ctx.fillText('1 / 2 / 3 — switch language · letters matching a ticket stripe do ×2 damage', cx, cy + 41);
  ctx.fillText('I — toggle auto-aim  ·  O — toggle auto-shoot', cx, cy + 52);
  ctx.fillText('Chain kills & graze tickets for bonus SP  ·  P — pause  ·  M — mute', cx, cy + 63);

  if (Math.floor(menuT * 2) % 2 === 0) {
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#3fe08a';
    ctx.fillText('PRESS SPACE TO CLOCK IN', cx, cy + 92);
  }
  if (high > 0) {
    ctx.font = '8px monospace';
    ctx.fillStyle = '#8f8fa8';
    ctx.fillText('BEST: ' + high + ' SP', cx, cy + 112);
  }
}

// The portrait is redrawn only when the turn frame or an option changes —
// roughly 8 times a second instead of 60.
const PW = 100, PH = 120;
const portraitCv = cvOf(PW, PH);
let portraitKey = '';
function portrait(frame) {
  const key = frame + ':' + LOOK_GROUPS.map((gr) => look[gr.key]).join(',');
  if (key !== portraitKey) {
    portraitKey = key;
    const g = portraitCv.getContext('2d');
    g.clearRect(0, 0, PW, PH);
    drawAvatar(g, frame / 16 * TAU, look);
  }
  return portraitCv;
}

// CREATE YOUR DEV: the name above the dev it belongs to, the nine appearance
// rows beside them. Every chip and button is registered in `setupHits` as it
// is drawn, so the screen answers to a mouse or a finger as well as the keys.
function drawSetup() {
  ctx.fillStyle = 'rgba(8,12,24,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  setupHits.length = 0;
  const lx = 116; // centre of the left column

  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#080c18'; ctx.fillText('CREATE YOUR DEV', lx + 1, 19);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('CREATE YOUR DEV', lx, 18);

  // name field — it goes on the standup board and above the chair in-game
  const bw = 180, bh = 22, bx = lx - bw / 2, by = 28;
  ctx.fillStyle = 'rgba(8,12,24,0.85)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#2fe4c8';
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  const shown = nameInput || DEFAULT_NAME; // grey = the default you'd get anyway
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = nameInput ? '#dfe6ff' : '#5a6a90';
  ctx.fillText(shown, lx, by + 16);
  if (Math.floor(menuT * 2) % 2 === 0) {
    ctx.fillStyle = '#2fe4c8';
    ctx.fillRect(Math.round(lx + ctx.measureText(shown).width / 2) + 3, by + 5, 1, 13);
  }

  // portrait: the customizer's 16-frame turnaround, spinning on its own
  ctx.fillStyle = 'rgba(47,228,200,0.10)';
  ctx.beginPath(); ctx.ellipse(lx, 262, 58, 11, 0, 0, TAU); ctx.fill();
  ctx.drawImage(portrait(Math.floor(menuT / 0.13) % 16), 0, 2, PW, 114, lx - PW, 52, PW * 2, 228);

  // and the top-down sprite you actually play as, so the match is visible here
  ctx.save();
  ctx.translate(40, 244);
  ctx.rotate(menuT * 0.9);
  ctx.scale(2, 2);
  ctx.drawImage(devImg, -17, -17);
  ctx.restore();
  ctx.font = '8px monospace';
  ctx.fillStyle = '#5a6a90';
  ctx.fillText('IN GAME', 40, 290);

  // ---- appearance rows
  const px0 = 236, labelR = 316, chipX = 322;
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#7fe0ff';
  ctx.fillText('APPEARANCE', px0, 18);

  ctx.font = '8px monospace';
  for (let i = 0; i < LOOK_GROUPS.length; i++) {
    const gr = LOOK_GROUPS[i], y = 30 + i * 20, row = i === setupRow;
    if (row) { ctx.textAlign = 'left'; ctx.fillStyle = '#ffd23f'; ctx.fillText('>', px0, y + 10); }
    ctx.textAlign = 'right';
    ctx.fillStyle = row ? '#dfe6ff' : '#5a6a90';
    ctx.fillText(gr.label, labelR, y + 10);

    let cx0 = chipX;
    for (let v = 0; v < groupLen(gr); v++) {
      const on = look[gr.key] === v;
      const w = gr.colors ? 16 : Math.round(ctx.measureText(gr.words[v]).width) + 8;
      ctx.fillStyle = gr.colors ? gr.colors[v] : on ? '#3a2f57' : '#1a1730';
      ctx.fillRect(cx0, y, w, 14);
      if (gr.words) {
        ctx.textAlign = 'center';
        ctx.fillStyle = on ? '#ffd23f' : '#8f8fa8';
        ctx.fillText(gr.words[v], cx0 + w / 2, y + 10);
      }
      ctx.strokeStyle = on ? '#ffd23f' : '#3a2f57';
      ctx.strokeRect(cx0 - 0.5, y - 0.5, w + 1, 15);
      setupHits.push({ x: cx0 - 2, y: y - 2, w: w + 4, h: 18, act: () => { setupRow = i; setLook(gr.key, v); } });
      cx0 += w + 3;
    }
  }

  const btn = (x, y, w, h, label, fg, act) => {
    ctx.fillStyle = 'rgba(8,12,24,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = fg;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = fg;
    ctx.fillText(label, x + w / 2, y + h / 2 + 3);
    setupHits.push({ x, y, w, h, act });
  };
  ctx.font = 'bold 9px monospace';
  btn(236, 212, 190, 20, 'TAB — RANDOMIZE', '#8a63ff', randomizeLook);
  btn(434, 212, 198, 20, 'ESC — BACK', '#5a6a90', () => { state = 'menu'; });
  ctx.font = 'bold 11px monospace';
  btn(236, 240, 396, 26, 'START SHIFT >', '#3fe08a', confirmSetup);

  ctx.textAlign = 'center';
  ctx.font = '8px monospace';
  ctx.fillStyle = '#8f8fa8';
  ctx.fillText('type your name  ·  ↑↓ pick a row  ·  ←→ change it  ·  ENTER to start', VW / 2, 326);
  ctx.fillText('…or just click. Pants only show here — the game sees you from above.', VW / 2, 340);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(8,12,24,' + clamp(overTimer, 0, 0.75) + ')';
  ctx.fillRect(0, 0, VW, VH);
  const cx = VW / 2;
  ctx.textAlign = 'center';

  // laid out top-down: the board below is 0–12 rows tall, so nothing here can
  // be positioned from the centre
  let y = 56;
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = '#080c18';
  ctx.fillText('BURNOUT', cx + 2, y + 2);
  ctx.fillStyle = '#ff5a6e';
  ctx.fillText('BURNOUT', cx, y);

  ctx.font = '8px monospace';
  ctx.fillStyle = '#8f8fa8';
  y += 16; ctx.fillText('The backlog consumed you.', cx, y);

  ctx.fillStyle = '#dfe6ff';
  y += 16;
  ctx.fillText('Story points: ' + score + '   ·   Sprints survived: ' + (sprint - 1) +
    '   ·   Tickets resolved: ' + kills, cx, y);
  if (score >= high && score > 0) {
    ctx.fillStyle = '#ffd23f';
    y += 13; ctx.fillText('★ NEW HIGH SCORE ★', cx, y);
  }

  y = drawBoard(y + 24, true);

  if (overTimer > 0.8 && Math.floor(overTimer * 2) % 2 === 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#3fe08a';
    ctx.fillText('PRESS R TO GRAB ANOTHER COFFEE', cx, y + 26);
  }
}

// The standup board, drawn from `board` — never blocks, never throws: an
// unsent, pending or failed board is one line of text and the screen goes on.
// `withRank` is for the death screen: only a finished run has a rank.
function drawBoard(y, withRank) {
  if (!board) return y;
  const cx = VW / 2;

  ctx.textAlign = 'center';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#dfe6ff';
  ctx.fillText('THE STANDUP BOARD', cx, y);

  ctx.font = '8px monospace';
  if (board.status !== 'ok' || !board.rows.length) {
    ctx.fillStyle = '#8f8fa8';
    y += 13;
    ctx.fillText(board.status === 'sending' ? 'posting your run…'
      : board.status === 'error' ? 'board unreachable — this run was not saved'
        : 'no runs on the board yet', cx, y);
    return y;
  }

  // columns: rank | name | score | when
  const R = 204, N = 212, S = 344, W = 452;
  const me = playerName.toLowerCase();
  for (let i = 0; i < board.rows.length; i++) {
    const row = board.rows[i];
    const mine = String(row.name).toLowerCase() === me;
    y += 11;
    ctx.textAlign = 'right';
    ctx.fillStyle = mine ? '#ffd23f' : '#5a6a90';
    ctx.fillText((i + 1) + '.', R, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = mine ? '#ffd23f' : '#dfe6ff';
    ctx.fillText(String(row.name), N, y);
    ctx.textAlign = 'right';
    ctx.fillText(row.score + ' SP', S, y);
    ctx.fillStyle = mine ? '#c9a86a' : '#5a6a90';
    ctx.fillText(fmtWhen(row.at), W, y);
  }

  if (withRank && board.rank) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8f8fa8';
    y += 15;
    ctx.fillText('this run ranks #' + board.rank, cx, y);
  }
  return y;
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let stopLoop = false; // set by the autotest so headless Chrome can settle and exit
function loop(now) {
  // clamp: the first rAF timestamp can predate `last`, and a negative dt
  // rewinds every clock in the game
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (!paused) update(dt);
  else menuT += dt;
  draw();
  if (!stopLoop) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'play' && !AUTOTEST) { paused = true; loadBoard(); }
});

// ---------------------------------------------------------------- autotest
// Headless smoke test: open index.html?autotest=1 and check the console.
const AUTOTEST = location.search.includes('autotest');
if (AUTOTEST) {
  playerName = 'AUTOTEST'; // exercises the name tag without touching localStorage
  startGame();
  player.hp = 2; // die faster so the game-over path gets exercised
  let reported = false;
  const drive = () => {
    if (state === 'play') {
      lang = Math.floor(menuT / 4) % LANGS.length; // cycle weapons so matchup damage gets exercised
      if (menuT < 12) {
        // manual phase: steer with A/D toward the nearest ticket, hold Space
        let best = null, bd = 1e9;
        for (const e of enemies) {
          if (e.type === 'meeting' || e.spawnT > 0) continue;
          const dd = Math.hypot(e.x - player.x, e.y - player.y);
          if (dd < bd) { bd = dd; best = e; }
        }
        const tx = best ? best.x : player.x + Math.cos(menuT * 2) * 60;
        const ty = best ? best.y : player.y + Math.sin(menuT * 2) * 60;
        const a = Math.atan2(ty - player.y, tx - player.x);
        const diff = ((a - player.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
        keys['d'] = diff > 0.12;
        keys['a'] = diff < -0.12;
        keys[' '] = true;
      } else {
        // assist phase: exercise auto-aim + auto-shoot
        autoAim = true; autoShoot = true;
        keys['a'] = keys['d'] = false; keys[' '] = false;
      }
      keys['arrowright'] = Math.sin(menuT) > 0;
      keys['arrowleft'] = !keys['arrowright'];
      keys['arrowdown'] = Math.cos(menuT) > 0;
      keys['arrowup'] = !keys['arrowdown'];
    }
    if (menuT > 25 && !reported) {
      reported = true;
      const msg = 'AUTOTEST state=' + state + ' sprint=' + sprint + ' score=' + score +
        ' kills=' + kills + ' enemies=' + enemies.length + ' OK';
      console.log(msg);
      document.title = msg;
      stopLoop = true; // let the page go idle so headless Chrome exits
      return;
    }
    requestAnimationFrame(drive);
  };
  requestAnimationFrame(drive);
}
