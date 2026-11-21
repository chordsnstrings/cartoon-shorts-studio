// "Thirteen Years of Waiting... and the Trucks Fly": timeline timed to pipeline/stories/glitch/words.json (ElevenLabs George, 34.4 s).
// Two places 400 m apart: a sunny downtown street (CITY, x 0; street along x, asphalt z -7..0, near lane -1.75 traffic +x, far lane
// -5.25, sidewalks z 0..4.5 and -11.5..-7, a cross street along z at x -6.5..6.5) and a harbour (x HX: quay z > QUAY_Z, sea wall face
// at QUAY_Z, a bridge along z on round piers, water at WATER_Y). The game's launch glitches happen literally in our own cartoon town.
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1050;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const ROAD = 0;

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  fans: 0.69, years: 1.68, then: 2.94, trucks: 3.32, flying: 4.07, grand: 4.73, six: 5.89, launched: 6.94, week: 7.61,
  estimated: 8.27, seventeen: 8.99, million: 9.71, copies: 10.26, day: 11.6, then2: 12.65, people: 13.14, played: 13.86, it: 14.19,
  one: 14.73, truck: 14.81, flung: 15.32, across: 15.62, map: 16.62, boat: 17.27, stuck: 17.81, bridge: 18.53, wall: 19.12,
  shaking: 19.81, ghost: 20.93, and: 21.62, hero: 21.98, sank: 22.48, straight: 22.98, through: 23.44, road: 23.9,
  critics: 24.96, score: 25.17, ninety: 25.58, hundred: 26.8, tie: 27.68, record: 28.84, would: 29.7, play: 29.85,
  flying2: 30.42, trucks2: 30.84, send: 31.41, friend: 32.43, called: 32.97, sick: 33.4, today: 33.72,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
export const LANE_N = -1.75, LANE_F = -5.25;
export const HX = 400, WATER_Y = -1.2, QUAY_Z = -6;
export const PIER = { zs: [-11, -27, -43], r: 0.8 };
export const BOAT = { len: 4.0, w: 1.9 };
/** the boat wedged between the sea wall (QUAY_Z) and the first pier: centre z */
export const BOAT_Z = (QUAY_Z + PIER.zs[0] + PIER.r) / 2;

export type Pose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; speed: number; vis: boolean };
const P = (x: number, z: number, yaw = 0, speed = 0, y = 0, pitch = 0, roll = 0): Pose => ({ x, y, z, yaw, pitch, roll, speed, vis: true });
export const HIDE: Pose = { ...P(0, 0), vis: false };

/** a vehicle flung at t0 from p0 with velocity v under gravity g, tumbling (roll rate rr, pitch rate pr); clamps at the ground */
const fly = (t: number, t0: number, p0: V3, v: V3, g: number, rr: number, pr: number, yaw = 0): Pose => {
  const u = t - t0;
  if (u <= 0) return P(p0[0], p0[2], yaw, 0, p0[1]);
  return { x: p0[0] + v[0] * u, y: Math.max(-30, p0[1] + v[1] * u - 0.5 * g * u * u), z: p0[2] + v[2] * u, yaw, pitch: pr * u, roll: rr * u, speed: 6, vis: true };
};

// hook: truck A already airborne at frame 0; truck B hops off the far lane on "trucks"
export const HOOK_T0 = -0.7;
export const HOOK_P0: V3 = [-2.0, 0, -0.9];
// shot 5: truck C drives +x along the near lane, rear-ends the parked car, launches on "flung"
export const PARK_X = 6.2;
export const HIT = W.flung - 0.12;
const C_V = 9;

