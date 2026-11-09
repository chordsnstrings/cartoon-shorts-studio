# Daily tech-news cartoon short — runbook for the scheduled agent

Goal: one 25-35 s vertical cartoon 3D short per day about the most viral fresh tech/AI/Apple/gadget story, made
with the `cartoon-3d-short` skill, then handed to TikTok via Higgsfield with an optimised caption. The script is
auto-approved (owner's standing instruction). Nothing about ARKS or the owner's companies, ever.

> **2026-11-08 analytics override (beats any older rule here or in the skill):** first 6 posts all stalled at ~150
> views. 97% For You traffic (distribution fine), avg watch 12% of 71 s, most viewers left at **0:01**, 0 shares,
> 0 comments. Causes: static opening frame with no text, too long, stale stories. Fixes are baked into steps 1, 2, 5.
> Max ONE post per day.

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

## 1. Topic (search online, ~15 min) — FRESH ONLY
- Run `date` first. Use WebSearch (mode "extended" for news) with today's date / "today" / "this week" in queries
  (e.g. "viral AI news today", "Apple news <Month YYYY>", "tech fail this week"); WebFetch the articles.
- The EVENT itself must have happened in the last 48 h (72 h max if nothing qualifies). Check the event date in the
  article body, not just the article's publish date — reject recaps of older events (e.g. a March story re-reported
  in November). Never use a story from memory/training data; every story must come from today's search results.
- Log the event date + article dates in `SCRIPT.md`. If no fresh story passes, search wider categories; never fall
  back to an old story.
- Categories: viral tech, AI, Apple/iPhone, gadgets, robots, space-tech, big app/product launches,
  funny tech fails. Rotate categories day to day (log the category in the daily notes) so we learn what gets views.
- Pick ONE story that is (a) true and confirmed by 2+ reputable sources, (b) visual with a physical cause and effect,
  (c) funny or surprising, (d) not about a private individual, crime victims, deaths, politics or finance.
- Skip anything already covered (see `published.md`).
- Write facts + source URLs at the top of `SCRIPT.md`.

## 2. Script (auto-approved)
Compressed formula, 25-35 s at ~3.4 words/s (~85-120 words):
- **0-2 s hook:** open ON the climax/payoff (the smash, the crease, the fail) with motion and a cartoon character
  visibly reacting — never a static object or establishing shot. First spoken line = the hook, no intro.
