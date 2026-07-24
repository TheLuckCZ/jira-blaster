# Jira Blaster

A top-down 2D pixel-art arcade shooter set in an open-plan office. You are a
developer in a rolling office chair, laptop on your legs, blasting incoming
Jira tickets before they land in your backlog and burn you out.

Pure static HTML5 canvas — no dependencies, no build step.

## Run

Open `index.html` in a browser, or serve the folder:

```bash
open index.html
# or
python3 -m http.server 8000   # → http://localhost:8000
```

## Controls

Keyboard-first; the customizer and the title/burnout screens also take a click
or a tap. The title screen leads to **CREATE YOUR DEV**: name at the top, the
dev below it, the eight appearance rows beside them.

| Input | Action on the customizer |
| --- | --- |
| Type / BACKSPACE | The name — it goes on the standup board and above your chair |
| ↑ / ↓ | Move between appearance rows |
| ← / → | Change the selected option (wraps) |
| TAB | Randomize the whole look |
| ENTER | Start sprint 1 |
| ESC | Back to the title |
| Click / tap | Every swatch and button is also a click target |

Both the name and the look are remembered in `localStorage`, so a returning dev
just presses ENTER.

| Input | Action in a run |
| --- | --- |
| Arrow keys | Scoot the chair (it drifts — office-chair physics) |
| D / A | Spin the chair clockwise / counter-clockwise at 180°/s (hold; both at once = facing locked) |
| 1 / 2 / 3 | Switch language: **HTML** (red) / **NODE** (green) / **GO** (blue) — recolors your letters |
| I | Toggle **auto-aim** — the chair tracks the nearest ticket by itself; A/D override it |
| O | Toggle **auto-shoot** — fire continuously by itself |
| Space | Fire along the current facing (hold for the full letter-stream) |
| Click / tap | Also fires |
| P / Esc | Pause ("in a meeting") |
| M | Mute |
| R | Restart after burnout |

## Your dev

Eight choices on the start screen — skin, hair style, hair color, glasses,
shirt, pants, chair and laptop — drawn live as the customizer's 16-frame
turnaround portrait, spinning on its own.

The 34×34 top-down sprite you actually play as is rebuilt from the same eight
choices, so the chair, shirt, skin, hair and laptop you picked are the ones on
screen for the whole run — and on the title screen's spinning chair. The
customizer draws that sprite beside the portrait, labelled **IN GAME**, so the
match is visible while you pick.

Pants are the one thing a top-down camera cannot see, so they live only in
the portrait. Hair style still reads from above as a silhouette (bald, long,
bun, mohawk) and glasses as a dark bar across the face.

## Gameplay

Every threat telegraphs; every death is avoidable. Size = threat tier, color =
type — one glance is full information:

