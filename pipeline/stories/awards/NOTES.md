# Awards short - working notes (2026-11-16)
- Code: studio/src/videos/awards (composition AwardsShort, 1080x1920, 30 fps, 1000 f = 33.3 s). Base: drone (post chain, toon, cast core).
- New reusable pieces: build.ts buildTheatre (stage deck, red curtain folds + scalloped valance, podium with star, speaker stacks,
  hanging announcer pod, truss, seat rows with a centre aisle) + buildLobby (marble floor, step-and-repeat backdrop of stars/notes,
  red carpet, brass posts with sagging velvet rope, plants). screens.ts: big-screen pictures swapped per frame (robot singer idle/sing/win,
  a tall trailer picture tilted up by texture offset, colour bars, dark) + tower face screens. world.ts tower group (faux-stone
  octagon vessel, rocks in place via towerRock). awards_fx.ts: jagged blare bubble with scribbles, squashed dots bubble, trophy,
  handheld mic, sweat drop, confetti, play icon, camera + flash star.
- lights.ts "night" preset redefined as a theatre show light (warm key, violet shade, sat 1.06).
- Opus verifier round 1 (hook 7, story 7, composition 6, look 8) -> fixed: singer's arm looped to her neck with the mic on her cheek
  (read as clutching her throat) -> mic held out at chest height, open mouth; announcer shot pulled back (pod + whole bubble);
  trailer shots re-aimed so the laughing host is in frame; stray white block removed from the colour bars; clock pulled into the CU,
  trophy off the chin; stronger tower wobble; double confetti. Hosts in front of the win screen covered the trophies -> dropped.
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 33.1 s; ElevenLabs music_v1 composition plan (plan.json, 7 sections);
  mix_awards.py (crowd murmur bed, play click, shutters synced to the flash fx, tower chatter, strain servos, feedback squeal,
  robotic gabble, clock ticks, record scratch + bars tone, trophy pops + chimes, confetti pops, applause).
