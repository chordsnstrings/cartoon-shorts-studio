# Hot pot robot short — working notes
- Code: /home/claude/studio/src/videos/hotpot (composition HotpotShort, 1080x1920, 30 fps, 2061 f = 68.7 s)
- Voice: Kokoro am_michael x1.33 (voice/tts.py), word times faster-whisper small.en (voice/words.json); "In" hand-fixed to 0.36 s
- Audio: audio/music.py (original F major 112 bpm tune: dance groove / pizz underscore / music box), audio/mix.py (SFX + mix)
- Mix: music +3 dB over a -14 LU-under-voice base, SFX -6 dB from voice-peak parity, duck -3 dB, -15 LUFS, -1.2 dBTP
- Render (software GL, 2 CPUs): ~8 s/frame at 1440x2560 (msaa 0, shadow 2048, lens 6+16+6 taps)
- Places: restaurant origin, street x+200, kitchen x-200
- Final: the-robot-that-danced-too-close.mp4 (1440x2560, 2061 f, -15 LUFS, -1.1 dBTP). Rendered in 4 chunks (~1 h each, software GL),
  then 10 audit fixes patched as PNG ranges and re-encoded (libx264 crf 16). QA: no black/white/frozen; remaining pops = planned cuts/kicks.
- Gotchas: --scale must be 1.3333333333333333 (1.3333 -> non-integer height); first frame needs --timeout=300000;
  Short.tsx ink.dispose crashed on crossfade unmount (guarded); waiter cards near cameras -> grey frames (check every lens vs cast).
