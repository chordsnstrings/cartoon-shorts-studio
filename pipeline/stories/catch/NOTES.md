# Catch short - working notes (2026-11-16)
- Code: studio/src/videos/catch (composition CatchShort, 1080x1920, 30 fps, 1030 f = 34.3 s). Base: orbit (Earth, space light, sky,
  post chain), toon.ts from kei (headphones), HookText overlay from kei/Short.tsx.
- New reusable pieces: world.ts ship (stainless body + ogive nose, black hex heat shield on local -x, thin flaps, catch pins, 3 engines
  with per-engine flames), booster (grid fins, hot-stage ring, flame cluster scaled by boostFlame), catch arms as hinged groups
  (`armOpen(t, id)`), lap rings around the Earth (torus arc in the orbit plane, `lapPt` / `LAP_TILT`). build.ts buildPad (lattice tower with
  X braces, launch ring mount, tank farm, viewing fence) + buildSea (Gulf with wave texture, far coast). cast.ts fx: chopsticks + dumpling
  (`fxChop`, `fxDump`, drop with motion lines), fuel gauge (`fxGauge`, no letters), cartoon boom (`fxBoom`), splash column, confetti.
  story.ts `aim(pos, target, d)` = near look point (pushK creeps along pos->look; far look targets flew the camera through the cast).
- Places: SPACE origin (Earth R 120, centre y -128), PAD x 1000 (rocket axis z -70, tower x +15), SEA x 1400.
- Opus verifier round 1 (hook 8, composition 7, look 8; boom 4, ending 5) -> fixed: boom = bright poof + sparkles + cream puffs + splash
  over the sea, booster drops low and tips first; low tilted look-up at the ship in the arms (read as "ship hits tower") replaced by a calm
  level wide; impact star at the pins (read as a hit) replaced by soft sparkles off the arm tips; grid fins smaller/darker (read as solar
  panels); dumpling drop kept in frame with motion lines; cheer shot tighter.
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 33.9 s; words.json = whisper timings with the script's words (align.py overwrites
  words.json - copy it first!); ElevenLabs music_v1 composition plan (plan.json, 7 sections); mix_catch.py (rocket roar + crackle, clang,
  servo, chopstick clicks, separation clunk, lap whooshes + dings, engine pops, applause, sputter, boom, splash, dumpling splat).
- Earth texture: ModelArk Seedream 2880x1440 equirect plate upscaled to studio/public/catch/earth.jpg (not committed).
