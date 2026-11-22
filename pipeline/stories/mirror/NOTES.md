# Mirror short - working notes (2026-11-22 run, 2026-11-21 22:10 UTC start)
- Code: studio/src/videos/mirror (composition MirrorShort, 1080x1920, 30 fps, 1020 f = 34.0 s). Base: glitch (post chain, toon, cast core,
  HookText overlay). Category: AI / internet security (AI agents) - new category angle (agents, not models).
- New reusable pieces: build.ts `buildSet()` movie-set town (flat painted prop shop fronts on struts + sandbags, `frontTex()` with
  pictogram icons via `drawIcon()` - cart/card/heart/chef hat/play/envelope, no text; striped awnings; dirt lot; film lights on tripods;
  `addrTex()` glyph-strip sign with no letters), `makeTrap()` giant mousetrap (snap bar group pivots about z, bait gift box squashes).
  robot.ts (from hotpot): shopper variant (`apron:false`, teal chest panel), `basket` (left / "R"), `glass` magnifier, faces squint/wide/smug.
  cast.ts fx: sticky note (scribbles), framed picture, dashed ghost tag (invisible label), icon bubbles, butterfly net, spade, hole, clods.
- Voice: ElevenLabs George, eleven_v3, SPEED 1.12, MAX_GAP 0.25 -> 33.4 s (first take at 1.1 was 41.5 s: script trimmed 110 -> 87 words).
  words.json = ElevenLabs alignment with 3 outliers fixed from whisper (In 12.8, So 26.7, Send 30.9).
- Opus verifier round 1 on stills (hook 6, readability 6, comp 5.5, look 8) -> fixed: engineers overlapping in shot 3 (split left/right),
  shot 4 too tight (one wide fov 70 front, bigger note/frame/tag), shot 8 crops, "deeper" not reading (trap slides into a visible hole),
  robot squints earlier at the sign, eager star eyes + laughing engineer on frame 0, a baited trap in the peek shot, engineer not on the trap.
- Opus verifier round 2: near-pass (hook 7, readability 7.5, comp 6.5, look 8) -> fixed engineer crop at the end, heart decal at a head,
  trap slide into the hole, glyphs that read as M/i, frame-0 overlap. Render: scripts/final.sh MirrorShort mirror 1020 5 1 (~25 min per
  204-frame chunk, ~2 h). QA: no black/white/frozen frames, pops only at planned cuts / expression swaps; -15 LUFS, -1.0 dBTP.
  Final Opus audit: PASS (nits: dig pit could faintly read as grave-digging; hook text near the TikTok top bar - nudge down ~3% next time).
- TikTok: cover = frame 38 (trap snap + hook text). Higgsfield publish session prepared (DIRECT_POST), owner submits the form.
