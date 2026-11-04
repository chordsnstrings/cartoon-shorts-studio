# Orbit haiku short — working notes (2026-11-04/05)
- Code: studio/src/videos/orbit (composition OrbitShort, 1080x1920, 30 fps, 2070 f = 69.0 s). Template: hotpot.
- Voice: ElevenLabs George JBFqnCBsd6RMkjVDRZzb, eleven_v3, SPEED=1.08, MAX_GAP=0.32 (eleven_voice.py squeezes mid-line holes);
  14 word starts snapped to energy onsets where ElevenLabs alignment and whisper disagreed by >0.15 s (words.json here is final).
- Music: ElevenLabs music_v1 composition plan (plan.json, 8 sections on the shot beats). music_v2 rejects composition plans;
  force_instrumental is only allowed with a prompt (eleven_music.py fixed).
- Mix: pipeline/stories/orbit/mix_orbit.py <day_dir> (own synthesized SFX table + score + voice; -15 LUFS, -1.2 dBTP).
- Earth: ModelArk Seedream plate (prompt in the ark log: stylised equirect map, 2880x1440, min 3.69 MP), edge whites filled with
  ocean, polar ice painted, upscaled to 4096x2048 -> studio/public/orbit/earth.jpg (not committed; regenerate if missing).
  R = 120 m, centre y = -128, equator rotated up, spin 0.004 rad/s; space cams tip down 0.09 x distance so the limb shows.
- Gotchas: an async texture must be loaded BEFORE the canvas mounts (Short.tsx gates on loadEarth): a texture arriving after
  the first GL render is never drawn in stills/renders. Exterior ground planes of different places must not overlap in x
  (snow covered the pad and park): keep each place's planes within +-195 m. A close-up camera inside an atmosphere shell sees
  the fresnel everywhere: the glow is a BackSide shell (limb halo only).
- Render: scripts/final.sh OrbitShort orbit 2070 6 2 (6 chunks, 2 browsers at once: ~2 h at 1440x2560 on 2 CPUs).
