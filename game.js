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
const inRect = (q, h) => q.x >= h.x && q.x <= h.x + h.w && q.y >= h.y && q.y <= h.y + h.h;

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
const HAIRS  = ['short', 'buzz', 'bun', 'mohawk', 'bald'];
const SHIRTS = ['#e0554f', '#3d9bff', '#2fbf62', '#ffb43d', '#8a63ff', '#20c9b0', '#2a2a33', '#f2f2f7'];
const PANTS  = ['#3a4a63', '#2a2a33', '#5a3a24', '#4f6f3a', '#7a3a5a'];
const CHAIRS = ['#ff8a3d', '#e0554f', '#3d9bff', '#2fbf62', '#8a63ff', '#2a2a33'];
const LAPS   = ['#c7d0dd', '#e0554f', '#2a2a33', '#8a63ff', '#20c9b0'];

// One row per option on the customizer: a strip of colors or a strip of words.
// `key` indexes into `look`; whichever list is present gives the value count.
const LOOK_GROUPS = [
  { key: 'skin',    label: 'SKIN',       colors: SKINS },
  { key: 'hairS',   label: 'HAIR',       words: ['SHORT', 'BUZZ', 'BUN', 'MOHAWK', 'BALD'] },
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
// The same dev seen from the front, for the CREATE YOUR DEV screen. Draws
// into a 100×120 box at `a` radians of turn (0 = facing the camera).
//
// Painter's algorithm: every part carries a camera depth — forward·cosθ −
// right·sinθ at its body position — and the parts render far-to-near, so
// occlusion is correct at every angle of the spin and nothing pops in front
// of what should cover it. The figure is a seated ~4.5-heads cartoon with
// volumed capsule limbs, a real neck, and a chair with cushion, tilted
// backrest, gas lift and a 5-star base that turns with the body.
// This is the only place pants and glasses are legible, so it is the one
// view that shows every option.
function drawAvatar(g, a, o) {
  const S = Math.sin(a), C = Math.cos(a);
  const OUT = '#1c1320';
  const CX = 50;
  const skin = SKINS[o.skin], skinS = shade(skin, 0.8);
  const hair = HAIRC[o.hairC], hairS = shade(hair, 0.74);
  const shirt = SHIRTS[o.shirt], shirtS = shade(shirt, 0.78), shirtH = shade(shirt, 1.18);
  const pants = PANTS[o.pants], pantsS = shade(pants, 0.76);
  const chair = CHAIRS[o.chair], chairS = shade(chair, 0.72), chairH = shade(chair, 1.22);
  const lap = LAPS[o.lap], lapH = shade(lap, 1.25), lapS = shade(lap, 0.72);
  const style = HAIRS[o.hairS];

  // body space → screen: f = forward, r = the wearer's right, both in px
  const X = (f, r) => CX + f * S + r * C;
  const D = (f, r) => f * C - r * S;              // + = toward the camera

  g.lineJoin = 'round'; g.lineCap = 'round';
  const path = (fn, fill, ow) => {
    g.beginPath(); fn();
    if (ow) { g.strokeStyle = OUT; g.lineWidth = ow; g.stroke(); }
    g.fillStyle = fill; g.fill();
  };
  const ellip = (x, y, rx, ry, fill, ow) => path(() => g.ellipse(x, y, rx, ry, 0, 0, TAU), fill, ow);
  const quad = (pts, fill, ow) => path(() => {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }, fill, ow);
  const rrect = (x, y, w, h, r, fill, ow) => path(() => {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }, fill, ow);
  const limb = (x1, y1, x2, y2, w, fill) => {
    g.strokeStyle = OUT; g.lineWidth = w + 2.6; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = fill; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  };

  const lean = 4.5;                 // recline: shoulders + head sit behind the hips
  const shY = 48, hipY = 73, seatY = 77;
  const hx = CX - S * lean, hy = 30;     // head centre

  const parts = [];
  const add = (d, fn) => parts.push({ d, fn });

  // soft contact shadow, under everything
  ellip(CX, 107.5, 28, 4.2, 'rgba(10,8,16,0.35)');

  // ---- 5-star base + gas lift, just behind the body core ----
  add(-1.5, () => {
    // the star takes -a so it turns with the body, not against it
    const spokes = [];
    for (let i = 0; i < 5; i++) { const t = i * TAU / 5 - a; spokes.push({ c: Math.cos(t), s: Math.sin(t) }); }
    spokes.sort((p, q) => p.s - q.s);            // far spokes first
    for (const l of spokes) {
      const ex = CX + l.c * 23, ey = 102 + l.s * 7.5;
      limb(CX, 100.5, ex, ey, 4, chairS);
      ellip(ex, ey + 1.4, 2.9, 2.2, '#2b2734', 1.6);   // caster
    }
    quad([[CX - 3.2, seatY + 3], [CX + 3.2, seatY + 3], [CX + 2.5, 100.5], [CX - 2.5, 100.5]], '#3a3a46', 1.8);
    g.fillStyle = '#5a5a6a'; g.fillRect(CX - 1.7, seatY + 4.5, 1.7, 94 - seatY);
  });

  // ---- backrest, tilted a touch further back than the torso ----
  add(D(-9.5, 0), () => {
    const bw = Math.hypot(13 * C, 4 * S);        // slab: wide face-on, thin edge-on
    const bx = X(-8, 0), tx = X(-11.5, 0);
    limb(X(-7, 0), seatY + 1, X(-9, 0), 66, 4.4, chairS);   // seat→slab support
    quad([[bx - bw, 72], [bx + bw, 72], [tx + bw, 45], [tx - bw, 45]], chair, 2.2);
    const iw = bw - 2.5;
    if (C > 0.15) {         // cushioned front face + lumbar seam
      quad([[bx - iw, 69.5], [bx + iw, 69.5], [tx + iw, 47.5], [tx - iw, 47.5]], chairH);
      g.strokeStyle = chairS; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo((bx + tx) / 2 - iw, 58.5); g.lineTo((bx + tx) / 2 + iw, 58.5); g.stroke();
    } else if (C < -0.15) { // hard shell seen from behind
      quad([[bx - iw, 69.5], [bx + iw, 69.5], [tx + iw, 47.5], [tx - iw, 47.5]], chairS);
    }
  });

  // ---- legs: hip → knee → ankle → shoe, with volume ----
  const dLegR = D(11, 6.5), dLegL = D(11, -6.5);
  const leg = (r, far) => () => {
    const thigh = far ? pantsS : pants, shin = far ? shade(pants, 0.66) : pantsS;
    limb(X(2, r * 5.5), hipY - 1, X(15, r * 6.5), 70.5, 7.4, thigh);
    limb(X(15, r * 6.5), 70.5, X(16, r * 6.5), 93, 5.2, shin);
    ellip(X(19.5, r * 5.8), 96.8, 3 + 2.6 * Math.abs(S), 2.7, far ? '#211c2b' : '#2f2940', 1.7);
  };
  add(dLegR, leg(1, dLegR < dLegL));
  add(dLegL, leg(-1, dLegL <= dLegR));

  // ---- arms: shoulder → dropped elbow → hand on the keyboard ----
  const dArmR = D(5, 11.5), dArmL = D(5, -11.5);
  const arm = (r, far) => () => {
    const sleeve = far ? shirtS : shirt, hand = far ? skinS : skin;
    const ex = X(3.5, r * 10.5), hx2 = X(11, r * 4.2);
    limb(X(-5, r * 11.5), 50, ex, 62, 6, sleeve);   // upper arm (sleeve)
    limb(ex, 62, hx2, 65.5, 4.4, hand);             // bare forearm
    ellip(hx2, 66, 2.6, 2.3, hand, 1.6);            // hand
  };
  add(dArmR, arm(1, dArmR < dArmL));
  add(dArmL, arm(-1, dArmL <= dArmR));

  // ---- body core: seat cushion, neck, torso, collar (depth 0) ----
  add(0, () => {
    const sw = Math.hypot(15.5 * C, 12 * S);
    quad([[CX - sw, seatY - 4], [CX + sw, seatY - 4], [CX + sw * 0.9, seatY + 4], [CX - sw * 0.9, seatY + 4]], chair, 2.2);
    g.strokeStyle = chairH; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(CX - sw * 0.8, seatY - 2.2); g.lineTo(CX + sw * 0.8, seatY - 2.2); g.stroke();
    limb(hx, 38, hx, 50, 5.4, skinS);               // neck, tucked under the jaw
    const wSh = Math.hypot(13.5 * C, 8.5 * S), wHip = Math.hypot(11.5 * C, 8 * S);
    quad([[hx - wSh, shY - 2], [hx + wSh, shY - 2], [CX + wHip, hipY + 2], [CX - wHip, hipY + 2]], shirt, 2.2);
    g.strokeStyle = shirtS; g.lineWidth = 1.2;      // hem
    g.beginPath(); g.moveTo(CX - wHip * 0.85, hipY - 1); g.lineTo(CX + wHip * 0.85, hipY - 1); g.stroke();
    ellip(hx, shY - 0.5, 4.6, 2.3, shirtH, 1.6);    // collar
  });

  // ---- head unit: constant depth between torso (0) and the backrest when
  //      it swings near (+9.5), so the face is always over the shirt and the
  //      chair back correctly overlaps the head from behind ----
  add(2.5, () => {
    const earX = (r) => hx + r * 9.3 * C;
    const nearR = S >= 0 ? -1 : 1;                  // which ear faces the camera
    // Ears foreshorten with the turn: edge-on slivers at dead front/back,
    // widest in profile. The inner fold only reads once the ear is side-on.
    const earW = 0.8 + 1.9 * Math.abs(S);
    const ear = (r) => {
      ellip(earX(r), 31.5, earW, 2.7 + 0.5 * Math.abs(S), skin, 1.6);
      if (Math.abs(S) > 0.45) { g.fillStyle = skinS; g.fillRect(earX(r) - 0.7, 30.6, 1.4, 1.9); }
    };
    const knot = () => ellip(hx - 7.5 * S, 20.5, 3.7, 3.3, hair, 1.8);
    const earsBehind = C < -0.05;

    // the far ear only shows near dead front/back — mid-turn it is occluded
    if (Math.abs(C) > 0.55) ear(-nearR);
    if (earsBehind) ear(nearR);
    if (style === 'bun' && C > 0) knot();

    ellip(hx, hy, 10.5, 11, skin, 2.2);             // skull
    if (style !== 'bald' && style !== 'mohawk') {
      // hair fills the whole crown, then the face is re-exposed toward the
      // camera — the back of the head is never bare and there is no cap seam.
      // The cover matches the skull exactly (an offset leaves a seam line at
      // the nape) and the carve is generous, so the hair is a thin cap, not
      // half a ball worn on the head.
      ellip(hx, hy, 10.5, 11, style === 'buzz' ? shade(hair, 0.8) : hair);
      if (C > -0.05) {
        ellip(hx + S * 4.6, hy + 2.1, 9.9, 10.1, skin);
        if (style !== 'buzz') { g.fillStyle = hair; g.fillRect(hx + S * 5 - 4.4, hy - 8.4, 8.8, 3); }
      }
    }
    if (C <= 0 && style === 'bun') knot();

    if (C > -0.05) {                                 // face features
      const fx2 = hx + S * 6.4, eyeC = '#241a2e';
      const two = C > 0.32;
      const sep = 2.1 + 2.6 * Math.max(C, 0);
      const eyes = two ? [fx2 - sep, fx2 + sep] : [hx + S * 7.3];
      g.fillStyle = style === 'bald' ? shade(skin, 0.62) : hairS;   // brows
      for (const ex2 of eyes) g.fillRect(ex2 - 1.8, 26.2, 3.6, 1.3);
      if (o.glasses) {
        g.strokeStyle = eyeC; g.lineWidth = 1.3;
        for (const ex2 of eyes) g.strokeRect(ex2 - 2.3, 27.4, 4.6, 4);
        g.beginPath();
        if (two) { g.moveTo(eyes[0] + 2.3, 28.8); g.lineTo(eyes[1] - 2.3, 28.8); }
        else { g.moveTo(eyes[0] - Math.sign(S || 1) * 2.6, 29.2); g.lineTo(earX(nearR), 30.2); }
        g.stroke();
      }
      g.fillStyle = eyeC;
      for (const ex2 of eyes) g.fillRect(ex2 - 0.9, 28.6, 1.8, 1.9);
      g.strokeStyle = skinS; g.lineWidth = 1.3;      // mouth
      g.beginPath(); g.moveTo(fx2 - 1.9, 38.2); g.quadraticCurveTo(fx2, 39.3, fx2 + 1.9, 38.2); g.stroke();
    }
    if (style === 'mohawk') {                        // crest along the midline
      if (Math.abs(S) < 0.22) rrect(hx - 1.7, 12.6, 3.4, 8.6, 1.5, hair, 1.8);
      else {
        const top = (f) => 19.6 + Math.pow(f / 10.5, 2) * 6.5;
        const pts = [];
        for (let f = -8; f <= 6.01; f += 2) pts.push([hx + f * S, top(f) - 7]);
        for (let f = 6; f >= -8.01; f -= 2) pts.push([hx + f * S, top(f) + 0.6]);
        quad(pts, hair, 1.8);
      }
    }
    if (!earsBehind) ear(nearR);
  });

  // ---- laptop: base slab on the thighs, lid hinged at the far edge and tilted
  //      outward (its top leans away from the dev). The display faces the DEV:
  //      from the front we see the lid back with the logo, and the glowing
  //      screen only shows over their shoulder when they face away ----
  add(D(13.5, 0) + 0.01, () => {
    const w = 3.5 + 13.5 * Math.abs(C);
    const rx = X(8.5, 0), fx2 = X(15.5, 0);
    quad([[rx - w * 0.9, 63.5], [rx + w * 0.9, 63.5], [fx2 + w, 67.2], [fx2 - w, 67.2]], lapS, 2);
    const bx = X(16, 0), tx = X(19.5, 0);          // top leans forward, past the hinge
    quad([[bx - w, 66], [bx + w, 66], [tx + w * 0.96, 50.5], [tx - w * 0.96, 50.5]], lap, 2.2);
    if (C > 0.15) {
      ellip((bx + tx) / 2, 58, 2.3, 2.3, lapH);     // logo on the lid back
    } else if (C < -0.15) {                         // the screen, seen from behind the dev
      const iw = w - 2.2;
      quad([[bx - iw, 63.8], [bx + iw, 63.8], [tx + iw, 52.3], [tx - iw, 52.3]], '#bfeaff');
      g.fillStyle = 'rgba(90,140,190,0.55)';        // little UI rows on the screen
      g.fillRect(tx - iw + 1, 54, Math.max(1, iw), 1.4);
      g.fillRect(tx - iw + 1, 57, Math.max(1, iw * 1.4), 1.4);
    }
  });

  parts.sort((p, q) => p.d - q.d);
  for (const p of parts) p.fn();
  g.lineJoin = 'miter'; g.lineCap = 'butt';
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
  g.drawImage(deskImg, 64, 4); g.drawImage(deskImg, VW - 120, 4);
  g.drawImage(whiteboardImg, VW - 110, VH - 20);
  return c;
})();

