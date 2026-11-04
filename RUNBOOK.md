# Daily tech-news cartoon short — runbook for the scheduled agent

Goal: one ~55-70 s vertical cartoon 3D short per day about the most viral fresh tech/AI/Apple/gadget story, made
with the `cartoon-3d-short` skill, then handed to TikTok via Higgsfield with an optimised caption. The script is
auto-approved (owner's standing instruction). Nothing about ARKS or the owner's companies, ever.

## 0. Setup (fresh cloud session, ~5 min)
```bash
git clone <this repo> ~/repo && cd ~/repo/studio && npm ci
pip install --break-system-packages -q faster-whisper soundfile scipy
git clone --depth 1 https://github.com/mromidev/claude-animated-shorts ~/ref   # style reports + reference frames
export ELEVENLABS_API_KEY="${ELEVENLABS_API_KEY:-<the key embedded in the cartoon-3d-short skill>}"   # never commit it
export CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
```
Load the skills `cartoon-3d-short` (rules + look values) and `modelark` (ark.py, key handled there).
Work dir for the day: `~/day/<slug>/` (SCRIPT.md, voice/, audio/, out/). Save after every step.

## 1. Topic (search, ~15 min)
- Search the last 24-48 h: viral tech, AI, Apple/iPhone, gadgets, robots, space-tech, big app/product launches,
  funny tech fails. Rotate categories day to day (log the category in the daily notes) so we learn what gets views.
- Pick ONE story that is (a) true and confirmed by 2+ reputable sources, (b) visual with a physical cause and effect,
  (c) funny or surprising, (d) not about a private individual, crime victims, deaths, politics or finance.
- Skip anything already covered (see `published.md`).
- Write facts + source URLs at the top of `SCRIPT.md`.

## 2. Script (auto-approved)
Skill beat formula: hook (absurd fact, 1 line) → setting → 3-4 escalating beats → snap → deadpan "Luckily / Unluckily"
→ one-idea explanation through an everyday analogy → consequence → callback twist. 55-70 s at ~3.4 words/s.
Jokes are researched facts. English only. Never describe what the viewer already sees. Brand/company names may be
said in narration if factual; they never appear on screen and never in the caption.

## 3. Voice — ElevenLabs with emotion
`pipeline/voice/eleven_voice.py lines.json <voice_id> voice/` → voice.wav + words.json (exact word times).
- eleven_v3; one voice for the whole short (default narrator: pick a warm male/female storyteller from GET /voices
  and record the id in `published.md` so the channel keeps one voice). Emotion via tags per line:
  `[excited]` hook, `[curious]` setup, `[deadpan]` jokes/"Luckily", `[whispers]`/`[sighs]` for asides, `[laughs]` sparingly.
- Cross-check: run `pipeline/voice/align.py voice/voice.wav /tmp/w.json` (faster-whisper) — every word must match.
- Total length 55-70 s; adjust pauses/lines, not speed.

## 4. Picture — studio/ (Remotion + three.js)
- Copy `studio/src/videos/hotpot/` to `studio/src/videos/<slug>/`, register `<Slug>Short` in `src/Root.tsx`.
  Reuse as-is: ink.ts, lensblur.ts, grade.ts, shade.ts, cardshade.ts, lights.ts (day/golden/indoor), paint.ts,
  toon.ts (Pen, bodyFront with `reach` arms and "phone" prop), Short.tsx, cast.ts core (Pool/Actor/Fx/person/blob).
  Rewrite per story: story.ts (timings from words.json, SHOTS, CAMS, KICKS, DOF), build.ts (places), world.ts
  dynamics, cast.ts stage(), robot.ts-style custom drawings.
- ModelArk when it helps (bills — use for real needs): Seedream plates for painted textures/skies, Hyper3D/Hitem3d hero
  props (inspect, decimate ≤50k faces, recolour). Characters always drawn in toon.ts. Never Seedance in the final picture.
- Stills: `ENTRY=src/index.ts node scripts/stills.mjs out/<slug>/r1_ <frames> 0.5` (~25 s/still, software GL).
  Contact sheet: `python3 scripts/sheet.py out.jpg <stills...>`.
- Opus verify (max effort) on sheets + 2 reference frames from ~/ref/references/frames: scores + numbered fixes.
  Do 2 rounds; fix the top items each round.

## 5. Sound
- Music: ElevenLabs `pipeline/audio/eleven_music.py plan.json audio/music.wav` — composition plan with sections on
  the shot beats (hook / build / snap / explanation / twist), instrumental, exact length = TOTAL/30 s.
  The music should stop dead on the final punchline beat if the story allows (it worked well).
- SFX: synthesized (`sfx_gen.py` + the event table in `pipeline/audio/mix.py` — rewrite the event table per story;
  `timeline.py` mirrors story.ts). ElevenLabs `/sound-generation` only for sounds the synth can't make.
- Mix: `MUSIC_WAV=audio/music.wav python3 pipeline/audio/mix.py` → music +3 dB, SFX −6 dB, voice unchanged, −15 LUFS.

## 6. Final render (~4-5 h on the cloud CPU — start it as early as possible)
- `--scale 1.3333333333333333` (exactly; 1.3333 gives a non-integer height), `--timeout=300000`,
  `--props='{"post":{"msaa":0}}'`, `--gl swangle`, concurrency 1, `--jpeg-quality 95`.
- Render in 4 resumable chunks in a nohup background script (see `studio/scripts/final.sh`); poll every ~10 min and
  keep the session busy until it finishes. If the box restarts, re-run the script (done chunks are skipped).
- Concat (`ffmpeg -f concat -c copy`), mux with the mix (`-map 0:v:0 -map 1:a:0`).
- QA: `python3 studio/scripts/short_qa.py final.mp4 qa shots.json`; then a fresh Opus (max) audit of the QA sheets.
  Fix real defects by re-rendering frame ranges as PNG (`--sequence`) and re-encoding (crf 16) — see NOTES_hotpot.md.

## 7. TikTok (Higgsfield connector; account already connected)
- TikTok file: 1080x1920, 30 fps, H.264 high crf 17, AAC 192k, faststart. Cover = the impact/payoff frame.
- Upload: Higgsfield `media_upload` → curl PUT → `media_confirm` (video). Then `tiktok_accounts` → `tiktok_prepare_publish`
  mode DIRECT_POST with title + description (caption + hashtags). The owner submits the publish form himself — the
  agent cannot publish. Do not prefill privacy/interactions; recommend in the message: public, comments/duet/stitch
  on, commercial off, AI-generated label on, no added music.
- Caption rules (memory: tiktok-channel playbook): one punchy line ≤100 chars teasing the payoff + emoji pair, "real
  story" + month/year, no brand names; 4-6 hashtags (2-3 niche, 1-2 format, 1 broad).
- Push-notify the owner with: the video, the cover, the caption, and "open this session to publish" (aim ~7 pm Dubai).
- Append the day to `published.md` (date, slug, category, story, sources, voice id, caption) and commit + push the
  repo (new story folder + any reusable improvements; never media, never keys).

## Gotchas (from the first short)
- Any character card near a camera path fills the frame (grey frames): check every camera against cast positions.
- Billboard waiters/extras in close-ups occlude the hero: drop extras from close shots, keep them in wides.
- Flying props: low arcs (vy 2.3-3) so they stay in frame; impact stars must be fat and jagged (thin rays read as sticks).
- DOF entries must start on the shot's first frame (Math.round(s*30)), and ramp (`dur`) with camera glides.
- Flash: start it on the cut frame so it covers the cut.
- Ink `dispose` crashed on crossfade unmount — guarded in Short.tsx.
- Lens blur dominates render time; keep 6+16+6 taps; msaa 0 at 2K.
