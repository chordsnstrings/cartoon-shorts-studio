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

## Gotchas (from the butter short)
- ElevenLabs can run out of quota (401 `quota_exceeded`, not a rotated key): fall back to free local Kokoro (`pipeline/voice/kokoro_voice.py
  lines.json <day>/voice bm_george 1.1`, model files in /root/tts from the kokoro-onnx GitHub release, then `align.py` for words.json) and a
  synthesized score (copy `stories/butter/music_butter.py`); push-notify the owner to top up. Higgsfield credits are not needed for TikTok prep.
- Portrait framing of a bench: a camera level with the bench sees mostly the bench skirt. Look down at ~1.2 m with fov 31-38.
- Small white-tipped hand props read as cigarettes; smoke puffs near a laughing mouth read as smoking. Chunky props, smoke to the side.
- Hook text must be gone before the white flash frame (HOOK_END = FLASH_AT - 8).

## Gotchas (from the drone short)
- A small 3D hero prop (the drone) reads at phone size only at ~0.5 m across within ~3 m of the lens; scale it per shot (1.3-2.6) rather than
  building it life-size. In a CU of a character, keep any prop/fx >= 150 px (1080) clear of the head or it reads as poking/stabbing.
- Projection check for "X finds Y" shots: a prop on nearly the same camera ray as a face sits ON the face. Keep the angle between them >= 10 deg.
- Wall-mounted boxes (cupboards) read as floating TVs/billboards at night; drop them from night shots.
- Diagonal red "no" slashes near a hand read as a stick/weapon; keep icons clear of hands.
- A camera that should follow a fast prop: compute the look target from droneAt(id, t) inside the CAMS key (mix 0.88 prop / 0.12 subject).
- ElevenLabs had quota again on 2026-11-10 (voice + music_v1 plan both fine); `user/subscription` needs a permission the key lacks - just try TTS.

## Gotchas (from the kei short)
- Vehicles: build cabs with open window frames (no glass) so a seated driver card reads; seat the card ~0.5 m (sit-mode hip) and keep the
  face in the window band (y 1.1-1.75). A waving hand above ~1.7 m hides under the roof.
- Golden BACKLIGHT turns a pale body colour into the violet shade colour (mint read as a blue truck = "a different vehicle"): for a hero
  vehicle at sunset put the sun to the side (sunAz ~160) so its faces stay warm-lit.
- Right/left-hand-drive beats only read from BEHIND the vehicle (screen right = vehicle right); front views mirror it.
- A covered object under a dust sheet reads as a ghost unless its wheels/bumper peek out: lift the sheet ~0.35 m.
- Soft white puffs on a dark stage read as bokeh/balloons; dust needs grey-brown opaque blobs. Wavy "air" lines at chin height read as smoke/breath.
- Cars passing behind a hero prop are only on screen ~1 s at 20 m/s: aim the camera along the road and schedule one car per second.
- A steering wheel beside a seated driver card crosses the cheek in side close-ups (reads as a hand/phone at the face): mount it low and flat
  (rim top below the chin, ~1.15 m) and keep it on the card's own z so the card covers it.

## Gotchas (from the catch short)
- `pipeline/voice/align.py voice.wav words.json` OVERWRITES words.json with whisper's words ("41", misspellings): copy words.json first, or
  merge whisper timings back onto the script words (word counts matched 83/83).
- pushK creeps along pos->look: a far look target (the tower 90 m away) flew the camera 5-10 m through the foreground cast. Use story.ts
  `aim(pos, target, d)` (look point 5-9 m out) in every shot with near characters.
- Front cards can't face away: for "watching something" put the cast 2-4 m in front of the lens along the view ray, facing +-1, look/headTilt up.
- Big vehicles + people in one portrait frame: lens ~0.6 m high, cast at 2.4-3.4 m, target 90 m out, fov 58 -> faces in the lower third, the
  event in the middle; hook text stays clear above it.
- Verifier flags: an impact star where an arm meets a ship = "hit"; a tilted low angle of a ship + tower = disaster echo (use a calm level
  wide); a dark smoke blob = real explosion (cartoon poof + sparkles + cream puffs over visible water); grid fins read as solar panels unless small/dark.
- A 1030-frame space/sky short rendered in ~50 min (4 chunks, jobs=1) - big empty skies are cheap.

