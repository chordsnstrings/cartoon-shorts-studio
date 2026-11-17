# Outage short - working notes (2026-11-17)
- Code: studio/src/videos/outage (composition OutageShort, 1080x1920, 30 fps, 850 f = 28.3 s). Base: awards (post chain, toon, cast core).
- Story: Tue 17 Nov 2026 the phone maker's internal update knocked iCloud / Pay / App Store / activation / its own store tills offline;
  status page still green early on; "not a cyberattack". Category Apple/iPhone (tech fail).
- New reusable pieces: build.ts buildStore (plank floor, wood feature wall + wall screen, ceiling light strips, two display tables with
  phones on angled stands, checkout counter + card reader + register, accessory-box shelves, wifi router, plants) + buildOffice (server
  racks, desk, monitor, keyboard, mug). screens.ts: wall screen hero/glitch/dark/spinner/status-board, display phone on/off, reader
  ok/no, register on/off, monitor update-arrows+progress/error, rack LED faces (green blink / red). outage_fx.ts: held phone card with
  screen modes (on/err/out/lock/x/new/spin), sad cloud, red error bubble, hooded hacker pictogram, red cross stamp, open product box,
  wifi arcs, cyan power spark, cream poof. cast.ts phoneAt() (phone card at a hand), tableErrors() (staggered error bubbles).
- Opus verifier round 1 (hook 7, story 6, composition 6, look 8) -> fixed: payment X over the staff's face (now on the phone itself),
  cloud too small/off-phone, hacker icon hidden by the X (smaller X, icon shows 0.6 s first), unbox box not visible, router cropped /
  hidden behind a display phone (moved into the gap between phones, bigger, LEDs), CU padlock phone cut at the bottom, spark next to the
  staff's head (moved to the screen's far corner).
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 27.0 s; ElevenLabs music_v1 composition plan (plan.json, 7 sections);
  mix_outage.py (store murmur bed, error beeps from frame 0, glitch sputter, power-down, sign-out bloop, declined buzz, spinner ticks,
  lock clunk + sad trombone, register buzz, all-green chime, stamp, typing + progress blips, racks power-down, wifi blips, boing).
- Final Opus audit: FAIL on a cream poof cloud over the server racks (read as smoke / hardware fire) -> removed, f602-670 re-rendered and spliced; audit otherwise clean.
