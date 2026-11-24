# Delivery short - working notes (2026-11-25 run)
- Code: studio/src/videos/delivery (composition DeliveryShort, 1080x1920, 30 fps, 1047 f = 34.9 s). Base: drone (post chain, toon, cast core,
  droneAt/path helpers). New reusable pieces:
  - build.ts `buildYard`: suburban yard (two-storey house with facadeHD, detached gable garage with a painted sectional door, neighbour house
    with live windows B_WINDOWS, houses behind + across the street, sidewalk/curb/road, two utility poles with crossarms + transformer,
    driveway, bushes, trees, mailbox). `house()` = gable-roofed box with a facade texture.
  - drone3d.ts: big generic delivery hexacopter (white capsule fuselage + blue stripe, hex frame, 6 shrouded rotors with blur discs, skids,
    parcel under the belly `box`, broken rotor `lost` with a bent stub, nose LED "eyes").
  - world.ts `Cable` + `cablePts`: live hanging lines (catenary, wobble after a clip, `via` point = snagged by the drone).
  - story.ts `placeAt(pos, look, fov, depth, nx)`: put a character at a given depth and screen-x of a portrait frame (fixes two-shot overlaps).
  - story.ts `spline` (Catmull-Rom, no stop at keys) + `sick()` wobble (roll/dip "flapping") + `fall()` onto a roof with settle.
  - dfx.ts: order app on a phone (drone icon + countdown ring), shampoo bottle, two-blade propeller, light bulb on/off, gift card (flat
    card with chip + star), clipboard, magnifier, question mark, check pip, zig-zag spark.
- Opus verifier round 1 (hook 7, readability 6, composition 6, look 8) -> fixed: shot 3 reframed so the drone stays whole, buyer removed from
  the low-angle cable shot (forehead crop), propeller 1.5x bigger, windows warmer when lit / near-black when off, bulb filament no longer
  reads as "M", inspector moved off the drone, gift card flattened (no ribbon cross = present), stray parcel removed from the ending,
  intact delivery drone with a parcel crossing the sky in the ending, hook drone lowered under the text.
- Audio: ElevenLabs George (eleven_v3, SPEED 1.1) 34.8 s; ElevenLabs music_v1 composition plan (plan.json, 6 sections);
  mix_delivery.py (flapping wounded rotor = rotor() with |sin| amplitude, zaps, crash = thump + clunk + clatter + spin-down, app ding,
  parcel thump, cable twang, propeller pop + whoosh, power clunk + down-sweep, fast clock + ladder creaks, coins, pops).
- Render: scripts/final.sh DeliveryShort delivery 1047 4 1 (~7 min per 262-frame chunk: the yard renders fast).
