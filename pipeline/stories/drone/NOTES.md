# Drone short - working notes (2026-11-10)
- Code: studio/src/videos/drone (composition DroneShort, 1080x1920, 30 fps, 1020 f = 34.0 s). Base: tidy (post chain, toon, cast core,
  hall staircase). New: drone3d.ts (primitive quadcopter: rounded body, lens + privacy shutter, 4 shrouded rotors with blur discs
  when flying / blades when docked, LEDs), droneAt(id, t) in story.ts (smootherstep key paths, velocity tilt), stage(...).drone override
  for the carried shot.
- Places: LIVING x 0 (sofa, coffee table, side table + router LEDs, console + dock, wall clock, fridge with hinged door + light,
  alarm sensor on the back wall, window glass swapped day/night), STAGE x +400 (2020 keynote: platform, glowing backdrop with a drone
  pictogram, pedestal, audience-head cards), HALL x -400 (tidy staircase).
- Lights: indoor for day shots, night preset for 6-7 (fridge glow + LEDs).
- Opus verifier round 1 fixes: drone poking into the head in the "same price" CU -> two-shot; no-Wi-Fi slash read as a stick in his hand
  -> moved up/left, hand down; drone drawn over a dark wall cupboard read as a TV -> cupboard removed, drone beside him; box clipped the
  drone -> drone hidden until it pops out; sensor moved next to the dock so the alarm shows in the CU; stage drone scale 2.6.
- Audio: ElevenLabs George (eleven_v3, SPEED 1.08) 33.6 s; ElevenLabs music_v1 composition plan (plan.json); mix_drone.py (rotor
  buzz synth = sawtooth blade-pass + band noise, alarm beeps, doorbell, spin-down, cushion thump).
- Render: scripts/final.sh DroneShort drone 1020 3 1.
