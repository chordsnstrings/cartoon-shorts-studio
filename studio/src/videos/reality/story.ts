// "The Car That Sees the Road Like a Video Game": timeline timed to pipeline/stories/reality/words.json (ElevenLabs George, 31.6 s).
// One place: the downtown street (x along the street, near lane z -1.75 traffic +x). Our white crossover with a driver and a big
// centre touchscreen showing a "game view"; a speed camera on the near sidewalk at CAM_X; a pothole at PH_X; parked spot PARK_X.
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 966;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const ROAD = 0;

// ---------------- story beats (film seconds, from words.json, cross-checked with whisper) ----------------
export const W = {
  update: 1.19, shows: 1.723, road: 2.31, video: 3.315, game: 3.662, saturday: 4.418, rolling: 5.996, selfdriving: 6.644, fifteen: 7.796,
  screen: 8.734, car: 9.897, floating: 10.481, camera: 10.906, ai: 11.987, filling: 12.347, gaps: 12.963, spots: 13.832, potholes: 14.218,
  slows: 15.393, speed: 16.193, cameras: 16.586, unless: 17.583, override: 17.86, twice: 18.585, same: 19.142, camera2: 19.455, then: 19.99,
  just: 20.501, stops: 21.184, slowing: 21.567, there: 22.277, claims: 23.296, twentyfive: 23.776, improvement: 24.819, but: 25.785,
  no: 26.278, numbers: 26.855, would: 27.749, trust: 27.904, send: 28.42, friend: 29.393, drives: 29.884, video2: 30.68, game2: 31.027,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
export const LANE_N = -1.75, LANE_F = -5.25;
export const ROAD_Z0 = -7, ROAD_Z1 = 0;
/** legacy trolley-crossing constants (gate arm helpers in build.ts still read them; nothing is built from them here) */
export const GATE_N: [number, number, number] = [-400, 0.5, -1];
export const GATE_F: [number, number, number] = [400, -7.5, 1];
export const ARM_L = 3.6, ARM_Y = 1.0;
/** the car: 4.7 m (x -2.35 .. 2.35), front toward local +x; driver seat local -z (left-hand drive) */
export const CAR_HALF = 2.35;
export const SEAT_DRV: V3 = [0.45, 0.42, -0.42];
export const SEAT_PAS: V3 = [0.45, 0.42, 0.42];
export const SCREEN: V3 = [1.0, 1.16, 0.08];
export const CAM_X = 40, CAM_Z = 0.9;   // speed camera pole (box over the lane edge, lens toward -x)
export const PH_X = -20, PH_Z = -1.15;  // pothole
export const PARK_X = 72;               // parked spot (car at z -1.05)
export const EASEL: V3 = [PARK_X - 3.6, 0.15, 1.45];
/** x positions kept clear of palms / lamps (camera spots and set pieces) */
export const CLEAR_X = [CAM_X, CAM_X + 8, PARK_X - 3, PARK_X - 9, PH_X + 5];

export type Pose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; speed: number; vis: boolean; brake?: boolean };
const P = (x: number, z: number, yaw = 0, speed = 0, y = 0, pitch = 0, roll = 0): Pose => ({ x, y, z, yaw, pitch, roll, speed, vis: true });

// ---------------- car motion ----------------
/** speed-camera approach (shot 6): 9 m/s, brakes to 4.5 m/s from "slows", passes the camera box (x CAM_X - 0.5) around 17.1 s */
const vApp = (t: number) => 9 - 4.5 * smooth((t - (W.slows - 0.1)) / 1.1);
const appX = (() => { const dt = 1 / 120, xs: number[] = []; let x = 0; for (let t = 15.0; t < 17.6; t += dt) { xs.push(x); x += vApp(t) * dt; } const off = CAM_X - 0.5 - xs[Math.round((17.1 - 15.0) / dt)]; return (t: number) => off + xs[Math.max(0, Math.min(xs.length - 1, Math.round((t - 15.0) / dt)))]; })();
/** the three passes at the camera (shot 8): centre crosses CAM_X at tc */
export const PASSES: { tc: number; v: number; brake: boolean }[] = [{ tc: 18.75, v: 15, brake: true }, { tc: 19.6, v: 15, brake: true }, { tc: 21.45, v: 11, brake: false }];
/** pothole swerve: lateral offset toward -z around the pothole crossing at 14.55 s */
const PH_T = 14.55;
const swerveZ = (t: number) => -1.45 * Math.sin(Math.PI * clamp01((t - (PH_T - 0.75)) / 1.5));

