# Floppy short — working notes (2026-11-07)
- Code: studio/src/videos/floppy (composition FloppyShort, 1080x1920, 30 fps, 2080 f = 69.3 s). Template: finnish (post chain, toon, cast),
  plus the skyclue US map + airliner, and a new airport build.
- Places: AIRPORT x 0 (runway along x at z -40, tower at (22, -72), terminal, hangars, windsock), CONTROL ROOM x -1000 (9 x 7 m, console
  row of four beige 1980s CRTs via `crt()`, window picture of the airfield, flight-strip board, floppy drive box with LED), US MAP x +1000
  (skyclue map, 435 green site dots), HIGHWAY x +2000 (road, trees, farm houses, `makeTruck()` with separate wheels + axle hub).
- New reusable pieces: build.ts `crt()` terminal + `makeTruck()`; world.ts `makePlane()` with landing gear + cabin windows, 3D floppy mesh
  (`floppyTex`), `takeoff`/`landing`/`fly` plane paths (story.ts); cast.ts `onCard()` (canvas point on a billboard -> world, for props held
  in hands), fx cards: floppy, flight strip, parcel, selfie photo, tyre, empty box, dark smoke; screen.ts green radar sweep, capacity page,
  emoji post, one-screen dashboard, save icon (all inside the 0.3-0.7 width band for portrait inserts).
- Voice: George, eleven_v3, SPEED 1.08: first take 73.2 s -> cut "It's 2026" + "at more than four hundred sites" -> 68.4 s. whisper check OK
  except "floppy disks from the eighties, out. Twenty-first" where eleven's alignment is ~0.4 s early (story.ts uses whisper times).
- Music: music_v1 composition plan (plan.json, 8 sections). Mix: mix_floppy.py (drive clunk/whir, CRT on, sputter, parcel thump, strip
  flutters, selfie pop, jets, tyre bounce + clunk, cheer, X stamp, chimes, site-dot pops, click).
- Verifier round 1 (Opus, stills): readability 6, composition 5.5, look 7 -> fixed tyre swap readability, insert framing, sunset airliner,
  smoke, colleague framing, last-disk box, dashboard map. 
- Gotchas: a 36 m airliner never fits a portrait frame near the camera: fly it 90+ m away (behind the tower). Glow fx cards in front of a
  CRT render as a black wedge: don't put soft cards over screens. Guard rails between the camera and a moving vehicle fill the lens: skip them.
- Render: scripts/final.sh FloppyShort floppy 2080 6 1.
- Final Opus audit: FIX - airliners crossing the control tower at sunset read like a plane hitting a tower (9/11 echo). Moved both planes
  well above the cab, tilted the camera up, re-rendered the last chunk. RULE: never let an aircraft silhouette overlap a tower/building.
- The 2026-11-08 runbook override (25-35 s, frame-1 hook text, end question) landed mid-run: made a 34.5 s TikTok cut from the 69 s master with
  pipeline/audio/recut.py (picture segments + voice/SFX stems, continuous score, PIL hook-text overlay, extra ElevenLabs question line). Skip the
  4-frame white flash when a cut starts near FLASH_AT.
