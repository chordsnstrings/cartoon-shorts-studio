// "The Tower That Caught a Spaceship" (Starship Flight 15, 13-14 Nov 2026): timeline timed to ~/day/catch/voice/words.json
// (ElevenLabs George, 33.9 s). Places in one scene graph: SPACE at the origin (cartoon Earth below), the launch PAD (x + 1000:
// launch mount, tower with two catch arms, viewing fence) and the SEA sky (x + 1400: open Gulf for the return and the booster).
// Camera grammar from the bridge short: smootherstep glides, hard cuts on big jumps, every hold creeps in, impact kicks flip
// sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1030;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const PAD = 1000, SEA = 1400;
export const EARTH_R = 120, EARTH_Y = -128;

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  giant: 0.48, caught: 1.5, spaceship: 1.94, chopsticks: 3.04,
  friday: 4.2, spacex: 5.46, blasted: 6.52, texas: 7.56, forty: 8.54, rocket: 9.68,
  top: 10.36, going: 11.16, fourteen: 12.02, earth: 13.3, hours: 14.44,
  then: 15.16, home: 15.68, flipped: 16.4, lit: 17.54, three: 17.82, engines: 18.2,
  and: 19.1, arms: 19.92, snapped: 20.28, shut: 20.82, caughtB: 21.78, first: 22.52, ever: 22.82,
  booster: 23.92, part: 24.84, before: 25.5, low: 26.4, fuel: 26.76, blew: 27.68, sea: 28.52,
  would: 29.3, stand: 29.6, chopsticks2: 30.42, send: 31.6, friend: 32.24, drops: 32.74, everything: 32.96,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- the pad layout ----------------
/** rocket axis on the launch mount */
export const AXIS: V3 = [PAD, 0, -70];
export const MOUNT_Y = 18; // booster base on the launch ring
export const SHIP_R = 4.5, SHIP_H = 40, BOOST_H = 56;
export const TOWER_X = PAD + 15; // tower centre (8 x 8 m), its face toward the rocket at x = TOWER_X - 4
export const TOWER_H = 96;
export const ARM_Y = 70; // top of the catch arms
export const PIN_Y = 33; // catch pins on the ship (local height)
export const CATCH_Y = ARM_Y - PIN_Y; // ship base height when caught
export const ARM_Z = 5.4; // arm inner faces at z = AXIS z +- ARM_Z when closed
export const VIEW: V3 = [PAD - 28, 0, 16]; // the viewing spot behind the fence
export const C1: V3 = [PAD - 25.4, 0.6, 20.6]; // hook camera, low behind the fence line
export const HERO_AT: V3 = [PAD - 25.08, 0, 18.19], BUD_AT: V3 = [PAD - 23.9, 0, 17.49]; // 2.4 / 3.4 m along the hook view, left / right
export const FOOT: V3 = [PAD - 33, 0, -28]; // the end: on the pad apron ~53 m from the tower, ship held above

/** arm opening 0 (closed) .. 1 (open) */
export const armOpen = (t: number, id: number) => {
  if (id === 1) return 1 - smooth((t - 0.95) / 0.5);
  if (id === 9) return 1 - smooth((t - (W.snapped - 0.05)) / 0.5);
  if (id === 2 || id === 3 || id === 4) return 1;
  return 0;
};
/** ship base height on the pad during a catch shot (descending at ~9 m/s, stops on the arms with a little bounce) */
export const shipCatchY = (t: number, id: number) => {
  const tc = id === 1 ? W.caught : W.shut;
  if (t < tc) return CATCH_Y + 9 * (tc - t) - 0.6 * Math.max(0, 1 - (tc - t) / 0.4);
  const d = t - tc;
  return CATCH_Y - 0.5 * Math.exp(-d * 5) * Math.sin(d * 18);
};
/** liftoff: stack climbs from the mount (t seconds) */
export const liftY = (t: number) => { const d = Math.max(0, t - W.blasted); return 1.4 * d * d + 0.8 * d; };

