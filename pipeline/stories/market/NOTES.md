# Market short - working notes (2026-11-27 Dubai run / 11-26 UTC)
- Code: studio/src/videos/market (composition MarketShort, 1080x1920, 30 fps, 1008 f = 33.6 s). Base: delivery (post chain, toon, cast core).
- New reusable pieces: build.ts `buildHall` (big bare warehouse: concrete floor slabs, block plinth + corrugated walls, roof underside,
  steel portal frames, fluorescent tubes, strip windows, roller door, pallets) and `buildDream` (snowy twilight plaza, houses with warm
  windows, snow-capped pines, a giant stacked-cone tree); `hut()` = a wooden market chalet usable bare (pale wood, dim inside, jars)
  or dream (snow on the roof, lit inside panel); world.ts roll-down shutters per hut (`shutterAt`), fairy-light garlands + tree baubles
  as one instanced HDR bulb mesh with twinkle, falling snow as Points, the AI banner = a real Seedream image on the back wall
  (public/market/poster.jpg, loaded with delayRender before the canvas mounts - not committed: regenerate with modelark if needed).
- Drips: cartoon drip law in story.ts (`dropY`: leaves the roof from rest, lands at 6.5 m/s under g = 3) so drops stay on screen ~2 s;
  each bucket has (period, hit) so a hero splash can land on a word; mix_market.py mirrors the same table for the plinks.
- mfx.ts: water drop, thought bubble that fills with hut icons / little people, counting star, glitch pixel, AI chip, head splat.
- Opus verifier round 1 (hook 7, dream 9, look 8) -> fixed: crown splash inside a bucket read as teeth (now 3 jumping droplets + ring);
  thought bubble cropped (re-aimed); count stars too small (1.45 m); drips not visible (camera back + higher aim); shutters small (camera
  into the aisle, fov 54, bigger pows); head splat read as an ice pack + spiral eyes = injury (transient splat, deadpan face); banner
  clipped in the end shot (re-aimed). Earlier self-checks: a reacting trader always lined up with a far pow star (read as a hit) -> dropped
  from the shutter shot; shrug ticks read as extra limbs -> removed; snow points near the crane lens became a giant disc -> volume kept
  >= 2 m ahead of the camera; a bucket between the organiser's legs read as him standing in it -> moved him.
- Audio: ElevenLabs George (eleven_v3, SPEED 1.12) 33.2 s, whisper check clean (2 timing fixes: "Buckets." start, "Send" start);
  ElevenLabs music_v1 composition plan (plan.json, 9 sections); mix_market.py (shed room tone + tube hum, drip plinks matched to the
  picture, BIG plink on "Buckets", sleigh bells, sparkle, cheer, bubble pop, hut ticks, fifty ding, count pings, glitch static + zaps,
  chip power-up, 3 shutter rattles + clangs, shrug boing, head plink + splat, question pop, send chime).
