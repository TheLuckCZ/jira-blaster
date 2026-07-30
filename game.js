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

// ---------------------------------------------------------------- render scale
// The world is always laid out in 640×360 game units — every position, size and
// font in this file is in those units and none of them change here. What this
// dial changes is how many real pixels each unit is rasterized into.
//
//   BIG   (1×) backbuffer 640×360   — the original chunky look
//   SMALL (2×) backbuffer 1280×720  — same layout, twice the rasterization
//
// It is NOT the VW/VH size dial: raising that would widen the arena and change
// the game. This keeps the arena identical and only sharpens how it is drawn.
//
// The big win is text: an 8px font rasterized into 16 real pixels has genuine
// extra detail, where the same glyph blown up 2× afterwards has none — which is
// why the HUD was hard to read. Tickets sharpen too, because they are drawn
// ROTATED by their wobble, and a rotation resolved at 2× has half-size
// stair-steps along every edge. The art's own pixel grid is unchanged, so it
// still reads as pixel art — it just stops looking smeared at the corners.
let hiRes = false;
try { hiRes = localStorage.getItem('jiraBlasterHiRes') === '1'; } catch (e) { /* private mode */ }
const RS = () => (hiRes ? 2 : 1);

const ctx = canvas.getContext('2d');
function applyRes() {
  // assigning width/height wipes all context state, so anything sticky has to
  // be re-set right after — imageSmoothingEnabled is the one that matters, and
  // losing it silently turns every sprite into a blurry mess
  canvas.width = VW * RS();
  canvas.height = VH * RS();
  ctx.imageSmoothingEnabled = false;
  resize();
}
function setHiRes(v) {
  hiRes = v;
  try { localStorage.setItem('jiraBlasterHiRes', hiRes ? '1' : '0'); } catch (e) { /* private mode */ }
  applyRes();
}

// The backbuffer is always 640×360 — there is only ever one resolution in this
// game, and every sprite is generated in code — so filling the window is purely
// a question of how the canvas is stretched by CSS.
//
// This used to floor to a whole multiple, which kept every game pixel exactly
// square but left bars on any window that wasn't a 16:9 multiple, and (per
// docs/MOBILE-PORT.md) overflowed a phone because it also clamped to a minimum
// of 1×. Scaling fractionally fills the largest 16:9 box the window can hold,
// in both directions. The trade is that at, say, 3.4× some source rows land on
// 3 device pixels and some on 4, so the art shimmers very slightly in motion —
// `image-rendering: pixelated` keeps it crisp-but-uneven rather than blurry,
// which is the right way round for pixel art.
//
// The aspect ratio is deliberately preserved: stretching to 100%×100% would
// turn every disc — the chair, the graze ring, the meeting's invite radius —
// into an ellipse.
function resize() {
  const s = Math.max(0.1, Math.min(innerWidth / VW, innerHeight / VH));
  canvas.style.width = VW * s + 'px';
  canvas.style.height = VH * s + 'px';
}
addEventListener('resize', resize);
applyRes();   // sizes the backbuffer for the saved mode, then lays it out

// Real fullscreen, independent of the scaling above: whatever the window
// becomes, resize() fills it. The documentElement goes fullscreen rather than
// the canvas so the page's backdrop still shows in the letterbox margin
// instead of a flat black bar.
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFullscreen() {
  try {
    if (fsOn()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) Promise.resolve(exit.call(document)).catch(() => {});
    } else {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      // rejects unless it came from a real gesture — the next click can retry
      if (req) Promise.resolve(req.call(el)).catch(() => {});
    }
  } catch (e) { /* unsupported — the button just does nothing */ }
}
// the resize event usually follows on its own, but not on every browser
addEventListener('fullscreenchange', resize);
addEventListener('webkitfullscreenchange', resize);

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
function buildDevImg(o, scr) {
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
  // The laptop display shows what you are about to fire. It is the only part of
  // the sprite that isn't the dev's own choice of colours, and it means the
  // equipped language is readable from the chair itself — you never have to
  // look away to the HUD to check what a letter will do to a stripe.
  rf(g, cx - 5, cy - 15, 10, 2, scr || PAL.screen);
  disc(g, cx, cy, 11, PAL.rim, (dx, dy) => dy < -2 && dx * dx + dy * dy >= 108);
  return c;
}
// The sprite is baked once and reused, so it has to be rebuilt when either
// input to it changes: the dev's look, or the equipped language now that the
// laptop shows it. Invalidating lazily on read rather than hooking every
// assignment to `lang` — the autotest and the auto-aim assist both set it
// directly, and a hook would have to catch every one of them.
let devImg = buildDevImg(look), devImgLang = -1;

function devSprite() {
  if (devImgLang !== lang) {
    devImg = buildDevImg(look, LANGS[lang].color);
    devImgLang = lang;
  }
  return devImg;
}

function applyLook() {
  devImgLang = -1;   // force a rebuild on next draw, in the current language
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
  { name: 'JAVA', area: 'be',    color: AREAS.be.color },
  { name: 'BASH', area: 'infra', color: AREAS.infra.color },
];

const GLYPHS = Object.keys(FONT);
// Every glyph as a 5×7 sprite in one color, outlined so it reads over any
// floor tile. The player's letters use one set per language; the code a boss
// throws back uses the same builder in its own colors — see HAZARD_IMG.
function glyphSet(color) {
  const set = {};
  for (const ch of GLYPHS) {
    const c = cvOf(5, 7), g = c.getContext('2d');
    const plot = (ox, oy, col) => {
      for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++)
        if (FONT[ch][r][k] === '1') rf(g, ox + k, oy + r, 1, 1, col);
    };
    plot(0, 1, PAL.outline); plot(2, 1, PAL.outline); plot(1, 2, PAL.outline);
    plot(1, 1, color);
    set[ch] = c;
  }
  return set;
}
const GLYPH_IMG = LANGS.map((L) => glyphSet(L.color));

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
  loadSamples(); // async; until they land, every voice plays its synth version
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
  // Sample-first voices, added with the retro pack (SAMPLES below). The first
  // two fall back to their nearest synth relative; `trace` and `click` are
  // sample-only — without the files those events stay silent, exactly as they
  // were before the pack.
  canPickup: () => VOICES.pickup(),  // energy drink — the can
  bossDie: () => VOICES.bossDown(),  // a boss actually dying
  trace: () => {},                   // the Monolith's stack-trace ring firing
  click: () => {},                   // any UI hit-target
};

// Minimum seconds between repeats of the same sound. Held fire and dense hit
// frames would otherwise stack voices faster than the ear can separate them.
const SFX_GAP = { shoot: 0.045, hit: 0.04, crit: 0.04, block: 0.05, graze: 0.06, kill: 0.05, ding: 0.07 };
const lastPlayed = {};
// ---------------------------------------------------------------- samples
// Retro one-shots from Juhani Junkala's "Essential Retro Video Game Sound
// Effects Collection" (CC0), picked per event and layered OVER the synth: a
// voice listed here plays its sample, everything else stays synthesised, and
// if the files fail to load — offline, blocked, a bad deploy — every voice
// falls back to the synth and the game sounds exactly as it did before.
//
// The four voices deliberately NOT sampled are the ones whose synth versions
// carry the office joke the pack can't tell: `over` (a machine powering
// down), `quack` (a rubber duck), `graze` (a filtered noise sweep past your
// ear), and `block` — the two detuned squares beating against each other that
// say ACCESS DENIED when your letters bounce off a meeting invite or an
// immune boss. Add a name here to sample it too.
//
// WAV, not MP3: `shoot` fires up to 22×/second, and MP3 encoder delay prepends
// silence that decodeAudioData does not reliably strip. 22.05 kHz mono keeps
// the whole set at ~450 KB.
// Gains are NOT taste — each was measured. The sources are all ~-6 dB, which
// put every one of them a tier or two too loud (`crit` landed at 0.34, level
// with a boss dying). Each buffer's true peak was read back at the context
// sample rate and the gain solved so the sound lands in the tier its synth
// counterpart occupies — the same three tiers VOICES documents above:
// constant ~0.12, punctuation ~0.20, once-a-sprint drama ~0.34.
// Re-measure if you swap a source; the pack's files are not level with each other.
const SAMPLES = {
  shoot:    0.20,   // single shot — the shortest in the pack, so rapid fire stays clean
  hit:      0.22,
  crit:     0.26,   // sits just above `hit`, so a matched letter reads as better
  kill:     0.40,   // a coin: the ticket moved to Done
  ding:     0.38,   // new ticket assigned
  pickup:   0.37,
  hurt:     0.35,
  siren:    0.41,
  epicDie:  0.63,
  wave:     0.60,   // fanfare: the sprint starts
  bossDown: 0.83,   // mid-fight all-clear cues (scope clear, branch clean)
  canPickup: 0.36,  // energy drink: CRUNCH MODE
  bossDie:  0.55,   // a boss actually dying
  trace:    0.36,   // the Monolith's stack-trace ring firing
  click:    0.26,   // any UI hit-target
  bossIn:   0.67,   // mechanical grind — the dial-up synth stays the fallback
};
const sampleBuf = {};
let samplesAsked = false;

// Resolved against game.js's own URL, not the page's. The game ships as a git
// submodule inside the apex site at /game/jira-blaster/, and is also loaded by
// a probe harness from another directory — a page-relative 'sounds/…' silently
// 404s in both cases and drops the whole layer back to the synth, which looks
// exactly like "the samples didn't work" and is miserable to diagnose.
// Read at parse time: document.currentScript is null once handlers run.
const ASSET_BASE = (() => {
  const s = document.currentScript && document.currentScript.src;
  return s ? s.replace(/[^/]*$/, '') : '';
})();

function loadSamples() {
  if (samplesAsked || !actx) return;
  samplesAsked = true;
  for (const name of Object.keys(SAMPLES)) {
    fetch(ASSET_BASE + 'sounds/' + name + '.wav')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => actx.decodeAudioData(b))
      .then((buf) => { sampleBuf[name] = buf; })
      .catch(() => { /* stays on the synth voice — nothing to report */ });
  }
}

function playSample(buf, gain) {
  const src = actx.createBufferSource();
  src.buffer = buf;
  const g = actx.createGain();
  g.gain.value = gain;
  route(src, g, 0.12);   // a touch of the same room the synth voices sit in
  src.start();
}

const sfx = {};
for (const name of Object.keys(VOICES)) {
  sfx[name] = () => {
    if (!actx || muted) return;
    const gap = SFX_GAP[name];
    if (gap && lastPlayed[name] > actx.currentTime - gap) return;
    lastPlayed[name] = actx.currentTime;
    const buf = sampleBuf[name];
    if (buf) playSample(buf, SAMPLES[name]);
    else VOICES[name]();
  };
}

function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, actx.currentTime, 0.02);
  try { localStorage.setItem('jiraBlasterMute', muted ? '1' : '0'); } catch (e) { /* private mode */ }
}

// ---------------------------------------------------------------- input
const keys = {};
// x/y is the last pointer position on the 640×360 grid — the difficulty screen
// uses it to show the hovered level's numbers. Stays at -1,-1 until the pointer
// first moves, so keyboard-only play never has a phantom hover.
const mouse = { down: false, x: -1, y: -1 };

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  initAudio();
  // The setup screen owns the keyboard — every printable key is text there, so
  // none of the shortcuts below (M, I, O, 1-3, P, R) may fire while typing.
  if (state === 'setup') { setupKey(e); return; }
  // above the per-screen handlers so F works everywhere except the name field,
  // which is the one place a printable key has to stay text
  if (k === 'f') { toggleFullscreen(); return; }
  if (k === 'g') { setHiRes(!hiRes); return; }   // pixel size: BIG / SMALL
  if (state === 'diff') { diffKey(e); return; }
  if (state === 'help') { helpKey(e); return; }
  // H is the help page from anywhere it can't be mistaken for typing
  if (k === 'h' && (state === 'menu' || (state === 'play' && paused))) {
    openHelp(state === 'menu' ? 'menu' : 'play');
    return;
  }
  if (k === 'm') setMuted(!muted);
  if (k === 'i' && state === 'play') {
    if (!curDiff().assists) { addFloater(player.x, player.y - 16, 'NO ASSISTS ON ' + curDiff().name, '#8f8fa8'); }
    else {
      autoAim = !autoAim;
      addFloater(player.x, player.y - 16, 'AUTO-AIM ' + (autoAim ? 'ON (SP ×0.6)' : 'OFF'), '#2fe4c8');
    }
  }
  if (k === 'o' && state === 'play') {
    if (!curDiff().assists) { addFloater(player.x, player.y - 16, 'NO ASSISTS ON ' + curDiff().name, '#8f8fa8'); }
    else {
      autoShoot = !autoShoot;
      addFloater(player.x, player.y - 16, 'AUTO-SHOOT ' + (autoShoot ? 'ON (SP ×0.6)' : 'OFF'), '#2fe4c8');
    }
  }
  if ((k === '1' || k === '2' || k === '3') && state === 'play') {
    lang = +k - 1;
    addFloater(player.x, player.y - 16, LANGS[lang].name + ' EQUIPPED', LANGS[lang].color);
  }
  if (k === 'p' || k === 'escape') {
    if (state === 'play') { paused = !paused; if (paused) loadBoard(); }
    if (state === 'menu') {
      if (k === 'p' && !menuBoard) { menuBoard = true; loadBoard(); }
      else menuBoard = false;
    }
  }
  if (k === 'c' && state === 'play' && paused) openSetup('play');
  if (k === 'q' && state === 'play' && paused) quitRun();
  if (k === 'r' && state === 'over') startGame();
  if (k === 'd' && state === 'over') openDiff();      // straight to a different sprint
  if (k === 'escape' && state === 'over') state = 'menu';
  if (state === 'menu' && k === ' ') { if (menuBoard) menuBoard = false; else openSetup(); }
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// Pointer → the 640×360 internal grid. The canvas is CSS-upscaled by a whole
// number, but the measured rect is the honest source — it also covers a zoomed
// page and a phone that scaled the canvas to fit.
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * VW / r.width, y: (e.clientY - r.top) * VH / r.height };
}

