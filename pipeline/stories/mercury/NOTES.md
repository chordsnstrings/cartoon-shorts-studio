# Mercury short - working notes (2026-11-24 run)
- Code: studio/src/videos/mercury (composition MercuryShort, 1080x1920, 30 fps, 1000 f = 33.3 s). Base: orbit (drawn satellite
  character in sat.ts, mission control with a wall screen, space light/sky/stars, post chain) + toon.ts from catch (headsets).
- New reusable pieces: sat.ts `nozzle` (one big engine bell) + `chips: -1` (radiator strip instead of chip lights); build.ts painted
  planet maps (mercuryTex / venusTex / earthTex / plutoTex, procedural, no ModelArk plate needed), `drawWall` live wall screen
  (probe icon + flame + progress bar + red alarm frame; orbit page with old faded orbit + new gold one); world.ts cartoon Sun body card
  (sunTex) that fills the frame when the shot's sun is ahead/below, polar orbit rings (ringPt: plane contains y, opened 30 deg to the
  lens so rings read as tall ellipses in portrait), dashed ring from merged tube beads, live arc behind the probe, flyby trail tube.
  cast.ts fx: fxFlame (teardrop), cough puffs, speed streaks, fxEnergy (two bars + planet icons, no text), fxPip (check pips),
  fxLaptopBug (green cartoon bug crawling over code bars), fxUp.
- Places: SPACE origin (Mercury R 120 at y -124 so the limb sits low under the probe), FLY x + 3000 (planets stacked vertically for
  portrait), CTRL x - 1100.
- Opus verifier round 1 (hook 7, readability 6, composition 6, look 7) -> fixed: frame 0 flame on + camera raised (less empty ground),
  energy bars bigger, probe after flame-out framed against stars (read as a crash on the ground), red bar on alarm, bigger up arrow,
  Mercury warmer + no bright ray craters (read as the Moon), Venus stripes softened (read as Jupiter), laptop CUs wider (head crop),
  end shot closer.
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 32.4 s, words.json from ElevenLabs alignment; ElevenLabs music_v1 composition plan
  (plan.json, 8 sections); mix_mercury.py (coughing engine synced to flameAt, alarm beeps, sun rumble, streak whooshes, pip pings, bar
  fill, power-down, pfft, bug skitter, orbit swoosh + chime, applause + hurrahs, slide-up, send chime).
- Render: 4 chunks x ~10 min at 2K, jobs=1 (space + one small room render fast).