/** the car pose for a shot */
export const carPose = (id: number, t: number): Pose => {
  if (id === 1 || id === 4 || id === 7) return P(-120 + 9 * t, LANE_N, 0, 9); // interior shots: cruising
  if (id === 2) return P(-86 + 6 * (t - 4.1), LANE_N, 0, 6);
  if (id === 3) return P(-80 + 9 * (t - 8.5), LANE_N, 0, 9);
  if (id === 5) {
    const z = LANE_N + swerveZ(t), dz = (Math.PI * 1.45 / 1.5) * Math.cos(Math.PI * clamp01((t - (PH_T - 0.75)) / 1.5)) * (t > PH_T - 0.75 && t < PH_T + 0.75 ? 1 : 0);
    return P(PH_X + 9 * (t - PH_T), z, Math.atan2(dz, 9), 9);
  }
  if (id === 6) {
    const v = vApp(t), d = t - (W.slows - 0.1);
    return { ...P(appX(t), LANE_N, 0, v, 0, d > 0 && d < 1.4 ? -0.018 * Math.sin(Math.min(1, d / 1.1) * Math.PI) : 0), brake: t > W.slows - 0.1 && t < 17.3 };
  }
  if (id === 8) {
    // pick the pass whose window contains t
    let best = PASSES[0];
    for (const p of PASSES) if (Math.abs(t - p.tc) < Math.abs(t - best.tc)) best = p;
    const x = CAM_X + best.v * (t - best.tc);
    return { ...P(x, LANE_N, 0, best.v), brake: best.brake && Math.abs(t - best.tc) < 0.35, vis: Math.abs(x - CAM_X) < 40 };
  }
  return P(PARK_X, -1.05);
};
export const PH_TIME = PH_T;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "city";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
const D = { light: "day" as Light, place: "city" as Place, sunAz: 115, sunEl: 44 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.1), ...D },          // hook: inside the car, the driver gasps at the game-view screen
  { id: 2, a: F(4.1), b: F(8.5), ...D },     // Saturday: the update cloud drops onto the car on the street
  { id: 3, a: F(8.5), b: F(10.4), ...D },    // close on the screen: your car from behind, like a game
  { id: 4, a: F(10.4), b: F(13.5), ...D },   // outside: the floating camera behind the car; the gaps in the city fill in
  { id: 5, a: F(13.5), b: F(15.05), ...D },  // the pothole: a gentle swerve
  { id: 6, a: F(15.05), b: F(17.5), ...D },  // the speed camera: brake lights, the camera smiles
  { id: 7, a: F(17.5), b: F(18.62), ...D },  // the driver's grin: "override"
  { id: 8, a: F(18.62), b: F(22.7), ...D },  // two whooshing passes ... the third: no slowing at all
  { id: 9, a: F(22.7), b: F(27.4), ...D },   // the "25x" chart with no numbers
  { id: 10, a: F(27.4), b: TOTAL, ...D },    // would you trust it?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.1);
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
/** a point in the car's frame (local x fwd, z right) for shot id at time t */
export const carPt = (id: number, t: number, lx: number, ly: number, lz: number): V3 => {
  const p = carPose(id, t), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [p.x + lx * c + lz * s, p.y + ly, p.z - lx * s + lz * c];
};
/** interior camera riding with the car: pos and target in car-local coordinates, pushK as a dolly toward the target */
const IN = (id: number, f: number, pos: V3, tgt: V3, k: number, rest: Partial<Cam> = {}): Shot => {
  const t = tf(f), p: V3 = [tgt[0] + (pos[0] - tgt[0]) * k, tgt[1] + (pos[1] - tgt[1]) * k, tgt[2] + (pos[2] - tgt[2]) * k];
  const bob = id === 1 ? 0.012 * Math.sin(t * 17) + 0.006 * Math.sin(t * 29) : 0;
  const P0 = carPt(id, t, ...p); P0[1] += bob;
  return { pos: P0, look: carPt(id, t, ...tgt), ...rest };
};
/** the floating camera's local position behind / above the car (bobbing) */
export const floatCamLocal = (t: number): V3 => [-3.3, 2.55 + 0.08 * Math.sin(t * 5), 0.25 * Math.sin(t * 2.2)];