canvas.addEventListener('pointermove', (e) => {
  const q = canvasPos(e);
  mouse.x = q.x; mouse.y = q.y;
});

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (state === 'menu') {
    if (menuBoard) {
      const q0 = canvasPos(e);
      for (const h of menuHits) if (inRect(q0, h)) { sfx.click(); h.act(); return; } // pager
      menuBoard = false; return; // any other tap closes the board
    }
    const q = canvasPos(e);
    for (const h of menuHits) if (inRect(q, h)) { sfx.click(); h.act(); return; } // leaderboard / debug slider
    openSetup();
    return;
  }
  if (state === 'setup') {
    // the click that opened the screen would land on whatever is under it
    if (menuT - setupShownAt < 0.4) return;
    const q = canvasPos(e);
    for (const h of setupHits) {
      if (q.x >= h.x && q.x <= h.x + h.w && q.y >= h.y && q.y <= h.y + h.h) { sfx.click(); h.act(); return; }
    }
    return;
  }
  if (state === 'diff') {
    // same guard as setup: the tap that opened this screen must not land on a row
    if (menuT - diffShownAt < 0.4) return;
    const q = canvasPos(e);
    for (const h of diffHits) if (inRect(q, h)) { sfx.click(); h.act(); return; }
    return;
  }
  if (state === 'help') {
    if (menuT - helpShownAt < 0.4) return;
    const q = canvasPos(e);
    for (const h of helpHits) if (inRect(q, h)) { sfx.click(); h.act(); return; }
    return;
  }
  if (state === 'over') {
    // the buttons win over the tap-anywhere-to-restart shortcut
    const q = canvasPos(e);
    for (const h of overHits) if (inRect(q, h)) { sfx.click(); h.act(); return; }
    if (overTimer > 0.8) startGame();
    return;
  }
  if (state === 'play' && paused) {
    const q = canvasPos(e);
    for (const h of pauseHits) if (inRect(q, h)) { sfx.click(); h.act(); return; }  // edit your dev
    if (debugMode) for (const h of debugHits) if (inRect(q, h)) { sfx.click(); h.act(); return; } // jump to a sprint
    return; // clicks on the pause overlay never fire the gun
  }
  mouse.down = true; // click/tap = fire along the current facing
});
addEventListener('pointerup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- state
let state = 'menu'; // 'menu' | 'setup' | 'diff' | 'play' | 'over'
let paused = false;
let menuBoard = false; // title screen: P shows the standup board, Esc hides it
let autoAim = false, autoShoot = false; // assist toggles (I / O) — persist across runs
// Debug: flipped by the title-screen slider. When on, pausing shows a level
// jumper on the left so boss difficulty can be tuned without grinding to it.
let debugMode = false;
const DEBUG_MAX_SPRINT = 33; // the hackathon is terminal — nothing past it
const menuHits = [];   // title-screen click targets (the debug slider), rebuilt each frame
const debugHits = [];  // debug pause-overlay click targets (the level list), rebuilt each frame
// Equipped language (keys 1/2/3), persists across runs. Starts on BASH: the
// laptop screen on the chair shows this colour, and the chair is on screen from
// the title onward — a cold start should not sit there glowing alarm-red before
// the player has picked anything.
let lang = 2;
let t = 0;              // in-game time
let menuT = 0;          // menu animation clock
let overTimer = 0;      // time since game over
let shake = 0;

let player, bullets, enemies, particles, floaters, pickups;
let sprint, phase, breakTimer, spawnQueue, spawnTimer, spawnInterval, meetingCd;
// After the 8th boss (sprint 32) comes the one sprint you cannot clear: THE
// HACKATHON. No standup clock, no spawn queue — tickets stream in forever,
// arriving faster (interval halves every HACK_RAMP seconds) and moving faster
// (makeEnemy reads hackT), until the coffee runs out. Every run ends here.
const HACK_SPRINT = 33;
const HACK_RAMP = 45;
let hackT = 0;      // seconds survived in the hackathon
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
// Code a boss threw at you: {x,y,vx,vy,r,life,kind,ch,armT}. See throwHazard.
let hazards = [];
const HAZARD_CAP = 40; // readability and perf ceiling — past this the oldest drop
// Thickness of the area stripe — the tell for which language kills a ticket.
// At 2px it was a hairline you had to already know to look for; the colour is a
// decision you make every second, so it gets real estate. It runs across the
// TOP of the card like a document header, which covers the 2px type-colour band
// baked into the sprite: type still reads from the card's size, its pips along
// the bottom, and the hotfix's flashing border.
// 3, not 4: a Bug's card is only 10px tall, and at 4 the header ate 40% of it
// and stopped reading as a header at all.
const STRIPE_W = 3;
// The boss fight in progress: its live parts (Merge Conflict has two), the
// roster entry driving the name/colour, and the title card's fade timer.
let bossParts = [], bossDef = null, bossMaxHp = 0, bossBanner = 0;
// Trunks a Merge Conflict has lost so far, newest last. They are closed, not
// resolved: if the reconnect countdown on the last side standing runs out, all
// of them come back at once. Only ever one conflict fight on the field, so one
// list is enough — spawnBoss empties it.
let conflictFallen = [];
// Boss sprints have no standup clock, so a patient player could kite one for
// as long as they liked. This is the answer: not a fail state, just pressure.
let bossClock = 0, bossEnraged = false;
const BOSS_ENRAGE_AT = 75; // seconds of one fight before it stops being polite
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
// Where leaving the setup screen goes back to. 'menu' is the cold start; 'play'
// means it was opened from a paused run, which must be resumed rather than
// restarted — a mid-run visit that called startGame() would wipe the run.
let setupReturn = 'menu';
const pauseHits = []; // click targets on the pause overlay, rebuilt every frame
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
// `short` is the name on the difficulty screen's unlock chips, where the full
// title doesn't fit six across.
//
// Eight slots, and the last two are second, nastier readings of a fight you
// have already had: THE OCTOPUS MERGE is Merge Conflict with a third branch,
// THE CASCADING OUTAGE is the Megaoutage with a third charge and a shockwave
// at the end of each. They reuse the enemy type — and therefore every rule
// written against `e.boss` — and differ only by the knobs below:
//   trunks    branch names for a conflict fight; its length IS the trunk count
//   dashes    charges the outage links into one combo before it goes down
//   ringEach  outage: slam the room at the end of every charge
//   ringAfter outage: seconds after the combo lands before one single slam
//   hpMul     extra HP on top of the lap scaling, for a late-roster slot
const BOSSES = [
  { type: 'monolith', area: 'infra', color: '#8fa8d8', name: 'THE LEGACY MONOLITH', short: 'MONOLITH', tag: 'opened 2009 · nobody knows what it does' },
  { type: 'conflict', area: 'be',    color: '#3fe08a', name: 'MERGE CONFLICT',      short: 'CONFLICT', tag: 'resolve both sides — together',
    trunks: ['main', 'master'] },
  { type: 'flaky',    area: 'be',    color: '#c9a8ff', name: 'THE FLAKY TEST',      short: 'FLAKY',    tag: 'passes locally. sometimes.' },
  { type: 'outage',   area: 'infra', color: '#ff8a5c', name: 'P0 MEGAOUTAGE',       short: 'OUTAGE',   tag: 'prod is down. everyone is watching.',
    dashes: 2, ringAfter: 0.5 },
  { type: 'screep',   area: 'fe',    color: '#ff5a6e', name: 'SCOPE CREEP',         short: 'CREEP',    tag: 'just one more little thing…' },
  // the meeting's area is a starting point only — it rotates during the fight
  { type: 'mtgboss',  area: 'be',    color: '#b9c4dd', name: 'THE ENDLESS MEETING', short: 'MEETING',  tag: 'this could have been an email' },
  { type: 'conflict', area: 'be',    color: '#2fe4c8', name: 'THE OCTOPUS MERGE',   short: 'OCTOPUS',  tag: 'three branches. nobody knows which is real.',
    trunks: ['main', 'master', 'mainster'], hpMul: 1.3 },
  { type: 'outage',   area: 'infra', color: '#ff5a6e', name: 'THE CASCADING OUTAGE', short: 'CASCADE', tag: 'it took the status page down with it',
    dashes: 3, ringEach: true, hpMul: 1.3 },
];

// The roster has eight slots but only six distinct nightmares — the octopus is
// still a Merge Conflict, the cascade is still a Megaoutage — and the unlock
// has always been keyed by enemy type. Counting distinct types keeps it at the
// six it has always been, and keeps a save made before slots 7 and 8 existed
// worth exactly what it was worth.
const BOSS_TYPES = [...new Set(BOSSES.map((b) => b.type))];

// ---------------------------------------------------------------- difficulty
// Nine knobs, each applied at exactly one existing choke point, so a row here
// is the whole definition of a difficulty and nothing is hidden in the code:
//   cups    starting coffee (startGame + jumpToSprint)
//   off     damage for a letter in the WRONG language (bullets-vs-enemies).
//           A match is always ×2; this is what the wrong tech is worth, so it
//           sets how much the red/green/blue stripe actually matters. Heavies
//           and bosses take half of it, exactly as they always have.
//   dead    standup deadline length — the sprint's clock
//   dens    spawn interval (smaller = tickets arrive closer together)
//   speed   ticket movement. Bosses are deliberately NOT scaled by it: their
//           chases are tuned against the chair's top speed, and the fights have
//           a cadence knob of their own that was built for this.
//   cad     boss attack cadence (smaller = it acts more often)
//   scope0  how much scope is ALREADY glued to Scope Creep when it arrives.
//           The one boss-specific knob on the sheet, and it earns the place:
//           that fight opens on a strip rather than on a shot, so how long the
//           strip takes IS the difficulty of it.
//   sp      score multiplier — the board has to compare like with like
//   assists whether auto-aim / auto-shoot may be switched on at all
// NORMAL is every multiplier at 1 and 3 cups: the game exactly as it shipped,
// so scores set before this screen existed still mean what they meant.
const DIFFS = [
  { key: 'easy',   name: 'EASY',   tag: 'we own the schedule',
    cups: 5, off: 1.5,  dead: 1.35, dens: 1.3,  speed: 0.85, cad: 1.25, sp: 0.7, scope0: 2, assists: true,  color: '#3fe08a' },
  { key: 'normal', name: 'NORMAL', tag: 'the schedule owns us',
    cups: 3, off: 1,    dead: 1,    dens: 1,    speed: 1,    cad: 1,    sp: 1,   scope0: 3, assists: true,  color: '#7fe0ff' },
  { key: 'hard',   name: 'HARD',   tag: 'the client owns the schedule',
    cups: 2, off: 0.75, dead: 0.82, dens: 0.78, speed: 1.12, cad: 0.85, sp: 1.5, scope0: 4, assists: true,  color: '#ff8a5c' },
  { key: 'claudelike', name: 'CLAUDELIKE', tag: 'one cup. no assists. ship it.',
    cups: 1, off: 0.5,  dead: 0.7,  dens: 0.62, speed: 1.25, cad: 0.72, sp: 2.5, scope0: 5, assists: false, color: '#8a63ff', locked: true },
];
const HARD_IDX = 2; // only a run at this level or above earns the unlock

// Bosses resolved on HARD or above, by type, remembered across runs. Clearing
// all six is what unlocks CLAUDELIKE. Easy and Normal clears deliberately do
// not count — the credential is the point — and a debug run never counts, the
// same rule the high score already follows.
let bossesDown = new Set();
try { bossesDown = new Set(JSON.parse(localStorage.getItem('jiraBlasterBossesHard') || '[]')); } catch (e) { /* private mode */ }
const allBossesDown = () => BOSS_TYPES.every((ty) => bossesDown.has(ty));
// Debug mode opens CLAUDELIKE so it can be played and tuned without grinding
// six HARD bosses first. It does NOT earn it: recordBossKill still refuses to
// log anything in a debug run, so switching debug off drops you straight back
// to whatever you have actually resolved.
const diffUnlocked = (d) => !d.locked || allBossesDown() || debugMode;

// Resolving a boss says out loud whether it counted, and when it doesn't, why.
// Silence here is what made the rule undiscoverable: a debug run and an EASY
// run both looked exactly like a HARD one that had just been logged.
function recordBossKill(e) {
  const type = e.boss, at = e.y - 26;
  if (bossesDown.has(type)) return;                 // already logged — no need to shout
  if (debugMode) { addFloater(e.x, at, 'DEBUG RUN — NOT LOGGED', '#8f8fa8'); return; }
  if (diffIdx < HARD_IDX) { addFloater(e.x, at, 'ONLY HARD COUNTS — NOT LOGGED', '#8f8fa8'); return; }
  bossesDown.add(type);
  try { localStorage.setItem('jiraBlasterBossesHard', JSON.stringify([...bossesDown])); } catch (err) { /* private mode */ }
  const done = BOSS_TYPES.filter((ty) => bossesDown.has(ty)).length;
  if (allBossesDown()) addFloater(e.x, at, 'CLAUDELIKE UNLOCKED!', '#8a63ff', true);
  else addFloater(e.x, at, 'LOGGED ON HARD — ' + done + '/' + BOSS_TYPES.length, '#8a63ff');
}

let diffIdx = 1; // NORMAL
try {
  const saved = DIFFS.findIndex((d) => d.key === localStorage.getItem('jiraBlasterDiff'));
  // a locked level can still be sitting in storage — cleared save, another
  // browser profile — so the gate is re-checked on load, not just on click
  if (saved >= 0 && diffUnlocked(DIFFS[saved])) diffIdx = saved;
} catch (e) { /* private mode */ }
const curDiff = () => DIFFS[diffIdx];
const diffHits = [];       // click targets on the difficulty screen, rebuilt each frame
let diffShownAt = 0;       // guards against the click that opened it landing on a row
let diffDenied = -9;       // when a locked row was last tapped — flashes the reason

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
const BOARD_PAGE = 10; // rows per page; the API returns up to 200 runs
let boardPage = 0;

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
  boardPage = 0;
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
  boardPage = 0;
  if (AUTOTEST) return;                              // never write to the live board
  // Every non-debug death is a run worth recording, 0 SP included — the
  // caller already routes debug runs to loadBoard() instead. Opened from
  // disk there is no API, but the board is still what the screen owes you.
  if (!/^https?:$/.test(location.protocol)) { loadBoard(); return; }

  const gen = ++boardGen;
  board = { status: 'sending', rows: [], rank: null };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), BOARD_TIMEOUT);
  fetch(SCORES_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: playerName, score, look }),
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