// ---------------------------------------------------------------- audio
// Every sound is synthesized at runtime — no sample files, no loader, no
// network, so the game stays a two-file drop-in. Three voices cover the whole
// soundtrack:
//   noise() — filtered noise burst: keyboards, knocks, whooshes, modem hiss
//   bell()  — two-operator FM: the entire notification-chime family
//   tone()  — plain oscillator, optional pitch glide and formant filter
// They all land on master → compressor → out, so a held trigger can't clip the
// mix, and each sfx is rate-limited so dense frames don't smear into mush.
//
// The palette is deliberately office-flavoured: firing is a keyboard, a kill is
// a ticket-closed chime, taking a hit is an error dialog, and a boss arrives
// over a 56k handshake. They're original synths, not the real Slack/Windows
// sounds — same reflex, nothing borrowed.

let actx = null, master = null, verb = null, noiseBuf = null;
let muted = false;
const VOLUME = 0.85;
try { muted = localStorage.getItem('jiraBlasterMute') === '1'; } catch (e) { /* private mode */ }

function initAudio() {
  // resume() rejects if the gesture didn't count (Safari is picky); the next
  // input will call through here again, so swallowing it is the whole recovery.
  if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }

  master = actx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  // Rapid fire stacks a dozen voices per second; the compressor rides those
  // peaks instead of letting them clip the sum.
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 14; comp.ratio.value = 6;
  comp.attack.value = 0.003; comp.release.value = 0.16;
  master.connect(comp); comp.connect(actx.destination);

  // A small algorithmic room — decaying noise as the impulse response. It is
  // the whole difference between "a beep" and "a sound in a room".
  const conv = actx.createConvolver();
  conv.buffer = renderNoise(0.34, 2.6, 2);
  verb = actx.createGain(); verb.gain.value = 0.5;
  verb.connect(conv); conv.connect(master);

  noiseBuf = renderNoise(1, 0, 1);
  if (actx.state === 'suspended') actx.resume().catch(() => {});
}