## Gotchas (from the awards short)
- Long tool sleeps (>~9 min) can get the whole session's processes killed, setsid render included: poll with `sleep 290` and restart
  final.sh if `pgrep -fa final.sh` is empty (it resumes from .done chunks; a killed chunk restarts from frame 0 of that chunk).
- Higgsfield upload_url signs `if-none-match`: the curl PUT needs `-H "If-None-Match: *"` as well as Content-Type.
- A handheld mic near the face + an arm looping up past the neck read as "clutching her throat": hold props out at chest height.
- Wide portrait shots of a 16:9 stage screen leave the lower half as empty floor: fill it with audience-head cards or go low (y ~1.1).
- Theatre look: redefine the `night` preset as a show light (warm key, violet shade) instead of adding a new light name (grade/cast use the names).

## Gotchas (from the outage short)
- A pop-up "X" icon placed on a 3D prop (card reader) can line up with a face behind it from the shot camera: anchor reaction icons to the
  held phone card (phoneAt() returns its world point) or check the projection against every head.
- Horizontal half-width of a portrait frame is small (fov 42 at 3.5 m = +-0.78 m): fx drifting "up and away" sideways leave the frame in
  half a second; drift mostly up.
- Small props on a display table hide behind the display phones on their stands: put hero props in the gaps between PHONE_SPOTS.
- Shared stills + final render on 2 CPUs: run stills before starting final.sh (each still ~10 s after a ~2 min bundle).
- Cartoon 'poof' clouds over machines (server racks) read as smoke/fire to the verifier: use sparks + red LEDs only.

## Gotchas (from the trolley short)
- Golden light turns a WHITE hero car violet whenever the sun is behind it: white vehicles -> "day" light (sunAz ~115) for every shot.
- quad() normals follow (b-a)x(d-a): a single-sided pane (rear glass) built in the wrong order is invisible from outside; set DoubleSide on glass.
- Random dark crack strokes on road textures read as garbled/mirrored letters to the verifier: no squiggles on asphalt.
- A gate arm pushed by a car: compute the swing from the car's NEAR corner, not its centre line, or the arm clips through the body.
- Portrait framing with characters + a car: raise the lens (~3 m) and put the cast 2-3 m in front of it so faces sit in the lower third and
  the car in the middle; at eye height the cast covers the car. Near-side buildings start at z 4.5: keep cameras out of them (all-violet frame).
- A long tool sleep plus a session restart killed the setsid render: just rerun final.sh (it resumes from .done chunks).

## Gotchas (from the glitch short)
- Bash tool calls time out at 2 min by default: start stills/renders with `setsid nohup ... &` and poll with an explicit timeout.
- A camera above a sidewalk at roof height sits INSIDE the near blocks (z 4.5..18.5): put high establishing cameras over the road (z ~ -3).
- A character sinking into the ground: a lone head on asphalt reads as a severed head. Stop at the shoulders with arms flailing up out of a
  dark crack ring (flat fx decal), then drop out of sight in 0.15 s.
- A small boat seen from a quay at eye height is just a cabin roof: give it a coloured hull + mast/flag and look down from ~4.5 m.
- Thin dark firework rays read as cracks/spiders: big multicolour dot bursts at 17 m card size, low over the street (y 16-24).
- faster-whisper's av can't open our wavs (metadata_errors TypeError): load with soundfile, resample to 16 kHz, pass the array.

## Gotchas (from the mirror short)
- Shop fronts / building faces at z +-4: a street camera must stay at |z| < ~3.7 or it sits behind the front (whole frame = plywood/wall).
- Portrait half-width is tiny: at fov 46 a card 3-4 m off the view axis at 6 m depth is out of frame. Place side characters by
  `cam + fwd*depth + right*lateral` with lateral/depth <= ~0.15 (fov 46) instead of guessing world x/z; check with a still.
- Two characters on nearly the same camera ray read as one (yellow body under a white head): split them left/right of the hero.
- Props pinned on a facade (note, frame) beat props held at the hands: a frame held at chest height covered the face.
- eleven_v3 at SPEED 1.1 runs ~2.65 words/s including pauses: budget <= 90 words for a 33-34 s short (110 words came out 41.5 s).
- Glyph "weird address" signs: zigzags read as W/M, keyholes as i: use spirals, stars, hearts, dot clusters, rings, triangles only.
- The mousetrap emoji (U+1FAA4) renders as a brown blob at hook-text size; prefer common emoji.