// ---------------- the shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "space" | "pad" | "sea";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(2.85), light: "day", place: "pad", sunAz: 120, sunEl: 40 }, // hook: the arms close on the ship
  { id: 2, a: F(2.85), b: F(4.0), light: "day", place: "pad", sunAz: 110, sunEl: 40 }, // "with chopsticks!" - the friend's chopsticks
  { id: 3, a: F(4.0), b: F(6.4), light: "golden", place: "pad", sunAz: 140, sunEl: 8 }, // Friday evening: the stack on the mount
  { id: 4, a: F(6.4), b: F(10.33), light: "golden", place: "pad", sunAz: 140, sunEl: 8 }, // blasted off / forty-one stories
  { id: 5, a: F(10.33), b: F(12.0), light: "space", place: "space", sunAz: 120, sunEl: 25 }, // the top half kept going
  { id: 6, a: F(12.0), b: F(15.0), light: "space", place: "space", sunAz: 100, sunEl: 20 }, // fourteen laps
  { id: 7, a: F(15.0), b: F(16.35), light: "day", place: "sea", sunAz: 120, sunEl: 35 }, // came home: belly flop
  { id: 8, a: F(16.35), b: F(19.17), light: "day", place: "sea", sunAz: 120, sunEl: 35 }, // flipped, lit three engines
  { id: 9, a: F(19.17), b: F(21.7), light: "day", place: "pad", sunAz: 120, sunEl: 40 }, // the arms snap shut
  { id: 10, a: F(21.7), b: F(23.75), light: "day", place: "pad", sunAz: 110, sunEl: 40 }, // Caught! A first, ever.
  { id: 11, a: F(23.75), b: F(28.65), light: "golden", place: "sea", sunAz: 150, sunEl: 8 }, // the booster, low on fuel, boom
  { id: 12, a: F(28.65), b: TOTAL, light: "day", place: "pad", sunAz: 125, sunEl: 40 }, // would you stand under there?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.0);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- moving vehicles (pure functions of shot + film time) ----------------
/** a vehicle pose: base position (bottom centre), euler (x, y, z), flames on/off */
export type Pose = { p: V3; r: V3; vis: boolean; s?: number };
/** the ship's pose for shot id at time t */
export const shipPose = (id: number, t: number): Pose => {
  if (id === 1 || id === 9) return { p: [AXIS[0], shipCatchY(t, id), AXIS[2]], r: [0, 0, 0], vis: true };
  if (id === 10 || id === 12 || id === 2) return { p: [AXIS[0], CATCH_Y, AXIS[2]], r: [0, 0, 0], vis: true };
  if (id === 3 || id === 4) return { p: [AXIS[0], MOUNT_Y + BOOST_H + liftY(t), AXIS[2]], r: [0, 0, 0], vis: true };
  if (id === 5) { // coasting along +x (nose forward); after separation the ship pulls ahead
    const d = Math.max(0, t - (W.top + 0.15));
    return { p: [-30 + 6 * (t - 10.33) + 0.5 + 10 * d * d, 40, 0], r: [0, 0, -Math.PI / 2], vis: true };
  }
  if (id === 6) { // laps around the Earth (drawn 2.4x for the wide)
    const a = lapAng(t), R = 156;
    const [x, y, z] = lapPt(a, R);
    const [x2, y2, z2] = lapPt(a + 0.02, R);
    const yaw = Math.atan2(-(z2 - z), x2 - x), pit = Math.atan2(y2 - y, Math.hypot(x2 - x, z2 - z));
    return { p: [x, y, z], r: [0, yaw, -Math.PI / 2 + pit], vis: true, s: 2.4 };
  }
  if (id === 7) { // belly flop: falling, horizontal, nose toward -x... sliding across the frame
    const u = t - 15.0;
    return { p: [SEA + 24 - 7 * u, 260 - 16 * u, -40], r: [0.12 * Math.sin(u * 2), 0, Math.PI / 2], vis: true }; // heat shield (local -x) down, nose -x
  }
  if (id === 8) { // flip: horizontal -> upright between "flipped" and +0.7 s, then a slow powered descent
    const u = t - W.flipped, k = smooth(u / 0.7);
    return { p: [SEA + 14, 239 - 14 * u + 3 * k, -40], r: [0, 0, (Math.PI / 2) * (1 - k)], vis: true };
  }
  return { p: [0, -999, 0], r: [0, 0, 0], vis: false };
};
/** booster pose */
export const boostPose = (id: number, t: number): Pose => {
  if (id === 3 || id === 4) return { p: [AXIS[0], MOUNT_Y + liftY(t), AXIS[2]], r: [0, 0, 0], vis: true };
  if (id === 5) {
    const d = Math.max(0, t - (W.top + 0.15));
    return { p: [-30 - BOOST_H + 6 * (t - 10.33) - 4 * d, 40 - 1.5 * d * d, 0.6 * d], r: [0.05 * d, 0, -Math.PI / 2 - 0.12 * d], vis: true };
  }
  if (id === 11) { // descending tail-first over the Gulf, slowing; then it stops (boom)
    const u = t - 23.75;
    const tip = smooth((t - (W.blew - 0.9)) / 0.85) * 0.5; // it tips over sideways just before the boom
    return { p: [SEA, 70 - 17.5 * u + 0.6 * u * u, -60], r: [0, 0.3, 0.06 + tip], vis: t < W.blew - LEADS };
  }
  return { p: [0, -999, 0], r: [0, 0, 0], vis: false };
};
/** which ship engines burn: 0 none, 3 = the three landing engines (count lights one by one in shot 8), 6 = all */
export const shipFlames = (id: number, t: number) => {
  if (id === 1 || id === 9) return t < (id === 1 ? W.caught : W.shut) + 0.15 ? 3 : 0;
  if (id === 5) return at(t, W.top + 0.3) ? 6 : 0;
  if (id === 6) return 0;
  if (id === 8) return at(t, W.engines) ? 3 : at(t, W.three) ? 2 : at(t, W.lit) ? 1 : 0;
  return 0;
};
/** booster flame size 0..1 (0 = off) */
export const boostFlame = (id: number, t: number) => {
  if (id === 3 || id === 4) return at(t, W.blasted) ? 1 : 0;
  if (id === 5) return t < W.top + 0.15 ? 1 : 0;
  if (id === 11) { // landing burn sputters on "low on fuel", then cuts
    if (t < W.low - LEADS) return 0.45;
    if (t > W.blew - 0.35) return 0;
    return Math.floor(t * 15) % 3 === 0 ? 0 : 0.3 * (1 - (t - W.low) / 1.4);
  }
  return 0;
};
/** lap angle around the Earth (shot 6): ~2.6 laps on screen */
export const lapAng = (t: number) => -0.6 + (t - 12.0) * 5.6;
export const LAP_TILT = 0.42;
export const lapPt = (a: number, R: number): V3 => {
  const x = R * Math.cos(a), z0 = R * Math.sin(a);
  return [x, EARTH_Y + z0 * Math.sin(LAP_TILT), z0 * Math.cos(LAP_TILT)];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const glide5 = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const glide = glide5;
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const add = (a: V3, x: number, y: number, z: number): V3 => [a[0] + x, a[1] + y, a[2] + z];
/** look point d metres from pos toward a far target (pushK creeps along pos->look, so keep look points near) */
const aim = (pos: V3, target: V3, d = 9): V3 => { const v = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]], L = Math.hypot(...v); return [pos[0] + (v[0] / L) * d, pos[1] + (v[1] / L) * d, pos[2] + (v[2] / L) * d]; };

