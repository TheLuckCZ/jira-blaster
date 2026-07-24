# Co-op Multiplayer Plan (invite link, realtime boss fights)

Status: **not started** — parked plan, written 2026-07-24.

## Architecture decision

- **Host-authoritative**: Player 1's browser runs the whole sim exactly as today.
  Player 2 sends only inputs; host applies them to a second chair and broadcasts
  state snapshots. No determinism refactor, no server-side game logic.
- **Cloudflare Durable Object** (free tier) as room coordinator + WebSocket relay.
  One DO instance per room. D1 stays what it is (leaderboard only).
- Invite link format: `stesti.pro/game/jira-blaster/?room=<code>`.
- Mid-run join is allowed (drop straight into a boss fight): host adds a chair
  and streams current state.

## Phase 1 — plumbing (~1 day)

- [ ] New Worker (or extend apex functions if DO binding allows): `/api/jira-blaster/room`
- [ ] Durable Object: create room, generate short code, relay WS messages between 2 sockets
- [ ] Client: `?room=` param detection → "JOIN X'S OFFICE" flow on the menu
- [ ] "INVITE A COLLEAGUE" button on pause/setup → copies link, shows room code

## Phase 2 — second dev in the office (1–2 days)

- [ ] Refactor `player` singleton → players array (input abstraction per player)
- [ ] Render remote dev (own look, name tag, chair) from relayed input
- [ ] Per-player aim/fire/cups; shared score & combo (co-op, not versus)
- [ ] Down-but-not-out: at 0 cups you're "in a meeting" — teammate revives by touch

## Phase 3 — sync (2–3 days)

- [ ] P2 → host: inputs at 30–60 Hz (angle, move vector, fire, language)
- [ ] Host → P2: compact snapshots ~15 Hz (players, enemies, bullets, pickups, boss state)
- [ ] P2 client: interpolation between snapshots; local prediction for own chair only
- [ ] Join/leave/reconnect; host migration = just end the run (keep it simple)

## Phase 4 — polish & rules (1–2 days)

- [ ] Pause semantics (either player pauses → both paused; host tab-hidden **must not** freeze the room — rethink the auto-pause-on-hidden listener)
- [ ] `hitFreeze` freeze-frame: per-player flash only, no global time stop in MP
- [ ] Pickup contention (first touch wins) and heal targeting
- [ ] Leaderboard: co-op runs post to a separate board (or tagged `co-op`) — don't mix with solo
- [ ] Difficulty scaling with 2 players (spawn count ×1.6–1.8, boss HP ×1.7)

## Known traps (budget time here)

- Tab-hidden rAF throttling on the host kills the room — need the host sim to tick via the WS/DO heartbeat or `setInterval` fallback when hidden.
- Clock drift / dt clamping between peers.
- Boss dash attacks must telegraph fairly at P2's ping.

## Cost / effort summary

- Runtime cost: ~$0 at hobby scale (DO free tier).
- Total effort: ~1 focused week for a playable v1; weekend for a rough prototype.