/** vehicles per shot: trucks A (orange), B (blue), C (red), parked car, traffic car */
export const vehPoses = (id: number, t: number) => {
  const out = { A: HIDE, B: HIDE, C: HIDE, car: HIDE, car2: HIDE };
  if (id === 1) {
    out.A = fly(t, HOOK_T0, HOOK_P0, [-6.0, 9.5, 0.5], 6, 4.5, 1.4, Math.PI);
    out.B = fly(t, W.trucks - 0.1, [-17, 0, LANE_F], [-1.5, 9.5, 0.6], 6, -3.2, 0.9, Math.PI);
    out.car = P(-0.4, LANE_N, Math.PI, 0, 0, 0, t < 0.4 ? 0.06 * Math.exp(-t * 6) * Math.sin(t * 30) : 0);
  }
  if (id === 2) {
    out.B = P(-20 + 7 * (t - 4.6), LANE_N, 0, 7);
    out.car2 = P(18 - 8 * (t - 4.6), LANE_F, Math.PI, 8);
  }
  if (id === 4 || id === 7 || id === 8) out.car = P(PARK_X + 4, LANE_N);
  if (id === 5) {
    const x = (t < HIT ? 0.4 - C_V * (HIT - t) : 0.4);
    out.C = t < HIT ? P(x, LANE_N, 0, C_V) : fly(t, HIT, [0.4, 0, LANE_N], [13, 15, -2.5], 6, 2.6, -1.8, 0);
    const d = t - HIT;
    out.car = P(PARK_X + (d > 0 ? 1.2 * (1 - Math.exp(-d * 5)) : 0), LANE_N, 0, 0, 0, d > 0 ? -0.05 * Math.exp(-d * 5) * Math.sin(d * 25) : 0);
  }
  if (id === 9) {
    // one truck drifts calmly across the sky behind them, tumbling slowly
    const u = t - 29.55;
    out.A = { x: -11 + 2.2 * u, y: 8.6 + 0.5 * Math.sin(u * 1.3), z: -16, yaw: 0.3, pitch: 0.25 * u, roll: 0.5 * u, speed: 3, vis: true };
  }
  return out;
};
/** the boat: wedged and shaking like it saw a ghost (fast irregular jitter) */
export const boatPose = (t: number): Pose => {
  const k = 1 + (at(t, W.shaking) ? 0.8 : 0);
  const jx = 0.07 * k * (Math.sin(t * 47) + 0.6 * Math.sin(t * 83 + 1.3));
  const jz = 0.04 * k * Math.sin(t * 59 + 0.4);
  return { x: HX + 0.2 + jx, y: WATER_Y + 0.05 + 0.05 * Math.sin(t * 37), z: BOAT_Z + jz, yaw: Math.PI / 2 + 0.05 * k * Math.sin(t * 61 + 2),
    pitch: 0.03 * k * Math.sin(t * 53), roll: 0.06 * k * Math.sin(t * 71 + 0.7), speed: 0, vis: true };
};
/** hero sinking through the road (shot 7, glitchy steps) and popping back up (shot 8): y offset of his feet */
export const HERO_SPOT: [number, number] = [1.0, 2.0];
export const sinkY = (id: number, t: number) => {
  if (id === 7) {
    // stepped sink to the shoulders (arms still up), then one last drop out of sight just after "road"
    const u = smooth((t - (W.sank - 0.1)) / (W.through + 0.25 - W.sank)), d = clamp01((t - (W.road + 0.12)) / 0.15);
    return -(Math.round(u * 10) / 10) * 1.25 - d * 1.2;
  }
  if (id === 8) {
    const d = t - (W.ninety - 0.12);
    if (d < 0) return -2.4;
    return -2.4 * Math.exp(-d * 7) * Math.cos(d * 9);
  }
  return 0;
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "city" | "harbour";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.6), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // hook: trucks flying, the two friends gasp
  { id: 2, a: F(4.6), b: F(8.1), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // launch day: the sunny town celebrates
  { id: 3, a: F(8.1), b: F(12.45), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // 17 million: the crowd floods in
  { id: 4, a: F(12.45), b: F(14.6), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // then people played it: T-pose
  { id: 5, a: F(14.6), b: F(17.0), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // truck flung across the map
  { id: 6, a: F(17.0), b: F(21.5), light: "day", place: "harbour", sunAz: 115, sunEl: 42 }, // boat stuck, shaking
  { id: 7, a: F(21.5), b: F(24.75), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // the hero sinks through the road
  { id: 8, a: F(24.75), b: F(29.55), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // 99 / 100: he pops back up, trophy
  { id: 9, a: F(29.55), b: TOTAL, light: "day", place: "city", sunAz: 115, sunEl: 42 }, // would you play it?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.6);
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
/** look point d metres from pos toward target (pushK creeps along pos->look: keep it short) */
export const aim = (pos: V3, target: V3, d = 8): V3 => { const v = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]], L = Math.hypot(...v); return [pos[0] + (v[0] / L) * d, pos[1] + (v[1] / L) * d, pos[2] + (v[2] / L) * d]; };
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const AD = (pos: V3, target: V3, k: number, rest: Partial<Cam> = {}, d = 8) => dolly(pos, aim(pos, target, d), k, rest);
const tf = (f: number) => f / FPS;
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const vpt = (p: Pose, dy = 1.6): V3 => [p.x, p.y + dy, p.z];

// cast spots (cast.ts reads these too)
export const HOOK_HERO: [number, number] = [1.61, 2.91], HOOK_PAL: [number, number] = [1.91, 2.23];
export const END_HERO: [number, number] = [0.05, 2.4], END_PAL: [number, number] = [1.05, 2.8];

const CAMS: Record<number, Key[]> = {
  1: [
    // low on the near sidewalk looking up the street: the two friends gasp in the lower half, the trucks tumble through the sky
    { f: 0, s: (f) => AD([4.5, 1.3, 3.8], [-9, 6.2, -2], pushK(f, 0, 0.0022, 0.006, 30), { fov: 60, roll: 0.04 }, 6) },
    { f: F(2.6), dur: 36, s: (f) => AD([4.6, 1.3, 3.9], [-10, 5.4, -2.6], pushK(f, F(2.6), 0.0025, 0.007, 25), { fov: 60, roll: -0.03 }, 6) },
  ],
  2: [
    // high over the sunny street: launch day, fireworks over the rooftops
    { f: F(4.6), s: (f) => AD([-40, 15, -3.2], [-6, 4, -2.5], pushK(f, F(4.6), 0.0022), { fov: 52, roll: -0.03 }, 10) },
    { f: F(5.4), dur: 40, s: (f) => AD([-36, 12, -3.0], [-4, 4, -2.5], pushK(f, F(5.4), 0.0022), { fov: 52, roll: 0.03 }, 10) },
  ],
  3: [
    // a little high at the junction: the crowd pours in from both ends of the street
    { f: F(8.1), s: (f) => AD([9.5, 5.0, 9.5], [-6, 1.0, -2.5], pushK(f, F(8.1), 0.0022), { fov: 52, roll: 0.03 }) },
    { f: F(9.6), dur: 36, s: (f) => AD([9.0, 4.4, 8.8], [-5, 1.0, -2.5], pushK(f, F(9.6), 0.0025, 0.006, 25), { fov: 52, roll: -0.03 }) }, // "million"
  ],
  4: [
    // close on the hero: big grin ... then he snaps into a T-pose
    { f: F(12.45), s: (f) => AD([1.4, 1.75, 5.6], [0.5, 1.45, 2.0], pushK(f, F(12.45), 0.003, 0.009, 25), { fov: 40, roll: -0.03 }, 4) },
    { f: F(13.8), cut: true, s: (f) => AD([1.0, 1.7, 5.0], [0.5, 1.4, 2.0], pushK(f, F(13.8), 0.004, 0.01, 20), { fov: 40, roll: 0.05 }, 4) },
  ],
  5: [
    // the near sidewalk: the red truck rear-ends the parked car and is flung away over the rooftops; the camera tilts after it
    { f: F(14.6), s: (f) => AD([-8.5, 1.5, 4.2], [2.5, 1.4, -1.6], pushK(f, F(14.6), 0.0022), { fov: 54, roll: 0.03 }) },
    { f: F(15.25), dur: 30, s: (f) => { const p: V3 = [-8.5, 1.5, 4.2]; return AD(p, lerp3([3.5, 1.4, -1.6], vpt(vehPoses(5, tf(f)).C, 1.2), 0.85), 1, { fov: 54, roll: -0.03 }); } },
  ],
  6: [
    // the harbour: the boat jammed between the sea wall and the bridge pier, shaking
    { f: F(17.0), s: (f) => AD([HX + 7.0, 4.6, -4.2], [HX - 0.6, 0.9, BOAT_Z - 0.8], pushK(f, F(17.0), 0.0022), { fov: 50, roll: 0.03 }) },
    { f: F(19.6), dur: 30, s: (f) => AD([HX + 5.6, 3.6, -4.4], [HX - 0.4, 0.6, BOAT_Z - 0.6], pushK(f, F(19.6), 0.003, 0.008, 25), { fov: 48, roll: -0.04 }, 6) }, // "shaking"
  ],
  7: [
    // the hero on the sidewalk sinks into it; his friend stares
    { f: F(21.5), s: (f) => AD([1.9, 1.9, 5.6], [0.8, 0.7, 2.0], pushK(f, F(21.5), 0.0025, 0.007, 25), { fov: 44, roll: -0.03 }, 5) },
    { f: F(22.4), dur: 30, s: (f) => AD([1.7, 1.75, 5.1], [0.9, 0.45, 2.0], pushK(f, F(22.4), 0.003, 0.008, 25), { fov: 42, roll: 0.03 }, 5) }, // "sank"
  ],
  8: [
    // ... the score: he pops back up holding the trophy, the crowd cheers
    { f: F(24.75), s: (f) => AD([3.4, 2.2, 6.6], [1.2, 1.0, 2.0], pushK(f, F(24.75), 0.0022), { fov: 46, roll: 0.03 }, 5) },
    { f: F(27.5), dur: 30, s: (f) => AD([2.9, 2.0, 6.0], [1.1, 1.3, 2.0], pushK(f, F(27.5), 0.0028, 0.008, 25), { fov: 46, roll: -0.03 }, 5) }, // "tie / record"
  ],
  9: [
    // the two friends look at us; a truck drifts across the sky behind them
    { f: F(29.55), s: (f) => AD([1.0, 1.9, 7.9], [0.5, 2.6, 0], pushK(f, F(29.55), 0.0022), { fov: 46, roll: 0.03 }, 6) },
    { f: F(31.3), dur: 36, s: (f) => AD([0.95, 1.85, 7.5], [0.5, 2.4, 0], pushK(f, F(31.3), 0.0025, 0.006, 25), { fov: 46, roll: -0.03 }, 6) }, // "send this"
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [0, 0.5], [W.trucks, 0.6], [W.million, 0.4], [W.played, 0.6], [HIT, 0.9], [W.stuck, 0.5], [W.shaking, 0.4], [W.sank, 0.4],
  [W.road, 0.5], [W.ninety, 0.8], [W.record, 0.5], [W.send, 0.4],
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
export const DOF: Dof[] = [
  { f: 0, cInf: 3, focus: () => [2.2, 1.7, 2.7] },
  { f: F(4.6), cInf: 0 },
  { f: F(8.1), cInf: 0 },
  { f: F(12.45), cInf: 13, focus: () => [0.5, 1.6, 2.0] },
  { f: F(14.6), cInf: 0 },
  { f: F(17.0), cInf: 5, focus: () => [HX + 0.2, 0.3, BOAT_Z] },
  { f: F(21.5), cInf: 8, focus: () => [1.4, 1.0, 2.2] },
  { f: F(24.75), cInf: 7, focus: () => [1.2, 1.2, 2.0] },
  { f: F(29.55), cInf: 10, focus: () => [0.6, 1.6, 2.6] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
void easeOut;