## Gotchas (from the reality short)
- Interior shots of makeRobo: the lower body is a SOLID box (top at y 0.98), so the cabin is a flat deck; a camera behind the rear bench
  (x < -0.9) sits inside the bench back (whole lower frame one colour). Ride at x ~ -0.7, y ~ 1.22, between the seats (z ~ 0.1), fov 62-68.
- Raised-arm `reach` targets on SEATED cards draw long arcs past the head: verifier read them as a strap round the neck. No raised arms in cars.
- Speed-camera / box props need a face card nudged off the box toward the camera (the lens faces traffic, the camera sees the back).
- A pothole with a blue puddle reads as an eye; a red box with two reels reads as a gift box: give a hero prop its defining feature (lens, rim).
- Portrait insert of a landscape touchscreen: keep the key content (our car) at u 0.55-0.65, and keep pushK small or it slides off frame.

## Gotchas (from the mercury short)
- Planet-scale scenes: a sphere's limb sits acos(R/(R+h)) below the horizon. With the camera ~5 m above a 40 m planet the planet is out of
  frame; use R ~120 with the hero ~4 m above the surface, and cartoon-scale the probe card (scale ~22) for the whole-planet wides.
- Orbits in portrait: make them polar (plane contains y) and open the plane ~30 deg toward the lens, so rings read as tall ellipses that fit.
- A lone hero card in front of a planet's horizon reads as "sitting on the ground" (verifier: crash-landing): frame it against stars.
- Grey cratered sphere with bright ray craters reads as the Moon; striped cream sphere reads as Jupiter: warm Mercury, soft Venus.
- The drawn satellite (sat.ts) works as any spacecraft character: `nozzle` + `chips: -1` options; flame = a camera-facing fx card below
  the nozzle exit (design y 826).
- Space + one small room render fast: 1000 frames at 2K = 4 chunks x ~10 min (jobs=1).

## Gotchas (from the delivery short)
- Yard reuse: `studio/src/videos/delivery` has `buildYard` (houses, detached garage, poles, live windows), a big delivery hexacopter (drone3d.ts)
  and live hanging cables (world.ts `Cable`, snag/wobble). Utility poles stand on the sidewalk (z 8.4): lawn cameras at z < 8 or a pole fills the frame.
- A hook camera aimed at a far target with pushK creeps ~1 m toward the near character (head crop by 3 s): aim the look point ~4 m out.
- Two-shots in portrait: place the cast with story.ts `placeAt(pos, look, fov, depth, nx)` (nx ±0.5) instead of world guesses; a camera that
  follows a moving prop slides the cast off-frame, so mix the prop into the look by <= 0.25.
- Verifier reads: a zig-zag bulb filament = the letter "M"; a ribbon cross + bow = a wrapped present (gift card = flat card, chip + star);
  lit windows need a warm emissive >= 1.5 to read "on" in daylight, "off" = near-black glass.
- Exterior yard at 2K: ~15 min per 262-frame chunk (jobs=1).

## Gotchas (from the million short)
- Night-sky reuse: `studio/src/videos/million` has `buildHill` (hilltop + 3D telescope), satellite trains (`skyTrains`, HDR fx cards rotated
  to screen motion: pass `up`/`fwd` in CamInfo), an eyepiece view (ring card 0.6 m in front of the lens: size the hole to the frame WIDTH,
  a hole bigger than the frame is invisible), an instanced Earth swarm (`swarmN`) and `earthHD`.
- A planet's additive atmosphere shell must stay below the hero's altitude, or a CU fills with pale blue (hero 11 m above a 120 m Earth, shell 1.03 R).
- Seated cards: `reach` targets sit much lower than for standing ones (y ~745 = chest out wide). y 560-650 put the hands at/above the head:
  read as "hooray" or "hands on head", not a shrug.
- Grey hair over a bald-looking forehead + a grey moustache read as a blindfold + gag: give older characters dark/solid hair, no moustache.
- A seated character under a wall screen: a camera ~1.9 m high looking slightly down keeps his head below the screen content; a low lens
  stacks the head over the screen centre and shows a lavender floor.
- ElevenLabs music plan sections are min 3 s: merge or stretch shorter beats before sending.
- Space + night hill + one room: ~5-8 min per 233-frame chunk at 2K (jobs=1).
