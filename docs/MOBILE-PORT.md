# Mobile Port Plan (iPhone / web, no app)

Status: **not started** — parked plan, written 2026-07-24.
Goal: playable from the existing URL in mobile Safari; no app store.

## Already in place

- 640×360 canvas 2D — any iPhone renders it at 60fps (dt clamp already handles 120Hz rAF).
- Audio unlock on first touch (`initAudio` on pointerdown).
- Menu / setup / pause / debug screens are fully tappable (hit-target work done July 2026).

## Work items

### 1. Touch controls for gameplay (1–2 days — the core)

- Left-thumb **virtual joystick** → chair movement (replaces arrows).
- Mobile defaults **auto-aim ON**; right-thumb **FIRE button** (hold = shoot).
  Twin-stick aiming can come later — auto-aim + one thumb is what feels good.
- 3 tap chips for language (HTML/NODE/GO) + a pause button.
- Detect touch device (`pointer: coarse`) → show overlay controls, hide keyboard hints.

### 2. Scaling (~half day)

- `resize()` floors to integer scale with minimum 1× — a phone gets a 640×360 box
  that overflows portrait. Allow **fractional scaling** on small screens.
- Landscape-first: show a "rotate your phone" card in portrait.

### 3. Safari gesture hardening (~half day)

- `touch-action: none` on the canvas; block double-tap zoom and rubber-band scroll.
- `viewport-fit=cover` + safe-area insets (notch).
- Re-check auto-pause-on-hidden for app switching / control centre pulls.

### 4. Icing (~half day)

- PWA manifest + apple-touch-icon → installs to home screen, runs full-screen.
- Screen Wake Lock (iOS 16.4+) so the phone doesn't dim mid-boss.

## Notes

- Composes with `MULTIPLAYER-PLAN.md`: a phone player can join a desktop host's
  boss fight via the room link.
- Total: **2–4 focused days**; joystick/fire feel is the part worth iterating.
