# Glitch short - working notes (2026-11-21)
- Code: studio/src/videos/glitch (composition GlitchShort, 1080x1920, 30 fps, 1050 f = 35.0 s). Base: trolley (post chain, toon, cast core,
  HookText overlay, buildCity). Category: gaming / video games (first gaming story on the channel).
- buildCity: tram crossing removed -> plain cross street (x -6.5..6.5) with zebra crossings. New reusable pieces (build.ts):
  `buildHarbour()` (quay + sea wall at QUAY_Z, railing, bridge deck on round piers, water plane, far shore blocks + palms),
  `makeBoxTruck()` delivery truck, `makeCar()` sedan, `makeBoat()` motor boat (extruded pointed hull, cabin, mast + flag).
  story.ts: `fly()` tumbling flung-vehicle arc, `vehPoses()`, `boatPose()` jitter, `sinkY()` stepped sink + spring pop-up.
  cast.ts fx: confetti shower, glitch pixel squares (`pixels()`), trophy cup, fireworks, shake zigzags, flat crack ring decal.
- Opus verifier round 1 (hook 8, readability 6, comp 6, look 7.5) -> fixed: boat read as a kiosk (now red hull, mast, flag, higher camera
  that shows the bridge deck); sinking head on asphalt could read as a severed head (now he sinks only to the shoulders with arms flailing
  in a dark crack ring, then a quick final drop); thin dark fireworks read as cracks (bigger, multicolour dots); truck over the friend's
  head (moved left); cut figures at edges reframed.
- Audio: ElevenLabs George 34.4 s; ElevenLabs music_v1 plan (plan.json); mix_glitch.py (8-bit glitch blips, boings, whooshes, fireworks,
  crowd applause, record-stop, boat jitter rattle, stepped sink beeps, drumroll, trophy ding).
- Render: scripts/final.sh GlitchShort glitch 1050 5 1 (~25-30 min per 210-frame chunk); hook chunk re-rendered after a frame check (truck A landed too early, push crept too close). QA: no black/white/frozen frames, pops only on planned cuts; -15 LUFS. Final Opus audit: PASS (cover moved to f40 so the flying truck shows).
