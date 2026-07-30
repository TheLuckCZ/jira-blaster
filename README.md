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

Keyboard-first; every screen also takes a click or a tap. Buttons are one
standard size everywhere (`BTN_W`/`BTN_H`, taken from the setup screen's
FREEZE SPIN) and rows are laid out by index with `btnX(n, i)` rather than
hand-counted pixels, so adding a button re-centres the row instead of shifting
its neighbours into each other. The run is three
pages: title → **CREATE YOUR DEV** (name at the top, the dev below it, the eight
appearance rows beside them) → **HOW BAD IS THIS SPRINT?** (the difficulty) →
sprint 1.

Every screen goes both ways, and none is a dead end:

```
title ──► create your dev ──► difficulty ──► RUN ──► burnout
  ◄────────────┘      ◄────────────┘         │        │
                                             │        ├──► R: same again
  help ◄── ? on every screen (H where        │        ├──► D: difficulty
           typing can't swallow the key)     │        └──► ESC: title
                                             └──► pause: resume · edit dev · Q quit ─► difficulty
```

Quitting mid-run lands on the **difficulty** screen rather than the title,
because changing difficulty is the reason to quit — and BACK from there still
walks out through the customizer to the title, so nothing is cut off.

| Input | Action on the customizer |
| --- | --- |
| Type / BACKSPACE | The name — it goes on the standup board and above your chair |
| ↑ / ↓ | Move between appearance rows |
| ← / → | Change the selected option (wraps) |
| TAB | Randomize the whole look |
| ENTER | On to the difficulty screen — or, mid-run, back into the fight wearing the changes |
| ESC | Back to the title — or, mid-run, back to the pause screen |
| Click / tap | Every swatch and button is also a click target |

| Input | Action on the difficulty screen |
| --- | --- |
| ↑ / ↓ (or ← / →) | Pick a level — locked ones are skipped, never landed on |
| 1 – 4 | Jump straight to a level |
| ENTER / Space | Clock in and start sprint 1 |
| ESC | Back to the customizer |
| Click / tap | A row selects it; **PLAY ›** starts. Tapping a locked row says why |

Both the name and the look are remembered in `localStorage`, so a returning dev
just presses ENTER. The same screen is reachable **mid-run** from the pause
overlay (`C`, or the button on it), where it reads EDIT YOUR DEV and returns you
to the run you were in rather than starting a new one — changes apply on the
spot, so you never have to die to restyle.

| Input | Action in a run |
| --- | --- |
| Arrow keys | Scoot the chair (it drifts — office-chair physics) |
| D / A | Spin the chair clockwise / counter-clockwise at 180°/s (hold; both at once = facing locked) |
| 1 / 2 / 3 | Switch language: **HTML** (red) / **JAVA** (green) / **BASH** (blue) — recolors your letters, and the laptop screen on your chair, so what you're firing is readable without looking at the HUD |
| I | Toggle **auto-aim** — the chair tracks the nearest ticket by itself; A/D override it |
| O | Toggle **auto-shoot** — fire continuously by itself |
| Space | Fire along the current facing (hold for the full letter-stream) |
| Click / tap | Also fires |
| P / Esc | Pause ("in a meeting") |
| C | While paused: **edit your dev** — the customizer, then straight back into the same run |
| Q | While paused: **quit the run** and go pick a different difficulty. Asks twice — the run is discarded and scores nothing |
| D | On the burnout screen: straight to the difficulty screen. **R** replays the same one, **ESC** goes back to the title |
| H | **Help** — a five-page reference: controls, the sprint clock and overflow, cups & pickups, languages & stripes, and the ticket bestiary. Also the `?` buttons on the title, difficulty and pause screens. Bosses are deliberately left out — those you meet cold |
| F | **Fullscreen** toggle (also a button on the title screen). Works on every screen except the name field, where F is text |
| G | **Pixel size** — BIG (chunky, the original look) or SMALL (same layout, twice the rasterization: much easier to read). Also a button on the title screen; remembered in `localStorage` |
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

