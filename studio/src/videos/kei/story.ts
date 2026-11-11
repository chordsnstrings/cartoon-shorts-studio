// "The New Pickup That Tops Out at 25 mph": timeline timed to pipeline/stories/kei/words.json (ElevenLabs George, 34.8 s).
// Two places in one scene graph: the country ROAD (x 0: main road along x at z -6..0, a side road at x CROSS, a muddy mound,
// farm houses) and the SHOWROOM (x + 400: dark storage stage where the brand is revived).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1060;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const ROAD = 0, SHOW = 400;

// ---------------- story beats (film seconds, from words.json, cross-checked with whisper) ----------------
export const W = {
  toyota: 0.7, neww: 1.38, america: 2.21, tops: 3.4, tf: 4.03, hour: 5.18, tiny: 5.97, eleven: 6.49, long: 7.42, about: 7.89, half: 8.36,
  full: 8.76, steering: 10.19, wheel: 10.67, right: 11.64, why: 12.3, slow: 12.86, at25: 13.3, tf2: 13.66, low: 15.36, vehicle: 15.93,
  so: 16.42, states: 17.31, stuck: 18.23, roads: 18.52, t35: 19.06, slower: 19.95, but: 20.65, hauls: 20.87, six: 21.2, pounds: 21.7,
  four: 22.72, drive: 23.3, and: 24.1, air: 24.34, cond: 24.57, sell: 25.48, toyota2: 26.19, revived: 26.59, brand: 27.15, killed: 27.63,
  y2016: 28.1, scion: 29.26, would: 30.51, one: 31.02, send: 31.39, friend: 32.28, drives: 32.92, way: 33.32, fast: 33.86,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** lanes of the main road (along x): near lane (traffic +x) and far lane (traffic -x, also the overtaking lane) */
export const LANE_N = -1.5, LANE_F = -4.5;
/** the side road crossing (runs along z from the main road toward +z), centre x */
export const CROSS = 120;
/** the muddy mound on the field (+z side of the road) */
export const MOUND: V3 = [-120, 0, 16];
export const MOUND_R = 4.2, MOUND_H = 1.0;
/** height of the mound at (x, z) */
export const moundY = (x: number, z: number) => { const d = Math.hypot((x - MOUND[0]) / MOUND_R, (z - MOUND[2]) / (MOUND_R * 1.4)); return d < 1 ? MOUND_H * 0.5 * (1 + Math.cos(Math.PI * d)) : 0; };

/** the kei truck: length 3.4 m (x -1.7 .. 1.7), front toward local +x; cab x 0.75..1.7; right-hand drive (driver at local +z) */
export const KEI_L = 3.4;
export const SEAT_D: V3 = [1.12, 0.53, 0.33]; // driver hip (local)
export const SEAT_P: V3 = [1.12, 0.62, -0.33]; // passenger seat (local)
/** the big full-size pickup: 5.9 m (scaled floppy truck) */
export const BIG_S = 1.3;

export type Pose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; speed: number; vis: boolean };
const P = (x: number, z: number, yaw = 0, speed = 0, y = 0, pitch = 0, roll = 0): Pose => ({ x, y, z, yaw, pitch, roll, speed, vis: true });
const HIDE: Pose = { ...P(0, 0), vis: false };
/** kei position along a road: x0 + v (t - t0) */
const keiRun1 = (t: number) => -40 + 8 * (t - 0);
const keiRun12 = (t: number) => 60 - 6.5 * (t - 30.45);
export const PARK_X = 40;
/** the kei truck pose for a shot */
export const keiPose = (id: number, t: number): Pose => {
  if (id === 1 || id === 2) return P(keiRun1(t), LANE_N, 0, 8);
  if (id === 3 || id === 4 || id === 5 || id === 6) return P(PARK_X, LANE_N, 0, 0);
  if (id === 7) return P(CROSS + 1.3, 5.2, Math.PI / 2, 0); // waiting at the stop line, facing -z (toward the main road)
  if (id === 8) { const sq = squatK(t); return P(PARK_X, LANE_N, 0, 0, -0.06 * sq); }
  if (id === 9) {
    const x = MOUND[0] - 5.4 + 4.6 * (t - 22.65), z = MOUND[2];
    const y = moundY(x, z), dy = (moundY(x + 0.9, z) - moundY(x - 0.9, z)) / 1.8;
    return P(x, z, 0, 4.6, y + 0.03 * Math.abs(Math.sin(t * 14)), -Math.atan(dy) * 0.95, 0.03 * Math.sin(t * 9));
  }
  if (id === 10) return P(PARK_X, LANE_N, 0, 0);
  if (id === 11) return P(SHOW, 0, -0.5, 0); // on the turntable (rotates in world.ts)
  if (id === 12) return P(keiRun12(t), LANE_N, Math.PI, 6.5);
  return HIDE;
};
/** the bed squats as hay bales land (shot 8) */
export const BALES = [W.hauls + 0.05, W.six - 0.02, W.pounds - 0.12, W.pounds + 0.22];
export const baleDrop = (i: number, t: number) => clamp01((t - (BALES[i] - 0.3)) / 0.3);
export const squatK = (t: number) => { let s = 0; for (const b of BALES) { const d = t - b; if (d > 0) s += 0.25 + 0.75 * Math.exp(-d * 9) * Math.cos(d * 30); } return s; };
/** the big red pickup pose */
export const bigPose = (id: number, t: number): Pose => {
  if (id === 1) return P(keiRun1(t) - 0.6 + 12 * t, LANE_F, 0, 20); // overtakes in the far lane (already alongside at frame 0)
  if (id === 3) return P(PARK_X + 1.03, LANE_F + 0.7, 0, 0); // parked alongside, rear ends level (truck spans -2.73 .. 3.32 at scale 1.3)
  if (id === 7) return P(CROSS - 10 - 22 * (t - W.stuck), LANE_F, Math.PI, 22); // zooming past on the main road on "stuck"
  if (id === 12) return P(keiRun12(W.fast) - 1.0 + 17 * (t - W.fast), LANE_F, 0, 17); // from behind the camera, past the kei on "fast"
  return HIDE;
};
/** extra cars on the main road in the crossing shot: [x, z, yaw] */
export const trafficAt = (id: number, t: number): Pose[] => {
  if (id !== 7) return [];
  const out: Pose[] = [];
  // [time it passes x = CROSS - 10, lane, direction, speed]: one car in view behind the truck at almost every moment
  const cars: [number, number, number, number][] = [[16.5, LANE_N, 1, 20], [17.05, LANE_F, -1, 21], [17.55, LANE_N, 1, 21], [18.6, LANE_N, 1, 20],
    [19.1, LANE_F, -1, 20], [19.55, LANE_N, 1, 21], [20.1, LANE_F, -1, 21], [20.5, LANE_N, 1, 20]];
  for (const [t0, z, dir, v] of cars) { const x = CROSS - 10 + dir * v * (t - t0); if (Math.abs(x - CROSS) < 90) out.push(P(x, z, dir > 0 ? 0 : Math.PI, v)); }
  return out;
};
/** the left (passenger, local -z) door opening in shot 4: 0 shut .. 1 open */
export const doorK = (id: number, t: number) => { void id; void t; return 0; };
/** the dust sheet over the truck in the showroom: 0 on .. 1 yanked away */
export const sheetK = (t: number) => clamp01((t - (W.revived - 0.1)) / 0.5);
/** spotlights in the showroom: on at "Scion" */
export const spotsOn = (t: number) => at(t, W.scion);

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "road" | "show";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(3.3), light: "day", place: "road", sunAz: 110, sunEl: 45 }, // hook: the big pickup overtakes the tiny truck
  { id: 2, a: F(3.3), b: F(5.65), light: "day", place: "road", sunAz: 120, sunEl: 45 }, // front 3/4: tops out at 25 (dial)
  { id: 3, a: F(5.65), b: F(10.0), light: "day", place: "road", sunAz: 100, sunEl: 45 }, // parked side by side: the tape measure
  { id: 4, a: F(10.0), b: F(12.25), light: "day", place: "road", sunAz: 120, sunEl: 45 }, // steering wheel on the right
  { id: 5, a: F(12.25), b: F(14.9), light: "day", place: "road", sunAz: 110, sunEl: 45 }, // why so slow? the driver shrugs
  { id: 6, a: F(14.9), b: F(16.35), light: "day", place: "road", sunAz: 120, sunEl: 45 }, // low-speed vehicle: turtle sticker
  { id: 7, a: F(16.35), b: F(20.55), light: "day", place: "road", sunAz: 100, sunEl: 45 }, // stuck at the busy road
  { id: 8, a: F(20.55), b: F(22.65), light: "day", place: "road", sunAz: 110, sunEl: 45 }, // hay bales: 600 pounds
  { id: 9, a: F(22.65), b: F(24.0), light: "day", place: "road", sunAz: 110, sunEl: 45 }, // four-wheel drive over the mud mound
  { id: 10, a: F(24.0), b: F(25.35), light: "day", place: "road", sunAz: 110, sunEl: 45 }, // air conditioning bliss
  { id: 11, a: F(25.35), b: F(30.45), light: "indoor", place: "show", sunAz: 60, sunEl: 60 }, // the dust sheet comes off: the brand is back
  { id: 12, a: F(30.45), b: TOTAL, light: "golden", place: "road", sunAz: 160, sunEl: 11 }, // sunset: would you drive one?
];
export const XFADE: Record<number, number> = { 11: 8, 12: 10 };
export const FLASH_AT = F(5.65);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
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
const tf = (f: number) => f / FPS;
/** a point in the kei truck's frame (local x fwd, z right) for shot id at frame f */
export const keiPt = (id: number, t: number, lx: number, ly: number, lz: number): V3 => {
  const p = keiPose(id, t), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  // yaw about +y: local +x -> world (cos, -sin) in (x, z)
  return [p.x + lx * c + lz * s, p.y + ly, p.z - lx * s + lz * c];
};
const K = (id: number, lx: number, ly: number, lz: number) => (f: number) => keiPt(id, tf(f), lx, ly, lz);
const Sh = (x: number, y: number, z: number): V3 => [SHOW + x, y, z];

