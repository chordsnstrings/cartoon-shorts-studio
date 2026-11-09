# Tidy short - working notes (2026-11-08)
- Code: studio/src/videos/tidy (composition TidyShort, 1080x1920, 30 fps, 940 f = 31.3 s). Base: floppy post chain/toon/cast core,
  hotpot robot.ts rewritten (claws, antennae, T-shirt, grippy socks, dangle legs, dizzy/frozen/proud faces, held toilet brush).
- Places: HALL x 0 (12-step carpeted staircase, landing), STOOP x +400 (brick facade, 8 stone steps + railings, street, minivan
  `makeVan()`), HQ x -400 (desk, monitor with robot-POV canvas, gear box LED, shelves of spare robot heads), BATH x -800 (toilet,
  sink, mirror, tiles).
- Hook text is now a Remotion overlay in Short.tsx (HookText, Poppins + Noto Color Emoji, vh units) - no PIL post step needed.
- Verifier round 1 (Opus): hook robot claw read as covering the woman's mouth -> arm across her chest (clinging), robot to her side,
  camera pulled back; controllers moved to desk level; reporter card removed (half-face at frame edge); brush head 2x bigger and
  placed exactly at the poke tip; frozen shot reframed + loading ring.
- Gotcha: a card point far from the card centre swings back in depth (card faces the camera) - props held at the card's edge
  can end up inside nearby geometry (brush tip inside the toilet). Put the loose prop where the drawn tip actually is (onCard with
  the same canvas point, small fwd).
- Render: scripts/final.sh TidyShort tidy 940 4 1.
