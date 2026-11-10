# Butter short - working notes (2026-11-09)
- Code: studio/src/videos/butter (composition ButterShort, 1080x1920, 30 fps, 930 f = 31.0 s). Base: tidy post chain/toon/cast core.
- One place: chip LAB (x 0): workbench with skirt (hides legs of people behind it), 4 chip boards (CHIPX), butter box, red start
  button, pegboard, window, fridge. Butter knobs + puddles are real meshes in world.ts (meltAt() squashes the box, grows the puddle).
- New fx drawings in props.ts: knife, thermometer, bolt, sleepy snail ("lazy chip"), stopwatch, laptop with frying egg, butter splat.
- ElevenLabs was OUT OF QUOTA this run (1 credit left of 131,000) and Higgsfield had 0 credits: voice = local Kokoro bm_george
  (pipeline/voice/kokoro_voice.py + align.py), music = synthesized (stories/butter/music_butter.py, pipeline instruments).
- Verifier (Opus) round 1 7/10: knife read as cigarette (made it a chunky butter knife), smoke over a laughing mouth (moved to the
  laptop side), thermometers too small, critic half off-frame, hook text still up during the white flash (HOOK_END 82).
- Render: scripts/final.sh ButterShort butter 930 4 1.