const CAMS: Record<number, Key[]> = {
  1: [
    // tracking alongside the tiny truck (near side, a little ahead); the big pickup roars past in the far lane
    { f: 0, s: (f) => dolly(K(1, 1.9, 1.75, 5.2)(f), K(1, 0.3, 1.45, -1.4)(f), pushK(f, 0, 0.0025), { fov: 48, roll: 0.03 }) },
    { f: F(1.5), dur: 34, s: (f) => dolly(K(1, 2.0, 1.6, 5.4)(f), K(1, 0.4, 1.45, 0)(f), pushK(f, F(1.5), 0.003, 0.006, 25), { fov: 46, roll: -0.03 }) },
  ],
  2: [
    // ahead of the truck, low, looking back at the cab: the driver behind the windscreen (on the right)
    { f: F(3.3), s: (f) => dolly(K(2, 6.4, 1.3, 2.4)(f), K(2, 0.9, 1.45, 0.05)(f), pushK(f, F(3.3), 0.003), { fov: 42, roll: -0.04 }) },
    { f: F(3.95), dur: 18, s: (f) => dolly(K(2, 5.4, 1.35, 2.0)(f), K(2, 1.0, 1.45, 0.25)(f), pushK(f, F(3.95), 0.003, 0.009, 25), { fov: 42, roll: 0.03 }) }, // "twenty-five"
  ],
  3: [
    // side-on, close on the tiny truck; the tape runs nose to tail; pull back to reveal the big one alongside
    { f: F(5.65), s: (f) => dolly([PARK_X + 0.4, 1.3, 5.2], [PARK_X + 0.2, 0.95, LANE_N], pushK(f, F(5.65), 0.003, 0.008, 25), { fov: 46, roll: 0.03 }) },
    { f: F(7.75), dur: 36, s: (f) => dolly([PARK_X + 2.3, 2.6, 11.8], [PARK_X + 2.1, 1.5, LANE_N - 1.2], pushK(f, F(7.75), 0.0022, 0.005, 25), { fov: 50, roll: -0.03 }) }, // "half a full-size pickup"
  ],
  4: [
    // behind and left of the truck: the friend opens the left door - no wheel; the driver waves from the right seat
    { f: F(10.0), s: (f) => dolly([PARK_X - 4.4, 2.3, LANE_N + 0.5], [PARK_X + 1.1, 1.3, LANE_N - 0.25], pushK(f, F(10.0), 0.003), { fov: 50, roll: 0.03 }) },
    { f: F(11.35), dur: 20, s: (f) => dolly([PARK_X - 3.5, 2.2, LANE_N + 0.35], [PARK_X + 1.2, 1.3, LANE_N - 0.3], pushK(f, F(11.35), 0.003, 0.008, 25), { fov: 48, roll: -0.03 }) }, // "on the right"
  ],
  5: [
    // close on the driver through the open right window
    { f: F(12.25), s: (f) => dolly([PARK_X + 1.75, 1.4, LANE_N + 3.3], [PARK_X + 1.12, 1.18, LANE_N + 0.33], pushK(f, F(12.25), 0.0035, 0.009, 25), { fov: 40, roll: -0.03 }) },
    { f: F(13.55), dur: 18, s: (f) => dolly([PARK_X + 1.85, 1.38, LANE_N + 2.9], [PARK_X + 1.12, 1.2, LANE_N + 0.33], pushK(f, F(13.55), 0.003, 0.009, 25), { fov: 40, roll: 0.03 }) }, // "twenty-five"
  ],
  6: [
    // low behind the tailgate: the turtle sticker slaps on
    { f: F(14.9), s: (f) => dolly([PARK_X - 4.8, 1.35, LANE_N + 0.9], [PARK_X - 1.7, 0.95, LANE_N + 0.05], pushK(f, F(14.9), 0.004, 0.01, 25), { fov: 44, roll: 0.04 }) },
  ],
  7: [
    // beside the tiny truck at the stop line, the busy main road behind it
    { f: F(16.35), s: (f) => dolly([CROSS + 5.0, 1.6, 9.2], [CROSS - 3.4, 1.0, -1.0], pushK(f, F(16.35), 0.0025), { fov: 48, roll: 0.03 }) },
    { f: F(18.0), dur: 30, s: (f) => dolly([CROSS + 4.4, 1.6, 8.4], [CROSS - 2.2, 1.05, 0.2], pushK(f, F(18.0), 0.0025, 0.006, 25), { fov: 46, roll: -0.03 }) }, // "stuck"
  ],
  8: [
    // three-quarter, a little high: bales thump into the bed, the truck squats
    { f: F(20.55), s: (f) => dolly([PARK_X + 4.6, 3.0, LANE_N + 5.4], [PARK_X - 0.2, 0.9, LANE_N], pushK(f, F(20.55), 0.003, 0.008, 25), { fov: 44, roll: -0.03 }) },
  ],
  9: [
    // low in front of the mound: the truck bounces over, mud flies
    { f: F(22.65), s: (f) => dolly([MOUND[0] + 2.6, 2.0, MOUND[2] + 6.4], [MOUND[0] - 1.2, 1.3, MOUND[2]], pushK(f, F(22.65), 0.004, 0.01, 25), { fov: 50, roll: 0.05 }) },
  ],
  10: [
    // close on the driver: cool air, bliss
    { f: F(24.0), s: (f) => dolly([PARK_X + 1.8, 1.38, LANE_N + 2.8], [PARK_X + 1.12, 1.2, LANE_N + 0.33], pushK(f, F(24.0), 0.004, 0.01, 25), { fov: 40, roll: -0.03 }) },
  ],
  11: [
    // the dusty showroom: the presenter, the sheet-covered truck; yank, dust, then the spotlights
    { f: F(25.0), s: (f) => dolly(Sh(2.0, 2.0, 9.0), Sh(0.9, 1.15, 0.4), pushK(f, F(25.0), 0.0022), { fov: 46, roll: 0.03 }) },
    { f: F(26.5), dur: 20, s: (f) => dolly(Sh(1.8, 1.8, 7.8), Sh(1.1, 1.1, 0.5), pushK(f, F(26.5), 0.0025, 0.008, 25), { fov: 46, roll: -0.03 }) }, // "revived"
    { f: F(29.1), dur: 18, s: (f) => dolly(Sh(1.5, 1.6, 7.3), Sh(1.15, 1.05, 0.5), pushK(f, F(29.1), 0.0025, 0.01, 25), { fov: 48, roll: 0.03 }) }, // "Scion"
  ],
  12: [
    // sunset: backing away ahead of the truck as it putters toward us; the red pickup flies past
    { f: F(30.0), s: (f) => dolly(K(12, 6.4, 1.6, -2.6)(f), K(12, 0.8, 1.35, -0.1)(f), pushK(f, F(30.0), 0.002), { fov: 46, roll: 0.03 }) },
    { f: F(32.6), dur: 30, s: (f) => dolly(K(12, 6.0, 1.7, -3.2)(f), K(12, 0.4, 1.4, 0.6)(f), pushK(f, F(32.6), 0.002, 0.005, 25), { fov: 50, roll: -0.03 }) }, // "drives way too fast"
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [0.45, 0.7], [W.tf, 0.8], [W.tiny, 0.8], [W.half, 0.5], [W.right, 0.6], [W.low + 0.05, 0.9], [W.stuck, 0.5],
  [BALES[0], 0.5], [BALES[1], 0.5], [BALES[2], 0.6], [BALES[3], 0.7], [W.four, 0.6], [W.drive, 0.6], [W.revived + 0.1, 0.7], [W.scion, 0.9], [W.fast, 0.6],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
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
const driverEyes = (id: number) => (f: number) => keiPt(id, tf(f), SEAT_D[0], 1.3, SEAT_D[2]);
export const DOF: Dof[] = [
  { f: 0, cInf: 6, focus: driverEyes(1) },
  { f: F(3.3), cInf: 11, focus: driverEyes(2) },
  { f: F(5.65), cInf: 10, focus: () => [PARK_X + 1.6, 1.2, LANE_N + 1.0] },
  { f: F(7.75), dur: 36, cInf: 4, focus: () => [PARK_X + 1.3, 1.2, LANE_N - 1.2] },
  { f: F(10.0), cInf: 9, focus: () => [PARK_X + 1.0, 1.25, LANE_N] },
  { f: F(12.25), cInf: 14, focus: driverEyes(5) },
  { f: F(14.9), cInf: 12, focus: () => [PARK_X - 1.75, 0.85, LANE_N] },
  { f: F(16.35), cInf: 8, focus: () => [CROSS + 1.3, 1.25, 5.0] },
  { f: F(20.55), cInf: 9, focus: () => [PARK_X - 0.6, 0.9, LANE_N] },
  { f: F(22.65), cInf: 8, focus: (f) => keiPt(9, tf(f), 0.6, 1.0, 0) },
  { f: F(24.0), cInf: 14, focus: driverEyes(10) },
  { f: F(25.35), cInf: 7, focus: () => [SHOW, 1.1, 0] },
  { f: F(30.45), cInf: 5, focus: driverEyes(12) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
