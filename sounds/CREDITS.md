# Sound effects

These sixteen one-shots are from **"The Essential Retro Video Game Sound
Effects Collection [512 sounds]"** by **Juhani Junkala**, released under
**CC0 / public domain** — no attribution required, credited here anyway.

- <https://opengameart.org/content/512-sound-effects-8-bit-style>

The full 512-sound pack lives in `resources/` on the author's machine and is
**gitignored** — only the sixteen files actually used are committed.

## What's here, and where each came from

| File | Source in the pack |
| --- | --- |
| `shoot.wav` | `Weapons/Single Shot Sounds/sfx_weapon_singleshot16.wav` |
| `hit.wav` | `General Sounds/Simple Damage Sounds/sfx_damage_hit4.wav` |
| `crit.wav` | `General Sounds/Impacts/sfx_sounds_impact3.wav` |
| `kill.wav` | `General Sounds/Coins/sfx_coin_double7.wav` |
| `ding.wav` | `General Sounds/Interactions/sfx_sounds_interaction3.wav` |
| `pickup.wav` | `General Sounds/Positive Sounds/sfx_sounds_powerup6.wav` |
| `canPickup.wav` | `General Sounds/Positive Sounds/sfx_sounds_powerup9.wav` |
| `hurt.wav` | `General Sounds/Negative Sounds/sfx_sounds_error7.wav` |
| `siren.wav` | `General Sounds/Alarms/Alarms/sfx_alarm_loop6.wav` |
| `epicDie.wav` | `Explosions/Shortest/sfx_exp_shortest_hard4.wav` |
| `wave.wav` | `General Sounds/Fanfares/sfx_sounds_fanfare3.wav` |
| `bossDown.wav` | `General Sounds/Fanfares/sfx_sounds_fanfare1.wav` |
| `bossDie.wav` | `General Sounds/Weird Sounds/sfx_sound_shutdown1.wav` |
| `bossIn.wav` | `General Sounds/Weird Sounds/sfx_sound_mechanicalnoise1.wav` |
| `trace.wav` | `General Sounds/Weird Sounds/sfx_sound_mechanicalnoise3.wav` |
| `click.wav` | `General Sounds/Neutral Sounds/sfx_sound_neutral8.wav` |

## How they were prepared

Sources are 44.1 kHz 16-bit mono at −6 dB. Each was converted to **22.05 kHz
mono 16-bit WAV** (`ffmpeg -ar 22050 -ac 1 -c:a pcm_s16le`), which halves the
size and still passes everything in these sources — the whole set is ~450 KB.

`block` (letters bouncing off a meeting invite or an immune boss) was sampled
at first and reverted: the synth's two detuned squares beating against each
other read as ACCESS DENIED better than a clean error beep did.

**WAV, not MP3/OGG, on purpose:** `shoot` fires up to 22×/second, and MP3
encoder delay prepends silence that `decodeAudioData` does not reliably strip.
Latency on the most frequent sound in the game is not worth the saved bytes.
Every file was checked for lead-in silence after conversion; all are 0.0 ms
except `siren` at 0.7 ms.

Filenames are the event names in `game.js` — `sounds/<event>.wav` is loaded for
any event listed in the `SAMPLES` table.
