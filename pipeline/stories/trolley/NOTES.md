# Trolley short - working notes (2026-11-18)
- Code: studio/src/videos/trolley (composition TrolleyShort, 1080x1920, 30 fps, 965 f = 32.2 s). Base: kei (post chain, toon, cast core,
  HookText overlay), new downtown build.
- New reusable pieces (build.ts): `buildCity()` downtown street (8 m road tiles, sidewalks, curbs, building blocks with awnings + parapets,
  far glass towers, fan palms `palm()`, street lamps, trolley track crossing: embedded rails + panel, ballast/sleepers beyond, catenary
  poles + wire), `mast()` level-crossing signal (crossbuck, lamp bar, bell) + `LAMPS` for flashing lens/halo, `makeGateArm()` (hinge up/down,
  stub + outer part, arm lamps) + `makeArmPiece()` flying piece, `makeRobo()` white robotaxi SUV (open window frames so seated cards read,
  empty driver seat + wheel, spinning roof sensor, reverse lights, swappable rear glass ok/smashed texture), `makeTrolley()` red 2-car tram.
  story.ts: `carPose/trolleyPose`, `revX()` reverse run with contact/brake, `armState()` (swing from the near car corner, snap), `aim()`.
  cast.ts fx: glass shards burst, sound arcs (bell, reverse beeps), magnifier.
- Look: golden light turned the white car violet (backlit) -> all shots "day" sunAz 115.
- Opus verifier round 1 (hook 6, readability 6, comp 5, look 6) -> fixed: road crack strokes read as garbled letters (removed); gate arm
  clipped through the car (swing now from the near corner); employee in hi-vis + cap; shot 3 camera tracks the car (was an empty street);
  rear glass quad faced inward (invisible from behind) -> flipped + DoubleSide. Not fixed (time): car reads as an open "cage"/jeep.
- Audio: ElevenLabs George 31.6 s; ElevenLabs music_v1 plan (plan.json); mix_trolley.py (crossing bell, reverse beeps, EV whine, arm
  snap = wood_crack, glass shatter, trolley roll + gong, brake squeak, hurried steps).
- Render: scripts/final.sh TrolleyShort trolley 965 4 1.