## Difficulty

Picked on its own screen between *create your dev* and the run — **how bad is
this sprint?** The choice is fixed for the run and remembered for the next one.

Eight knobs, each applied at exactly one place in `game.js`, so a row in the
`DIFFS` table is the whole definition of a level and nothing hides in the code.
Every number below is shown on the screen itself — point at a level and its
stat sheet appears beside the rows (the selected level's sheet when the pointer
isn't on one). All relative to NORMAL, with "bigger = worse for you" — which is
why swarm and boss cadence are displayed inverted, since the stored values are
intervals and nobody reads an interval.

| | Cups | Wrong tech | Clock | Swarm | Ticket speed | Boss cadence | SP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **EASY** | 5 | ×1.5 | ×1.35 | ×0.77 | ×0.85 | ×0.8 | ×0.7 |
| **NORMAL** | 3 | ×1 | ×1 | ×1 | ×1 | ×1 | ×1 |
| **HARD** | 2 | ×0.75 | ×0.82 | ×1.28 | ×1.12 | ×1.18 | ×1.5 |
| **CLAUDELIKE** | 1 | ×0.5 | ×0.7 | ×1.61 | ×1.25 | ×1.39 | ×2.5 |

**NORMAL is every multiplier at 1** — the game exactly as it shipped before
this screen existed, so old high scores still mean what they meant. A *matched*
language is always ×2 on every level; only the wrong-tech value moves.

Bosses are deliberately **not** scaled by ticket speed: their chases are tuned
against the chair's top speed, and they have a cadence knob of their own that
was built for exactly this (the same one laps and the soft enrage use).

**CLAUDELIKE is locked** until all six bosses have been resolved **on HARD** —
Easy and Normal clears don't count, and neither do debug runs (the same rule
the high score already follows). The screen shows one chip per boss, lit in its
own colour once that one has gone down, so the remaining work is visible.
Progress lives in `localStorage` under `jiraBlasterBossesHard`.

Resolving a boss says which happened — `LOGGED ON HARD — 3/6`, or
`DEBUG RUN — NOT LOGGED` / `ONLY HARD COUNTS — NOT LOGGED` — because silence
made the rule undiscoverable: a debug kill looked exactly like a logged one.

**Debug mode opens CLAUDELIKE immediately** so it can be played and tuned
without grinding six HARD bosses first. It is borrowed, not earned: a debug run
still logs nothing, the screen says `OPEN FOR TESTING (DEBUG) — not earned yet`,
and switching debug off drops the selection back to HARD. `startGame()`
re-checks the gate, so a borrowed CLAUDELIKE (×2.5 SP) can never reach the
standup board.

## Gameplay

Every threat telegraphs; every death is avoidable. Size = threat tier, color =
type — one glance is full information:

| Ticket | Look | HP | Speed | Tell |
| --- | --- | --- | --- | --- |
| **Bug** (S) | small red card | 2 | fast | erratic wobble |
| **Story** (M) | green card | 5 | medium | straight line |
| **Epic** (L) | large purple card | 15 | slow | splits into 3 Stories on death |
| **Hotfix** | small flashing orange card | 3 | very fast | no wind-up — it screams in (siren) |
| **Meeting invite** | large grey card | ∞ | drifts | non-lethal, but it blocks your letters (cover). Up to **4** drift through a sprint at once (`MEETING_MAX`), arriving every 5–9s; never during a boss, and they don't count toward clearing the board — so they cost you room and firing lines, not time |
| **Bosses** | oversized named cards | huge | varies | every 4th sprint — see [Bosses](#bosses) |

- **Telegraphs:** tickets materialize with a 0.4s pulsing flash + ding (inert
  until real), draw a dotted approach trail toward your chair, and flash a red
  thickened border ~1.5s before impact — always enough time to turn and shoot.
- **HP is 3 coffee cups** on NORMAL (5 / 3 / 2 / 1 by difficulty — see below),
  no regen (coffee drops refill one — rare). On a hit
  the game freeze-frames for 0.5s and highlights the ticket that got you. Every
  2nd boss cleared (reaching sprint 9, 17, 25 …) is a **promotion**: your
  cup maximum grows by one, poured full.
- **Standup deadline:** every regular sprint runs on a countdown (boss sprints
  don't). Clear the board before it hits and you bank the full clear bonus. Let
  it run out and the sprint ends anyway — but nothing is cleared for free.
- **The backlog:** whatever is still alive when the clock runs out — plus
  anything that never got to spawn — is swept into three holding pens, one per
  area, on the edge that area's language fires from: **Frontend left, Backend
  top, Infrastructure right**. They rattle there through the standup countdown,
  then the pens open all at once as the next sprint starts, on top of that
  sprint's own tickets arriving normally — except before a **boss sprint**,
  where they stay shut and wait one more sprint, since a boss sprint has no
  clock and anything released into it would have to be killed to end the
  sprint. Carried-over tickets come back
  **enraged** — 50% faster, red, worth ×1.5 SP — and timing out pays only a
  third of the clear bonus. The next sprint's clock grows to account for the
  inherited work. The backlog caps at 24; past that the oldest tickets rot out
  as won't-fix, which is the only thing stopping one bad sprint from
  snowballing into an unplayable wall.
- **BLOCKED BY:** some Stories arrive shielded, linked to a blocker Bug — the
  Story can't be damaged until its blocker is resolved. The pair arrives as a
  **formation**: the shielded Story leads, and the blocker escorts it a few
  card-widths behind, matching its speed and its straight line. Since a blocked
  Story eats your letters, the big immune card is a moving wall with the fix
  trailing behind it — shooting head-on gets you nothing. The blocker steers to
  stay covering, but it can only **turn** so fast, so the counterplay is to
  **cut back the other way**: reverse your circle and the shield has to swing
  the long way round, which buys you a couple of seconds of clear line on the
  blocker. Standing off at range never opens anything. Back a pair into a wall
  and the formation flattens out sideways, which is its other weakness.
- **Areas & languages:** every ticket belongs to an area, shown as the colored
  header stripe across its top edge, like a document header — **Frontend**
  (red), **Backend** (green),
  **Infrastructure** (blue). Shooting it with the matching language (letters
  the same color as the stripe) always does **×2 damage**. What the *wrong
  tech* is worth is the difficulty's call (×1 on NORMAL, down to ×0.5 on CLAUDELIKE),
  which is what decides whether the stripe is a bonus or an instruction; Epics
  and bosses take half of that again. Epics pass their area to the Stories they
  split into.
- **Assists are taxed:** auto-aim / auto-shoot (I / O) work, but score earned
  with either enabled is ×0.6. CLAUDELIKE forbids them outright.
- **Chain:** kills within 1.2s of each other build a ×1→×8 multiplier.
  Getting hit resets it to ×1 — and the ticket that hit you keeps coming
  (only hotfixes burn out on impact).
  **Graze:** dodging a ticket by ~8px pays +50 and ticks the chain. Turtling
  scores worse than committing — aggression is the whole meta.
- Waves are **sprints** and scale density only (spawn interval decays 8% per
  sprint, floor 0.3s) — nothing new after sprint 3: 1 = Bugs, 2 = +Stories,
  3 = +Epics & Hotfixes. Every 4th sprint is a **boss** (see below).
- Drops: **coffee** (+1 cup), **energy drink** (crunch mode — double fire
  rate), **rubber duck** (shield that deflects tickets).

## Bosses

Every 4th sprint escalates to a named nightmare from the dev world — **alone on
screen**: no edge burst, no drifting meetings, no backlog. It gets a title card,
a name and HP bar in the HUD, and pays triple the sprint bonus plus a guaranteed
coffee + duck + energy drink on death.

Each is built around a mechanic the game already teaches, and every immune or
vulnerable window is telegraphed on the card before it matters. Bosses are also
the only things that **throw code back at you** — burning glyphs and burning
ground that ignore your letters completely. Thrown code is an ember that cools
as it travels: white-hot as it leaves the boss, orange in flight, dull red as it
burns out, which is what tells it apart from the steady orange of ground the
Megaoutage has already set on fire. You cannot shoot a stack trace down; the
only answer is to not be standing there.

| # | Boss | The fight |
| --- | --- | --- |
| 4 | **THE LEGACY MONOLITH** | Huge, slow, enormous HP. Its area stripe **rotates FE→BE→INFRA every 3.2s**, so the ×2 matchup keeps moving and you must keep switching 1/2/3. **Sheds tech debt** — Bugs on a timer *and* every seventh of its HP. It can't reach you, so it **throws the stack trace**: a ring of 9 glyphs fired outward, a glow and a pager tone ahead of it. And it **wakes up** — glacial at full HP, better than twice that speed as it comes apart. |
| 8 | **SCOPE CREEP** | **Armoured by its own scope.** Every 2.6s it buds a ticket that stays **glued to its edge** ("…and a dark mode") — attachments ride the rim and move as one body with it, and while a single one is attached **the boss cannot be damaged from any angle**. So the fight is never a damage race: strip the scope, then burn it in the window. Closing the last attachment resets the growth clock in full, so the window is guaranteed rather than lucky. Up to 5 attached at once, and it throws requirement docs at you the whole time. On death it splits into everything it accreted. |
| 12 | **MERGE CONFLICT** | Two diverged trunks, **`main`** and **`master`**, linked by a solid line. Each keeps **cutting feature branches** — small tickets on dashed tethers, named `feat/…` and `fix/…` — and while *any* branch is open anywhere, **neither trunk can be merged**. Close one side's branches and it goes **CLEAN** and stops cutting, which is what makes the work finite: clear one, then the other, and only then are the trunks killable. They **pincer**, and within 90px they are **rebasing** at **half damage**. Kill one and the reconnect countdown starts (survivor takes **×2**) — let it run out and **both diverge again**, cutting branches from scratch. Both throw letters at you throughout. |
| 16 | **THE ENDLESS MEETING** | A wall-sized invite that **blocks your letters**. It starts closed, and the window is something you **cause**: resolve an attendee right next to it (within 60px) and the room looks up for 2.2s. Left alone it only loses its own thread every 6s, briefly. **Mandatory attendance** — stand inside the ring drawn on the floor and it drags you into the room. **The agenda changes colour every 4.5s**, and the attendees it calls in are always the **other two** areas — so the language that clears a path to the room is never the language that hurts it, and the window costs you a switch to use. Past half HP it calls attendees two at a time. |
| 20 | **P0 MEGAOUTAGE** | **aim → dash → re-aim → dash → down.** Two chained charges, each re-reading where you actually are, so one sidestep no longer settles it. Then it goes down and the incident window opens: **×2 damage**. The route it took **stays on fire** — a long fight slowly costs you the room rather than only the moment. |
| 24 | **THE FLAKY TEST** | Blinks **PASS** (green, hittable) / **FAIL** (red, immune). **It feeds on blind fire** — every letter you spray into FAIL heals it, so holding the trigger through the immune window is how you lose. Its pursuit is inverted: it **backs off while you can hit it and hunts you while you can't**, making the damage window a chase and the immune window a dodge. Every **second** failure it just **retries somewhere else** — a ~135px hop that swings it *around* you rather than away, so it lands on a completely different side of the room while staying inside the fight. |

The roster then cycles — sprint 28 is the Monolith again — and a full lap does
more than pad HP. Alongside **+55% HP and payout**, every timer in the fight
runs ~12% quicker, everything moves 8% faster, and the fights themselves change:
Scope Creep grows eight times instead of six, the Outage links a **third** dash,
the Monolith sheds debt in pairs. A boss past the first lap also pours a second
coffee when it dies.

And no boss lets you kite it forever. Boss sprints have no clock, so after
**75 seconds** the fight stops being polite — everything speeds up and every
cadence halves. It is pressure, not a fail state: the sprint review is waiting.

## The Hackathon (sprint 33 — the end)

After the 8th boss falls (sprint 32), there is exactly one sprint left, and it
cannot be cleared: **THE HACKATHON**. No standup clock, no spawn queue —
tickets simply stream in, in the sprint-33 mix with the odd Epic folded in,
and the ratchet turns for as long as you last: the spawn interval **halves
every 45 seconds** (floored at 0.12s), and every new ticket arrives **moving
faster than the last** (up to 2.5× at 135s). Meetings still drift through.
The HUD counts seconds survived instead of a deadline, because that is the
score that matters now: the run ends here, at zero cups, for everyone — and
then it goes on the board.

## The standup board (leaderboard)

Every non-debug death POSTs the run to `/api/jira-blaster/scores` — 0 SP
included, and a run worse than your best still lands under it: the board is
one row **per run**, not per name. Quitting from pause posts nothing; only an
empty coffee cup does. The board is drawn on the BURNOUT screen, your own rows
lit up, with the date and time of each run (in the viewer's timezone) and a
mini top-view of the dev the run was played with, between the rank and the
name. Ten rows at a time, with `‹` / `›` paging buttons once it outgrows a
page. Then `R` starts the next run.

The board is also drawn on the **pause** screen, from a read-only `GET` fired
when you pause (including the auto-pause on tab-hide) and reused for 20s. No
rank line there: a run still in progress hasn't got one. And a run that could
*not* be posted — offline, or opened from `file://` — still gets the board
section on the burnout screen rather than silence, saying why.

- **Storage:** a Cloudflare D1 (SQLite) table `jira_blaster_runs` — `id`,
  `name` (`COLLATE NOCASE`), `score`, `look`, `created_at`. The look (the
  dev's integer indices, JSON) travels with the run it was played on. No
  image data is stored; the game re-renders the icon through its own sprite
  generator. (Two earlier tables are retired: `jira_blaster_scores`, one
  best row per name, and the short-lived `jira_blaster_looks`.)
- **API:** a Cloudflare Pages Function behind `/api/jira-blaster/scores`.
  `GET` returns the kept runs (up to 200) which the game pages by 10;
  `POST {name, score, look}` records a run and returns the board plus the
  run's rank. The browser never talks to D1 directly.
- **Trust:** the game has no accounts, so the write is unauthenticated — anyone
  with `curl` can post any score. What the endpoint accepts is bounded instead:
  a name of ≤ 12 printable characters, an integer score, the table pruned to
  the top 200 runs after every write, and a look of at most 16 short keys
  with small integer values (dropped when malformed, never a rejected run —
  and clamped again client-side before drawing).
- **Failure is silent and safe:** the game never waits on the network. Offline,
  from `file://`, or with D1 down it draws "board unreachable — this run was not
  saved" and plays exactly the same. `?autotest=1` and debug runs never post.

## Sound

Two layers. The **synth** in `VOICES` is the original: every sound generated in
code from oscillators and filtered noise, in an office palette — firing is
typing, a kill is the column moving to Done, a boss arriving is a dial-up
handshake. Levels sit in three tiers (constant ~0.12, punctuation ~0.20,
once-a-sprint drama ~0.34), calibrated by rendering each voice offline; see
`audio-test.html`.

Over that, eleven **retro one-shots** from Juhani Junkala's CC0 pack (see
[`sounds/CREDITS.md`](sounds/CREDITS.md) for the per-file provenance and how
they were prepared). Any event named in the `SAMPLES` table plays its sample;
everything else stays synthesised, and if the files fail to load — offline,
blocked, a bad deploy — **every voice falls back to the synth** and the game
sounds exactly as it did before. Move a name in or out of `SAMPLES` to switch a
single voice.

Five voices are deliberately **not** sampled, because their synth versions tell
the office joke the pack can't: `bossIn` (dial-up), `over` (a machine powering
down), `quack` (the rubber duck), `graze` (a filtered sweep past your ear) and
`block` — the detuned squares that say ACCESS DENIED when your letters bounce
off a meeting invite or an immune boss.

Sample gains are measured, not chosen: the pack's files are all ~−6 dB, which
put every one of them a tier or two too loud (`crit` first landed level with a
boss dying). Each buffer's true peak is read back at the context sample rate and
the gain solved for its tier. A worst-case render — held fire at 22 shots/s plus
hits, a kill, an Epic and a boss all inside 400 ms — peaks at 0.685 through the
master compressor with zero clipped samples. Re-measure after swapping a source.

## Dev notes

- `index.html?autotest=1` runs a 25-second self-playing smoke test and reports
  a summary via `console.log` and `document.title` (see the autotest block at
  the bottom of `game.js`). Headless Chrome's `--virtual-time-budget` does
  **not** advance `requestAnimationFrame`, so run it in real time, e.g.:
  ```bash
  chrome --headless=new --enable-logging=stderr --v=1 'file://…/index.html?autotest=1' \
    2>&1 | grep -o 'AUTOTEST[^"]*'   # kill after ~40s
  ```
- The world is always laid out in **640×360 game units**; `G` switches how many
  real pixels each unit is rasterized into — **BIG** (1×, backbuffer 640×360,
  the original chunky look) or **SMALL** (2×, backbuffer 1280×720). One
  `ctx.setTransform(RS, 0, 0, RS, 0, 0)` at the top of `draw()` is what keeps
  every other drawing call resolution-agnostic, so layout, hit targets and
  gameplay are byte-identical between modes — verified by comparing hit rects.
  This is **not** the `VW`/`VH` dial below: raising that would widen the arena
  and change the game. The gain is in text (an 8px font rasterized into 16 real
  pixels has detail that the same glyph blown up 2× afterwards cannot), and in
  tickets, which are drawn rotated by their wobble and so get half-size
  stair-steps along every edge. Cost measured at ~0.08 ms/frame vs 0.07 —
  irrelevant against a 16.7 ms budget.
- Internal resolution is **640×360** — one backbuffer, one resolution, every
  sprite generated in code — CSS-upscaled with `image-rendering: pixelated`.
  `resize()` scales **fractionally** to fill the largest 16:9 box the window can
  hold, in both directions; it used to floor to a whole multiple, which kept
  every game pixel exactly square but left bars on any window that wasn't a 16:9
  multiple and overflowed a phone (it clamped to a 1× minimum). The trade is
  that at a fractional scale some source rows land on one more device pixel than
  others, so the art shimmers slightly in motion. Aspect is deliberately
  preserved — stretching to 100%×100% would turn every disc (the chair, the
  graze ring, the meeting's invite radius) into an ellipse. **F** or the title
  button goes true fullscreen via `requestFullscreen()` on the documentElement,
  so the page backdrop fills the letterbox margin instead of a black bar; the
  scaling policy above then fills whatever the window becomes.
  `VW`/`VH` at the top of `game.js` is the size dial:
  raising it shrinks every element on screen and widens the arena. World
  speeds (px/s) are sized to it — scale them together and the feel, including
  the 1.5s telegraph budget, is preserved. All sprites are generated in code —
  no image assets. The art implements the **"1a NEON DEADLINE"** direction from the
  Pixel Art Lab design (claude.ai/design project "Developer Defense Game
  Concept"); `PAL` in `game.js` is that palette verbatim and the single source
  of truth for every color in the *world*. The dev in the chair is the
  exception: their colors come from `look`, picked on the start screen.
- The customizer's front-view character generator is ported into `game.js` as
  `drawAvatar()` / `hairShape()` from `player_customizer.html` (a bundled
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

## Deploy

Two self-contained static files (`index.html` + `game.js`) plus the optional
leaderboard Pages Function — host them on any static host. The game plays fully
without the API; the board just draws "board unreachable" when it's absent.

**When updating in place, bump `?v=` on the `<script>` tag in `index.html`.**
Some CDNs (Cloudflare Pages among them) pin non-HTML assets to a multi-hour
browser cache, so returning players would otherwise run the previous `game.js`.
The HTML is always revalidated, so a new query string takes effect immediately.