- **Burned-in hook text from frame 1** (big, bold, top-third, ≤8 words, states the payoff, e.g. "Apple's $2,000
  folding iPhone has a crease problem 😬"), held ~3 s. This overrides the skill's "no text anywhere" rule.
- Then: 2-3 fast beats (what happened, why) → one-line twist.
- **End:** a question to the viewer ("Would you trust it?") + share prompt ("Send this to…"). Put the same question
  in the caption and in a pinned comment.
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
  sheets via `studio/scripts/sheet.py`, chunked final via `studio/scripts/final.sh <Comp> <slug> <frames> [chunks] [jobs]`
  (resumable; 6 chunks x 2 parallel browsers ~2 h at 2K; poll ~10 min).
- Per-story files live in `pipeline/stories/<slug>/` (SCRIPT.md, lines.json, words.json, plan.json, mix_<slug>.py, NOTES.md).
  `pipeline/stories/orbit/mix_orbit.py` is a self-contained mix template (SFX table + duck + limiter): copy it per story.
- Cloud render specifics: `--scale 1.3333333333333333`, `--timeout=300000`, `--gl swangle`, `--props='{"post":{"msaa":0}}'`,
  concurrency 1; ~4-5 h at 2K. Fix audit defects by re-rendering frame ranges as PNG and re-encoding (crf 16).

## 7. TikTok (Higgsfield connector; account already connected)
- TikTok file: 1080x1920, 30 fps, H.264 high crf 17, AAC 192k, faststart. Cover = the impact/payoff frame with the hook text. Before render, check frame 0: motion + face + hook text, or redo.
- Upload: Higgsfield `media_upload` → curl PUT → `media_confirm` (video). Then `tiktok_accounts` → `tiktok_prepare_publish`
  mode DIRECT_POST with title + description (caption + hashtags). The owner submits the publish form himself — the
  agent cannot publish. Do not prefill privacy/interactions; recommend in the message: public, comments/duet/stitch
  on, commercial off, AI-generated label on, no added music.
- Caption rules (memory: tiktok-channel playbook): one punchy line ≤100 chars teasing the payoff + emoji pair, "real
  story" + month/year, no brand names, end with the viewer question; 4-6 hashtags (2-3 niche, 1-2 format, 1 broad).
- The Higgsfield publish form is an MCP-Apps widget: it did not render in the Cowork cloud session (2026-11-05), and the
  prepared session expires after 2 h. Always also send the TikTok file + caption so the owner can post from the TikTok app.
- Push-notify the owner with: the video, the cover, the caption, and "open this session to publish" (aim ~7 pm Dubai).
- After posting: pin a comment with the viewer question + sources; reply to comments in the first hour.
- Append the day to `published.md` (date, slug, category, story, sources, voice id, caption) and commit + push the
  repo (new story folder + any reusable improvements; never media, never keys).

## Gotchas (from the orbit short)
- ElevenLabs v3 leaves 1 s holes mid-sentence: `MAX_GAP` in eleven_voice.py squeezes them; `SPEED=1.08`; trim the script, not the speed, to hit 25-35 s.
- Music: composition plans only work on `music_v1`, and without `force_instrumental` (instrumental via negative styles).
- Async textures (staticFile images) must load before the ThreeCanvas mounts, or held frames render without them.
- Keep each exterior place's ground/mountains within +-195 m of its x offset (places are 400 m apart).

## Gotchas (from the first short)
- Any character card near a camera path fills the frame (grey frames): check every camera against cast positions.
- Billboard waiters/extras in close-ups occlude the hero: drop extras from close shots, keep them in wides.
- Flying props: low arcs (vy 2.3-3) so they stay in frame; impact stars must be fat and jagged (thin rays read as sticks).
- DOF entries must start on the shot's first frame (Math.round(s*30)), and ramp (`dur`) with camera glides.
- Flash: start it on the cut frame so it covers the cut.
- Ink `dispose` crashed on crossfade unmount — guarded in Short.tsx.
- Lens blur dominates render time; keep 6+16+6 taps; msaa 0 at 2K.

## Gotchas (from the sky-clue short)
- pushK creeps the camera along the whole pos->look vector: with a far look target the camera travels metres. Aim look points ~9 m away.
- Check every long glide for props it passes through (poles, trees): a QA "pop" run of 3-4 frames inside a shot is usually that.
- Splicing a re-rendered range at 2K: encode the parts separately and join with the concat demuxer (filter trim/concat runs out of memory).
- No protected emblems (red cross / red crescent) on props; no text anywhere except the frame-1 hook text (step 2).

## Gotchas (from the finnish short)
- Two parallel 2K chunk renders on this 2-CPU box deadlock: the second browser sits at 0 % CPU forever. Run final.sh with jobs=1
  (`scripts/final.sh <Comp> <slug> <frames> 6 1`, ~38 min per 348-frame chunk). Killing final.sh also kills its `touch .done` subshells:
  touch the .done of a chunk that finished on its own.
- Splicing patches: re-encode only the patched pieces with `-video_track_timescale 90000` (Remotion segments use 1/90000) and join
  with the concat demuxer `-c copy`. Mixed timebases + `setpts=N/30/TB` gave the right frame count but shifted later cuts 4-5 frames
  late (audio out of sync): always check cut frames with a frame-diff after splicing.
- Portrait inserts of a landscape screen see only its central ~40 %: keep screen content in the 0.3-0.7 width band.
- Golden light turns snow into orange sand; snowy places read in "day" light.
- Effect cards that fly around (bubbles) must skip anything within ~1.8 m of the camera, or a huge blob crosses the lens.

## Gotchas (from the floppy short)
- Never let an aircraft silhouette overlap a tower or building in frame (the final audit read it as a 9/11 echo): fly planes clearly above or beside.
- A 36 m airliner only fits a portrait frame 90+ m from the camera. Inserts of a landscape CRT: keep screen content in the 0.3-0.7 width band.
- A sleeping tool call that gets killed can take a nohup render with it: start final.sh with `setsid nohup ... < /dev/null & disown`.
- Glow/soft fx cards over a screen render as a black wedge; don't put them there.
- To shorten a finished short without re-rendering: `python3 pipeline/audio/recut.py stories/<slug>/cut.json` (segments + stems + hook text).

## Gotchas (from the tidy short)
- Hook text can live in the composition: `HookText` overlay in studio/src/videos/tidy/Short.tsx (Poppins + Noto Color Emoji, vh units,
  frames 0-90 + 8-frame fade) - copy it instead of the PIL post step; emoji render fine in the cloud Chromium.
- Never let a character's hand/claw end near another character's face or throat (both Opus checks flagged it as gagging/choking).
  "Carried" reads when the carried card is lifted (feet clearly above the carrier's), tilted, legs dangling, hands at waist level.
- Points far from a card's centre swing back in depth (the card faces the camera): props drawn at the card edge can sink into nearby
  geometry. Place loose props with onCard at the same canvas point (small fwd) so drawn tip and prop meet.
- 940 frames at 2K = 4 chunks x ~40 min with jobs=1. To redo one chunk, delete its seg_*.mp4(.done) + status.txt and rerun final.sh.