const CAMS: Record<number, Key[]> = {
  1: [ // low behind the two friends, looking up at the ship sinking into the arms
    { f: 0, s: (f) => dolly(C1, aim(C1, [AXIS[0] + 1, 64, AXIS[2]], 5), pushK(f, 0, 0.0015), { fov: 58, roll: 0.035 }) },
  ],
  2: [ // CU: the friend snaps his chopsticks shut on a dumpling
    { f: F(2.85), s: (f) => dolly(add(BUD_AT, 0.9, 1.45, 2.3), add(BUD_AT, 0.25, 1.22, 0), pushK(f, F(2.85), 0.003, 0.007, 25), { fov: 40, roll: -0.04 }) },
  ],
  3: [ // golden wide: the full stack on the mount, the friends' silhouettes at the fence
    { f: F(4.0), s: (f) => dolly([PAD - 40, 2, 80], aim([PAD - 40, 2, 80], [AXIS[0], 55, AXIS[2]], 30), pushK(f, F(4.0), 0.002), { fov: 50, roll: -0.02 }) },
  ],
  4: [
    { f: F(6.4), s: (f) => dolly([AXIS[0] - 46, 3, AXIS[2] + 60], [AXIS[0], 34, AXIS[2]], pushK(f, F(6.4), 0.0015), { fov: 50, roll: 0.03 }) }, // liftoff
    { f: F(6.9), dur: 40, s: (f) => { const y = liftY(f / FPS); return dolly([AXIS[0] - 46, 3, AXIS[2] + 60], [AXIS[0], 40 + y * 0.8, AXIS[2]], 1, { fov: 52, roll: 0.03 }); } },
    { f: F(8.45), cut: true, s: (f) => { const y = liftY(f / FPS); return dolly(add(HERO_AT, -0.32, 0.6, 2.6), [AXIS[0] - 6, 70 + y * 0.55, AXIS[2]], 1, { fov: 54, roll: -0.05 }); } }, // forty-one stories: hero cranes her neck
  ],
  5: [ // space: the stack coasting over the limb; the booster falls away
    { f: F(10.33), s: (f) => dolly([-12, 52, 150], [-12, 36, 0], pushK(f, F(10.33), 0.002), { fov: 44, roll: -0.04 }) },
  ],
  6: [ // the whole Earth: the ship laps it, leaving rings
    { f: F(12.0), s: (f) => dolly([110, EARTH_Y + 190, 780], [0, EARTH_Y + 4, 0], pushK(f, F(12.0), 0.0012), { fov: 44, roll: 0.03 }) },
  ],
  7: [ // falling belly-first: the camera falls with it
    { f: F(15.0), s: (f) => { const p = shipPose(7, f / FPS).p; return { pos: [p[0] - 46, p[1] + 12, p[2] + 95], look: [p[0] - 20, p[1] - 2, p[2]], fov: 46, roll: 0.06 }; } },
  ],
  8: [ // flip + three engines: close under the tail
    { f: F(16.35), s: (f) => { const p = shipPose(8, f / FPS).p; return { pos: [p[0] + 28, p[1] + 6, p[2] + 64], look: [p[0], p[1] + 14, p[2]], fov: 46, roll: -0.04 }; } },
    { f: F(17.35), dur: 26, s: (f) => { const p = shipPose(8, f / FPS).p; const k = pushK(f, F(17.35), 0.002); return { pos: [p[0] + 13 * k, p[1] - 9 * k, p[2] + 30 * k], look: [p[0], p[1] + 2, p[2]], fov: 44, roll: 0.03 }; } },
  ],
  9: [ // the catch, side-on wide: arms swing shut on "snapped shut"
    { f: F(19.17), s: (f) => dolly([AXIS[0] - 24, 40, AXIS[2] + 110], [AXIS[0] + 2, 60, AXIS[2]], pushK(f, F(19.17), 0.0012), { fov: 42, roll: 0.03 }) },
    { f: F(20.2), dur: 18, s: (f) => dolly([AXIS[0] - 22, 50, AXIS[2] + 96], [AXIS[0] + 2, 60, AXIS[2]], pushK(f, F(20.2), 0.0015, 0.006, 25), { fov: 42, roll: -0.03 }) },
  ],
  10: [ // the friends cheer at the fence
    { f: F(21.7), s: (f) => dolly(add(C1, -0.675, 0.9, 2.41), aim(add(C1, -0.675, 0.9, 2.41), [C1[0] + 0.27 * 30, 10.5, C1[2] - 0.963 * 30], 6), pushK(f, F(21.7), 0.0015, 0.004, 25), { fov: 44, roll: 0.04 }) },
  ],
  11: [ // golden, over the Gulf: the booster sinks, sputters, boom
    { f: F(23.75), s: (f) => { const p = boostPose(11, Math.min(f / FPS, W.blew - 0.1)).p; return dolly([SEA - 50, 34, -60 + 130], [SEA, p[1] + 24, -60], pushK(f, F(23.75), 0.0012), { fov: 44, roll: -0.03 }); } },
    { f: F(26.2), dur: 20, s: (f) => { const p = boostPose(11, Math.min(f / FPS, W.blew - 0.1)).p; return dolly([SEA - 40, 22, -60 + 105], [SEA, Math.max(14, p[1] + 20), -60], pushK(f, F(26.2), 0.002), { fov: 44, roll: 0.03 }); } },
  ],
  12: [ // the end: at the foot of the tower, looking up past her to the ship in the arms
    { f: F(28.65), s: (f) => dolly(add(FOOT, -2.23, 1.0, 3.33), aim(add(FOOT, -2.23, 1.0, 3.33), [AXIS[0], 19, AXIS[2]], 6), pushK(f, F(28.65), 0.002), { fov: 52, roll: 0.03 }) },
    { f: F(29.55), cut: true, s: (f) => dolly([AXIS[0] - 12, 48, AXIS[2] + 125], [AXIS[0] + 3, 57, AXIS[2]], pushK(f, F(29.55), 0.0012), { fov: 40, roll: 0 }) }, // the ship held by the arms, calm and level
    { f: F(31.45), cut: true, s: (f) => dolly(add(FOOT, -2.5, 1.4, 4.7), add(FOOT, 0.5, 1.1, 0.4), pushK(f, F(31.45), 0.0025), { fov: 50, roll: 0.03 }) }, // back down: send this
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.caught, 0.9], [W.chopsticks, 0.5], [W.blasted, 1.3], [W.flipped, 0.6], [W.shut, 1.0], [W.caughtB, 0.6], [W.blew, 1.0], [W.drops, 0.4],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  const d = t - W.blasted; // launch rumble
  if (d > 0 && d < 3.6) a += 0.3 * (Math.floor(t * FPS) % 2 ? -1 : 1) * (1 - d / 3.6);
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: F(2.85), cInf: 13, focus: () => add(BUD_AT, 0, 1.45, 0) },
  { f: F(4.0), cInf: 0 },
  { f: F(8.45), cInf: 0 },
  { f: F(10.33), cInf: 0 },
  { f: F(15.0), cInf: 0 },
  { f: F(19.17), cInf: 0 },
  { f: F(21.7), cInf: 8, focus: () => add(HERO_AT, 0, 1.5, 0) },
  { f: F(23.75), cInf: 0 },
  { f: F(28.65), cInf: 9, focus: () => add(FOOT, 0, 1.6, 0) },
  { f: F(29.55), cInf: 0 },
  { f: F(31.45), cInf: 11, focus: () => add(FOOT, 0, 1.5, 0) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