// decay 0 → flat white noise (the reusable source); >0 → a decaying tail (the
// reverb impulse).
function renderNoise(dur, decay, chans) {
  const n = Math.max(1, Math.floor(actx.sampleRate * dur));
  const b = actx.createBuffer(chans, n, actx.sampleRate);
  for (let c = 0; c < chans; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (decay ? Math.pow(1 - i / n, decay) : 1);
  }
  return b;
}

// Attack + exponential decay. The attack is what separates a click from a
// chime: 1 ms reads as mechanical, 20 ms+ reads as a tone.
function envelope(t0, peak, atk, dur) {
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dur);
  return g;
}

// Dry to the master bus, plus an optional tap into the reverb.
function route(src, g, send) {
  src.connect(g); g.connect(master);
  if (send) { const s = actx.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); }
}

function tone(o) {
  const atk = o.a == null ? 0.004 : o.a, t0 = actx.currentTime + (o.at || 0);
  const osc = actx.createOscillator();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + atk + o.dur);
  let out = osc;
  if (o.filter) {
    // A formant is a resonance, not a brick wall: peaking EQ lifts the band
    // and leaves the rest of the tone's weight intact. A bandpass here would
    // throw away the fundamental and gut the level.
    const pk = actx.createBiquadFilter();
    pk.type = 'peaking'; pk.frequency.value = o.filter.f;
    pk.Q.value = o.filter.q || 1; pk.gain.value = o.filter.g == null ? 12 : o.filter.g;
    out.connect(pk); out = pk;
  }
  if (o.lp) { // tame a buzzy sawtooth without changing how heavy it sits
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = 0.7;
    out.connect(lp); out = lp;
  }
  route(out, envelope(t0, o.vol, atk, o.dur), o.send);
  osc.start(t0); osc.stop(t0 + atk + o.dur + 0.03);
}

function noise(o) {
  const atk = o.a == null ? 0.001 : o.a, t0 = actx.currentTime + (o.at || 0);
  const src = actx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const bq = actx.createBiquadFilter();
  bq.type = o.type || 'bandpass';
  bq.frequency.setValueAtTime(o.f, t0);
  if (o.f2) bq.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + atk + o.dur);
  bq.Q.value = o.q == null ? 1 : o.q;
  src.connect(bq);
  route(bq, envelope(t0, o.vol, atk, o.dur), o.send);
  // Random start offset, so repeated bursts aren't the identical waveform.
  src.start(t0, Math.random() * 0.9); src.stop(t0 + atk + o.dur + 0.03);
}

// Two-operator FM: the modulator bends the carrier's frequency. Integer ratios
// ring like a bell or marimba; an inharmonic one (1.41) clangs.
function bell(o) {
  const atk = o.a == null ? 0.003 : o.a, t0 = actx.currentTime + (o.at || 0);
  const car = actx.createOscillator(), mod = actx.createOscillator();
  car.type = 'sine'; mod.type = 'sine';
  car.frequency.value = o.f;
  mod.frequency.value = o.f * (o.ratio || 2);
  // The modulation index decays faster than the note: bright strike, pure tail.
  const mg = actx.createGain();
  mg.gain.setValueAtTime(o.index || 200, t0);
  mg.gain.exponentialRampToValueAtTime(0.01, t0 + o.dur * 0.6);
  mod.connect(mg); mg.connect(car.frequency);
  route(car, envelope(t0, o.vol, atk, o.dur), o.send);
  const end = t0 + atk + o.dur + 0.03;
  mod.start(t0); car.start(t0); mod.stop(end); car.stop(end);
}