const CAMS: Record<number, Key[]> = {
  1: [
    // from the back seat (right): the driver on the left, the glowing screen on the right, the street racing past the windscreen
    { f: 0, s: (f) => IN(1, f, [-0.8, 1.22, 0.12], [0.8, 1.27, -0.22], pushK(f, 0, 0.0016, 0.006, 20), { fov: 68, roll: 0.03 }) },
    { f: F(2.2), dur: 36, s: (f) => IN(1, f, [-0.72, 1.22, 0.12], [0.8, 1.27, -0.22], pushK(f, F(2.2), 0.0016, 0.004, 20), { fov: 68, roll: -0.03 }) }, // "road"
  ],
  2: [
    // high over the street: the white car drives toward us; the update cloud drops onto it
    { f: F(4.1), s: (f) => AD([-50, 6.4, -5.4], carPt(2, tf(f), 0, 1.0, 0), pushK(f, F(4.1), 0.0022), { fov: 46, roll: -0.03 }, 10) },
    { f: F(6.9), dur: 40, s: (f) => AD([-51, 4.6, -5.0], carPt(2, tf(f), 0, 1.3, 0), pushK(f, F(6.9), 0.0025, 0.006, 25), { fov: 46, roll: 0.03 }, 9) },
  ],
  3: [
    // over the driver's shoulder onto the screen: the game view (car centre in the 0.3-0.7 band)
    { f: F(8.5), s: (f) => IN(3, f, [0.12, 1.32, 0.52], [SCREEN[0], SCREEN[1], SCREEN[2]], pushK(f, F(8.5), 0.004, 0.009, 25), { fov: 40, roll: 0.03 }) },
  ],
  4: [
    // outside, beside the car: the little floating camera follows it ... glide up behind into the camera's own view, the city fills in
    { f: F(10.4), s: (f) => AD(carPt(4, tf(f), -8.6, 3.5, -3.5), carPt(4, tf(f), -1.6, 1.8, 0), pushK(f, F(10.4), 0.0025), { fov: 48, roll: -0.03 }, 7) },
    { f: F(11.6), dur: 38, s: (f) => AD(carPt(4, tf(f), -7.6, 3.9, 0.6), carPt(4, tf(f), 6.0, 1.0, 0.2), pushK(f, F(11.6), 0.002), { fov: 52, roll: 0.03 }, 7) },
  ],
  5: [
    // low at the roadside past the pothole: the car comes on, sees it, eases around it
    { f: F(13.5), s: (f) => AD([PH_X + 4.6, 0.85, -0.35], [PH_X - 6, 0.5, -1.6], pushK(f, F(13.5), 0.0025, 0.007, 25), { fov: 52, roll: 0.03 }) },
  ],
  6: [
    // the speed camera on its pole, the car approaching below it: brake lights, a polite slow-down
    { f: F(15.05), s: (f) => AD([CAM_X + 6.5, 1.9, 2.6], [CAM_X - 8, 2.2, -1.2], pushK(f, F(15.05), 0.0022), { fov: 54, roll: -0.03 }) },
    { f: F(16.4), dur: 30, s: (f) => AD([CAM_X + 6.0, 1.9, 2.5], [CAM_X - 6, 2.4, -1.1], pushK(f, F(16.4), 0.0025, 0.006, 25), { fov: 54, roll: 0.03 }) },
  ],
  7: [
    // the driver's sly grin (from the passenger seat)
    { f: F(17.5), s: (f) => IN(7, f, [0.85, 1.36, 0.82], [0.45, 1.3, -0.42], pushK(f, F(17.5), 0.0025, 0.006, 25), { fov: 66, roll: -0.04 }) },
  ],
  8: [
    // from the far sidewalk, along the road: whoosh, whoosh ... and the third time it just cruises past
    { f: F(18.62), s: (f) => AD([CAM_X + 6.0, 2.3, -8.4], [CAM_X - 1.6, 2.6, -0.6], pushK(f, F(18.62), 0.0022), { fov: 54, roll: 0.03 }) },
    { f: F(20.3), dur: 34, s: (f) => AD([CAM_X + 5.4, 2.4, -8.0], [CAM_X - 1.3, 2.8, -0.5], pushK(f, F(20.3), 0.0025, 0.007, 25), { fov: 52, roll: -0.03 }) }, // "then it just..."
  ],
  9: [
    // on the sidewalk by the parked car: the driver presents the chart ... then squints at it: no numbers
    { f: F(22.7), s: (f) => AD([PARK_X - 9.2, 1.75, 2.4], [PARK_X - 3.4, 1.35, 0.95], pushK(f, F(22.7), 0.0022, 0.005, 25), { fov: 50, roll: 0.03 }) },
    { f: F(25.7), dur: 30, s: (f) => AD([PARK_X - 8.4, 1.72, 2.2], [PARK_X - 3.4, 1.4, 0.95], pushK(f, F(25.7), 0.0022, 0.006, 25), { fov: 50, roll: -0.04 }) }, // "but"
  ],
  10: [
    // at the driver's window of the parked car: would you trust it? send this to...
    { f: F(27.4), s: (f) => AD([PARK_X + 0.9, 1.42, -4.4], carPt(10, tf(f), 0.45, 1.3, -0.42), pushK(f, F(27.4), 0.0022, 0.005, 25), { fov: 46, roll: 0.03 }, 5) },
    { f: F(29.3), dur: 34, s: (f) => AD([PARK_X + 0.8, 1.42, -4.2], carPt(10, tf(f), 0.45, 1.32, -0.42), pushK(f, F(29.3), 0.0022, 0.005, 25), { fov: 46, roll: -0.03 }, 5) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [0.0, 0.5], [W.update, 0.35], [W.road, 0.4], [W.game, 0.5], [W.fifteen, 0.4], [W.potholes + 0.2, 0.4], [W.slows, 0.3], [PASSES[0].tc, 0.6], [PASSES[1].tc, 0.6], [PASSES[2].tc, 0.4],
  [W.twentyfive, 0.5], [W.numbers, 0.4], [W.friend, 0.3],
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
  { f: 0, cInf: 6, focus: (f) => carPt(1, tf(f), 0.6, 1.2, -0.2) },
  { f: F(4.1), cInf: 0 },
  { f: F(8.5), cInf: 12, focus: (f) => carPt(3, tf(f), ...SCREEN) },
  { f: F(10.4), cInf: 4, focus: (f) => carPt(4, tf(f), -1.2, 1.5, 0) },
  { f: F(13.5), cInf: 6, focus: () => [PH_X, 0.6, -1.4] },
  { f: F(15.05), cInf: 6, focus: () => [CAM_X - 0.3, 3.4, -0.6] },
  { f: F(17.5), cInf: 13, focus: (f) => carPt(7, tf(f), 0.45, 1.25, -0.42) },
  { f: F(18.62), cInf: 4, focus: () => [CAM_X - 0.3, 2.6, -0.8] },
  { f: F(22.7), cInf: 7, focus: () => [PARK_X - 3.4, 1.4, 0.9] },
  { f: F(27.4), cInf: 10, focus: (f) => carPt(10, tf(f), 0.45, 1.2, -0.42) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
