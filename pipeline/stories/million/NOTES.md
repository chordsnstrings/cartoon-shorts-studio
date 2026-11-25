# Million short - working notes (2026-11-26 Dubai run)
- Code: studio/src/videos/million (composition MillionShort, 1080x1920, 30 fps, 930 f = 31.0 s). Base: mercury (drawn satellite in sat.ts,
  mission-control room, space light/sky/stars, sun body card, post chain).
- New reusable pieces: build.ts `buildHill` (night hilltop: sphere-cap hill with painted night grass, far rolling hills, pines, a 3D
  telescope on a tripod; `hillY`, `EYEPIECE`), `earthHD` (2048 cartoon Earth map: smooth continents, light cloud streaks), new
  `drawWall` pages ("approve": Earth wrapped in a dot swarm + green tick that pops; "deny": dead-satellite icon -> Sun crossed by a red
  no-sign, kept in the 0.3-0.7 width band); world.ts instanced swarm (7000 little glowing satellites on inclined circular orbits,
  `swarmN` controls how many are visible: any prefix is spread evenly), Earth + additive atmosphere rim, night moon disc; cast.ts
  satellite trains in the night sky (`skyTrains`: great circles through points in front of the hill cameras, HDR fx cards rotated to
  their screen-space motion via CamInfo up/fwd), eyepiece view (black ring card 0.6 m in front of the lens + galaxy card + trains timed
  to cross it), chip thought bubble, sun rays, complaint paper flicked off a desk, shrug lines, question marks.
- Opus verifier round 1 (hook 7, readability 7, composition 6, look 8) -> fixed: shrug read as celebrating (hands raised) -> arms out low,
  flat face, shrug ticks; regulator's grey hair band + grey moustache read as blindfold + gag -> dark hair, no moustache; wall graphic
  cropped -> narrower band; empty floor in office -> camera raised (also keeps his head below the screen content); astronomer cropped
  -> cameras re-aimed; end shot pushed in; trains made more parallel (a sharp V read as a tick).
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 30.2 s, whisper check clean (82/82 words); ElevenLabs music_v1 composition plan
  (plan.json, 8 sections, min 3 s each); mix_million.py (night crickets/breeze, streak whooshes, twinkle flood, chip power-up, sunshine
  chime, swarm blips + rise, eyepiece streaks, approve ding, paper flick, shrug boing, denied buzzer, power-down + slide whistle).
- Render: 4 chunks x ~5 min at 2K, jobs=1.