// `vol` is the envelope peak *before* filtering, so it is not the level you
// hear — a narrow bandpass on noise throws away most of a source's energy, and
// FM spreads it across sidebands. These numbers were calibrated by rendering
// each sound offline and measuring its actual peak (see audio-test.html), so
// the mix sits in three tiers: constant sounds ~0.12, punctuation ~0.20,
// once-a-sprint drama ~0.34. Re-run the harness after changing any of them.
const VOICES = {
  // Firing is typing. Clacky top end plus a little keycap thock underneath.
  shoot: () => {
    noise({ f: rnd(1900, 2700), q: 1.4, dur: 0.024, vol: 0.64 });
    tone({ f: rnd(150, 190), f2: 90, dur: 0.03, type: 'sine', vol: 0.4 });
  },
  hit: () => {
    noise({ f: rnd(900, 1300), q: 1.2, dur: 0.03, vol: 0.65 });
    tone({ f: 200, f2: 150, dur: 0.04, type: 'square', vol: 0.35 });
  },
  // Landing the matching language is the Enter key: heavier clack, bright tick.
  crit: () => {
    noise({ f: 2600, q: 2, dur: 0.03, vol: 0.6 });
    bell({ f: 1568, ratio: 2, index: 320, dur: 0.16, vol: 0.48, send: 0.3 });
  },
  // Ticket closed — a resolved fifth, the sound of the column moving to Done.
  kill: () => {
    bell({ f: 784, ratio: 3.5, index: 480, dur: 0.34, vol: 0.26, send: 0.5 });
    bell({ f: 1175, ratio: 2, index: 200, dur: 0.26, vol: 0.15, at: 0.045, send: 0.5 });
  },
  // Two soft woody taps — the "someone messaged you" knock.
  pickup: () => {
    for (const at of [0, 0.088]) {
      noise({ f: 430, q: 3.2, dur: 0.055, vol: 0.28, at, send: 0.25 });
      tone({ f: 196, f2: 150, dur: 0.06, type: 'sine', vol: 0.19, at });
    }
  },
  // Error dialog: a falling fourth, sine body with a triangle octave on top.
  hurt: () => {
    tone({ f: 622, dur: 0.17, type: 'sine', vol: 0.25, a: 0.008, send: 0.3 });
    tone({ f: 1244, dur: 0.17, type: 'triangle', vol: 0.07, a: 0.008 });
    tone({ f: 466, dur: 0.34, type: 'sine', vol: 0.25, a: 0.008, at: 0.18, send: 0.35 });
    tone({ f: 932, dur: 0.34, type: 'triangle', vol: 0.07, a: 0.008, at: 0.18 });
  },
  // The rubber duck, with a throat.
  quack: () => tone({ f: 380, f2: 210, dur: 0.13, type: 'sawtooth', vol: 0.32, filter: { f: 1100, q: 4, g: 16 }, lp: 3200, send: 0.2 }),
  // New ticket assigned to you. Glockenspiel, gone in a third of a second.
  ding: () => bell({ f: 1568, ratio: 3, index: 300, dur: 0.3, vol: 0.48, send: 0.55 }),
  // Pager alert — two tones trading places.
  siren: () => {
    tone({ f: 880, f2: 660, dur: 0.13, type: 'square', vol: 0.073, filter: { f: 2200, q: 1, g: 8 }, lp: 4000 });
    tone({ f: 660, f2: 880, dur: 0.13, type: 'square', vol: 0.073, at: 0.14, filter: { f: 2200, q: 1, g: 8 }, lp: 4000 });
  },
  // Access denied. Two detuned squares beating against each other.
  block: () => {
    tone({ f: 150, dur: 0.09, type: 'square', vol: 0.38 });
    tone({ f: 156, dur: 0.09, type: 'square', vol: 0.29 });
    noise({ f: 500, q: 1, dur: 0.05, vol: 0.17 });
  },
  // A near miss: something flies past your ear.
  graze: () => noise({ f: 700, f2: 4200, q: 0.9, dur: 0.14, vol: 1.6, send: 0.3 }),
  // Hardware failure. Inharmonic clang over a dying spindle.
  epicDie: () => {
    noise({ f: 1400, f2: 180, q: 1.2, dur: 0.4, vol: 0.54, send: 0.4 });
    tone({ f: 220, f2: 40, dur: 0.45, type: 'sawtooth', vol: 0.44, lp: 900 });
    bell({ f: 330, ratio: 1.41, index: 600, dur: 0.5, vol: 0.25, at: 0.03 });
  },
  // Build passed: a major arpeggio climbing out of the pipeline.
  wave: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    bell({ f, ratio: 4, index: 260, dur: 0.34, vol: 0.21, at: i * 0.085, send: 0.5 })),
  // Shutting down. Four notes down, the last one left hanging.
  over: () => {
    [587.33, 493.88, 392, 293.66].forEach((f, i) =>
      tone({ f, dur: i === 3 ? 0.9 : 0.3, type: 'triangle', vol: 0.23, a: 0.02, at: i * 0.22, send: 0.6 }));
    tone({ f: 147, f2: 55, dur: 1.1, type: 'sawtooth', vol: 0.17, a: 0.05, at: 0.66, lp: 420 });
  },
  // Dial-up handshake, abridged: touch-tone dialling, the 2100 Hz answer tone,
  // the dual-tone warble, then the carrier scramble. ~1.7s of pure 1998.
  bossIn: () => {
    [[697, 1209], [852, 1477], [770, 1336]].forEach((pair, i) => {
      tone({ f: pair[0], dur: 0.075, type: 'sine', vol: 0.09, at: i * 0.13 });
      tone({ f: pair[1], dur: 0.075, type: 'sine', vol: 0.09, at: i * 0.13 });
    });
    tone({ f: 2100, dur: 0.42, type: 'sine', vol: 0.1, a: 0.01, at: 0.46, send: 0.2 });
    tone({ f: 1650, f2: 1180, dur: 0.3, type: 'square', vol: 0.054, at: 0.9, filter: { f: 2000, q: 1, g: 8 }, lp: 4000 });
    tone({ f: 1080, f2: 1750, dur: 0.3, type: 'square', vol: 0.054, at: 0.9, filter: { f: 2000, q: 1, g: 8 }, lp: 4000 });
    noise({ f: 900, f2: 2600, q: 0.9, dur: 0.55, vol: 0.14, a: 0.02, at: 1.15, send: 0.4 });
    noise({ f: 2400, f2: 700, q: 0.8, dur: 0.5, vol: 0.09, a: 0.02, at: 1.2 });
    tone({ f: 110, f2: 55, dur: 0.9, type: 'sawtooth', vol: 0.14, a: 0.03, at: 1.15, lp: 400 });
  },
  // Spindle winds down, then the all-clear chime.
  bossDown: () => {
    noise({ f: 2200, f2: 300, q: 1.6, dur: 0.7, vol: 0.2, send: 0.4 });
    tone({ f: 180, f2: 45, dur: 0.75, type: 'sawtooth', vol: 0.2, lp: 600 });
    [523.25, 783.99, 1046.5].forEach((f, i) =>
      bell({ f, ratio: 3, index: 300, dur: 0.6, vol: 0.21, at: 0.5 + i * 0.11, send: 0.6 }));
  },
};

// Minimum seconds between repeats of the same sound. Held fire and dense hit
// frames would otherwise stack voices faster than the ear can separate them.
const SFX_GAP = { shoot: 0.045, hit: 0.04, crit: 0.04, block: 0.05, graze: 0.06, kill: 0.05, ding: 0.07 };
const lastPlayed = {};
const sfx = {};
for (const name of Object.keys(VOICES)) {
  sfx[name] = () => {
    if (!actx || muted) return;
    const gap = SFX_GAP[name];
    if (gap && lastPlayed[name] > actx.currentTime - gap) return;
    lastPlayed[name] = actx.currentTime;
    VOICES[name]();
  };
}

