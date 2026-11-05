# Sky-clue short — working notes (2026-11-05)
- Code: studio/src/videos/skyclue (composition SkyclueShort, 1080x1920, 30 fps, 2055 f = 68.5 s). Template: orbit (post chain, toon, cast).
- Places: RIVER x 0 (camera pole, far-bank trees), DESK x -1000 (room, monitor with a canvas picture in screen.ts), MAP x +1000
  (hand-painted US map canvas, 5000 instanced dots, cone relief), STREET x +2000 (houses, ambulance).
- Voice: George, eleven_v3, SPEED 1.08; first take was 73 s at 184 words -> trimmed to 173 words = 67.75 s. 19 word starts snapped to
  energy onsets where ElevenLabs and whisper disagreed by > 0.15 s (words.json is final).
- Music: music_v1 composition plan (plan.json, 9 sections). Mix: mix_skyclue.py (synth jet with Doppler drop, Doppler siren, clatter, printer...).
- toon.ts: new `phones` option (headphones) and `reach` now works when seated (shrug).
- Gotchas: a creeping push-in toward a FAR look target moves the camera metres (pushK scales the whole pos->look vector): aim() keeps
  look points ~9 m away. Portrait frame + landscape monitor: screen inserts pan across the screen instead of fitting it.
  The security camera must not face its own pole (lens toward the river, mounted on the pole's +x side).
- Render: scripts/final.sh SkyclueShort skyclue 2055 6 2.
