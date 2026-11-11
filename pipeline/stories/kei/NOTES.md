# Kei short - working notes (2026-11-11)
- Code: studio/src/videos/kei (composition KeiShort, 1080x1920, 30 fps, 1060 f = 35.3 s). Base: floppy (post chain, toon, cast core,
  street build, truck), HookText overlay from drone/Short.tsx.
- New reusable pieces: build.ts `makeKei()` (cab-over mini pickup, open window frames so a seated driver card reads, steering wheel on the
  right, hinged left door group), `makeTruck(col)` (floppy pickup, recolourable, scale 1.3 = full-size), `makeCar()` sedan, `makeBale()`,
  mud mound (height field + `moundY()` in story.ts for driving over it with pitch), side road with stop line, barn + silo, field fence,
  showroom (curtains, truss, crates, turntable, lumpy dust sheet `makeSheet()`, additive spotlight beam cones). world.ts `poseVeh()`
  (pose + wheel spin from speed). story.ts `keiPose/bigPose/trafficAt` per shot, `keiPt(id, t, lx, ly, lz)` (truck-local -> world, for
  cameras and seated cards). cast.ts fx: dial (needle + red stop pin), tape measure, turtle sticker, streaks, mud, cool air, cobweb,
  confetti, straw, grey dust cloud.
- Places: ROAD x 0 (main road along x z -6..0, lanes z -1.5 / -4.5, side road at x 120, mound at (-120, 16)), SHOW x +400.
- Opus verifier round 1 (hook 6, readability 6, composition 6, look 7) -> fixed: frame 0 pushed in on the driver with the big pickup already
  past the cab + streaks; dial red stop pin + bounce; right-hand-drive beat as a rear view (friend at left door, driver on the right);
  busy-road camera aimed along the road so cars read; A/C swirls moved down to the vents (they read as smoke at chin height); dust sheet
  raised so wheels peek out (read as a ghost); grey dust clouds; presenter proud + in frame; sunset sun moved to the side (backlit golden
  turned the mint truck blue -> reads as another vehicle).
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 34.8 s; ElevenLabs music_v1 composition plan (plan.json); mix_kei.py (putter = 3-cyl
  pulse train, V8 pass with Doppler, car passes, horn meeps, tape ratchet, sticker slap, bale thumps, splats, breeze, cloth yank, drumroll,
  spot clunks, applause, confetti pops).
- Render: scripts/final.sh KeiShort kei 1060 4 1.