function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, actx.currentTime, 0.02);
  try { localStorage.setItem('jiraBlasterMute', muted ? '1' : '0'); } catch (e) { /* private mode */ }
}

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
  if (k === 'm') setMuted(!muted);
  if (k === 'i' && state === 'play') {
    autoAim = !autoAim;
    addFloater(player.x, player.y - 16, 'AUTO-AIM ' + (autoAim ? 'ON (SP ×0.6)' : 'OFF'), '#2fe4c8');
  }
  if (k === 'o' && state === 'play') {
    autoShoot = !autoShoot;
    addFloater(player.x, player.y - 16, 'AUTO-SHOOT ' + (autoShoot ? 'ON (SP ×0.6)' : 'OFF'), '#2fe4c8');
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
  if (state === 'menu') {
    const q = canvasPos(e);
    for (const h of menuHits) if (inRect(q, h)) { h.act(); return; } // leaderboard / debug slider
    openSetup();
    return;
  }
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
  if (state === 'play' && paused && debugMode) {
    const q = canvasPos(e);
    for (const h of debugHits) if (inRect(q, h)) { h.act(); return; } // jump to a sprint
    return; // clicks on the debug pause overlay never fire the gun
  }
  mouse.down = true; // click/tap = fire along the current facing
});
addEventListener('pointerup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- state
let state = 'menu'; // 'menu' | 'setup' | 'play' | 'over'
let paused = false;
let autoAim = false, autoShoot = false; // assist toggles (I / O) — persist across runs
// Debug: flipped by the title-screen slider. When on, pausing shows a level
// jumper on the left so boss difficulty can be tuned without grinding to it.
let debugMode = false;
const DEBUG_MAX_SPRINT = 34;
const menuHits = [];   // title-screen click targets (the debug slider), rebuilt each frame
const debugHits = [];  // debug pause-overlay click targets (the level list), rebuilt each frame
let lang = 0; // equipped language (keys 1/2/3) — persists across runs
let t = 0;              // in-game time
let menuT = 0;          // menu animation clock
let overTimer = 0;      // time since game over
let shake = 0;

let player, bullets, enemies, particles, floaters, pickups;
let sprint, phase, breakTimer, spawnQueue, spawnTimer, spawnInterval, meetingCd;
// Sprint deadline: seconds until "standup". When it hits, every live and future
// ticket of the sprint enrages (faster, red, worth ×1.5). Boss sprints untimed.
let deadlineT = 0;
// Tickets that outlived their sprint. They're swept off the field into three
// edge cages — one per area — and released all at once when the next sprint
// starts. Entries are the live enemy objects themselves, so hp, BLOCKED BY
// links and every other bit of state survive the trip.
let backlog = [];
const BACKLOG_MAX = 24; // past this the oldest get written off — see sweepToBacklog
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
// Setup preview turntable: `devAngle` advances at DEV_SPIN while not frozen, and
// drives BOTH the front turnaround and the top-down sprite so they stay locked.
// Freezing (the FREEZE button, or a step arrow) lets you inspect a fixed angle.
let devAngle = 0, devSpinPaused = false, lastDevT = 0;

// The single most important tuning knob: chair turn rate vs. telegraph time.
// π rad/s → a worst-case 180° aim takes 1.0s; the 1.5s wind-up plus letter
// travel time keeps every death theoretically avoidable.
const CHAIR_TURN = Math.PI;   // rad/s
const WINDUP_TIME = 1.5;      // seconds-from-contact when a ticket flashes red
const CHAIN_WINDOW = 1.2;     // seconds between kills to keep the chain alive
const CHAIN_MAX = 8;
const GRAZE_PX = 8;           // near-miss distance that pays out
// Shared turnaround speed for the two dev previews on the setup screen (front
// portrait + top-down sprite), so one spin of each takes exactly the same time.
const DEV_SPIN = 1.9;         // rad/s — a brisk spin (TAU / 1.9 ≈ 3.3s per turn)

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

// Every 4th sprint is a boss instead of a Sprint Planning burst: one named
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
  devSpinPaused = false;   // always arrive spinning
  lastDevT = menuT;        // so the first frame adds ~0, not a jump
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
  deadlineT = 0; backlog = [];
  combo = 1; comboT = 0; hitFreeze = 0; culprit = null;
  bossParts = []; bossDef = null; bossMaxHp = 0; bossBanner = 0;
}

