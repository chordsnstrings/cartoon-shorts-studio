# Reality short - working notes (2026-11-23)
- Code: studio/src/videos/reality (composition RealityShort, 1080x1920, 30 fps, 966 f = 32.2 s). Base: trolley (post chain, toon, cast core,
  HookText overlay, buildCity). Track/gates/catenary removed from buildCity (full street, CLEAR_X keeps palms/lamps off camera spots).
- New reusable pieces (build.ts): `gameTex(phase)` painted "video-game view" touchscreen texture (4 phases scroll lane dashes, swap every 3 f),
  centre touchscreen on a stalk in makeRobo (`sm/games/scr`), brake-light tail lamps (`tl`, own material), tan cabin seats + dark cabin floor,
  `speedCam()` pole + yellow box + hood + lens, `makePothole()` crater decal, `makeEasel()` with blank/chart board swap (axes, bars, arrow, no
  numbers), `makeFloatCam()` little drone camera. story.ts: `IN()` interior camera riding in car-local coords (+ hook bob), swerve pose,
  speed-camera approach with numeric decel integration, PASSES table. cast.ts fx: update cloud with download arrow, twinkles, gap panels,
  speed streaks, question marks, speed-camera face card (eyes + lens nose + mouth) nudged off the box toward the camera.
- Opus verifier round 1 (hook 6, readability 5, comp 5, look 7) -> fixed: hook face cut + no motion (camera bob + kick + wider fov, screen in
  frame); arm arcs reading as a strap round the neck (dropped all raised-arm reaches in car shots); floating camera read as a gift box
  (dark body, big lens, red rec light, x1.7); pothole read as a puddle/eye (crater + rim chunks); speed camera had no lens (lens nose in the face
  card, bigger smile); sly grin (side glance + head tilt); end question (yellow "?" over the head); cloud too small (x1.5).
- Steering wheel removed (its rim read as a black claw at the driver's hands).
- Render: scripts/final.sh RealityShort reality 966 4 1.
