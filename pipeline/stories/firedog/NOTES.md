# Firedog short - working notes (2026-11-28 Dubai run / 11-27 UTC)
- Code: studio/src/videos/firedog (composition FiredogShort, 1080x1920, 30 fps, 1008 f = 33.6 s). Base: delivery (post chain, toon, cast core).
- New reusable pieces: dog3d.ts = a quadruped robot dog from primitives (quilted silver coat texture over body + upper legs, orange
  boxy head with dark visor + LED eyes / happy arcs, lidar puck, wagging antenna), per-frame two-bone IK legs (all knees backward),
  trot gait from distance travelled (feet don't skate), slope pitch for stairs, sit, foot taps, `feet[]`/`headPos` world points for fx.
  world.ts `Flames`: camera-facing HDR flame cards (8 frames x 4 shapes of dfx `fxFlame`, colour > 1 so they bloom), also on the feet.
  build.ts `buildFireYard` (concrete training yard, burn tower with a REAL doorway + vestibule, painted openings with soot plumes,
  red-brick fire station with three bays, a primitive fire engine, cones, pallets) and `buildStairwell` (room + 18-step flight with
  yellow nosings, landing, glowing window, burning pallets). toon.ts hat "helmet" (firefighter helmet, colour = o.cap).
  dfx.ts: flame, rocket, steam puff, thin-coat gauge, thermometer hot/cool, tablet, map pin, hose jet, star.
- Opus verifier round 1 (hook 6, readability 6, look 8; nothing inappropriate) -> fixed: frame 0 firefighter now in shock + dog closer
  (fov 54); foot flames covered the legs with black holes (now small flames rising off each foot); climbing legs tangled (dog lifted
  0.1 m on the steps + stride x0.7); signal waves lost in a flame (moved, white); question mark tiny (bigger, off the flames);
  thermometer/dog framing on the landing.
- Self-checks before that: shot-2 head off-frame (dog yaw = camera angle + ~0.9 rad puts the nose screen-right); a glide from the
  scientists' camera to a low feet camera passed THROUGH a scientist card (hard cut instead); red handrail crossed the climbing dog
  (removed); the dark core capsule poked out of the coat front like a gaping mouth (shortened).
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 32.35 s, whisper check clean (1 fix: "Send" start 30.60); ElevenLabs music_v1
  composition plan (plan.json, 6 sections); mix_firedog.py (fire roar + crackle bed per shot, robot steps, servo, hero sparkle, coat
  shimmer, gauge pop, rocket launch, tablet beeps, fast clock, alert ding, report chirps, sizzle / cool chime, record scratch, feet
  whoomp + hot-foot boings, hose spray + steam hiss, new-feet taps, sparkle + ding, question pop, antenna boing, send chime).