// ---------------------------------------------------------------- sprints
// Escalating density, never new rules after sprint 3:
// sprint 1 = Bugs, 2 = +Stories (meetings start drifting in), 3 = +Epics & Hotfixes.
function buildSprint(n) {
  if (n % 4 === 0) return []; // boss sprint: the boss is the whole wave
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

// ---------------------------------------------------------------- backlog
// Three holding pens, one per area, each on the edge that area's language
// fires from: frontend piles up on the left, backend along the top, infra on
// the right. Sized as fractions so they follow the phone's wider playfield.
function cageRect(area) {
  if (area === 'be') return { x: VW * 0.24, y: 30, w: VW * 0.52, h: 15, horiz: true };
  const h = VH * 0.54, y = VH * 0.24;
  return area === 'fe' ? { x: 3, y, w: 15, h, horiz: false }
                       : { x: VW - 18, y, w: 15, h, horiz: false };
}

// Where the i-th of n tickets sits inside its pen. They stack from the near
// end so a pen visibly fills as work piles up; past what fits, the step
// shrinks and they overlap rather than spilling out.
function cageSlot(area, i, n) {
  const r = cageRect(area);
  const span = r.horiz ? r.w : r.h;
  const step = Math.min(10, (span - 8) / Math.max(1, n));
  const along = (r.horiz ? r.x : r.y) + 4 + step * (i + 0.5);
  return r.horiz ? { x: along, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: along };
}

// Sprint's up. Everything still breathing — plus everything that never got to
// spawn — is swept off the field into the cages instead of vanishing for free.
function sweepToBacklog() {
  const caged = [];
  for (const e of enemies) {
    if (e.boss || e.type === 'meeting') continue;
    addParticles(e.x, e.y, AREAS[e.area].color, 9, 90);
    caged.push(e);
  }
  enemies.length = 0; // meetings expire with the sprint; everything else is caged
  for (const type of spawnQueue) { // never-spawned tickets are unfinished work too
    caged.push(makeEnemy(type, VW / 2, VH / 2));
    enemies.pop(); // makeEnemy puts it on the field; this one belongs in a pen
  }
  spawnQueue.length = 0;

  // A ticket that rotted through a sprint comes back angry. The speed-up lands
  // once — otherwise re-caging the same ticket compounds it into a blur.
  for (const e of caged) if (!e.enraged) { e.sp *= 1.5; e.enraged = true; }

  backlog = backlog.concat(caged);
  let writtenOff = 0;
  if (backlog.length > BACKLOG_MAX) {
    // Left to grow, a bad sprint snowballs into an unplayable wall. The oldest
    // tickets rot out of the backlog as won't-fix.
    writtenOff = backlog.length - BACKLOG_MAX;
    backlog = backlog.slice(-BACKLOG_MAX);
  }
  return { caged: caged.length, writtenOff };
}

// Standup's over: every pen opens at once and the carry-over comes at you
// together, while the new sprint's tickets trickle in on their usual schedule.
function releaseBacklog() {
  if (!backlog.length) return;
  for (const area of AREA_KEYS) {
    const list = backlog.filter(e => e.area === area);
    list.forEach((e, i) => {
      const s = cageSlot(area, i, list.length);
      e.x = s.x; e.y = s.y;
      e.spawnT = 0; // they've had a whole standup to materialize
      // fling them off their wall so the breakout reads, before they start hunting
      const d = Math.hypot(VW / 2 - e.x, VH / 2 - e.y) || 1;
      e.vx = (VW / 2 - e.x) / d * e.sp * 2.2;
      e.vy = (VH / 2 - e.y) / d * e.sp * 2.2;
      e.burstT = rnd(0.35, 0.6); // staggered so they fan out instead of marching
      enemies.push(e);
      addParticles(e.x, e.y, AREAS[area].color, 7, 110);
    });
  }
  addFloater(player.x, player.y - 20, backlog.length + ' CARRIED OVER — BACKLOG RELEASED', '#ff5a6e', true);
  sfx.siren();
  shake += 7;
  backlog = [];
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
    touchCd: 0, spawnT: 0.4, windup: false, grazed: false, grazeArmed: false, vx: 0, vy: 0, burstT: 0,
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
  const step = Math.floor(n / 4) - 1;
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
  // flanker bugs arc around your gun line instead of walking straight in
  if (type === 'bug' && sprint >= 4 && Math.random() < 0.35) e.flank = Math.random() < 0.5 ? 1 : -1;
  // BLOCKED BY: a shielded story that can't be damaged until its linked
  // blocker bug is resolved — kill order becomes a decision
  if (type === 'story' && sprint >= 3 && sprint % 4 !== 0 && Math.random() < 0.25) {
    const b = makeEnemy('bug', clamp(x + rnd(-28, 28), 12, VW - 12), clamp(y + rnd(-28, 28), 12, VH - 12));
    b.spawnT = 0.45;
    e.blockedBy = b;
    e.score = Math.round(e.score * 1.6); // shielded tickets pay better
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
  combo = 1; comboT = 0;        // a hit kills the chain
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
    if (debugMode) {
      // a debug run hops between levels — it never counts: no high score, no
      // board POST. The board is still fetched so the death screen can show it.
      loadBoard();
    } else {
      if (score > high) {
        high = score;
        try { localStorage.setItem('jiraBlasterHigh', String(high)); } catch (err) { /* ignore */ }
      }
      submitScore();
    }
    addParticles(player.x, player.y, '#f0b088', 24, 90);
    sfx.over();
  }
}

// Chain: kills (and grazes) within CHAIN_WINDOW of each other build ×1→×8.
function comboTick() {
  if (comboT > 0) combo = Math.min(CHAIN_MAX, combo + 1);
  comboT = CHAIN_WINDOW;
}

// Assists are convenience, not free: score earned with them on is taxed.
const assistMul = () => (autoAim || autoShoot) ? 0.6 : 1;

function killEnemy(e, silent) {
  enemies.splice(enemies.indexOf(e), 1);
  kills++;
  comboTick();
  const gained = Math.round(e.score * combo * (e.enraged ? 1.5 : 1) * assistMul());
  score += gained;
  // resolving a blocker frees whatever it was blocking
  for (const o of enemies) if (o.blockedBy === e) { o.blockedBy = null; addFloater(o.x, o.y - 8, 'UNBLOCKED!', '#7fe0ff'); }
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
  // pickup drops (bosses hand out their own guaranteed haul, see killBoss).
  // Deliberately stingy — coffee is the rare one, so cups actually matter.
  if (!e.boss) {
    const r = Math.random();
    if (r < 0.02) pickups.push({ kind: 'coffee', x: e.x, y: e.y, life: 12, phase: rnd(0, TAU) });
    else if (r < 0.045) pickups.push({ kind: 'can', x: e.x, y: e.y, life: 12, phase: rnd(0, TAU) });
    else if (r < 0.065) pickups.push({ kind: 'duck', x: e.x, y: e.y, life: 12, phase: rnd(0, TAU) });
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
      // only a hotfix burns itself out on impact — every other ticket keeps
      // fighting after it hits you, so a hit is never a free kill
      if (culprit.type === 'hotfix') {
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
      // the sprint has a standup deadline; boss fights are untimed
      // carry-over counts against the clock too — a sprint that inherits a
      // backlog gets the time to work it, but no more than that
      deadlineT = sprint % 4 === 0 ? 0 : 20 + (spawnQueue.length + backlog.length) * 0.7;
      sfx.wave();
      if (sprint % 4 === 0) spawnBoss(sprint); // boss sprints are the boss, alone
      releaseBacklog(); // the pens open the moment the standup ends
    }
  } else {
    // The standup deadline ends the sprint. Whatever is still alive doesn't
    // get cleared for free — it's swept into the cages and comes back next
    // sprint, angrier, on top of that sprint's own tickets.
    let timedOut = false;
    if (deadlineT > 0) {
      deadlineT -= dt;
      if (deadlineT <= 0) timedOut = true;
    }
    spawnTimer -= dt;
    if (spawnQueue.length && spawnTimer <= 0) {
      spawnEnemy(spawnQueue.shift());
      spawnTimer = spawnInterval * rnd(0.7, 1.3);
    }
    // meeting invites drift in on their own calendar — but never mid-boss
    meetingCd -= dt;
    if (sprint >= 2 && sprint % 4 !== 0 && meetingCd <= 0) {
      if (enemies.filter(e => e.type === 'meeting').length < 2) spawnEnemy('meeting');
      meetingCd = rnd(8, 14);
    }
    const cleared = !spawnQueue.length && !enemies.some(e => e.type !== 'meeting');
    if (cleared || timedOut) {
      const wasBoss = sprint % 4 === 0;
      // Clearing the board early still pays in full; running out the clock
      // pays a third and hands the remainder to next sprint.
      const swept = cleared ? { caged: 0, writtenOff: 0 } : sweepToBacklog();
      const bonus = Math.round((50 + sprint * 25) * (wasBoss ? 3 : 1) * (cleared ? 1 : 0.33) * assistMul());
      score += bonus;
      if (wasBoss) { bossDef = null; bossMaxHp = 0; }
      deadlineT = 0;
      if (cleared) {
        clearMsg = (wasBoss ? 'BOSS DOWN!  +' : 'SPRINT ' + sprint + ' CLEAR!  +') + bonus;
      } else {
        clearMsg = 'SPRINT ' + sprint + ' OVER — ' + swept.caged + ' TO BACKLOG'
          + (swept.writtenOff ? '  (' + swept.writtenOff + ' WRITTEN OFF)' : '');
        sfx.hurt();
        shake += 6;
      }
      addFloater(p.x, p.y - 14, '+' + bonus, cleared ? '#3fe08a' : '#ffb43d');
      sprint++;
      phase = 'break';
      breakTimer = sprint % 4 === 0 ? 3.5 : 3; // extra beat before a boss
      // every 2nd boss cleared = a promotion: +1 max cup, poured full
      if ((sprint - 1) % 8 === 0) {
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
    if (e.burstT > 0) {
      // just kicked out of a cage: it flies its own line clear of the wall
      // before it settles into hunting you
      e.burstT -= dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
    } else if (!selfMoved) {
      // seek player; wobble amplitude is part of the type's identity.
      // Flankers steer through a rotated approach vector: far away they move
      // sideways around your gun line, homing straight only once they're close.
      let sx = ux, sy = uy;
      if (e.flank) {
        const arc = e.flank * Math.min(1, d / 150) * 1.15;
        const ca = Math.cos(arc), sa = Math.sin(arc);
        sx = ux * ca - uy * sa; sy = ux * sa + uy * ca;
      }
      const wob = e.wobAmp ? Math.sin(t * e.wobFreq + e.wobPhase) * e.wobAmp : 0;
      e.x += (sx + -sy * wob) * e.sp * dt;
      e.y += (sy + sx * wob) * e.sp * dt;
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
        const gz = Math.round(50 * assistMul());
        score += gz;
        comboTick();
        addFloater(e.x, e.y - 8, 'GRAZE +' + gz, '#2fe4c8');
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
      } else {
        // no invuln-shred: on invuln frames this is a no-op and the ticket
        // stays alive — walking through a crowd is never a free clear
        damagePlayer(e);
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
        if (e.type === 'meeting' || bossBlocks(e) || (e.blockedBy && enemies.includes(e.blockedBy))) {
          // meeting invites block your letters — infinite HP, zero shame.
          // A boss in its immune window, or a BLOCKED BY ticket whose blocker
          // still lives, shrugs them off the same way.
          addParticles(b.x, b.y, '#5a6a90', 3, 40);
          sfx.block();
          continue outer;
        }
        const matched = e.area && LANGS[b.lang].area === e.area;
        let dmg = matched ? 2 : 1; // right language for the area = double damage
        // heavies resist off-area letters — switching language is the real answer
        if (!matched && e.area && (e.boss || e.type === 'epic')) {
          dmg = 0.5;
          if (!e.resistHint) { e.resistHint = true; addFloater(e.x, e.y - e.r - 8, 'WRONG LANGUAGE — ×½', '#8f8fa8'); }
        }
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
      if (pk.kind === 'duck') { p.duckT = 3; addFloater(pk.x, pk.y, 'DUCK SHIELD!', '#ffd23f'); }
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
    // BLOCKED BY: link line to the blocker + shield border while it lives
    if (e.blockedBy && enemies.includes(e.blockedBy)) {
      ctx.strokeStyle = 'rgba(127,224,255,0.35)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.blockedBy.x, e.blockedBy.y); ctx.stroke();
      ctx.strokeStyle = '#7fe0ff';
      ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
    }
    // carried over from a previous sprint: constant furious red border
    if (e.enraged) {
      ctx.strokeStyle = Math.floor(t * 10) % 2 === 0 ? '#ff5a6e' : '#ff8a5c';
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

  if (state === 'play' && phase === 'break' && backlog.length) drawCages();

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
    if (sprint % 4 === 0) {
      const next = BOSSES[(Math.floor(sprint / 4) - 1) % BOSSES.length];
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
    if (debugMode) drawDebugLevels(); // left-column level jumper
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

// The backlog made visible: three pens holding what didn't get finished,
// rattling against the bars while the standup counts down. Each carries an
// honest count, since past a dozen the tickets inside stack on top of one
// another rather than spilling out of the pen.
function drawCages() {
  ctx.lineWidth = 1;
  for (const area of AREA_KEYS) {
    const list = backlog.filter((e) => e.area === area);
    const r = cageRect(area);
    const col = AREAS[area].color;
    const lit = list.length > 0;

    ctx.fillStyle = 'rgba(8,12,24,0.78)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = lit ? col : '#2a3048';
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    // bars across the short axis — reads as a cage, not a progress bar
    ctx.globalAlpha = lit ? 0.5 : 0.22;
    const span = r.horiz ? r.w : r.h;
    for (let b = 1; b < 6; b++) {
      const at = Math.round((r.horiz ? r.x : r.y) + span * b / 6) + 0.5;
      ctx.beginPath();
      if (r.horiz) { ctx.moveTo(at, r.y + 1); ctx.lineTo(at, r.y + r.h - 1); }
      else { ctx.moveTo(r.x + 1, at); ctx.lineTo(r.x + r.w - 1, at); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    list.forEach((e, i) => {
      const s = cageSlot(area, i, list.length);
      const j = Math.sin(breakTimer * 9 + i * 1.7) * 1.2; // they want out
      const x = Math.round(s.x + (r.horiz ? 0 : j)) - 3;
      const y = Math.round(s.y + (r.horiz ? j : 0)) - 4;
      ctx.fillStyle = '#0d1220';
      ctx.fillRect(x, y, 6, 8);
      ctx.fillStyle = col; // same left-edge area stripe it wears on the field
      ctx.fillRect(x, y, 2, 8);
      ctx.fillStyle = '#5a6a90';
      ctx.fillRect(x + 3, y + 2, 3, 1);
      ctx.fillRect(x + 3, y + 4, 3, 1);
    });

    if (lit) {
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.fillText(list.length, r.x + r.w / 2, r.y - 3);
    }
  }
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
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx, 35, Math.round(9 * p.duckT / 3), 1);
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
    // the clock now ends the sprint rather than enraging it, so it reads hot
    // early: orange under 10s, red under 5 — anything left when it hits is carried
    ctx.fillStyle = deadlineT <= 0 ? '#8f8fa8' : deadlineT < 5 ? '#ff5a6e' : deadlineT < 10 ? '#ff8a5c' : '#8f8fa8';
    ctx.fillText((spawnQueue.length + enemies.length) + ' in sprint'
      + (deadlineT > 0 ? ' · standup in ' + Math.ceil(deadlineT) + 's' : ''), VW / 2, 21);
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
  menuHits.length = 0;
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
  ctx.fillText('Chain kills & graze tickets for bonus SP  ·  P — pause / leaderboard  ·  M — mute', cx, cy + 63);

  if (Math.floor(menuT * 2) % 2 === 0) {
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#3fe08a';
    ctx.fillText('PRESS SPACE TO CLOCK IN', cx, cy + 92);
  }

  // bottom-right: forward to the next page (create-your-dev)
  ctx.font = 'bold 10px monospace';
  uiButton(menuHits, VW - 132, VH - 34, 120, 24, 'CREATE DEV ›', '#3fe08a', openSetup);

  drawDebugToggle(cx, 330); // the debug slider lives at the bottom of the title screen
}

// A bordered button that registers its own click target. The caller sets the
// font first; `hits` is the list to push the target onto (menuHits, etc.).
function uiButton(hits, x, y, w, h, label, fg, act) {
  ctx.fillStyle = 'rgba(8,12,24,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = fg;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = fg;
  ctx.fillText(label, x + w / 2, y + h / 2 + 3);
  hits.push({ x, y, w, h, act });
}

// A rounded pill path (for the classic on/off slider track).
function pill(x, y, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The title-screen debug switch. On → pausing shows a level jumper (see
// drawDebugLevels) for tuning boss difficulty. Registers one generous tap
// target over label + switch so a finger works as well as a mouse.
function drawDebugToggle(cx, y) {
  const tw = 26, th = 12, on = debugMode;
  const tx = Math.round(cx - tw / 2);

  ctx.textAlign = 'right';
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = on ? '#3fe08a' : '#5a6a90';
  ctx.fillText('DEBUG', tx - 8, y + th - 3);

  pill(tx, y, tw, th);
  ctx.fillStyle = on ? 'rgba(63,224,138,0.30)' : 'rgba(90,106,144,0.25)';
  ctx.fill();
  ctx.strokeStyle = on ? '#3fe08a' : '#5a6a90';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(on ? tx + tw - th / 2 : tx + th / 2, y + th / 2, th / 2 - 1.5, 0, TAU);
  ctx.fillStyle = on ? '#3fe08a' : '#8f8fa8';
  ctx.fill();

  if (on) {
    ctx.textAlign = 'center';
    ctx.font = '8px monospace';
    ctx.fillStyle = '#5a6a90';
    ctx.fillText('pause (P) in-game to jump to any sprint', cx, y + th + 12);
  }

  menuHits.push({ x: tx - 48, y: y - 8, w: 48 + tw + 10, h: th + 16, act: () => { debugMode = !debugMode; } });
}

// The left-hand level jumper drawn over the pause screen when debug is on.
// One button per sprint, bosses called out by name; a click drops you in.
function drawDebugLevels() {
  debugHits.length = 0;
  const x = 6, w = 172, rowH = 10, top = 16;

  ctx.textAlign = 'left';
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('DEBUG · JUMP TO', x + 2, top - 5);

  ctx.font = 'bold 7px monospace';
  for (let n = 1; n <= DEBUG_MAX_SPRINT; n++) {
    const yy = top + (n - 1) * rowH;
    const boss = n % 4 === 0;
    const label = boss
      ? 'BOSS ' + (n / 4) + ' · ' + BOSSES[(n / 4 - 1) % BOSSES.length].name
      : 'SPRINT ' + n;
    const cur = n === sprint;
    ctx.fillStyle = boss ? 'rgba(255,90,110,0.16)' : 'rgba(63,224,138,0.10)';
    ctx.fillRect(x, yy, w, rowH - 1);
    ctx.strokeStyle = cur ? '#ffd23f' : boss ? '#ff5a6e' : '#3a6a52';
    ctx.strokeRect(x + 0.5, yy + 0.5, w - 1, rowH - 2);
    ctx.fillStyle = cur ? '#ffd23f' : boss ? '#ff9aa6' : '#dfe6ff';
    ctx.fillText(label, x + 5, yy + rowH - 3);
    debugHits.push({ x, y: yy, w, h: rowH - 1, act: () => jumpToSprint(n) });
  }
}

// Debug: drop straight into sprint n (or its boss). Clears the field and scales
// the player's coffee cups to the promotions they'd have earned reaching it, so
// a boss is fought at its real difficulty. The normal break→wave step spawns it.
function jumpToSprint(n) {
  paused = false;
  sprint = n;
  phase = 'break';
  breakTimer = 0.6;
  bullets = []; enemies = []; particles = []; floaters = []; pickups = [];
  bossParts = []; bossDef = null; bossMaxHp = 0; bossBanner = 0;
  spawnQueue = []; spawnTimer = 0; meetingCd = 6;
  deadlineT = 0; backlog = [];
  combo = 1; comboT = 0; hitFreeze = 0; culprit = null;
  clearMsg = '';
  player.maxHp = 3 + Math.floor((n - 1) / 8); // one promotion per 2nd boss cleared before now
  player.hp = player.maxHp;
  player.x = VW / 2; player.y = VH / 2; player.vx = 0; player.vy = 0;
  player.invuln = 1; player.rapidT = 0; player.duckT = 0;
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

  // advance the shared turntable angle (menuT always ticks, so this is robust
  // regardless of game-pause state); freezing simply stops the accumulation
  if (!devSpinPaused) devAngle += (menuT - lastDevT) * DEV_SPIN;
  lastDevT = menuT;
  const frame = ((Math.floor(devAngle / TAU * 16) % 16) + 16) % 16;

  // portrait: the customizer's 16-frame turnaround
  ctx.fillStyle = 'rgba(47,228,200,0.10)';
  ctx.beginPath(); ctx.ellipse(lx, 262, 58, 11, 0, 0, TAU); ctx.fill();
  ctx.drawImage(portrait(frame), 0, 2, PW, 114, lx - PW, 52, PW * 2, 228);

  // and the top-down sprite you actually play as, directly under the front view
  // on the same vertical axis, driven by the same devAngle so they stay locked
  ctx.save();
  ctx.translate(lx, 306);
  ctx.rotate(devAngle);
  ctx.scale(2, 2);
  ctx.drawImage(devImg, -17, -17);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = '8px monospace';
  ctx.fillStyle = '#5a6a90';
  ctx.fillText('IN GAME', lx, 348);

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
  ctx.font = 'bold 10px monospace';
  btn(236, 208, 396, 24, 'TAB — RANDOMIZE', '#8a63ff', randomizeLook);

  ctx.textAlign = 'center';
  ctx.font = '8px monospace';
  ctx.fillStyle = '#8f8fa8';
  ctx.fillText('type your name  ·  ↑↓ pick a row  ·  ←→ change it', 434, 250);
  ctx.fillText('pants only show here — the game sees you from above', 434, 263);

  // preview turntable: freeze the spin, or step the angle a frame at a time to
  // study the dev from any side (a step arrow freezes on its own) — sits under
  // the name field, right above the spinning dev it controls
  ctx.font = 'bold 9px monospace';
  btn(lx - 80, 53, 22, 16, '‹', '#7fe0ff', () => { devSpinPaused = true; devAngle -= TAU / 16; });
  btn(lx - 55, 53, 110, 16, devSpinPaused ? 'RESUME SPIN' : 'FREEZE SPIN', devSpinPaused ? '#3fe08a' : '#ffd23f', () => { devSpinPaused = !devSpinPaused; });
  btn(lx + 58, 53, 22, 16, '›', '#7fe0ff', () => { devSpinPaused = true; devAngle += TAU / 16; });

  // page navigation: bottom-left back to the welcome screen, bottom-right into
  // the game — mirrors the title screen's forward button
  ctx.font = 'bold 10px monospace';
  btn(8, VH - 34, 68, 24, '‹ BACK', '#5a6a90', () => { state = 'menu'; });
  btn(VW - 108, VH - 34, 96, 24, 'PLAY ›', '#3fe08a', confirmSetup);
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
    ctx.fillText(board.status === 'sending' ? (withRank ? 'posting your run…' : 'loading the board…')
      : board.status === 'error' ? (withRank ? 'board unreachable — this run was not saved' : 'board unreachable')
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
