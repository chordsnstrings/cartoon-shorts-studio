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

## 3-6. Voice, music, picture, render, Opus checks — follow the `cartoon-3d-short` skill
The skill is the source of truth for these steps (ElevenLabs voice with emotion + music, ModelArk assets, look values,
stills, Opus max verification rounds, 2K final render, QA, final Opus audit). Do not duplicate or override it here.
Repo-specific helpers for those steps:
- `pipeline/voice/eleven_voice.py lines.json <voice_id> voice/` → voice.wav + exact words.json (eleven_v3, tags per line);
  keep one voice id for the channel (record it in `published.md`). Cross-check with `pipeline/voice/align.py`.
- `pipeline/audio/eleven_music.py plan.json audio/music.wav` (exact length, beat-locked sections), then
  `MUSIC_WAV=audio/music.wav python3 pipeline/audio/mix.py` (rewrite its SFX event table + `timeline.py` per story).
- Picture: copy `studio/src/videos/hotpot/` → `studio/src/videos/<slug>/` as the starting template (reusable post chain,
  toon.ts with `reach` arms / phone prop, cast core, lights incl. `indoor`); stills via `studio/scripts/stills.mjs`,
  sheets via `studio/scripts/sheet.py`, chunked final via `studio/scripts/final.sh` (resumable; poll ~10 min).
- Cloud render specifics: `--scale 1.3333333333333333`, `--timeout=300000`, `--gl swangle`, `--props='{"post":{"msaa":0}}'`,
  concurrency 1; ~4-5 h at 2K. Fix audit defects by re-rendering frame ranges as PNG and re-encoding (crf 16).

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
