# Finnish-music short — working notes (2026-11-06)
- Code: studio/src/videos/finnish (composition FinnishShort, 1080x1920, 30 fps, 2085 f = 69.5 s). Template: skyclue (post chain, toon, cast, desk room).
- Places: LIBRARY hall x 0 (24 x 36 x 9 m, painted book-spine shelves, arched windows, bright entrance doorway, catalogue kiosk,
  reading tables with banker's lamps), IT OFFICE x -1000 (skyclue desk room), FINLAND x +1000 (snow, ice lake, red cabin + porch,
  jetty, snowy pines), BUFFET x +2000 (table on the left wall, four back doors, yellow pickup truck).
- New reusable pieces: bot.ts (drawBot: boxy screen-face robot with faces happy/closed/dots/wink/x/scan/angry, walk/tiptoe, tray of
  plates, disguises top hat/moustache/glasses, `guard` variant with shield badge; fx cards: search bubble, flying book, catalogue
  card, accordion, food, red X, paper, coloured note). screen.ts draws one canvas shared by two screen meshes (kiosk + monitor).
- Voice: George, eleven_v3, SPEED 1.08: 69.9 s raw -> 7 inter-line silences squeezed (0.95 s) -> 69.0 s; 22 word starts checked
  against whisper with an energy-onset score (words.json is final).
- Music: music_v1 composition plan (plan.json, 8 sections on the shot beats). Mix: mix_finnish.py (bubble pops, tick bursts, queue-full
  buzz, robot steps, servo, boing, accordion-free ending).
- Gotchas: portrait screen inserts only see ~40 % of a landscape monitor's width: keep insert content in the central 0.3-0.7 band.
  Golden light turns snow/ice into orange sand: snowy Finland reads only in "day" light (or with lots of blue shade).
  Billboards beside a bench/rail: keep props out of the card's footprint (the bench crossed the bot's chest).
  A seated student 2-3 m from a lens + DOF = a big blurred blob: drop seats near camera paths per shot.
- Render: scripts/final.sh FinnishShort finnish 2085 6 2.