// Each board row carries the look its run was posted with — the same integer
// indices this game saves locally. The server stores whatever bounded ints it
// was sent, so every index is clamped against this build's option lists before
// it reaches buildDevImg. Rendered once per distinct look into a 10×10 icon
// (smoothed — nearest-neighbour at 34→10 drops whole features) and cached.
const boardIcons = new Map();
function boardIcon(o) {
  if (!o || typeof o !== 'object') return null;
  const key = JSON.stringify(o);
  let c = boardIcons.get(key);
  if (!c) {
    const safe = {};
    for (const gr of LOOK_GROUPS) {
      const v = o[gr.key];
      safe[gr.key] = Number.isInteger(v) && v >= 0 && v < groupLen(gr) ? v : 0;
    }
    c = cvOf(10, 10);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(buildDevImg(safe), 0, 0, 10, 10);
    boardIcons.set(key, c);
  }
  return c;
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
function openSetup(from) {
  setupReturn = from || 'menu';
  state = 'setup';
  setupShownAt = menuT;
  devSpinPaused = false;   // always arrive spinning
  lastDevT = menuT;        // so the first frame adds ~0, not a jump
}

// Back out without applying anything. From a mid-run visit this lands on the
// pause overlay it came from — the run is still there, still paused.
function closeSetup() {
  state = setupReturn;
  setupReturn = 'menu';
}

function setupKey(e) {
  const k = e.key;
  if (k === 'Enter') { confirmSetup(); return; }
  if (k === 'Escape') { closeSetup(); return; }
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
  // Mid-run, this is "done editing" and drops you straight back into the fight
  // wearing the changes. Only a visit from the welcome screen goes on to pick a
  // difficulty — the run's difficulty is fixed once it has started.
  if (setupReturn === 'play') { setupReturn = 'menu'; state = 'play'; paused = false; return; }
  openDiff();
}

// ---------------------------------------------------------------- difficulty screen
function openDiff() {
  state = 'diff';
  diffShownAt = menuT;
  // never leave the cursor parked on a level that can't be started
  if (!diffUnlocked(curDiff())) diffIdx = HARD_IDX;
}

function pickDiff(i) {
  if (!diffUnlocked(DIFFS[i])) { diffDenied = menuT; sfx.block(); return; }
  diffIdx = i;
  try { localStorage.setItem('jiraBlasterDiff', DIFFS[i].key); } catch (e) { /* private mode */ }
}

// Move the cursor to the next selectable row, skipping anything still locked.
function stepDiff(dir) {
  const n = DIFFS.length;
  for (let k = 1; k <= n; k++) {
    const i = (diffIdx + dir * k + n * n) % n;
    if (diffUnlocked(DIFFS[i])) { pickDiff(i); return; }
  }
}

function diffKey(e) {
  const k = e.key;
  if (k === 'Enter' || k === ' ') { startGame(); return; }
  if (k === 'Escape') { openSetup('menu'); return; }
  if (k === 'ArrowUp' || k === 'ArrowLeft') { stepDiff(-1); return; }
  if (k === 'ArrowDown' || k === 'ArrowRight') { stepDiff(1); return; }
  if (k >= '1' && k <= String(DIFFS.length)) pickDiff(+k - 1);
}

function startGame() {
  state = 'play';
  paused = false;
  // A difficulty borrowed from debug mode must not outlive debug being switched
  // off: CLAUDELIKE pays ×2.5 SP, and that score reaches the standup board.
  if (!diffUnlocked(curDiff())) diffIdx = HARD_IDX;
  // the assist toggles survive between runs, so a level that forbids them has
  // to switch them off rather than just refuse the keypress
  if (!curDiff().assists) { autoAim = false; autoShoot = false; }
  t = 0; shake = 0; score = 0; kills = 0; overTimer = 0; clearMsg = '';
  player = {
    x: VW / 2, y: VH / 2, vx: 0, vy: 0, angle: 0, r: 7,
    // coffee cups come from the difficulty; still no passive regen
    hp: curDiff().cups, maxHp: curDiff().cups, fireCd: 0, invuln: 0, rapidT: 0, duckT: 0,
  };
  bullets = []; enemies = []; particles = []; floaters = []; pickups = []; hazards = [];
  sprint = 1; phase = 'break'; breakTimer = 2.5;
  spawnQueue = []; spawnTimer = 0; spawnInterval = 1; meetingCd = 6;
  deadlineT = 0; backlog = []; hackT = 0;
  combo = 1; comboT = 0; hitFreeze = 0; culprit = null;
  bossParts = []; bossDef = null; bossMaxHp = 0; bossBanner = 0;
  bossClock = 0; bossEnraged = false;
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

// The hackathon's ticket mix, picked per spawn since the stream never ends:
// the same weights buildSprint would use at sprint 33, with the epics folded
// in as a small steady chance instead of a per-sprint quota.
function pickHackType() {
  const w = [['bug', 10], ['story', 36], ['hotfix', 12.5], ['epic', 1.5]];
  const total = w.reduce((s, e) => s + e[1], 0);
  let r = Math.random() * total;
  for (const [type, wt] of w) { r -= wt; if (r <= 0) return type; }
  return 'bug';
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
  // A pair's two halves have their own areas, so they get penned separately —
  // re-form them on the way out, or the shield arrives on the far side of the
  // room from the ticket it's supposed to be shielding.
  for (const e of enemies) {
    if (!e.blockedBy || !enemies.includes(e.blockedBy)) continue;
    const b = e.blockedBy;
    tuckBlocker(e, b);
    b.vx = e.vx; b.vy = e.vy; b.burstT = e.burstT; // break out as one unit
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
    // bosses keep their tuned speed — the difficulty leans on their cadence.
    // In the hackathon every new ticket arrives faster than the last, up to
    // 2.5× at 135s — the other half of the ratchet the spawn interval starts.
    sp: def.sp * rnd(0.9, 1.1) * (def.boss ? 1 : curDiff().speed)
      * (!def.boss && sprint === HACK_SPRINT ? 1 + Math.min(1.5, hackT / 90) : 1),
    r: def.r, score: def.score, img: def.img, scale: def.scale || 1,
    wobPhase: rnd(0, TAU), wobFreq: rnd(def.wobFreq[0], def.wobFreq[1]), wobAmp: def.wobAmp,
    touchCd: 0, spawnT: 0.4, windup: false, grazed: false, grazeArmed: false, vx: 0, vy: 0, burstT: 0,
    boss: def.boss || null,
  };
  enemies.push(e);
  return e;
}

// ---------------------------------------------------------------- hazards
// The one thing on the field that is not a ticket: code the codebase throws
// back at you. Same glyphs you fire, and it burns. They hurt on contact,
// ignore your letters completely, and fade out on their own — so the room
// itself becomes a threat instead of just the boss standing in it. Inert for
// armT while they materialize, the same rule every spawning ticket follows.
//
// Thrown code used to be flat grey, which read as debris rather than danger
// and looked like nothing else on the field. It now burns like the ground the
// Megaoutage leaves behind — but as a cooling EMBER rather than a steady
// flame: white-hot as it leaves the boss, orange in flight, dull red as it
// burns out. That keeps the two apart at a glance, which matters because one
// is flying at you and the other is lying where it fell.
const EMBER = ['#ffd23f', '#ff8a5c', '#ff5a6e'];
const HAZARD_IMG = {
  code: EMBER.map((c) => glyphSet(c)),
  fire: [glyphSet('#ff8a5c')],   // burning ground: one steady tone
};
function throwHazard(x, y, vx, vy, life, kind) {
  hazards.push({
    x, y, vx, vy, r: 5, life, life0: life, kind: kind || 'code',
    ch: pick(GLYPHS), armT: 0.25,
  });
  if (hazards.length > HAZARD_CAP) hazards.shift();
}

// ---------------------------------------------------------------- bosses
// Every boss timer is set through this rather than written flat, so a later
// lap — and the soft enrage — can speed the whole fight up instead of just
// fattening its HP bar. e.cad is the fight's cadence multiplier (see bossInit).
const cad = (e, secs) => secs * (e.cad || 1);

// STACK TRACE: the Monolith's ring of thrown letters. Speed × life is its
// reach — at 55×3 = 165px you could simply stand in the far corner and never
// see it, which made the arena small and the boss a stationary chore. At
// 78×4.2 ≈ 328px it covers the room's full height from the middle, so the ring
// is dodged by moving rather than out-ranged, which is what it was always
// described as. It arrives on TRACE_PERIOD, still behind the 0.8s wind-up ring
// — more often, but never without warning.
//
// TRACE_PERIOD is the gap AFTER the wind-up, so the real cycle is period +
// 0.8s: at 1.2 the Monolith throws a trace every 2s, twice as often as the 4s
// it used to. The ring is the whole reason the fight has geometry, and once
// every four seconds left far too much of the room quiet.
const TRACE_N = 9, TRACE_SPEED = 78, TRACE_LIFE = 4.2, TRACE_PERIOD = 1.2;

// A ring of thrown code fired outward from a boss's rim. The Monolith's stack
// trace and the Megaoutage's shockwave are the same gesture at different sizes,
// so they are the same function — one ring reads as one ring wherever it comes
// from, which is what makes it dodgeable on sight.
function throwRing(e, n, speed, life) {
  const off = rnd(0, TAU);
  for (let k = 0; k < n; k++) {
    const a = off + TAU * k / n;
    throwHazard(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r,
      Math.cos(a) * speed, Math.sin(a) * speed, life);
  }
  shake += 3;
  sfx.trace();
}

// The Megaoutage's shockwave: the same ring, tighter and shorter-lived, because
// it goes off where the boss just landed rather than across a room it cannot
// reach. Speed × life ≈ 230px — the blast radius of one charge, not the room.
const OUT_RING_N = 8, OUT_RING_SPEED = 92, OUT_RING_LIFE = 2.5;

// Per-boss state, set after the HP scaling in spawnBoss so thresholds match.
// Lap and enrage land first, because every timer below is set through cad().
function bossInit(e) {
  e.cad = Math.pow(0.88, e.lap || 0) * curDiff().cad; // lap + difficulty both set the pace
  e.sp *= 1 + 0.08 * (e.lap || 0);
  if (bossEnraged) { e.cad *= 0.5; e.sp *= 1.3; } // a part that arrives mid-enrage
  if (e.boss === 'monolith') {
    e.langT = cad(e, 3.2); e.shedT = cad(e, 4.5);
    e.shedStep = Math.round(e.maxHp / 7); e.nextShed = e.maxHp - e.shedStep;
    e.traceT = cad(e, TRACE_PERIOD); e.traceWind = 0;
    e.spBase = e.sp; // rage scales off this — see the monolith branch in bossBehave
  }
  if (e.boss === 'screep') {
    e.scope = []; e.grown = 0; e.growT = cad(e, SCOPE_FIRST); e.shootT = cad(e, SCOPE_SHOOT);
    // the scope it was already carrying when it reached you
    for (let k = 0; k < Math.min(SCOPE_MAX, curDiff().scope0); k++) growScope(e, true);
  }
  if (e.boss === 'conflict') {
    e.reviveT = 0;
    e.feat = []; e.cutFeat = 0; e.clean = false;
    e.featT = cad(e, 1.2); e.shootT = cad(e, CONFLICT_SHOOT);
  }
  if (e.boss === 'mtgboss') { e.cycleT = 0; e.open = false; e.callT = cad(e, 3); e.hueT = cad(e, MTG_HUE); e.actT = cad(e, ACTION_EVERY); e.item = null; }
  if (e.boss === 'outage') { e.mode = 'aim'; e.phaseT = 1.6; e.dx = 0; e.dy = 0; e.dashesLeft = outageDashes(e); e.trailT = 0; e.ringT = 0; }
  if (e.boss === 'flaky') { e.pass = true; e.phaseT = cad(e, 1.7); e.fails = 0; e.blinkT = 0; e.failedAt = Infinity; }
}

function spawnBoss(n) {
  const step = Math.floor(n / 4) - 1;
  const def = BOSSES[step % BOSSES.length];
  const lap = Math.floor(step / BOSSES.length);
  const mul = (1 + 0.55 * lap) * (def.hpMul || 1); // each full lap is meaner, and a late slot starts meaner
  bossDef = def;
  bossParts = [];
  conflictFallen = [];
  bossBanner = 2.8;
  bossClock = 0; bossEnraged = false;

  const make = (x, y) => {
    const e = makeEnemy(def.type, x, y);
    e.hp = e.maxHp = Math.round(ENEMY_TYPES[def.type].hp * mul);
    e.score = Math.round(ENEMY_TYPES[def.type].score * mul);
    e.area = def.area;
    e.lap = lap;      // read by bossInit and by the per-boss lap tweaks
    e.def = def;      // the slot's own knobs — trunk count, dash count, shockwave
    e.spawnT = 1.4;   // long materialize — the title card plays over it
    bossInit(e);
    bossParts.push(e);
    return e;
  };

  if (def.trunks) {
    // Spread across the same span two trunks always used, so a third branch
    // slots in between them rather than changing where the fight opens.
    const n2 = def.trunks.length;
    def.trunks.forEach((name, i) => {
      make(VW * (n2 === 1 ? 0.5 : 0.24 + 0.52 * i / (n2 - 1)), VH * 0.5).branch = name;
    });
  } else {
    make(VW / 2, 46);
  }
  bossMaxHp = bossParts.reduce((s, e) => s + e.maxHp, 0);
  sfx.bossIn();
  shake += 8;
}

// Minions a boss calls in. They are ordinary tickets, so the sprint is not
// clear until they are gone too. Returns them, for the callers that want to
// send them in with a twist of their own.
function spawnMinion(type, from, n) {
  const made = [];
  for (let k = 0; k < n; k++) {
    const a = rnd(0, TAU);
    const m = makeEnemy(type,
      clamp(from.x + Math.cos(a) * (from.r + 12), 12, VW - 12),
      clamp(from.y + Math.sin(a) * (from.r + 12), 12, VH - 12));
    m.spawnT = 0.45; // materializes with a flash — readable, not a cheap shot
    made.push(m);
  }
  return made;
}

// How far it travels per second while charging, and how many charges it links
// into one attack before it goes down. The roster slot sets the base — two for
// the Megaoutage, three for the Cascade — and a second lap adds one more on
// top: the same fight, with less of the room left safe.
const DASH_SPEED = 430;
const outageDashes = (e) => ((e.def && e.def.dashes) || 2) + ((e.lap || 0) >= 1 ? 1 : 0);

function shedDebt(e, n) {
  spawnMinion('bug', e, n);
  addFloater(e.x, e.y - e.r - 6, 'TECH DEBT!', '#8fa8d8');
}

// SCOPE CREEP is armoured by its own scope. It buds tickets that stay GLUED to
// its edge — they ride its slot, move as one body with it, and while a single
// one is still attached the boss itself cannot be damaged from any angle. The
// fight is therefore never a damage race: it is strip the scope, then burn the
// thing in the window before more grows.
//
// The old version was a suppression race — any hit froze a growth clock — which
// meant a player holding the trigger saw nothing happen at all, and growing
// only ever added HP. This inverts it: growth is what makes it invulnerable,
// not what makes it fat, so ignoring the scope is the one thing you can't do.
//
// SCOPE_GROW has to stay slower than a competent player clears one ticket, or
// the vulnerable window never opens; killing the last attachment also resets
// the clock to a full interval, so the window is guaranteed by construction
// rather than by luck.
// It also does not arrive empty-handed: the ticket was already this big when it
// reached you, so it walks in with curDiff().scope0 attachments already glued
// on and the fight opens on a strip rather than on a free shot.
const SCOPE_GAP = 15;      // centre-to-centre ride distance out from the boss edge
const SCOPE_MAX = 5;       // most that can be attached at once
const SCOPE_GROW = 2.6;    // seconds between attachments
const SCOPE_FIRST = 1.1;   // the first is quick, so the rule teaches itself early
const SCOPE_SHOOT = 2.2;   // it throws requirements at you while you strip it
const SCOPE_SPREAD = [-0.22, 0, 0.22]; // the requirements doc, in triplicate

// A free-ish angle on the boss's rim: sample a few and take the one furthest
// from what is already attached, so the scope spreads around it instead of
// stacking on one side and leaving a bare flank.
function scopeAngle(e) {
  let best = rnd(0, TAU), bestGap = -1;
  for (let k = 0; k < 10; k++) {
    const a = rnd(0, TAU);
    let gap = Math.PI;
    for (const s of e.scope) {
      const dd = Math.abs(((a - s.scopeA + Math.PI) % TAU + TAU) % TAU - Math.PI);
      gap = Math.min(gap, dd);
    }
    if (gap > bestGap) { bestGap = gap; best = a; }
  }
  return best;
}

// `quiet` is the scope it arrived with: the same attachment, without the
// floater and the ding, because five of each on top of the title card is noise
// rather than information.
function growScope(e, quiet) {
  const a = scopeAngle(e);
  const m = makeEnemy('story',
    clamp(e.x + Math.cos(a) * (e.r + SCOPE_GAP), 10, VW - 10),
    clamp(e.y + Math.sin(a) * (e.r + SCOPE_GAP), 10, VH - 10));
  m.scopeA = a;
  m.scopeOf = e;
  m.spawnT = 0.45;    // materializes like anything else — never a cheap shot
  m.flank = 0;
  e.scope.push(m);
  e.grown++;
  if (quiet) return;
  addFloater(e.x, e.y - e.r - 6, CREEP[(e.grown - 1) % CREEP.length], '#ff8fa0');
  sfx.ding();
}

// Anything still glued to it. While this is true the boss shrugs off letters.
const scopeAttached = (e) => !!(e.scope && e.scope.some((s) => enemies.includes(s)));

// How many meeting invites may be drifting through a sprint at once, and the
// gap between arrivals. Raised from 2 / 8–14s: at that cadence a ~33s sprint
// only ever saw two on screen, and they are the one enemy whose whole job is
// to be in the way. The gap has to come down with the cap or the ceiling is
// never reached inside a sprint — the pair is the setting, not the number.
const MEETING_MAX = 4, MEETING_GAP = [5, 9];

// How close you have to be for The Endless Meeting to consider you an
// attendee, how hard it drags you in, and how close a resolved attendee has
// to be for the room to notice and lose its thread.
const ATTENDANCE_R = 130;
const MEETING_PULL = 28;   // u/s — noticeable, never faster than the chair
const DERAIL_R = 60;

// How often the agenda changes colour. Slower than the ~1.4s window it opens,
// so a switch never invalidates a window you already committed to.
const MTG_HUE = 4.5;

// ACTION ITEMS. The room used to lose its own thread every 6s no matter what
// you did, which meant the whole fight could be waited out: stand off, let the
// window arrive, take your free shots. Now nothing is free. The meeting assigns
// you an action item — a tagged attendee on a visible clock, tethered to the
// room — and closing it in time is what makes the chair look up. Miss the
// clock and the meeting takes the time back: it heals, and books another one.
//
// It cannot deadlock: there is always exactly one action item live or one
// about to be assigned, so there is always a way in.
const ACTION_EVERY = 5;    // seconds between assignments
const ACTION_TIME = 4;     // seconds on the clock once one lands
const ACTION_OPEN = 2;     // how long the agenda stays open when you close one
const ACTION_HEAL = 0.06;  // fraction of max HP it takes back when one expires
const ACTION_MISS = ['LET\'S TAKE THIS OFFLINE', 'PARKED FOR NOW',
  'LET\'S CIRCLE BACK', 'ADDING IT TO THE AGENDA', 'WE\'LL SYNC ON THIS'];

// The room's own language is never the attendees' — see the callT block — so
// the item you have to close in four seconds always costs you a switch, then
// the window you earned costs you another one back.
function assignAction(e) {
  const m = spawnMinion('story', e, 1)[0];
  m.area = pick(AREA_KEYS.filter((a) => a !== e.area));
  m.actionOf = e;
  m.actionT = cad(e, ACTION_TIME);
  e.item = m;
  addFloater(e.x, e.y - e.r - 8, 'ACTION ITEM ASSIGNED', '#ffd23f');
  sfx.ding();
}

// The only way into the agenda: something interrupts it. Called by an action
// item closed in time, and by any kill inside DERAIL_R.
function openMeeting(e, secs, why) {
  e.open = true;
  e.cycleT = Math.max(e.cycleT, secs);
  addFloater(e.x, e.y - e.r - 8, why, '#3fe08a');
  sfx.crit();
}

// Every trunk still standing. bossParts only ever holds live parts, so this IS
// the live set — and writing the pincer, the rebase and the reconnect against
// its size rather than against a single `twin` is what let a third branch drop
// into the same fight without a second copy of any of it.
const trunks = () => bossParts.filter((b) => b.boss === 'conflict');

// How long the last side standing gives you before everything you closed comes
// back. It used to be 3.2s, which — against a survivor already taking ×2 — was
// long enough that killing one side was simply how you won.
const REOPEN_WINDOW = 2;

// The reconnect countdown beat you: every branch you closed reopens at once,
// each half as strong as it was last time, and they all diverge again so the
// feature work has to be redone before anything can be merged. This is the
// cost of dropping sides and then stalling.
function reopenTrunks(e) {
  e.reviveT = 0;
  const back = conflictFallen.splice(0);
  if (!back.length) return;
  // They walk back in off the walls rather than popping up in your lap — the
  // reopen has to be survivable, and visible — and off DIFFERENT walls, or
  // three branches would rematerialize as one stack.
  const edges = [
    () => ({ x: 24, y: clamp(e.y, 24, VH - 24) }),
    () => ({ x: VW - 24, y: clamp(e.y, 24, VH - 24) }),
    () => ({ x: clamp(e.x, 24, VW - 24), y: 24 }),
    () => ({ x: clamp(e.x, 24, VW - 24), y: VH - 24 }),
  ];
  const dist = [e.x, VW - e.x, e.y, VH - e.y];
  let near = 0;
  for (let i = 1; i < 4; i++) if (dist[i] < dist[near]) near = i;

  back.forEach((src, i) => {
    const at = edges[(near + i) % 4]();
    const t = makeEnemy('conflict', at.x, at.y);
    t.maxHp = src.maxHp;
    t.hp = src.hp;
    t.score = src.score;
    t.area = src.area;
    t.lap = e.lap;    // the reopened side belongs to the same lap as the fight
    t.def = e.def;    // and to the same roster slot, so it keeps the trunk count
    t.spawnT = 0.5;
    bossInit(t);
    t.reopens = src.reopens; // so the next reopen is weaker again
    t.branch = src.branch;   // main comes back as main
    bossParts.push(t);
  });
  divergeAgain();
  addFloater(e.x, e.y - 16,
    'REOPENED — ' + (back.length + 1) + ' BRANCHES DIVERGED', '#ff5a6e', true);
  sfx.siren();
  shake += 5;
}

// How far The Flaky Test will back off while you can actually hit it. The
// retreat has to be a kite, not an exit. Uncapped, the flee and the hunt
// cancel out exactly — it settles into an orbit between 40 and 110px and a
// player who stands still is never reached at all, which is the opposite of
// the point. So the ceiling sits inside one FAIL window's worth of travel
// (1.2s at 1.3x speed ≈ 70px): every time it goes immune it can close the
// whole gap, and the immune window becomes something you dodge.
const FLAKY_KEEP = 70;

// Beyond this it is not kiting any more, it is coming back from wherever the
// last retry threw it, and both of its speeds change to say so. This is what
// pays for a half-room hop, and it is not optional: a hop of H from a boss H/2
// away CANNOT land closer than H/2 — the geometry allows nothing else — so
// without a hard return the retry is simply a rest, the fight never arrives,
// and a parked player is never touched. That is the exact trap FLAKY_KEEP was
// written to escape, and the threat proof catches it every time.
//
// The sprint is deliberately on the IMMUNE half of the cycle, where it costs
// you nothing you could have shot: FAIL was always the half you dodge, so a
// long hop just means more of it. At 2.4× it closes ~106u/s, still well under
// the chair's 160, so it is outrun rather than escaped.
//
// The leash has to sit just above FLAKY_KEEP, not comfortably above it. The
// whole rhythm is that a PASS window ends at the 70px standoff and the FAIL
// window that follows closes ~60px of it, which is contact. Leave a wide crawl
// band under the leash and a hop never gets back to that standoff — it ends
// each PASS at ~79 instead of 70, every FAIL bottoms out at 18px, and the fight
// misses the player by two pixels forever. That is what a 25s stall looks like,
// and it is worth more than the extra kiting room.
const FLAKY_LEASH = 90;
const FLAKY_RETURN = 0.9;  // ×speed walking back while hittable
const FLAKY_SPRINT = 2.4;  // ×speed sprinting back while immune

// The retry hop: how far it asks to re-run the suite, and how often. It was
// every 3rd failure and 80px — a nudge you barely registered, usually still
// inside your existing firing line — then every 2nd and a realised ~135px.
//
// FLAKY_HOP is the ask; FLAKY_REACH is what the room will actually give. The
// hop is an arc AROUND you rather than a flight away from you, so the landing
// radius is capped — and a 640×360 room caps it hard, because a radius past
// ~190 from mid-court is already outside the floor and gets clamped back in.
// Between that and the return trip the fight can afford, the realised hop lands
// at ~225px: 62% of the room's height, and two thirds further than before.
// Pushing FLAKY_REACH to 250 buys ~15px more and costs the threat proof — the
// boss cannot get back inside one PASS/FAIL cycle from there, and a parked
// player goes untouched for 17-23s. It is an arena-size ceiling, not a tuning
// one. Re-measure both if VW/VH ever change.
const FLAKY_HOP = VW / 2, FLAKY_HOP_EVERY = 2, FLAKY_REACH = 190;

// The stack a failing test throws: one ring on every flip to FAIL. Smaller and
// slower than the Monolith's — this one goes off at knife range, often the 70px
// standoff it kites at, so it has to be threadable rather than a wall. Eight
// glyphs are 7px apart on the rim and ~55px apart by the time the ring is 70px
// out, which is the whole design: back off before the window shuts and you have
// gaps to stand in, sit on top of it and you do not.
//
// FLAKY_WIND is the warning, drawn as a ring collapsing onto it over the last
// of the PASS window. It carries its weight twice — it is the tell for the
// stack AND the tell that the damage window is closing, which is the exact
// beat a player needs to stop firing or start feeding it.
const FLAKY_RING_N = 8, FLAKY_RING_SPEED = 88, FLAKY_RING_LIFE = 2.4;
const FLAKY_WIND = 0.45;

// Returns true when the boss moved itself this frame (skipping the generic seek).
function bossBehave(e, dt, ux, uy) {
  if (e.boss === 'monolith') {
    // the matchup keeps moving, so your language has to as well
    e.langT -= dt;
    if (e.langT <= 0) {
      e.langT = cad(e, 3.2);
      e.area = AREA_KEYS[(AREA_KEYS.indexOf(e.area) + 1) % AREA_KEYS.length];
      const L = LANGS.find((l) => l.area === e.area);
      addFloater(e.x, e.y - e.r - 8, 'REFACTORED → ' + L.name, AREAS[e.area].color);
      sfx.ding();
    }
    e.shedT -= dt;
    if (e.shedT <= 0) { e.shedT = cad(e, 4.5); shedDebt(e, (e.lap || 0) >= 1 ? 2 : 1); }
    // Stack trace: it can't reach you at sp 9, so it throws the trace at you
    // instead. Telegraphed by a glow and a pager tone a beat before it lands —
    // the ring is dodged by moving, not by out-ranging it.
    e.traceT -= dt;
    if (e.traceT <= 0 && e.traceWind <= 0) {
      e.traceWind = 0.8;
      addFloater(e.x, e.y - e.r - 8, 'STACK TRACE', '#8fa8d8');
      sfx.siren();
    }
    if (e.traceWind > 0) {
      e.traceWind -= dt;
      if (e.traceWind <= 0) {
        e.traceT = cad(e, TRACE_PERIOD);
        throwRing(e, TRACE_N, TRACE_SPEED, TRACE_LIFE);
      }
    }
    // it is glacial at full HP and genuinely fast once it is coming apart
    e.sp = e.spBase * (1 + 1.2 * (1 - e.hp / e.maxHp));
    if (e.hp < e.maxHp * 0.5 && !e.wakeHint) {
      e.wakeHint = true;
      addFloater(e.x, e.y - e.r - 16, "IT'S WAKING UP", '#ff8a5c', true);
    }
    return false;
  }
  if (e.boss === 'screep') {
    const had = e.scope.length;
    e.scope = e.scope.filter((s) => enemies.includes(s));
    // Stripping the last one buys a clean window: the clock restarts in full
    // rather than resuming wherever it happened to be.
    if (had && !e.scope.length) {
      e.growT = cad(e, SCOPE_GROW);
      addFloater(e.x, e.y - e.r - 10, 'SCOPE CLEAR — HIT IT NOW', '#3fe08a', true);
      sfx.bossDown();
    }
    e.growT -= dt;
    if (e.growT <= 0) {
      e.growT = cad(e, SCOPE_GROW);
      if (e.scope.length < SCOPE_MAX) { growScope(e); shake += 2; }
    }
    // the requirements doc, thrown at your head while you work
    e.shootT -= dt;
    if (e.shootT <= 0) {
      e.shootT = cad(e, SCOPE_SHOOT);
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      for (const spread of SCOPE_SPREAD) {
        throwHazard(e.x + Math.cos(a + spread) * e.r, e.y + Math.sin(a + spread) * e.r,
          Math.cos(a + spread) * 90, Math.sin(a + spread) * 90, 2);
      }
    }
    return false;
  }
  if (e.boss === 'conflict') {
    if (e.reviveT > 0) {
      e.reviveT -= dt;
      if (e.reviveT <= 0) reopenTrunks(e);
    }
    // --- feature branches: cut them, and go clean once they're all closed
    e.feat = e.feat.filter((f) => enemies.includes(f));
    if (!e.clean) {
      // Latch CLEAN before the cut timer, never after: closing the last branch
      // on the same frame the timer happens to fire would otherwise re-open the
      // side and the clear would silently not count.
      if ((e.cutFeat || 0) >= FEAT_QUOTA && !e.feat.length) {
        e.clean = true;
        addFloater(e.x, e.y - e.r - 10, e.branch + ' IS CLEAN', '#3fe08a', true);
        sfx.bossDown();
      } else {
        e.featT -= dt;
        if (e.featT <= 0 && e.feat.length < FEAT_MAX) {
          e.featT = cad(e, featEvery(e));
          cutFeature(e);
        }
      }
    }
    // --- a trunk throws letters at you the whole time
    e.shootT -= dt;
    if (e.shootT <= 0) {
      e.shootT = cad(e, CONFLICT_SHOOT);
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      throwHazard(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r,
        Math.cos(a) * 105, Math.sin(a) * 105, 2.6);
    }
    const rest = trunks().filter((o) => o !== e);
    if (!rest.length) return false; // last side standing: the ordinary seek is threat enough
    // Pincer: each side steers for the point opposite where the others are,
    // averaged, so they arrive from around you instead of queueing up in one
    // blob. Backing straight off no longer keeps them all in front of you, and
    // with three trunks the average is what spreads them across the room.
    const ox = rest.reduce((s, o) => s + o.x, 0) / rest.length;
    const oy = rest.reduce((s, o) => s + o.y, 0) / rest.length;
    const tx = clamp(player.x + (player.x - ox) * 0.5, e.r, VW - e.r);
    const ty = clamp(player.y + (player.y - oy) * 0.5, e.r, VH - e.r);
    const gx = tx - e.x, gy = ty - e.y;
    const gd = Math.hypot(gx, gy);
    if (gd > 0.5) {
      const step = Math.min(gd, e.sp * dt);
      e.x += gx / gd * step; e.y += gy / gd * step;
    }
    return true;
  }
  if (e.boss === 'mtgboss') {
    // Letters bounce off the agenda; they land only while someone derails it.
    // The old fixed open/closed cycle ignored the player entirely — you waited
    // your turn — and the 6s self-derail that replaced it was still a window
    // that arrived whether or not you did anything. Now every window is one you
    // earned: close the action item on its clock, or resolve an attendee right
    // next to the room (see killEnemy). Nothing opens on its own any more.
    if (e.open) {
      e.cycleT -= dt;
      if (e.cycleT <= 0) {
        e.open = false;
        addFloater(e.x, e.y - e.r - 8, 'AGENDA RESUMES', '#8f8fa8');
        sfx.block();
      }
    } else {
      // mandatory attendance: stand too close while it's talking and it pulls
      // you into the room. The ring it drags from is drawn on the floor.
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (d > 1 && d < ATTENDANCE_R) {
        const pull = MEETING_PULL * dt / d;
        player.x = clamp(player.x + (e.x - player.x) * pull, player.r, VW - player.r);
        player.y = clamp(player.y + (e.y - player.y) * pull, player.r, VH - player.r);
      }
    }
    // The action item and its clock. Closing it is handled in killEnemy — this
    // side only has to notice the miss, and book the next one.
    if (e.item && !enemies.includes(e.item)) e.item = null;
    if (e.item) {
      e.item.actionT -= dt;
      if (e.item.actionT <= 0) {
        e.item.actionOf = null;   // it stays on the field, just no longer on a clock
        e.item = null;
        e.actT = cad(e, ACTION_EVERY);
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ACTION_HEAL);
        addFloater(e.x, e.y - e.r - 8, pick(ACTION_MISS), '#ff5a6e', true);
        sfx.siren();
        shake += 3;
      }
    } else {
      e.actT -= dt;
      if (e.actT <= 0) { e.actT = cad(e, ACTION_EVERY); assignAction(e); }
    }
    // The room keeps changing what it's about. Its own area rotates, and the
    // attendees it calls in are deliberately the OTHER two areas — so the
    // language that clears a path through the room is never the language that
    // hurts the boss, and the window it opens costs you a switch to use.
    e.hueT -= dt;
    if (e.hueT <= 0) {
      e.hueT = cad(e, MTG_HUE);
      e.area = pick(AREA_KEYS.filter((a) => a !== e.area));
      addFloater(e.x, e.y - e.r - 8, 'NEW AGENDA — ' + LANGS.find((l) => l.area === e.area).name, AREAS[e.area].color);
      sfx.ding();
    }
    e.callT -= dt;
    if (e.callT <= 0) {
      e.callT = cad(e, 3);
      // past halfway it stops calling them in one at a time
      const split = e.hp < e.maxHp * 0.5;
      const others = AREA_KEYS.filter((a) => a !== e.area);
      for (const m of spawnMinion('story', e, split ? 2 : 1)) m.area = pick(others);
      if (split && !e.breakoutHint) { e.breakoutHint = true; addFloater(e.x, e.y - e.r - 8, 'BREAKOUT ROOMS', '#b9c4dd'); }
    }
    return false;
  }
  if (e.boss === 'outage') {
    // aim (telegraph) → dash → re-aim → dash → down (the incident window: ×2).
    // One dash was a sidestep away from free; a chain of them re-reads where
    // you actually are between each one, so the dodge has to keep being made.
    e.phaseT -= dt;
    if (e.mode === 'aim') {
      if (e.phaseT <= 0) {
        e.mode = 'dash'; e.phaseT = 0.45;
        e.dx = ux; e.dy = uy;   // aimed at where you are now, not where you were
        e.trailT = 0;
        sfx.siren();
      }
      return true;
    }
    if (e.mode === 'dash') {
      e.x += e.dx * DASH_SPEED * dt; e.y += e.dy * DASH_SPEED * dt;
      // burning ground: the route it took stays on fire behind it, so a long
      // fight slowly costs you the room rather than only the moment
      e.trailT -= dt;
      if (e.trailT <= 0) { e.trailT = 24 / DASH_SPEED; throwHazard(e.x, e.y, 0, 0, 2.5, 'fire'); }
      if (e.phaseT <= 0) {
        e.dashesLeft--;
        // The Cascade slams the room where every single charge ends; the
        // ordinary Megaoutage saves one slam for half a second after the whole
        // combo lands, so the incident window opens under a ring you have to
        // already be clear of. Either way it's the Monolith's stack trace,
        // fired by something that has just stopped moving.
        if (e.def && e.def.ringEach) throwRing(e, OUT_RING_N, OUT_RING_SPEED, OUT_RING_LIFE);
        if (e.dashesLeft > 0) { e.mode = 'aim'; e.phaseT = cad(e, 0.25); } // barely time to move
        else {
          e.mode = 'down'; e.phaseT = cad(e, 1.1); shake += 3;
          e.ringT = (e.def && e.def.ringAfter) || 0;
          if (!e.windowHint) { e.windowHint = true; addFloater(e.x, e.y - e.r - 8, 'INCIDENT WINDOW — ×2', '#ffd23f'); }
        }
      }
      return true;
    }
    if (e.ringT > 0) { // the delayed slam, telegraphed by the ring drawn around it
      e.ringT -= dt;
      if (e.ringT <= 0) throwRing(e, OUT_RING_N, OUT_RING_SPEED, OUT_RING_LIFE);
    }
    if (e.phaseT <= 0) { e.mode = 'aim'; e.phaseT = cad(e, 0.7); e.dashesLeft = outageDashes(e); }
    return true;
  }
  if (e.boss === 'flaky') {
    e.phaseT -= dt;
    if (e.phaseT <= 0) {
      e.pass = !e.pass;
      e.phaseT = e.pass ? cad(e, 1.7) : cad(e, 1.2);
      addFloater(e.x, e.y - e.r - 8, e.pass ? 'PASS' : 'FAIL — IMMUNE', e.pass ? '#3fe08a' : '#ff5a6e');
      sfx.ding();
      if (!e.pass) {
        e.failedAt = t; // the instant the window shut — see the feeding rule
        // A failing test throws its stack, and the immune window was the one
        // half of this fight with nothing in it: you waited it out at whatever
        // range you liked. Now the moment it goes red the room does too, so
        // FAIL is a dodge rather than a pause — and standing on top of it when
        // the window closes is the mistake it is there to charge you for.
        // Telegraphed by the collapsing ring drawn over the last of PASS,
        // which is the same beat you should be releasing the trigger on.
        if (++e.fails % FLAKY_HOP_EVERY === 0) {
          // every other failure it runs the suite again, somewhere else — the
          // stack then comes out where it LANDS, not where it left
          e.blinkT = 0.3;
          addFloater(e.x, e.y - e.r - 16, 'RETRYING…', '#c9a8ff');
        } else {
          throwRing(e, FLAKY_RING_N, FLAKY_RING_SPEED, FLAKY_RING_LIFE);
        }
      }
    }
    if (e.blinkT > 0) {
      e.blinkT -= dt;
      if (e.blinkT <= 0) {
        // The hop swings AROUND you, not away from you: it re-appears that far
        // along the arc, so it lands on a completely different side of the room
        // without ever running off with the fight. A hop in a free direction
        // fails the threat proof outright — at this size and rate it retreats
        // faster than a FAIL window can close, and a player who stands still is
        // never reached, which is the same trap FLAKY_KEEP was written to
        // escape. FLAKY_LEASH is what makes the wider arc affordable.
        // The radius it lands on has to account for where it is standing NOW,
        // not just for the arc: it starts d0 from you and finishes `keep` from
        // you on the far side, so the jump is d0 + keep long. Clamping the
        // START distance instead — which is the obvious way to write this —
        // silently delivers a 230px hop for a 320px setting.
        const d0 = Math.hypot(e.x - player.x, e.y - player.y);
        const keep = clamp(FLAKY_HOP - d0, FLAKY_KEEP, FLAKY_REACH);
        const swing = 2 * Math.asin(Math.min(1, FLAKY_HOP / (2 * keep))) * (Math.random() < 0.5 ? 1 : -1);
        const a = Math.atan2(e.y - player.y, e.x - player.x) + swing;
        e.x = clamp(player.x + Math.cos(a) * keep, e.r, VW - e.r);
        e.y = clamp(player.y + Math.sin(a) * keep, e.r, VH - e.r);
        e.spawnT = 0.3; // lands inert and pulsing, like anything materializing
        addParticles(e.x, e.y, '#c9a8ff', 10, 90);
        // A re-run is a different environment: the stack it fails on moves with
        // it, so the language that hurts it is never the one you just settled
        // into. Same gesture as the Monolith's refactor, on the hop instead of
        // on a clock — the tell is the hop you already had to watch for.
        e.area = pick(AREA_KEYS.filter((ar) => ar !== e.area));
        addFloater(e.x, e.y - e.r - 8,
          'RE-RAN ON ' + LANGS.find((l) => l.area === e.area).name, AREAS[e.area].color);
        // the re-run failed too, so the stack comes out here — arriving and
        // detonating are one event, which is what makes chasing the hop cost
        // something rather than being the obvious free move
        throwRing(e, FLAKY_RING_N, FLAKY_RING_SPEED, FLAKY_RING_LIFE);
      }
      return true; // it holds still through the flicker — that's the telegraph
    }
    // Inverted pursuit: it flees while it's hittable and hunts you while it
    // isn't, so the damage window is a chase and the immune window is a dodge.
    // Spraying through FAIL was free before; now it costs ground as well as HP.
    // Inside FLAKY_LEASH it is in the fight and behaves as it always has:
    // backing off while hittable, hunting while immune. Outside it, it is still
    // out at the last retry's distance and both speeds switch to getting back.
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    const out = d > FLAKY_LEASH;
    const sp = e.sp * (e.pass
      ? (out ? FLAKY_RETURN : d > FLAKY_KEEP ? 0.25 : -0.8)
      : (out ? FLAKY_SPRINT : 1.3));
    const wob = Math.sin(t * e.wobFreq + e.wobPhase) * e.wobAmp;
    e.x += (ux + -uy * wob) * sp * dt;
    e.y += (uy + ux * wob) * sp * dt;
    return true;
  }
  return false;
}

// MERGE CONFLICT is two long-lived branches, `main` and `master`, that have
// diverged — and THE OCTOPUS MERGE is the same fight with `mainster` in the
// middle of it. Each keeps cutting feature branches off itself — small tickets
// tethered to their parent by a dashed line — and while ANY feature branch is
// still open anywhere, no trunk can be merged: letters bounce off all of them.
//
// A side that has cut its quota and had them all closed goes CLEAN and stops
// cutting new ones, which is what makes the work finite: clear one side, then
// the next, and only then are the trunks themselves killable. Dropping trunks
// buys nothing until only ONE is left standing — that is when the reconnect
// countdown starts, and if it runs out every branch you closed comes back and
// they all diverge again, cutting features from scratch.
const FEAT_QUOTA = 3;      // a side must cut this many before it can be called clean
const FEAT_MAX = 3;        // open at once from one side
const FEAT_EVERY = 3.4;    // seconds between cuts, for a two-trunk fight
const CONFLICT_SHOOT = 3.6; // seconds between the letters a trunk throws at you

// Immunity here is GLOBAL — no trunk is merge-able while any branch is open
// anywhere — so the room's total cut rate, not the per-trunk one, is what the
// fight is balanced against. A third side cutting on the same 3.4s clock is
// half again the work, and against an all-or-nothing rule that is not "harder",
// it is unwinnable: measured, THE OCTOPUS MERGE sat at 3×full HP for 150s
// while a god-mode player did nothing but farm branches, because the window
// where every branch was closed at once never arrived. Stretching the per-trunk
// interval by the trunk count keeps the aggregate exactly where Merge Conflict
// tuned it, and the extra work shows up where it should — 9 branches to close
// instead of 6, and half again the HP behind them.
const featEvery = (e) => FEAT_EVERY * ((e.def && e.def.trunks ? e.def.trunks.length : 2) / 2);
const FEAT_NAMES = ['feat/login', 'fix/npe', 'feat/dark-mode', 'fix/flaky-ci',
  'feat/export', 'fix/off-by-one', 'feat/webhooks', 'fix/timezone'];

// Any feature branch still open, on either trunk. While true both are immune.
const featuresOpen = () => bossParts.some((b) =>
  b.boss === 'conflict' && b.feat && b.feat.some((f) => enemies.includes(f)));

function cutFeature(e) {
  const a = rnd(0, TAU);
  const m = makeEnemy('bug',
    clamp(e.x + Math.cos(a) * (e.r + 18), 12, VW - 12),
    clamp(e.y + Math.sin(a) * (e.r + 18), 12, VH - 12));
  m.featOf = e;
  m.branchName = pick(FEAT_NAMES);
  m.area = e.area;                                   // a branch inherits its trunk
  m.spawnT = 0.45;
  m.flank = Math.random() < 0.5 ? 1 : -1;            // they arc in rather than queue
  e.feat.push(m);
  e.cutFeat = (e.cutFeat || 0) + 1;
  return m;
}

// Both trunks diverge again: everything goes back to needing its features
// closed first. Called when the reconnect countdown beats you.
function divergeAgain() {
  for (const b of bossParts) {
    if (b.boss !== 'conflict') continue;
    b.clean = false;
    b.cutFeat = 0;
    b.featT = cad(b, 1.2);
  }
}

// Trunks sitting on top of each other are rebasing onto one another and take
// half damage until you split them up. Together with the pincer steering it
// makes Merge Conflict a positioning fight: they want to converge on you, and
// letting them is what makes them tanky.
const REBASE_DIST = 90;
const rebasing = (e) => e.boss === 'conflict' &&
  trunks().some((o) => o !== e && Math.hypot(e.x - o.x, e.y - o.y) < REBASE_DIST);

// What one letter is worth against a target, before the situational multipliers
// the fights layer on top (the incident window, the reconnect window, rebasing).
// A match is always ×2. What the wrong tech is worth is the difficulty's call —
// it decides whether the stripe is a bonus or an instruction — and heavies halve
// it again, so switching language is the real answer against anything big.
//
// It is a function rather than four lines inline because The Flaky Test needs
// the same number with the sign flipped: what it heals when you feed it a
// letter through FAIL has to track what that letter would have taken off.
function letterDamage(e, lang) {
  if (e.area && LANGS[lang].area === e.area) return 2;
  if (e.area && (e.boss || e.type === 'epic')) return curDiff().off * 0.5;
  return curDiff().off;
}

// Letters a boss currently ignores. Both cases are telegraphed on screen.
function bossBlocks(e) {
  return (e.boss === 'mtgboss' && !e.open) || (e.boss === 'flaky' && !e.pass) ||
    (e.boss === 'screep' && scopeAttached(e)) ||
    (e.boss === 'conflict' && featuresOpen());
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
  if (e.boss === 'conflict' && trunks().length) {
    // Closed, not resolved: it waits in conflictFallen for the countdown to
    // beat you, and comes back half as strong as it was last time — so the
    // fight converges even on a bad burst. But the countdown itself only
    // starts once ONE side is left standing: with three branches open,
    // dropping the first two just shortens the list you have to hold down.
    const reopens = (e.reopens || 0) + 1;
    conflictFallen.push({
      maxHp: e.maxHp, hp: Math.max(1, Math.round(e.maxHp * Math.pow(0.5, reopens))),
      score: e.score, area: e.area, reopens, branch: e.branch,
    });
    const rest = trunks();
    if (rest.length === 1) {
      rest[0].reviveT = REOPEN_WINDOW;
      addFloater(rest[0].x, rest[0].y - rest[0].r - 12, 'RESOLVE THE LAST SIDE — ×2 DAMAGE!', '#ffd23f', true);
      sfx.siren();
      shake += 4;
    } else {
      addFloater(e.x, e.y, rest.length + ' BRANCHES STILL OPEN — +' + gained, '#ffd23f');
      sfx.epicDie();
    }
    return false;
  }

  const over = !bossParts.length;
  if (over) {
    recordBossKill(e); // six of these on HARD is what unlocks CLAUDELIKE
    addFloater(e.x, e.y, (bossDef ? bossDef.name : 'BOSS') + ' RESOLVED! +' + gained, '#ffd23f', true);
    sfx.bossDie();
    // a boss always pays out — no dice roll
    pickups.push({ kind: 'coffee', x: clamp(e.x - 16, 12, VW - 12), y: e.y, life: 16, phase: rnd(0, TAU) });
    pickups.push({ kind: 'duck', x: clamp(e.x + 16, 12, VW - 12), y: e.y, life: 16, phase: rnd(0, TAU) });
    pickups.push({ kind: 'can', x: clamp(e.x, 12, VW - 12), y: clamp(e.y + 18, 12, VH - 12), life: 16, phase: rnd(0, TAU) });
    // a later lap is a harder fight, so it pours a second cup
    if ((e.lap || 0) >= 1) {
      pickups.push({ kind: 'coffee', x: clamp(e.x, 12, VW - 12), y: clamp(e.y - 18, 12, VH - 12), life: 16, phase: rnd(0, TAU) });
    }
  } else {
    addFloater(e.x, e.y, 'ONE SIDE DOWN! +' + gained, '#ffd23f');
    sfx.epicDie();
  }
  return over;
}

// How much faster than the ticket it escorts a blocker may move while getting
// back into its slot. This one number is the whole difficulty of a BLOCKED BY
// pair: it caps how fast the shield can swing around to face you, so a player
// who closes and strafes can open an angle on the blocker, while one standing
// off at range never will. Too high and the pair is simply unkillable.
// It only governs how fast the blocker closes distance to its slot, not how
// fast the slot moves — ESCORT_TURN below is what actually decides whether the
// shield can be beaten. Keep this comfortably above 1 so the blocker can still
// follow the ticket it escorts, which is travelling at the same base speed.
const ESCORT_CATCHUP = 2.4;

// How fast, in rad/s, the blocker can swing its slot around the ticket. This
// is the difficulty of a BLOCKED BY pair, and the only knob worth turning.
//
// The slot used to be recomputed from the player's position every frame, so it
// tracked with zero reaction delay and the blocker was limited only by travel
// speed. That is unbeatable by manoeuvring — you can only out-run it — and no
// value of ESCORT_CATCHUP fixes it, which is what an earlier pass wasted its
// time discovering. Rate-limiting the turn is what creates the counterplay:
// cut back the other way and the shield has to swing the long way round, and
// that swing is the window you shoot through.
//
// Time for the slot to come back around after a full reversal (measured; the
// theory is pi/ESCORT_TURN and it tracks well):
//   3.0 -> 0.85s      1.1 -> 2.95s   <- chosen
//   1.4 -> 1.90s      0.8 -> 3.88s
// The old instant-tracking behaviour was worth about 1s, i.e. roughly 3.0.
// For scale, the chair tops out at 160 u/s, so at ~60px out you can swing
// around a ticket at up to ~2.6 rad/s — well clear of this.
const ESCORT_TURN = 1.1;

// Centre-to-centre distance a blocker rides behind the ticket it escorts.
// Derived from the two radii so it still reads right if either changes, then
// opened up 3x from the original snug spacing: the pair reads as a formation
// with real air in it rather than two sprites stuck together.
const escortGap = (story, b) => (story.r + b.r + 3) * 3;

// Park a blocker just behind the ticket it blocks, on the far side from the
// player, and make it move as part of that formation rather than as a bug.
// A blocked ticket eats letters, so the pair arrives as a shield with the fix
// hiding behind it: head-on there's no line to the blocker, and flanking the
// formation is what breaks it open. Matching the story's speed and its
// straight line is the other half — a loose bug is nearly twice a story's
// speed and weaves besides, so it would just drive out in front of the thing
// it's meant to be hiding behind and hand itself over.
function tuckBlocker(story, b) {
  const a = Math.atan2(player.y - story.y, player.x - story.x) + rnd(-0.22, 0.22);
  const gap = escortGap(story, b);
  b.x = clamp(story.x - Math.cos(a) * gap, 12, VW - 12);
  b.y = clamp(story.y - Math.sin(a) * gap, 12, VH - 12);
  b.sp = story.sp;
  b.wobAmp = story.wobAmp; b.wobFreq = story.wobFreq; b.wobPhase = story.wobPhase;
  b.flank = 0;        // a blocker holds the line; it doesn't arc around it
  b.blocks = story;   // and it escorts that ticket rather than hunting you
  b.escortA = a;      // starts already covering, then has to turn to keep up
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
    const b = makeEnemy('bug', x, y);
    b.spawnT = 0.45;
    // Lead the ticket out ahead of its blocker rather than pushing the blocker
    // back through the wall: the spawn point is already hard against the edge,
    // and at this gap the blocker would clamp on top of the ticket and then
    // have to drag itself back in from off-screen.
    const a = Math.atan2(player.y - y, player.x - x);
    const g = escortGap(e, b);
    e.x = clamp(x + Math.cos(a) * g, 12, VW - 12);
    e.y = clamp(y + Math.sin(a) * g, 12, VH - 12);
    tuckBlocker(e, b);
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

// Every bounced letter says why it bounced, in two halves that read as one
// sentence: the ticket calls out "BLOCKED BY..." and its blocker answers "ME!".
// The link line already draws the relationship, but only while you're looking
// at it — this says it at the moment you're staring at your own bullets doing
// nothing, and it points at the thing to shoot instead.
const BLOCK_CALL_GAP = 0.4; // s — holding the trigger shouldn't stack the text
function callOutBlocker(story, blocker) {
  if (t - (story.blockCallT ?? -9) < BLOCK_CALL_GAP) return;
  story.blockCallT = t;
  // ASCII dots, not '…': the single-cell ellipsis reads as an underscore at 8px
  addFloater(story.x, story.y - story.r - 8, 'BLOCKED BY...', '#7fe0ff');
  addFloater(blocker.x, blocker.y - blocker.r - 8, 'ME!', '#7fe0ff');
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
  // t0 is when it left the laptop. Only The Flaky Test reads it, to tell a
  // letter you chose to fire into a FAIL window from one that was already in
  // the air when the window flipped — see the feeding rule in bullets-vs-enemies.
  bullets.push({ x: nx, y: ny, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 1.9, ch: pick(GLYPHS), lang, t0: t });
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
  const gained = Math.round(e.score * combo * (e.enraged ? 1.5 : 1) * assistMul() * curDiff().sp);
  score += gained;
  // resolving a blocker frees whatever it was blocking
  for (const o of enemies) if (o.blockedBy === e) { o.blockedBy = null; addFloater(o.x, o.y - 8, 'UNBLOCKED!', '#7fe0ff'); }
  const shredColor = { bug: PAL.bug, story: PAL.story, epic: PAL.epic, hotfix: PAL.cup }[e.type] || PAL.paper;
  addParticles(e.x, e.y, '#dfe6ff', e.type === 'epic' ? 30 : 8, e.type === 'epic' ? 120 : 70);
  addParticles(e.x, e.y, shredColor, e.type === 'epic' ? 16 : 4, 60);
  // An attendee resolved right next to The Endless Meeting is the interruption
  // that opens it — kills are the key, so add control becomes the boss fight.
  // An action item closed before its clock runs out opens it from anywhere, and
  // for longer: that is the scheduled way in, the proximity one is the greedy
  // one you take when the room happens to be standing next to your work.
  if (!e.boss) {
    if (e.actionOf && bossParts.includes(e.actionOf)) {
      const b = e.actionOf;
      b.item = null;
      b.actT = cad(b, ACTION_EVERY);
      openMeeting(b, cad(b, ACTION_OPEN), 'ACTION ITEM CLOSED');
    }
    for (const b of bossParts) {
      if (b.boss === 'mtgboss' && Math.hypot(e.x - b.x, e.y - b.y) < DERAIL_R) {
        openMeeting(b, cad(b, 2.2), 'SOMEONE ASKED A QUESTION');
      }
    }
  }
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
    let best = null, bd = Infinity, shielded = null, sd = Infinity;
    for (const e of enemies) {
      if (e.type === 'meeting' || e.spawnT > 0) continue;
      // A blocked ticket eats letters exactly like a meeting does. Locking
      // onto one burns the whole clip on something that can't be damaged —
      // aim past it at the blocker, which is what's actually in the way.
      if (e.blockedBy && enemies.includes(e.blockedBy)) continue;
      const dd = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
      // A boss inside its immune window is the same situation: it loses the
      // lock to anything that CAN be hit, because every one of those windows
      // exists to point you at something else — the scope, the attendees, the
      // open branches. This is aim, not mercy: it stays the fallback when
      // there is nothing else on screen, so against The Flaky Test the chair
      // sits pointed at it through FAIL and auto-shoot feeds it, exactly as it
      // should. Without the skip, THE OCTOPUS MERGE is a hard lock — measured:
      // the chair tracks an immune trunk while the branches, the only killable
      // thing in the room, go unshot forever and the fight never progresses.
      if (bossBlocks(e)) { if (dd < sd) { sd = dd; shielded = e; } continue; }
      if (dd < bd) { bd = dd; best = e; }
    }
    const tgt = best || shielded;
    if (tgt) {
      const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
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

  // --- firing: Space, click, or the auto-shoot assist. Auto-shoot is on or
  // off and nothing else — it does NOT hold fire for immune windows, and it
  // deliberately does not protect you from The Flaky Test, which heals on what
  // you feed it. An assist that quietly plays the immune windows for you is
  // teaching you nothing, and CLAUDELIKE takes the assists away entirely: the
  // trigger discipline you need there has to be learned somewhere, and it is
  // learned by watching that HP bar go the wrong way and reaching for Space.
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
      if (sprint >= HACK_SPRINT) {
        // the terminal sprint: no queue, no clock — the spawning lives in the
        // wave branch below, ramping for as long as the player lasts
        sprint = HACK_SPRINT;
        hackT = 0;
        spawnQueue = [];
        spawnInterval = 0.9 * curDiff().dens;
        spawnTimer = 0;
        deadlineT = 0;
        sfx.wave();
        addFloater(player.x, player.y - 20, 'HACKATHON — THERE IS NO FINISH LINE', '#ffd23f', true);
        releaseBacklog(); // whatever boss 8 left caged joins the party
      } else {
        spawnQueue = buildSprint(sprint);
        // density is the dial: interval decays 8% per sprint, floored at 0.3s
        spawnInterval = Math.max(0.3, 1.1 * Math.pow(0.92, sprint - 1)) * curDiff().dens;
        spawnTimer = 0;
        // the sprint has a standup deadline; boss fights are untimed
        // carry-over counts against the clock too — a sprint that inherits a
        // backlog gets the time to work it, but no more than that
        deadlineT = sprint % 4 === 0 ? 0 : (20 + (spawnQueue.length + backlog.length) * 0.7) * curDiff().dead;
        sfx.wave();
        if (sprint % 4 === 0) {
          spawnBoss(sprint); // boss sprints are the boss, alone
          // The pens stay shut through a boss fight. A boss sprint has no
          // clock, so anything released into it must be killed for the sprint
          // to end — and a BLOCKED BY pair that the player can't flank would
          // deadlock the run outright. It also keeps "boss plus a full
          // backlog" from being the hardest thing in the game by a wide
          // margin. They wait one more sprint.
        } else {
          releaseBacklog(); // the pens open the moment the standup ends
        }
      }
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
    // THE HACKATHON: no queue — the stream itself is the sprint. The interval
    // halves every HACK_RAMP seconds (floor 0.12s); newly spawned tickets also
    // move faster as hackT climbs (see makeEnemy). The 70-enemy ceiling is a
    // frame-rate guard, not mercy: at that density the office is already lost.
    if (sprint === HACK_SPRINT) {
      hackT += dt;
      spawnInterval = Math.max(0.12, 0.9 * Math.pow(0.5, hackT / HACK_RAMP)) * curDiff().dens;
      if (spawnTimer <= 0 && enemies.length < 70) {
        spawnEnemy(pickHackType());
        spawnTimer = spawnInterval * rnd(0.7, 1.3);
      }
    }
    // Meeting invites drift in on their own calendar — but never mid-boss.
    // They are pure obstacle: infinite HP, they don't hunt you, and they are
    // excluded from the sprint-clear check, so more of them costs you room and
    // firing lines rather than time.
    meetingCd -= dt;
    if (sprint >= 2 && sprint % 4 !== 0 && meetingCd <= 0) {
      if (enemies.filter(e => e.type === 'meeting').length < MEETING_MAX) spawnEnemy('meeting');
      meetingCd = rnd(MEETING_GAP[0], MEETING_GAP[1]);
    }
    const cleared = !spawnQueue.length && !enemies.some(e => e.type !== 'meeting');
    // the hackathon has no deadline and cannot be cleared — a momentarily
    // empty board between spawns must not end the sprint that never ends
    if (sprint !== HACK_SPRINT && (cleared || timedOut)) {
      const wasBoss = sprint % 4 === 0;
      // Clearing the board early still pays in full; running out the clock
      // pays a third and hands the remainder to next sprint.
      const swept = cleared ? { caged: 0, writtenOff: 0 } : sweepToBacklog();
      const bonus = Math.round((50 + sprint * 25) * (wasBoss ? 3 : 1) * (cleared ? 1 : 0.33) * assistMul());
      score += bonus;
      if (wasBoss) { bossDef = null; bossMaxHp = 0; }
      hazards.length = 0; // thrown code doesn't outlive the sprint that threw it
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

  // --- soft enrage: the sprint review is not going to move for you
  if (bossParts.length) {
    bossClock += dt;
    if (bossClock > BOSS_ENRAGE_AT && !bossEnraged) {
      bossEnraged = true;
      for (const b of bossParts) {
        b.sp *= 1.3;
        if (b.spBase) b.spBase *= 1.3; // the Monolith recomputes sp from this
        b.cad *= 0.5;                  // and every cadence timer from here halves
      }
      addFloater(p.x, p.y - 20, 'THE SPRINT REVIEW IS WAITING', '#ff5a6e', true);
      sfx.siren();
      shake += 6;
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
    } else if (e.scopeOf && enemies.includes(e.scopeOf)) {
      // Glued to Scope Creep: it doesn't hunt you, it IS the boss's edge. It
      // rides its slot on the rim, so the whole thing moves as one body.
      // Once its parent is gone this test fails and it drops through to the
      // ordinary seek below — loose scope goes back to being a plain ticket.
      const b = e.scopeOf;
      e.x = clamp(b.x + Math.cos(e.scopeA) * (b.r + SCOPE_GAP), 8, VW - 8);
      e.y = clamp(b.y + Math.sin(e.scopeA) * (b.r + SCOPE_GAP), 8, VH - 8);
    } else if (e.blocks && enemies.includes(e.blocks)) {
      // A blocker escorts the ticket it blocks instead of hunting you: it
      // steers for the slot tucked behind that ticket. Matching speed alone
      // isn't enough — two things homing on the player converge onto the same
      // line and settle side by side, which is no shield at all.
      // It may sprint to close the gap, but it can't rotate around the ticket
      // faster than that, so strafing hard still opens an angle on it. That
      // gap is the counterplay; without it the blocker would be unreachable
      // and the pair unkillable.
      const s = e.blocks;
      // The slot is a heading the blocker turns to, not a point it snaps to.
      // Rate-limiting that turn is what makes the shield out-manoeuvrable:
      // cut back the other way and it has to swing the long way round before
      // it's covering the ticket again, and that swing is your window. Without
      // it the slot tracks you with zero reaction delay and no amount of
      // capping its speed ever opens a reliable angle.
      const want = Math.atan2(p.y - s.y, p.x - s.x);
      if (e.escortA === undefined) e.escortA = want;
      const turn = ((want - e.escortA + Math.PI) % TAU + TAU) % TAU - Math.PI;
      e.escortA += clamp(turn, -ESCORT_TURN * dt, ESCORT_TURN * dt);
      const sa = e.escortA;
      const g = escortGap(s, e);
      // Keep the slot inside the room. At this gap a ticket working a wall
      // puts its slot outside it, and the blocker would sit off-screen —
      // invisible and unshootable, with the ticket immune for no reason the
      // player can see. Cornered, the formation just degrades to side-by-side,
      // which is a fair break for having backed it into a wall.
      const gx = clamp(s.x - Math.cos(sa) * g, 10, VW - 10) - e.x;
      const gy = clamp(s.y - Math.sin(sa) * g, 10, VH - 10) - e.y;
      const gd = Math.hypot(gx, gy);
      if (gd > 0.5) {
        const step = Math.min(gd, e.sp * ESCORT_CATCHUP * dt);
        e.x += gx / gd * step; e.y += gy / gd * step;
      }
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
        const blocker = e.blockedBy && enemies.includes(e.blockedBy) ? e.blockedBy : null;
        if (e.type === 'meeting' || bossBlocks(e) || blocker) {
          // meeting invites block your letters — infinite HP, zero shame.
          // A boss in its immune window, or a BLOCKED BY ticket whose blocker
          // still lives, shrugs them off the same way.
          // A failing test doesn't shrug it off, though — it eats it, and it
          // eats DOUBLE what the same letter would have been worth as damage.
          // A flat +0.5 was a rounding error you could spray straight through;
          // at ×2 a second of blind fire through FAIL undoes four seconds of
          // aimed fire through PASS, which is the fight the boss is named for.
          // It scales off the letter, so the wrong language feeds it less —
          // the stripe still means what it means, in both directions.
          // It only eats what you CHOSE to feed it: a letter fired after the
          // window had already flipped to FAIL. A letter that was mid-flight
          // when it flipped is merely wasted. Without that line the boss eats
          // your flight time rather than your judgement — measured on
          // CLAUDELIKE, where the PASS window is 1.22s and a letter takes
          // ~0.2s to cross the gap, it clawed back 258 of 326 damage and the
          // fight ran past the 75s enrage. Punishing the trigger is the
          // mechanic; punishing the speed of sound is not.
          if (e.boss === 'flaky' && b.t0 >= e.failedAt) {
            e.hp = Math.min(e.maxHp, e.hp + 2 * letterDamage(e, b.lang));
            if (!e.fedHint) { e.fedHint = true; addFloater(e.x, e.y - e.r - 8, 'IT FED ON THAT — ×2', '#c9a8ff'); }
          }
          if (blocker) callOutBlocker(e, blocker);
          addParticles(b.x, b.y, '#5a6a90', 3, 40);
          sfx.block();
          continue outer;
        }
        const matched = e.area && LANGS[b.lang].area === e.area;
        let dmg = letterDamage(e, b.lang);
        // heavies resist off-area letters — switching language is the real answer
        if (!matched && e.area && (e.boss || e.type === 'epic') && !e.resistHint) {
          e.resistHint = true; addFloater(e.x, e.y - e.r - 8, 'WRONG TECH — ×½', '#8f8fa8');
        }
        if (e.boss === 'outage' && e.mode === 'down') dmg *= 2; // the incident window
        if (e.boss === 'conflict' && e.reviveT > 0) dmg *= 2;   // last side standing
        if (rebasing(e)) {                                      // the two sides are covering each other
          dmg *= 0.5;
          if (!e.rebaseHint) { e.rebaseHint = true; addFloater(e.x, e.y - e.r - 8, 'REBASING — SPLIT THEM UP', '#ffd23f'); }
        }
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

  // --- hazards: thrown code. Bullets pass straight through it; the only
  // answer is not being where it lands.
  for (let i = hazards.length - 1; i >= 0; i--) {
    const hz = hazards[i];
    hz.x += hz.vx * dt; hz.y += hz.vy * dt;
    hz.armT = Math.max(0, hz.armT - dt);
    hz.life -= dt;
    if (hz.life <= 0 || hz.x < -12 || hz.x > VW + 12 || hz.y < -12 || hz.y > VH + 12) {
      hazards.splice(i, 1);
      continue;
    }
    if (hz.armT <= 0 && Math.hypot(hz.x - p.x, hz.y - p.y) < hz.r + p.r) {
      damagePlayer(hz);
      if (state !== 'play') break;
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
      sfx[pk.kind === 'can' ? 'canPickup' : 'pickup']();
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
  // Everything below this line draws in 640×360 game units regardless of mode —
  // one transform is what keeps ~3000 lines of drawing code resolution-agnostic.
  ctx.setTransform(RS(), 0, 0, RS(), 0, 0);
  ctx.save();
  if (shake > 0.3) ctx.translate(rnd(-shake, shake) * 0.6, rnd(-shake, shake) * 0.6);

  ctx.drawImage(bgCanvas, 0, 0);

  if (state === 'menu') { drawMenu(); ctx.restore(); return; }
  if (state === 'setup') { drawSetup(); ctx.restore(); return; }
  if (state === 'diff') { drawDiff(); ctx.restore(); return; }
  if (state === 'help') { drawHelp(); ctx.restore(); return; }

  // pickups
  for (const pk of pickups) {
    if (pk.life < 3 && Math.floor(pk.life * 6) % 2 === 0) continue; // blink before despawn
    const bob = Math.sin(menuT * 4 + pk.phase) * 1.5;
    const img = pk.kind === 'coffee' ? coffeeImg : pk.kind === 'can' ? canImg : duckImg;
    ctx.drawImage(img, Math.round(pk.x - img.width / 2), Math.round(pk.y - img.height / 2 + bob));
  }

  // hazards: thrown code lying on the floor, fading as it decays. One still
  // materializing pulses instead — the same tell a spawning ticket wears, and
  // it cannot touch you until it stops.
  for (const hz of hazards) {
    ctx.globalAlpha = hz.armT > 0
      ? 0.25 + 0.35 * Math.abs(Math.sin(hz.armT * 26))
      : clamp(hz.life, 0, 1);
    // hotter the fresher it is — the last frames of a thrown letter are the
    // dull red of something about to go out
    const set = HAZARD_IMG[hz.kind];
    const burn = set.length === 1 ? 0
      : clamp(Math.floor((1 - hz.life / hz.life0) * set.length), 0, set.length - 1);
    ctx.drawImage(set[burn][hz.ch], Math.round(hz.x) - 2, Math.round(hz.y) - 3);
    ctx.globalAlpha = 1;
    if (hz === culprit && hitFreeze > 0) { // freeze frame: that's what got you
      ctx.strokeStyle = Math.floor(hitFreeze * 16) % 2 === 0 ? '#ffffff' : '#ff5a6e';
      ctx.strokeRect(Math.round(hz.x) - 4.5, Math.round(hz.y) - 5.5, 9, 11);
    }
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
      if (e.area) { ctx.fillStyle = AREAS[e.area].color; ctx.fillRect(ex + 1, ey + 1, w - 2, STRIPE_W); }
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
    // area stripe across the top edge, like a document header:
    // red = FE, green = BE, blue = INFRA
    if (e.area) { ctx.fillStyle = AREAS[e.area].color; ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, STRIPE_W); }
    ctx.restore();

    // hotfixes flash orange the whole way in
    if (e.type === 'hotfix' && Math.floor(t * 12) % 2 === 0) {
      ctx.strokeStyle = '#ff8a5c';
      ctx.strokeRect(ex - 1.5, ey - 1.5, w + 3, h + 3);
    }
    // a feature branch wears its name, so the fiction is legible on the field
    if (e.branchName) {
      ctx.textAlign = 'center';
      ctx.font = '6px monospace';
      ctx.fillStyle = '#080c18';
      ctx.fillText(e.branchName, Math.round(e.x) + 1, ey + h + 8);
      ctx.fillStyle = '#7fe0ff';
      ctx.fillText(e.branchName, Math.round(e.x), ey + h + 7);
    }
    // an action item wears its clock — the deadline is the mechanic, so it has
    // to be readable from wherever you happen to be standing
    if (e.actionOf && bossParts.includes(e.actionOf)) {
      const late = e.actionT < 1.5;
      ctx.strokeStyle = late && Math.floor(t * 10) % 2 === 0 ? '#ff5a6e' : '#ffd23f';
      ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
      ctx.textAlign = 'center';
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#080c18';
      ctx.fillText(e.actionT.toFixed(1) + 's', Math.round(e.x) + 1, ey - 4);
      ctx.fillStyle = late ? '#ff5a6e' : '#ffd23f';
      ctx.fillText(e.actionT.toFixed(1) + 's', Math.round(e.x), ey - 5);
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
      ctx.drawImage(devSprite(), -17, -17);
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
    ctx.fillStyle = sprint >= HACK_SPRINT ? '#ffd23f' : '#dfe6ff';
    ctx.fillText(sprint >= HACK_SPRINT ? 'THE HACKATHON' : 'SPRINT ' + sprint, VW / 2, VH / 2 + 2);
    ctx.font = '8px monospace';
    if (sprint >= HACK_SPRINT) {
      ctx.fillStyle = '#ff8a5c';
      ctx.fillText('no deadline. no end. it ships when you drop — ' + Math.ceil(breakTimer) + '…', VW / 2, VH / 2 + 14);
    } else if (sprint % 4 === 0) {
      const next = BOSSES[(Math.floor(sprint / 4) - 1) % BOSSES.length];
      ctx.fillStyle = '#ff8a5c';
      ctx.fillText('ESCALATED TO ' + next.name + ' — ' + Math.ceil(breakTimer) + '…', VW / 2, VH / 2 + 14);
      // the pens stay shut for a boss — say so, or full cages that don't open
      // just read as a bug
      if (backlog.length) {
        ctx.fillStyle = '#8f8fa8';
        ctx.fillText('backlog frozen for the escalation', VW / 2, VH / 2 + 25);
      }
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
    pauseHits.length = 0; // cleared before drawBoard so its pager can register
    ctx.font = '8px monospace';
    drawBoard(y + 26, false, pauseHits); // a mid-run rank would be a lie — rows only
    if (debugMode) drawDebugLevels(); // left-column level jumper
    // Changing your dev is the one thing you could only do before a run, which
    // meant dying for it. Centred so it clears the debug column on the left.
    ctx.font = 'bold 10px monospace';
    const armed = quitArmed();
    uiButton(pauseHits, btnX(3, 0), BTN_Y, BTN_W, BTN_H,
      armed ? 'SURE? — QUIT' : 'Q — QUIT RUN',
      armed && Math.floor(menuT * 6) % 2 === 0 ? '#ffd23f' : armed ? '#ff5a6e' : '#5a6a90', quitRun);
    uiButton(pauseHits, btnX(3, 1), BTN_Y, BTN_W, BTN_H, 'C — EDIT DEV', '#8a63ff', () => openSetup('play'));
    uiButton(pauseHits, btnX(3, 2), BTN_Y, BTN_W, BTN_H, '? — HELP', '#7fe0ff', () => openHelp('play'));
    if (armed) {
      ctx.textAlign = 'center';
      ctx.font = '7px monospace';
      ctx.fillStyle = '#ff5a6e';
      ctx.fillText('this run ends here — it scores nothing', VW / 2, BTN_Y - 6);
    }
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
    // the invite radius: cross it while the agenda is running and you're an
    // attendee, dragged toward the table until it opens
    if (!e.open) {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#b9c4dd';
      ctx.beginPath(); ctx.arc(e.x, e.y, ATTENDANCE_R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the action item, on a dashed tether like a feature branch — the ticket
    // the room is waiting on, and the only scheduled way into the agenda
    if (e.item && enemies.includes(e.item)) {
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = e.item.actionT < 1.5 && Math.floor(t * 10) % 2 === 0
        ? '#ff5a6e' : 'rgba(255,210,63,0.7)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.item.x, e.item.y); ctx.stroke();
      ctx.restore();
    }
    // the organizer pip — green means someone derailed the agenda, hit it now
    ctx.fillStyle = e.open ? '#3fe08a' : '#5a6a90';
    ctx.fillRect(cx - 3, Math.round(e.y) - 3, 6, 6);
    ctx.strokeStyle = '#080c18';
    ctx.strokeRect(cx - 3.5, Math.round(e.y) - 3.5, 7, 7);
    if (!e.open) { ctx.strokeStyle = '#5a6a90'; ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5); }
  }
  if (e.boss === 'screep') {
    // every attachment draws its tether, so "that ticket is part of the boss"
    // is visible rather than something you infer from bullets not landing
    const shielded = scopeAttached(e);
    for (const s of e.scope) {
      if (!enemies.includes(s)) continue;
      ctx.strokeStyle = 'rgba(255,143,160,0.55)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
    if (shielded) {
      ctx.strokeStyle = '#ff8fa0';
      ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
    } else {
      // the window, flashing: this is the only time letters land on it
      ctx.strokeStyle = Math.floor(t * 10) % 2 === 0 ? '#3fe08a' : '#ffd23f';
      ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
    }
    // the clock to the next attachment, on the card
    ctx.fillStyle = '#080c18';
    ctx.fillRect(e.x - 8, ey - 5, 16, 2);
    ctx.fillStyle = shielded ? '#ff5a6e' : '#3fe08a';
    ctx.fillRect(e.x - 8, ey - 5, Math.round(16 * clamp(e.growT / cad(e, SCOPE_GROW), 0, 1)), 2);
  }
  if (e.boss === 'monolith' && e.traceWind > 0) {
    // the trace it is winding up to throw: a ring growing out to where the
    // glyphs will actually appear, so the dodge is decided before they exist
    ctx.strokeStyle = Math.floor(t * 14) % 2 === 0 ? '#8fa8d8' : '#dfe6ff';
    ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
    ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + (0.8 - e.traceWind) * 34, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (e.boss === 'flaky') {
    ctx.strokeStyle = e.pass ? '#3fe08a' : '#ff5a6e';
    ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
    ctx.textAlign = 'center';
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = e.pass ? '#3fe08a' : '#ff5a6e';
    ctx.fillText(e.pass ? 'PASS' : 'FAIL', cx, ey - 6);
    // the window closing, and the stack it is about to throw: one ring
    // collapsing onto it, the same shape the Megaoutage uses before its slam
    if (e.pass && e.phaseT <= cad(e, FLAKY_WIND)) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff5a6e';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + e.phaseT * 70, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
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
    if (e.ringT > 0) {
      // the shockwave it is about to let go, collapsing inward as it arrives —
      // the same wind-up ring the Monolith draws ahead of a stack trace
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff5a6e';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + e.ringT * 60, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (e.boss === 'conflict') {
    // one link per pair of trunks; each lights up while those two are close
    // enough to cover each other — the half-damage state, drawn before the HP
    // bar stalls. With three branches the lit triangle is the whole tell.
    for (const o of trunks()) {
      if (o === e) continue;
      ctx.strokeStyle = Math.hypot(e.x - o.x, e.y - o.y) < REBASE_DIST
        ? 'rgba(255,210,63,0.75)' : 'rgba(63,224,138,0.35)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(o.x, o.y); ctx.stroke();
    }
    // feature branches: a dashed tether, deliberately unlike the solid trunk
    // link, so "cut from this side" reads at a glance
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(127,224,255,0.6)';
    for (const f of e.feat) {
      if (!enemies.includes(f)) continue;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(f.x, f.y); ctx.stroke();
    }
    ctx.restore();
    // which trunk this is, and whether it still has branches to close
    ctx.textAlign = 'center';
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = e.clean ? '#3fe08a' : '#7fe0ff';
    ctx.fillText(e.branch || 'main', cx, ey - 6);
    if (e.clean) {
      ctx.font = '7px monospace';
      ctx.fillStyle = '#3fe08a';
      ctx.fillText('CLEAN', cx, ey - 14);
    }
    if (e.reviveT > 0) { // the window to finish the other side, at double damage
      ctx.strokeStyle = Math.floor(t * 10) % 2 === 0 ? '#ffd23f' : '#3fe08a';
      ctx.strokeRect(ex - 3.5, ey - 3.5, w + 7, h + 7);
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(e.reviveT.toFixed(1) + 's', cx, ey - 16);
    }
    if (featuresOpen()) { // why letters are bouncing off both trunks
      ctx.strokeStyle = '#7fe0ff';
      ctx.strokeRect(ex - 2.5, ey - 2.5, w + 5, h + 5);
    }
  }
}

function drawBossBar() {
  const hp = bossParts.reduce((s, e) => s + Math.max(0, e.hp), 0);
  const w = 250, x = Math.round((VW - w) / 2), y = 25;
  ctx.textAlign = 'center';
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = bossEnraged && Math.floor(t * 4) % 2 === 0 ? '#ff5a6e' : bossDef.color;
  ctx.fillText(bossDef.name + (bossEnraged ? ' — OVERRUNNING' : ''), VW / 2, y - 3);
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
  ctx.fillText(sprint === HACK_SPRINT ? 'THE HACKATHON' : 'SPRINT ' + sprint, VW / 2, 12);
  if (phase === 'wave' && bossParts.length) {
    drawBossBar(); // the boss owns this strip while it lives
  } else if (phase === 'wave' && sprint === HACK_SPRINT) {
    ctx.font = '8px monospace';
    ctx.fillStyle = hackT > 90 ? '#ff5a6e' : hackT > 45 ? '#ff8a5c' : '#8f8fa8';
    ctx.fillText(Math.floor(hackT) + 's survived · ' + enemies.length + ' on the board · it only gets worse', VW / 2, 21);
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
  // assist toggles (lit teal when on) — struck out entirely where the
  // difficulty forbids them, so the keys aren't advertised as available
  const d = curDiff();
  if (d.assists) {
    ctx.fillStyle = autoAim ? '#2fe4c8' : '#5a6a90';
    ctx.fillText('[I] AUTO-AIM', 6, VH - 15);
    ctx.fillStyle = autoShoot ? '#2fe4c8' : '#5a6a90';
    ctx.fillText('[O] AUTO-SHOOT', 6, VH - 5);
  } else {
    ctx.fillStyle = '#3a2f57';
    ctx.fillText('NO ASSISTS', 6, VH - 5);
  }
  // which sprint you signed up for — invisible otherwise once the run starts
  ctx.textAlign = 'right';
  ctx.fillStyle = d.color;
  ctx.fillText(d.name, VW - 6, VH - 5);
}

function drawMenu() {
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(0, 0, VW, VH);
  menuHits.length = 0;
  if (menuBoard) {
    // board-only page: same top-down layout as the pause screen, no rank
    ctx.fillStyle = 'rgba(8,12,24,0.82)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#dfe6ff';
    ctx.fillText('LEADERBOARD', VW / 2, 48);
    ctx.font = '8px monospace';
    drawBoard(74, false, menuHits); // menuHits was just cleared — only the pager lands in it
    ctx.font = '8px monospace';
    ctx.fillStyle = '#8f8fa8';
    ctx.fillText('ESC — back to the title', VW / 2, VH - 20);
    return;
  }
  const cx = VW / 2, cy = VH / 2; // laid out from the centre so it survives a resolution change

  // spinning chair
  ctx.save();
  ctx.translate(cx, cy - 84);
  ctx.rotate(menuT * 1.2);
  ctx.scale(2, 2);
  ctx.drawImage(devSprite(), -17, -17);
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
  uiButton(menuHits, btnX(5, 0), BTN_Y, BTN_W, BTN_H, '? — HELP', '#7fe0ff', () => openHelp('menu'));
  uiButton(menuHits, btnX(5, 1), BTN_Y, BTN_W, BTN_H, fsOn() ? 'F — WINDOWED' : 'F — FULLSCREEN', '#8a63ff', toggleFullscreen);
  uiButton(menuHits, btnX(5, 2), BTN_Y, BTN_W, BTN_H, 'G — PIXELS: ' + (hiRes ? 'SMALL' : 'BIG'), '#2fe4c8', () => setHiRes(!hiRes));
  uiButton(menuHits, btnX(5, 3), BTN_Y, BTN_W, BTN_H, 'DEBUG — ' + (debugMode ? 'ON' : 'OFF'),
    debugMode ? '#3fe08a' : '#5a6a90', () => { debugMode = !debugMode; });
  uiButton(menuHits, btnX(5, 4), BTN_Y, BTN_W, BTN_H, 'CREATE DEV ›', '#3fe08a', () => openSetup('menu'));

  if (debugMode) {
    ctx.textAlign = 'center';
    ctx.font = '8px monospace';
    ctx.fillStyle = '#5a6a90';
    ctx.fillText('pause (P) in-game to jump to any sprint', cx, BTN_Y - 8);
  }
}

// A bordered button that registers its own click target. The caller sets the
// font first; `hits` is the list to push the target onto (menuHits, etc.).
// One button size for the whole UI, taken from the setup screen's FREEZE SPIN.
// Six screens had grown five different sizes between them; this is the only one
// now, so a row is laid out by index instead of by hand-counted pixels.
const BTN_W = 110, BTN_H = 16, BTN_Y = VH - 26, BTN_GAP = 8;
const btnX = (n, i) => Math.round((VW - (n * BTN_W + (n - 1) * BTN_GAP)) / 2 + i * (BTN_W + BTN_GAP));

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
      : n === HACK_SPRINT ? 'THE HACKATHON (FINAL)' : 'SPRINT ' + n;
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
  bullets = []; enemies = []; particles = []; floaters = []; pickups = []; hazards = [];
  bossParts = []; bossDef = null; bossMaxHp = 0; bossBanner = 0;
  bossClock = 0; bossEnraged = false;
  spawnQueue = []; spawnTimer = 0; meetingCd = 6;
  deadlineT = 0; backlog = [];
  combo = 1; comboT = 0; hitFreeze = 0; culprit = null;
  clearMsg = '';
  player.maxHp = curDiff().cups + Math.floor((n - 1) / 8); // one promotion per 2nd boss cleared before now
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

  // mid-run the screen is an edit, not a character creation — say so, or
  // "CREATE" reads like the run is about to be thrown away
  const editing = setupReturn === 'play';
  const heading = editing ? 'EDIT YOUR DEV' : 'CREATE YOUR DEV';
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#080c18'; ctx.fillText(heading, lx + 1, 19);
  ctx.fillStyle = '#ffd23f'; ctx.fillText(heading, lx, 18);

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
  ctx.drawImage(devSprite(), -17, -17);
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
  // left edge on the swatch column (chipX, not the labels), so it lines up with
  // the rectangles it randomizes
  btn(chipX, 208, BTN_W, BTN_H, 'TAB — RANDOMIZE', '#8a63ff', randomizeLook);

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
  btn(btnX(3, 0), BTN_Y, BTN_W, BTN_H, '‹ BACK', '#5a6a90', closeSetup);
  // no H key here — every printable key is name text on this screen — so the
  // button is the only way in, and help must be reachable from every page
  btn(btnX(3, 1), BTN_Y, BTN_W, BTN_H, '? HELP', '#7fe0ff', () => openHelp('setup'));
  btn(btnX(3, 2), BTN_Y, BTN_W, BTN_H, editing ? 'RESUME ›' : 'NEXT ›', '#3fe08a', confirmSetup);
}

// The stat sheet, in the order a player cares about. Everything is shown as
// "more of this thing" relative to NORMAL, so a bigger number always reads as
// worse for you — which is why SWARM and BOSS are inverted here: the stored
// values are intervals (smaller = more often), and nobody reads an interval.
const mulTag = (v) => '×' + (Math.round(v * 100) / 100);
const DIFF_COLS = [
  { label: 'CUPS',  val: (d) => String(d.cups) },
  { label: 'WRONG TECH', val: (d) => mulTag(d.off) }, // wrong-language letter damage
  { label: 'CLOCK', val: (d) => mulTag(d.dead) },
  { label: 'SWARM', val: (d) => mulTag(1 / d.dens) },
  { label: 'SPEED', val: (d) => mulTag(d.speed) },
  { label: 'BOSS',  val: (d) => mulTag(1 / d.cad) },
  { label: 'SCOPE', val: (d) => d.scope0 + ' glued' }, // what Scope Creep walks in carrying
  { label: 'SP',    val: (d) => mulTag(d.sp) },
];

function drawDiff() {
  ctx.fillStyle = 'rgba(8,12,24,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  diffHits.length = 0;
  const cx = VW / 2;

  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#080c18'; ctx.fillText('HOW BAD IS THIS SPRINT?', cx + 1, 19);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('HOW BAD IS THIS SPRINT?', cx, 18);
  ctx.font = '8px monospace';
  ctx.fillStyle = '#8f8fa8';
  ctx.fillText('↑↓ pick  ·  ENTER to clock in  ·  point at a level for its numbers', cx, 30);

  // half-width rows, centred; the stat sheet sits to their right
  const rw = Math.round((VW - 32) / 2), rx = Math.round((VW - rw) / 2);
  let hovIdx = -1;

  for (let i = 0; i < DIFFS.length; i++) {
    const d = DIFFS[i], y = 48 + i * 52, h = 46;
    const on = i === diffIdx, open = diffUnlocked(d);
    if (mouse.x >= rx && mouse.x < rx + rw && mouse.y >= y && mouse.y < y + h) hovIdx = i;

    ctx.globalAlpha = open ? 1 : 0.45;
    ctx.fillStyle = on ? 'rgba(58,47,87,0.55)' : 'rgba(8,12,24,0.85)';
    ctx.fillRect(rx, y, rw, h);
    ctx.strokeStyle = on ? '#ffd23f' : open ? d.color : '#3a2f57';
    ctx.strokeRect(rx + 0.5, y + 0.5, rw - 1, h - 1);

    ctx.textAlign = 'left';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = open ? d.color : '#5a6a90';
    ctx.fillText(d.name, rx + 22, y + 20);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#8f8fa8';
    ctx.fillText(open ? d.tag : 'LOCKED — see below', rx + 22, y + 34);
    if (on) { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 10px monospace'; ctx.fillText('>', rx + 8, y + 21); }
    if (!d.assists) {
      ctx.font = '7px monospace';
      ctx.fillStyle = '#8f8fa8';
      ctx.textAlign = 'right';
      ctx.fillText('NO AUTO-AIM / AUTO-SHOOT', rx + rw - 6, y + 41);
    }
    ctx.globalAlpha = 1;

    diffHits.push({ x: rx, y, w: rw, h, act: () => pickDiff(i) });
  }

  // the stat sheet: the hovered level's numbers, or the selected one's when
  // the pointer isn't on a row (keyboard and touch both land here). Fixed
  // beside the rows rather than following them, so it never jumps around.
  const sd = DIFFS[hovIdx >= 0 ? hovIdx : diffIdx];
  const sdOpen = diffUnlocked(sd);
  const colX = rx + rw + 62;
  let ly = 48 + 52 * 2 - 28 - Math.round((DIFF_COLS.length * 11) / 2); // centred on the rows block
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = sdOpen ? sd.color : '#5a6a90';
  ctx.fillText(sd.name, colX + 3, ly);
  ctx.font = '9px monospace';
  for (const col of DIFF_COLS) {
    const v = col.val(sd);
    ly += 11;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5a6a90';
    ctx.fillText(col.label.toLowerCase(), colX, ly);
    ctx.textAlign = 'left';
    // dim anything identical to NORMAL — what's left is what actually changed
    ctx.fillStyle = !sdOpen ? '#5a6a90' : v === col.val(DIFFS[1]) ? '#8f8fa8' : sd.color;
    ctx.fillText(': ' + v, colX + 3, ly);
  }

  // the unlock strip: what CLAUDELIKE costs, and how far along you are
  const done = BOSS_TYPES.filter((ty) => bossesDown.has(ty)).length;
  const unlocked = allBossesDown();
  const nagging = menuT - diffDenied < 1.2 && Math.floor(menuT * 6) % 2 === 0;
  ctx.textAlign = 'center';
  ctx.font = 'bold 8px monospace';
  const onLoan = !unlocked && debugMode; // open for testing, not earned
  ctx.fillStyle = unlocked ? '#8a63ff' : onLoan ? '#ff8a5c' : nagging ? '#ff5a6e' : '#8f8fa8';
  ctx.fillText(unlocked
    ? 'CLAUDELIKE UNLOCKED — you resolved all six on HARD'
    : onLoan
      ? 'CLAUDELIKE OPEN FOR TESTING (DEBUG) — not earned yet: ' + done + '/' + BOSS_TYPES.length
      : 'CLAUDELIKE unlocks when all six bosses are resolved on HARD — ' + done + '/' + BOSS_TYPES.length, cx, 268);

  // One chip per distinct boss, lit in its own colour once that one has gone
  // down. The roster's last two slots are second readings of a fight already
  // on this strip, so they share its chip rather than adding one — resolving
  // THE OCTOPUS MERGE is resolving a MERGE CONFLICT, and the unlock says six.
  ctx.font = '7px monospace';
  let tw = 0;
  const chips = BOSS_TYPES.map((ty) => BOSSES.find((b) => b.type === ty));
  const cw = chips.map((b) => Math.round(ctx.measureText(b.short).width) + 10);
  for (const w of cw) tw += w + 3;
  let bxp = Math.round(cx - (tw - 3) / 2);
  for (let i = 0; i < chips.length; i++) {
    const b = chips[i], got = bossesDown.has(b.type);
    ctx.fillStyle = got ? 'rgba(58,47,87,0.55)' : 'rgba(8,12,24,0.85)';
    ctx.fillRect(bxp, 276, cw[i], 14);
    ctx.strokeStyle = got ? b.color : '#2a3048';
    ctx.strokeRect(bxp + 0.5, 276.5, cw[i] - 1, 13);
    ctx.fillStyle = got ? b.color : '#3a2f57';
    ctx.fillText(b.short, bxp + cw[i] / 2, 286);
    bxp += cw[i] + 3;
  }
  // The two ways a boss kill silently fails to count, said before you go and
  // spend a run finding out. The debug line only appears when it applies.
  if (!unlocked) {
    ctx.textAlign = 'center';
    ctx.font = '7px monospace';
    ctx.fillStyle = debugMode ? '#ff8a5c' : '#5a6a90';
    ctx.fillText(debugMode
      ? 'a debug run never logs a boss — switch DEBUG off on the title screen to earn it'
      : 'kills on EASY or NORMAL don\'t count, and neither do debug runs', cx, 300);
  }

  ctx.font = 'bold 10px monospace';
  uiButton(diffHits, btnX(3, 0), BTN_Y, BTN_W, BTN_H, '‹ BACK', '#5a6a90', () => openSetup('menu'));
  uiButton(diffHits, btnX(3, 1), BTN_Y, BTN_W, BTN_H, '? HELP', '#7fe0ff', () => openHelp('diff'));
  uiButton(diffHits, btnX(3, 2), BTN_Y, BTN_W, BTN_H, 'PLAY ›', '#3fe08a', startGame);
}

// ---------------------------------------------------------------- help
// Everything the game teaches through play, written down — reachable from the
// title, the difficulty screen and the pause overlay, so you can look something
// up mid-run without dying for it. Paged rather than scrolled: a 640×360 canvas
// has no scrollbar affordance, and pages give phones something to tap.
// Bosses are deliberately absent; they are the part you're meant to meet cold.
const helpHits = [];
let helpPage = 0, helpReturn = 'menu', helpShownAt = 0;

// ---------------------------------------------------------------- leaving a run
// Abandoning drops you on the difficulty screen rather than the title: changing
// difficulty is the whole reason to quit mid-run, and BACK from there still
// walks out to the customizer and the title, so nothing is cut off.
// The run is discarded — no score is submitted, the same as any unfinished
// sprint — so it asks twice. On a phone this button sits a thumb-width from
// RESUME, and one stray tap must not be able to bin a good run.
const overHits = [];
let quitArm = -9;
const quitArmed = () => menuT - quitArm < 2.5;

function quitRun() {
  if (!quitArmed()) { quitArm = menuT; sfx.block(); return; }
  quitArm = -9;
  paused = false;
  mouse.down = false;
  openDiff();
}

function openHelp(from) {
  helpReturn = from || 'menu';
  helpShownAt = menuT;
  state = 'help';
}
function closeHelp() { state = helpReturn; helpReturn = 'menu'; }

function helpKey(e) {
  const k = e.key;
  if (k === 'Escape' || k === 'Enter' || k === ' ' || k.toLowerCase() === 'h') { closeHelp(); return; }
  if (k === 'ArrowLeft' || k === 'ArrowUp') helpPage = (helpPage + HELP_PAGES.length - 1) % HELP_PAGES.length;
  if (k === 'ArrowRight' || k === 'ArrowDown') helpPage = (helpPage + 1) % HELP_PAGES.length;
}

// One text row. Returns the next baseline, so a page reads as a straight list
// instead of a pile of hand-counted y values.
function hRow(txt, x, y, color, font) {
  ctx.textAlign = 'left';
  ctx.font = font || '8px monospace';
  ctx.fillStyle = color || '#b9c4dd';
  ctx.fillText(txt, x, y);
  return y + 11;
}
// A key/action pair, the key right-aligned into its own column.
function hKey(key, what, y) {
  ctx.textAlign = 'right';
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(key, 250, y);
  return hRow(what, 262, y, '#b9c4dd');
}
// An icon in a fixed gutter with a heading and a line of description beside it,
// so every bestiary row lines up whatever the sprite's natural size is.
function hEntry(img, name, nameColor, lines, y, scale) {
  const s = scale || 1;
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, 0, 0, img.width, img.height, Math.round(60 - w / 2), Math.round(y - h / 2), w, h);
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = nameColor;
  ctx.fillText(name, 84, y - 3);
  ctx.font = '7px monospace';
  ctx.fillStyle = '#8f8fa8';
  let ly = y + 7;
  for (const l of lines) { ctx.fillText(l, 84, ly); ly += 8; }
}

function helpControls() {
  let y = 62;
  y = hKey('ARROWS', 'scoot the chair — it drifts, office-chair physics', y);
  y = hKey('A / D', 'spin the chair; hold both at once to lock your facing', y);
  y = hKey('SPACE', 'ship code — hold for the full letter stream', y);
  y = hKey('CLICK / TAP', 'also fires, along your current facing', y);
  y = hKey('1 / 2 / 3', 'switch language — see LANGUAGES & STRIPES', y);
  y = hKey('I / O', 'auto-aim / auto-shoot. Score earned with either is ×0.6', y);
  y = hKey('P / ESC', 'pause, and read the standup board', y);
  y = hKey('C', 'while paused: edit your dev, then straight back in', y);
  y = hKey('H', 'this page — from the title, difficulty or pause screen', y);
  y = hKey('F', 'fullscreen', y);
  y = hKey('G', 'pixel size — BIG is chunky, SMALL is easier to read', y);
  y = hKey('M', 'mute', y);
  y = hKey('R', 'restart after burnout', y);
  y += 6;
  hRow('Everything here is also a button. The whole game is playable by tap.', 60, y, '#5a6a90', '7px monospace');
}

function helpSprint() {
  let y = 60;
  y = hRow('Every regular sprint runs on a standup deadline. Clear the board', 24, y);
  y = hRow('before it hits and you bank the full clear bonus. Let it run out and', 24, y);
  y = hRow('the sprint ends anyway — but nothing is cleared for free.', 24, y);
  y += 6;
  y = hRow('OVERFLOW — WHAT DIDN\'T GET DONE', 24, y, '#ff8a5c', 'bold 8px monospace');
  y = hRow('Whatever is still alive when the clock runs out — plus anything that', 24, y);
  y = hRow('never got to spawn — is swept into three holding pens, one per area,', 24, y);
  y = hRow('on the edge that area\'s language fires from:', 24, y);
  y += 2;

  // the three pens, drawn where they actually sit — faster to read than a list
  const bx = 250, by = y, bw = 140, bh = 64;
  ctx.strokeStyle = '#2a3048';
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  ctx.fillStyle = AREAS.fe.color;    ctx.fillRect(bx + 3, by + 14, 5, bh - 28);
  ctx.fillStyle = AREAS.be.color;    ctx.fillRect(bx + 34, by + 3, bw - 68, 5);
  ctx.fillStyle = AREAS.infra.color; ctx.fillRect(bx + bw - 8, by + 14, 5, bh - 28);
  ctx.textAlign = 'center';
  ctx.font = '7px monospace';
  ctx.fillStyle = AREAS.be.color; ctx.fillText('BACKEND', bx + bw / 2, by + 17);
  ctx.fillStyle = AREAS.fe.color; ctx.fillText('FE', bx + 16, by + bh / 2);
  ctx.fillStyle = AREAS.infra.color; ctx.fillText('INFRA', bx + bw - 22, by + bh / 2);
  y += bh + 10;

  y = hRow('They rattle there through the countdown, then all three pens open at', 24, y);
  y = hRow('once as the next sprint starts — on top of that sprint\'s own tickets.', 24, y);
  y = hRow('Carried-over work comes back ENRAGED: 50% faster, red, worth ×1.5 SP.', 24, y, '#ff5a6e');
  y = hRow('Timing out pays only a third of the clear bonus.', 24, y);
  y += 4;
  y = hRow('Before a boss the pens stay shut and wait one more sprint — a boss', 24, y, '#8f8fa8', '7px monospace');
  y = hRow('sprint has no clock. The backlog caps at 24; past that the oldest rot', 24, y, '#8f8fa8', '7px monospace');
  y = hRow('out as won\'t-fix, so one bad sprint can\'t snowball into a wall.', 24, y, '#8f8fa8', '7px monospace');
}

function helpPickups() {
  let y = 58;
  y = hRow('Coffee cups are your health — top left of the screen. There is no', 24, y);
  y = hRow('passive regen, so a cup you lose is gone until something refills it.', 24, y);
  y = hRow('Every 2nd boss cleared is a PROMOTION: +1 maximum cup, poured full.', 24, y, '#ffd23f');
  y += 10;
  hEntry(coffeeImg, 'COFFEE — REFILL', '#dfe6ff', ['Pours one cup back. The only healing in the game.'], y + 8, 2);
  hEntry(canImg, 'ENERGY DRINK — CRUNCH MODE', '#2fe4c8', ['Double fire rate for 8 seconds.'], y + 44, 2);
  hEntry(duckImg, 'RUBBER DUCK — SHIELD', '#ffd23f', ['3 seconds where nothing can touch you.'], y + 80, 2);
  y += 112;
  y = hRow('Tickets drop these rarely — roughly one in twenty kills. A boss always', 24, y, '#8f8fa8', '7px monospace');
  hRow('drops all three, and a later lap of the same boss pours a second cup.', 24, y, '#8f8fa8', '7px monospace');
}

function helpLangs() {
  let y = 56;
  y = hRow('Every ticket belongs to an area, shown as the coloured header across', 24, y);
  y = hRow('its top edge. Your letters have a language, and it has to match.', 24, y);
  y += 8;

  for (let i = 0; i < LANGS.length; i++) {
    const L = LANGS[i], ry = y + i * 22;
    ctx.fillStyle = L.color;
    ctx.fillRect(30, ry - 8, 10, 12);
    ctx.textAlign = 'left';
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(String(i + 1), 48, ry + 1);
    ctx.fillStyle = L.color;
    ctx.fillText(L.name, 62, ry + 1);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#b9c4dd';
    ctx.fillText({ fe: 'Frontend tickets', be: 'Backend tickets', infra: 'Infrastructure tickets' }[L.area], 124, ry + 1);
  }
  y += LANGS.length * 22 + 6;

  y = hRow('MATCHING THE STRIPE = ×2 DAMAGE', 24, y, '#3fe08a', 'bold 9px monospace');
  y = hRow('The wrong tech still does something, but how much is set by the', 24, y);
  y = hRow('difficulty you picked: ×1 on NORMAL, down to ×0.5 on CLAUDELIKE.', 24, y);
  y = hRow('Epics and bosses take half of that again — against those, switching', 24, y);
  y = hRow('language is the only real answer.', 24, y);
  y += 4;
  hRow('An Epic passes its colour to the Stories it splits into.', 24, y, '#8f8fa8', '7px monospace');

  // A ticket with its stripe called out — blown up ×4, because at the size it
  // actually appears in-game the stripe is the very thing you can't see yet.
  const img = ENEMY_TYPES.story.img, S = 4;
  const sw = img.width * S, sh = img.height * S;
  const tx = 500 - sw / 2, ty = 150;
  ctx.drawImage(img, 0, 0, img.width, img.height, tx, ty, sw, sh);
  // deliberately INFRA blue: the Story card's own art is green, so a green
  // stripe here would blend into it and demonstrate nothing
  ctx.fillStyle = AREAS.infra.color;
  ctx.fillRect(tx + S, ty + S, sw - 2 * S, STRIPE_W * S);
  // leader drops straight down into the header band it names
  ctx.strokeStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(tx + sw / 2, ty - 8); ctx.lineTo(tx + sw / 2, ty + STRIPE_W * S);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = 'bold 7px monospace';
  ctx.fillStyle = '#ffd23f';
  // named from the table, never typed here — renaming a language must not be
  // able to leave a stale name sitting in the help page
  ctx.fillText('blue header —', tx + sw / 2, ty - 26);
  ctx.fillText('hit it with ' + LANGS.find((l) => l.area === 'infra').name, tx + sw / 2, ty - 18);
}

function helpTickets() {
  const T = ENEMY_TYPES;
  hEntry(T.bug.img, 'BUG', AREAS.fe.color,
    ['Small, fast, erratic. 2 HP. Comes in all three colours.'], 60, 2);
  hEntry(T.story.img, 'STORY', AREAS.be.color,
    ['Bigger, walks a straight line at you. 5 HP.'], 96, 1.6);
  hEntry(T.epic.img, 'EPIC', '#c9a8ff',
    ['Big and slow, 15 HP. Splits into Stories when it dies,',
     'and they inherit its colour. Resists off-language letters.'], 136, 1);
  hEntry(T.hotfix.img, 'HOTFIX', '#ff8a5c',
    ['Screams in at nearly four times a Story\'s speed. Only 3 HP,',
     'but no wind-up — the siren IS the telegraph. Burns out on impact.'], 180, 2);
  // the invite is drawn at ×2 in the game, so ×1 here would undersell it
  hEntry(T.meeting.img, 'MEETING INVITE', '#b9c4dd',
    ['Infinite HP — your letters bounce off it. It doesn\'t hunt you,',
     'it drifts across the room. Not a target. Get out of its way.'], 224, 2.5);
  hEntry(T.story.img, 'BLOCKED STORY', '#7fe0ff',
    ['Shielded, and linked by a line to a blocker Bug escorting it.',
     'It takes NOTHING until you resolve the blocker — kill that first.',
     'Cut back the other way and the escort has to swing the long way round.'], 274, 1.6);

  // the pair, drawn as it actually arrives
  const px = 470, py = 262;
  ctx.strokeStyle = 'rgba(127,224,255,0.5)';
  ctx.beginPath(); ctx.moveTo(px + 6, py + 8); ctx.lineTo(px + 44, py + 8); ctx.stroke();
  ctx.drawImage(ENEMY_TYPES.story.img, px, py);
  ctx.strokeStyle = '#7fe0ff';
  ctx.strokeRect(px - 1.5, py - 1.5, ENEMY_TYPES.story.img.width + 3, ENEMY_TYPES.story.img.height + 3);
  ctx.drawImage(ENEMY_TYPES.bug.img, px + 40, py + 3);

  // "kill this one" is wider than the gap between the two cards, so on its own
  // it sits under BOTH of them and names neither — which is exactly the
  // confusion this whole entry exists to clear up. The arrow does the naming.
  const bugCx = px + 44, tip = py + 15;   // bug is 8 wide at px+40, 10 tall from py+3
  ctx.strokeStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(bugCx, py + 30);
  ctx.lineTo(bugCx, tip);
  ctx.moveTo(bugCx - 3, tip + 4); ctx.lineTo(bugCx, tip); ctx.lineTo(bugCx + 3, tip + 4);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = 'bold 7px monospace';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('kill this one', bugCx, py + 39);
}

const HELP_PAGES = [
  { title: 'CONTROLS', draw: helpControls },
  { title: 'THE SPRINT', draw: helpSprint },
  { title: 'CUPS & PICKUPS', draw: helpPickups },
  { title: 'LANGUAGES & STRIPES', draw: helpLangs },
  { title: 'THE TICKETS', draw: helpTickets },
];

function drawHelp() {
  ctx.fillStyle = 'rgba(8,12,24,0.92)';
  ctx.fillRect(0, 0, VW, VH);
  helpHits.length = 0;
  const page = HELP_PAGES[helpPage];

  ctx.textAlign = 'center';
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#080c18'; ctx.fillText(page.title, VW / 2 + 1, 21);
  ctx.fillStyle = '#ffd23f'; ctx.fillText(page.title, VW / 2, 20);
  ctx.fillStyle = '#2a3048';
  ctx.fillRect(24, 27, VW - 48, 1);

  page.draw();

  // one pip per page, above the pager row
  for (let i = 0; i < HELP_PAGES.length; i++) {
    const px = Math.round(VW / 2 - (HELP_PAGES.length * 14) / 2 + i * 14);
    ctx.fillStyle = i === helpPage ? '#ffd23f' : '#3a2f57';
    ctx.fillRect(px, BTN_Y - 12, 8, 6);
    helpHits.push({ x: px - 3, y: BTN_Y - 16, w: 14, h: 14, act: () => { helpPage = i; } });
  }
  ctx.font = 'bold 10px monospace';
  uiButton(helpHits, btnX(3, 0), BTN_Y, BTN_W, BTN_H, '‹ PREV', '#7fe0ff', () => { helpPage = (helpPage + HELP_PAGES.length - 1) % HELP_PAGES.length; });
  uiButton(helpHits, btnX(3, 1), BTN_Y, BTN_W, BTN_H, 'ESC — CLOSE', '#3fe08a', closeHelp);
  uiButton(helpHits, btnX(3, 2), BTN_Y, BTN_W, BTN_H, 'NEXT ›', '#7fe0ff', () => { helpPage = (helpPage + 1) % HELP_PAGES.length; });
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

  overHits.length = 0; // cleared before drawBoard so its pager can register
  y = drawBoard(y + 24, true, overHits);

  if (overTimer > 0.8 && Math.floor(overTimer * 2) % 2 === 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#3fe08a';
    // the board can be up to 12 rows tall, so this yields to the button row
    ctx.fillText('PRESS R TO GRAB ANOTHER COFFEE', cx, Math.min(y + 26, VH - 40));
  }

  // Dying used to be the only way out of a run, and it still only offered the
  // same run again — no way back to the difficulty screen or the title without
  // reloading the page. All three ways on are here now.
  if (overTimer > 0.8) {
    ctx.font = 'bold 10px monospace';
    uiButton(overHits, btnX(3, 0), BTN_Y, BTN_W, BTN_H, '‹ TITLE', '#5a6a90', () => { state = 'menu'; });
    uiButton(overHits, btnX(3, 1), BTN_Y, BTN_W, BTN_H, 'R — AGAIN', '#3fe08a', startGame);
    uiButton(overHits, btnX(3, 2), BTN_Y, BTN_W, BTN_H, 'DIFFICULTY ›', '#7fe0ff', () => openDiff());
  }
}

// The standup board, drawn from `board` — never blocks, never throws: an
// unsent, pending or failed board is one line of text and the screen goes on.
// `withRank` is for the death screen: only a finished run has a rank.
// The API returns up to 200 runs; they're paged BOARD_PAGE at a time, with
// the pager buttons registered into `hits` (the calling screen's hit list).
function drawBoard(y, withRank, hits) {
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

  // columns: rank | dev icon | name | score | when
  const R = 204, I = 207, N = 222, S = 344, W = 452;
  const me = playerName.toLowerCase();
  const pages = Math.ceil(board.rows.length / BOARD_PAGE);
  if (boardPage >= pages) boardPage = pages - 1; // rows shrank under the pager
  const start = boardPage * BOARD_PAGE;
  for (let i = start; i < Math.min(start + BOARD_PAGE, board.rows.length); i++) {
    const row = board.rows[i];
    const mine = String(row.name).toLowerCase() === me;
    y += 11;
    ctx.textAlign = 'right';
    ctx.fillStyle = mine ? '#ffd23f' : '#5a6a90';
    ctx.fillText((i + 1) + '.', R, y);
    const ic = boardIcon(row.look);   // rows from before looks existed have none
    if (ic) ctx.drawImage(ic, I, y - 8, 10, 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = mine ? '#ffd23f' : '#dfe6ff';
    ctx.fillText(String(row.name), N, y);
    ctx.textAlign = 'right';
    ctx.fillText(row.score + ' SP', S, y);
    ctx.fillStyle = mine ? '#c9a86a' : '#5a6a90';
    ctx.fillText(fmtWhen(row.at), W, y);
  }

  // pager — only once the board outgrows one page
  if (pages > 1 && hits) {
    y += 8;
    ctx.font = 'bold 9px monospace';
    uiButton(hits, cx - 62, y, 24, 13, '‹', boardPage > 0 ? '#7fe0ff' : '#5a6a90',
      () => { if (boardPage > 0) boardPage--; });
    uiButton(hits, cx + 38, y, 24, 13, '›', boardPage < pages - 1 ? '#7fe0ff' : '#5a6a90',
      () => { if (boardPage < pages - 1) boardPage++; });
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8f8fa8';
    ctx.fillText((boardPage + 1) + ' / ' + pages, cx, y + 9);
    y += 13;
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