| Ticket | Look | HP | Speed | Tell |
| --- | --- | --- | --- | --- |
| **Bug** (S) | small red card | 2 | fast | erratic wobble |
| **Story** (M) | green card | 5 | medium | straight line |
| **Epic** (L) | large purple card | 15 | slow | splits into 3 Stories on death |
| **Hotfix** | small flashing orange card | 3 | very fast | no wind-up — it screams in (siren) |
| **Meeting invite** | large grey card | ∞ | drifts | non-lethal, but it blocks your letters (cover) |
| **Bosses** | oversized named cards | huge | varies | every 5th sprint — see [Bosses](#bosses) |

- **Telegraphs:** tickets materialize with a 0.4s pulsing flash + ding (inert
  until real), draw a dotted approach trail toward your chair, and flash a red
  thickened border ~1.5s before impact — always enough time to turn and shoot.
- **HP is 3 coffee cups**, no regen (coffee drops refill one). On a hit the
  game freeze-frames for 0.5s and highlights the ticket that got you. Every
  5 sprints cleared (reaching sprint 6, 11, 16 …) is a **promotion**: your
  cup maximum grows by one, poured full.
- **Areas & languages:** every ticket belongs to an area, shown as the colored
  stripe on its left edge — **Frontend** (red), **Backend** (green),
  **Infrastructure** (blue). Shooting it with the matching language (letters
  the same color as the stripe) does **×2 damage**. Epics pass their area to
  the Stories they split into.
- **Chain:** kills within 1.2s of each other build a ×1→×8 multiplier.
  **Graze:** dodging a ticket by ~8px pays +50 and ticks the chain. Turtling
  scores worse than committing — aggression is the whole meta.
- Waves are **sprints** and scale density only (spawn interval decays 8% per
  sprint, floor 0.3s) — nothing new after sprint 3: 1 = Bugs, 2 = +Stories,
  3 = +Epics & Hotfixes. Every 5th sprint is a **boss** (see below).
- Drops: **coffee** (+1 cup), **energy drink** (crunch mode — double fire
  rate), **rubber duck** (shield that deflects tickets).

## Bosses

Every 5th sprint escalates to a named nightmare from the dev world — **alone on
screen**: no edge burst, no drifting meetings, no backlog. It gets a title card,
a name and HP bar in the HUD, and pays triple the sprint bonus plus a guaranteed
coffee + duck + energy drink on death.

Each is built around a mechanic the game already teaches, and every immune or
vulnerable window is telegraphed on the card before it matters:

| # | Boss | The fight |
| --- | --- | --- |
| 5 | **THE LEGACY MONOLITH** | Huge, slow, enormous HP. Its area stripe **rotates FE→BE→INFRA every 3.2s**, so the ×2 matchup keeps moving and you must keep switching 1/2/3. **Sheds tech debt** — spawns Bugs on a timer *and* every time it loses a seventh of its HP. |
| 10 | **SCOPE CREEP** | Starts small and **grows every 3s** — bigger, faster, +10 max HP, and buds off a Story each time ("…and a dark mode"). Caps after 6 growths at ~2.3× size. On death it splits into everything it accreted (up to 7 Stories). Kill it early or drown. |
| 15 | **MERGE CONFLICT** | **Twins**, `<<<` and `>>>`, linked by a visible line. Kill one alone and it **reopens at half HP** after 3.2s — so both must die inside that window. While the window is open the survivor takes **×2 damage**, and each reopen returns weaker, so the fight always converges. |
| 20 | **THE ENDLESS MEETING** | A wall-sized invite that **blocks your letters** like a meeting invite does. Its organizer pip goes **green for 2.6s** when someone derails the agenda — that is the only window damage lands. Calls in attendees while it talks. |
| 25 | **P0 MEGAOUTAGE** | Charge-dashes across the arena: **aim** (telegraphed with a red line straight through you) → **dash** → **down**. While it is down the incident is being handled and it takes **×2 damage** — that is your whole DPS window. |
| 30 | **THE FLAKY TEST** | Blinks **PASS** (green, hittable) / **FAIL** (red, immune) on a rhythm. Passes locally. Sometimes. Pure shot-timing. |

The roster then cycles — sprint 35 is the Monolith again — and every full lap
scales HP and payout by **+55%**.

## The standup board (leaderboard)

On death the run is POSTed to `/api/jira-blaster/scores` and the top 10 is drawn
on the BURNOUT screen, your own row lit up, with the date and time each score
was set (in the viewer's timezone). Then `R` starts the next run.

The board is also drawn on the **pause** screen, from a read-only `GET` fired
when you pause (including the auto-pause on tab-hide) and reused for 20s. No
rank line there: a run still in progress hasn't got one. And a run that could
*not* be posted — offline, opened from `file://`, or 0 SP — still gets the board
section on the burnout screen rather than silence, saying why.

- **Storage:** Cloudflare D1 (SQLite), database `stesti-pro-web-games`, table
  `jira_blaster_scores` — `name` (primary key, `COLLATE NOCASE`), `score`,
  `created_at`. One row per name: a better run overwrites it, a worse one is
  ignored, so the timestamp is always the time of the run being shown.
- **API:** a Pages Function in `stesti-pro-web/functions/api/jira-blaster/`.
  `GET` returns the top 10, `POST {name, score}` records a run and returns the
  board plus the run's rank. The browser never talks to D1 directly.
- **Trust:** the game has no accounts, so the write is unauthenticated — anyone
  with `curl` can post any score. What the endpoint accepts is bounded instead:
  a name of ≤ 12 printable characters, an integer score, one row per name, and
  the table pruned to the top 200 after every write.
- **Failure is silent and safe:** the game never waits on the network. Offline,
  from `file://`, or with D1 down it draws "board unreachable — this run was not
  saved" and plays exactly the same. `?autotest=1` never posts.
- **Reading it by hand:**
  ```bash
  source stesti-pro-web/terraform/.env
  npx wrangler d1 execute stesti-pro-web-games --remote -y \
    --command "SELECT * FROM jira_blaster_scores ORDER BY score DESC LIMIT 20;"
  ```

## Dev notes

- `index.html?autotest=1` runs a 25-second self-playing smoke test and reports
  a summary via `console.log` and `document.title` (see the autotest block at
  the bottom of `game.js`). Headless Chrome's `--virtual-time-budget` does
  **not** advance `requestAnimationFrame`, so run it in real time, e.g.:
  ```bash
  chrome --headless=new --enable-logging=stderr --v=1 'file://…/index.html?autotest=1' \
    2>&1 | grep -o 'AUTOTEST[^"]*'   # kill after ~40s
  ```
- Internal resolution is **640×360**, integer-upscaled with
  `image-rendering: pixelated` — it lands on an exact whole-number scale at
  every common display (2× at 720p, 3× at 1080p, 4× at 1440p, 6× at 4K), so
  pixels stay square. `VW`/`VH` at the top of `game.js` is the size dial:
  raising it shrinks every element on screen and widens the arena. World
  speeds (px/s) are sized to it — scale them together and the feel, including
  the 1.5s telegraph budget, is preserved. All sprites are generated in code —
  no image assets. The art implements the **"1a NEON DEADLINE"** direction from the
  Pixel Art Lab design (claude.ai/design project "Developer Defense Game
  Concept"); `PAL` in `game.js` is that palette verbatim and the single source
  of truth for every color in the *world*. The dev in the chair is the
  exception: their colors come from `look`, picked on the start screen.
- The customizer's front-view character generator is ported into `game.js` as
  `drawAvatar()` / `hairShape()` from `Player Customizer.html` (a bundled
  artifact kept in the repo for reference — the game does not load it), with
  deliberate deviations from the source:
  - the source passed a hair-style *index* into name comparisons, so every
    style rendered as `short`; `hairShape()` resolves the index through
    `HAIRS` first;
  - the star base spun against the body (screen-y points down, so `+a` walks
    the wheels clockwise from above while the body's `fwdX = sin(a)` turn is
    counter-clockwise) — the star takes `-a` so both rotate together;
  - the legs are drawn in screen space with a level thigh and a vertical
    shin — a true seated 90° — instead of the source's sagittal projection,
    whose `fSY = 0.6` sloped the thigh ~35° toward the floor;
  - the chair is scaled up (seat, backrest, gas cylinder, star base) so it
    reads as an office chair under an adult rather than a stool;
  - the arms are two segments with a real elbow at 90° (upper arm hanging
    from the shoulder, forearm level to the laptop) instead of the source's
    single shoulder-to-hand stick;
  - the dev reclines slightly: hips stay put, shoulders and head sit back
    against a backrest that tilts with them;
  - in the back view the legs are drawn under the seat, so the thighs
    disappear behind the chair and only the shins hang into view below it
    (the source let the whole legs show in front of the chair);
  - the head sits 6px lower, so the neck meets the torso top instead of
    floating above the collar;
  - the source's beard option was dropped.

## Deploy (stesti.pro)

Static content — per the STESTI.PRO conventions, copy `index.html` and `game.js`
into `stesti-pro-web/public/game/jira-blaster/` and run `./deploy.sh` there:

```bash
cp index.html game.js ../stesti-pro-web/public/game/jira-blaster/
cd ../stesti-pro-web && ./deploy.sh
```

Live at `https://stesti.pro/game/jira-blaster/`. `/game/*` is `noindex` in
`public/_headers`, alongside the site's other non-CV pages.

**Bump `?v=` on the `<script>` tag in `index.html` whenever `game.js` changes.**
Cloudflare Pages pins non-HTML assets to `max-age=14400` and ignores a
`Cache-Control` set in `_headers` (tested), so returning players would otherwise
run the previous build for up to 4 hours. The HTML is always revalidated, so a
new query string takes effect immediately.
