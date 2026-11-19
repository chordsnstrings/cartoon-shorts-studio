// "The Robotaxi That Parked on the Train Tracks": timeline timed to pipeline/stories/trolley/words.json (ElevenLabs George, 31.6 s).
// One place: a downtown street at sunset (CITY, x 0). The street runs along x (asphalt z -7..0, near lane -1.75 traffic +x,
// far lane -5.25 traffic -x), sidewalks z 0..4 and -11..-7, buildings beyond; the trolley line crosses it along z at x 0
// (rails at x +-0.72) with two crossing gates (near-lane gate post at (-4, 0.5) arm toward -z; far-lane gate at (4, -7.5)).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 965;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const ROAD = 0;

// ---------------- story beats (film seconds, from words.json, cross-checked with whisper) ----------------
export const W = {
  self: 0.395, taxi: 1.083, stopped: 1.831, right: 2.574, tracks: 3.391, thisw: 4.079, downtown: 4.701, sandiego: 5.259,
  waymo: 6.479, robotaxi: 6.972, rolled: 7.816, trolley: 8.519, crossing: 8.852, stopped2: 10.007, then: 10.778, bells: 11.071,
  rang: 11.418, gates: 12.152, down: 12.659, its: 13.429, passengers: 13.67, smart: 14.472, they: 15.315, got: 15.665, out: 15.865,
  and: 16.374, car: 16.714, reversed: 17.471, straight: 18.244, through: 18.62, gate: 19.304, broke: 20.0, back: 20.584,
  window: 20.897, nobody: 21.844, hurt: 22.139, transit: 22.871, investigating: 23.838, human: 25.165, come: 25.85, drive: 26.111,
  away: 26.538, would: 27.216, ride: 27.441, one: 27.853, send: 28.107, friend: 29.044, trusts: 29.616, robots: 30.096, everything: 30.718,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
export const LANE_N = -1.75, LANE_F = -5.25;
export const ROAD_Z0 = -7, ROAD_Z1 = 0;
export const RAIL = 0.72;
/** gate posts: [x, z, arm direction along z (+1 / -1)] */
export const GATE_N: [number, number, number] = [-4.0, 0.5, -1];
export const GATE_F: [number, number, number] = [4.0, -7.5, 1];
export const ARM_L = 3.6, ARM_Y = 1.0;
/** the robotaxi: 4.7 m (x -2.35 .. 2.35), front toward local +x; rear seats at x -0.45, z +-0.42 (driver seat local -z) */
export const CAR_HALF = 2.35;
export const SEAT_RL: V3 = [-0.45, 0.42, -0.42];
export const SEAT_RR: V3 = [-0.45, 0.42, 0.42];
export const SEAT_DRV: V3 = [0.45, 0.42, -0.42];

export type Pose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; speed: number; vis: boolean; rev?: boolean };
const P = (x: number, z: number, yaw = 0, speed = 0, y = 0, pitch = 0, roll = 0): Pose => ({ x, y, z, yaw, pitch, roll, speed, vis: true });
const HIDE: Pose = { ...P(0, 0), vis: false };

// ---------------- the crash (shared by the hook and the real-time shot 7) ----------------
/** reverse run: x of the car (centre) at time r after it starts backing up, for a run whose arm contact is at rc and brake at rb */
const revX = (r: number, rc: number, rb: number) => {
  const a = (2 * 1.65) / (rc * rc), vc = a * rc; // contact when the rear (x - 2.35) reaches the near gate at x -4
  if (r <= 0) return 0;
  if (r < rc) return -0.5 * a * r * r;
  if (r < rb) return -1.65 - vc * (r - rc);
  const x0 = -1.65 - vc * (rb - rc), d = Math.min(r - rb, 0.5);
  return x0 - vc * (d - d * d); // brakes to a stop in 0.5 s
};
/** real time: backing starts on "reversed", arm contact on "gate", snap on "broke", window on "window" */
export const REV0 = W.reversed - 0.02, SNAP = W.broke - 0.03, GLASS = W.window - 0.06;
/** hook (shot 1): the same crash, faster, already moving at frame 0 */
export const H0 = -1.25, HC = 0.35, HSNAP = 0.62, HGLASS = 0.72;
export const carX = (id: number, t: number) => id === 1 ? revX(t - H0, HC - H0, 1.5 - H0) : revX(t - REV0, W.gate - REV0, 21.0 - REV0);
/** arm swing angle (rad, toward -x) while the car pushes it, and whether it has snapped */
export const armState = (id: number, t: number) => {
  if (id !== 1 && id !== 7 && id < 8) return { swing: 0, snapped: false };
  if (id >= 8) return { swing: 0.5, snapped: true };
  const xr = carX(id, Math.min(t, id === 1 ? HSNAP : SNAP)) - CAR_HALF;
  const swing = Math.atan(Math.max(0, GATE_N[0] - xr) / (GATE_N[1] - (LANE_N + 0.97)));
  return { swing, snapped: t >= (id === 1 ? HSNAP : SNAP) };
};
export const glassBroken = (id: number, t: number) => (id === 1 ? t >= HSNAP : id === 7 ? t >= SNAP : id > 7);
/** gate arms down (0 up .. 1 down) */
export const gateK = (id: number, t: number) => (id <= 1 || id >= 5 ? 1 : id < 4 ? 0 : id === 4 ? 0 : smooth((t - (W.gates - 0.15)) / 0.75));
/** crossing lamps flashing */
export const lampsOn = (id: number, t: number) => id === 1 || (id >= 4 && id <= 9 && (id !== 4 || at(t, W.bells - 0.25)));
export const PARKED_X = 14;

/** the robotaxi pose for a shot */
export const carPose = (id: number, t: number): Pose => {
  if (id === 1) { const x = carX(1, t); return { ...P(x, LANE_N, 0, t < 1.5 ? -2 : 0), rev: true }; }
  if (id === 2) return P(-62 + 10 * (t - 4.0), LANE_N, 0, 10);
  if (id === 3) {
    const u = clamp01((t - 6.3) / (W.stopped2 - 6.3)), x = -30 * (1 - u) * (1 - u), d = t - W.stopped2;
    return P(x, LANE_N, 0, 60 * (1 - u) / 3.7 * 0.5, 0, d > 0 ? -0.035 * Math.exp(-d * 5) * Math.sin(d * 18) : 0);
  }
  if (id === 4 || id === 5) return P(0, LANE_N);
  if (id === 6) { const d = t - REV0; return { ...P(carX(7, t), LANE_N, 0, d > 0 ? -1 : 0, 0, d > 0 ? 0.012 * Math.exp(-d * 4) : 0), rev: d > -0.12 }; }
  if (id === 7) return { ...P(carX(7, t), LANE_N, 0, -1.5), rev: t < 21.5 };
  const xs = carX(7, 30);
  if (id === 8 || id === 9) return P(xs, LANE_N);
  if (id === 10) {
    const d = Math.max(0, t - (W.drive - 0.2));
    return P(xs + 0.9 * d * d, LANE_N, 0, 1.8 * d);
  }
  if (id === 11) return P(PARKED_X, -1.05);
  return HIDE;
};
/** the red trolley (front of the lead car), running along z on the rails at x 0; dir +1 = toward +z */
export const trolleyPose = (id: number, t: number): Pose => {
  if (id === 1 || id === 5 || id === 6 || id === 7) return P(0, -46, -Math.PI / 2, 0); // waiting up the line, headlights on
  if (id === 4) return P(0, -46 - 3 * Math.max(0, 12.2 - t), -Math.PI / 2, 0);
  if (id === 8) return P(0, -12 + 6.2 * (t - 21.7), -Math.PI / 2, 6); // glides through the crossing behind the relieved passengers
  return HIDE;
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "city";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.0), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // hook: backing through the gate
  { id: 2, a: F(4.0), b: F(6.3), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // downtown at sunset, the robotaxi on its way
  { id: 3, a: F(6.3), b: F(10.75), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // rolls onto the crossing and stops
  { id: 4, a: F(10.75), b: F(13.35), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // bells + gates come down
  { id: 5, a: F(13.35), b: F(15.2), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // the two passengers: the smart thing
  { id: 6, a: F(15.2), b: F(18.1), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // they got out / and the car? reverse lights
  { id: 7, a: F(18.1), b: F(21.7), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // through the gate, the back window
  { id: 8, a: F(21.7), b: F(22.75), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // nobody was hurt (trolley passes behind)
  { id: 9, a: F(22.75), b: F(24.85), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // the transit agency investigates
  { id: 10, a: F(24.85), b: F(27.05), light: "day", place: "city", sunAz: 115, sunEl: 42 }, // a human drives it away
  { id: 11, a: F(27.05), b: TOTAL, light: "day", place: "city", sunAz: 115, sunEl: 42 }, // would you ride in one?
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

const CAMS: Record<number, Key[]> = {
  1: [
    // from the near sidewalk, a little high: the passengers in the lower third, the car backing through the gate behind them
    { f: 0, s: (f) => AD([1.4, 3.0, 6.3], [-3.9, 0.8, -1.7], pushK(f, 0, 0.0025, 0.007, 30), { fov: 50, roll: 0.03 }) },
    { f: F(1.6), dur: 40, s: (f) => AD([1.2, 2.9, 6.1], [-4.1, 0.85, -1.6], pushK(f, F(1.6), 0.0025), { fov: 48, roll: -0.03 }) },
  ],
  2: [
    // high over the street at sunset (downtown towers, palms, the trolley crossing); the white robotaxi heads for it
    { f: F(4.0), s: (f) => AD([-74, 10, -3.6], [-42, 1, -1.75], pushK(f, F(4.0), 0.0022), { fov: 50, roll: -0.03 }, 10) },
    { f: F(4.6), dur: 40, s: (f) => AD([-66, 7, -3.2], [-28, 1, -1.75], pushK(f, F(4.6), 0.002), { fov: 50, roll: 0.03 }, 10) },
  ],
  3: [
    // low on the corner past the crossing: the car rolls up and stops right on the rails
    { f: F(6.3), s: (f) => AD([2.6, 1.7, -10.4], carPt(3, tf(f), -0.6, 1.0, 0), pushK(f, F(6.3), 0.002), { fov: 48, roll: 0.03 }) },
    { f: F(9.0), dur: 30, s: (f) => AD([2.2, 1.7, -10.0], [-0.6, 1.0, LANE_N], pushK(f, F(9.0), 0.0025, 0.008, 25), { fov: 46, roll: -0.03 }) }, // "stopped"
  ],
  4: [
    // the signal mast: lamps flash, the bell rings ... then wide as both gates come down around the car
    { f: F(10.75), s: (f) => AD([-8.2, 2.3, 3.9], [-4.0, 3.2, 0.5], pushK(f, F(10.75), 0.003, 0.008, 25), { fov: 44, roll: 0.04 }, 6) },
    { f: F(11.95), cut: true, s: (f) => AD([-9.5, 2.3, 5.8], [-0.8, 1.0, -2.4], pushK(f, F(11.95), 0.0025, 0.006, 25), { fov: 50, roll: -0.03 }) },
  ],
  5: [
    // through the open side window: the two passengers in the back seat, deadpan
    { f: F(13.35), s: (f) => AD(carPt(5, tf(f), 3.4, 1.45, 0.25), carPt(5, tf(f), -0.45, 1.15, 0.0), pushK(f, F(13.35), 0.003, 0.008, 25), { fov: 44, roll: -0.03 }, 3) },
  ],
  6: [
    // wide: they hop out and scurry to the sidewalk ... then close on the empty car: reverse lights
    { f: F(15.2), s: (f) => AD([3.4, 1.9, 6.2], [-0.6, 0.9, -0.6], pushK(f, F(15.2), 0.0025), { fov: 48, roll: 0.03 }) },
    { f: F(16.45), cut: true, s: (f) => AD([-7.6, 1.55, -3.6], [-2.2, 0.95, LANE_N], pushK(f, F(16.45), 0.003, 0.009, 25), { fov: 46, roll: -0.04 }, 5) },
  ],
  7: [
    // side-on from the far sidewalk: backing through the gate, the arm bends, snaps, the back window bursts
    { f: F(18.1), s: (f) => AD([-10.2, 2.1, 2.6], [-3.6, 1.0, -1.7], pushK(f, F(18.1), 0.0022), { fov: 50, roll: 0.03 }) },
    { f: F(19.6), dur: 22, s: (f) => AD([-10.6, 2.1, 2.2], [-4.4, 1.0, -1.6], pushK(f, F(19.6), 0.0025, 0.007, 25), { fov: 50, roll: -0.04 }) }, // "broke"
  ],
  8: [
    // the passengers on the sidewalk, relieved; the trolley glides through the crossing behind them
    { f: F(21.7), s: (f) => AD([6.4, 1.6, 7.5], [0.6, 1.6, -6], pushK(f, F(21.7), 0.003, 0.006, 25), { fov: 48, roll: 0.03 }) },
  ],
  9: [
    // a transit inspector crouches over the snapped arm with a magnifier
    { f: F(22.75), s: (f) => AD([-4.9, 1.45, 4.2], [-7.3, 0.55, -0.2], pushK(f, F(22.75), 0.003, 0.008, 25), { fov: 46, roll: -0.03 }, 5) },
  ],
  10: [
    // in front of the car: a human at the wheel drives it away (toward us, past the camera's side)
    { f: F(24.85), s: (f) => AD([1.6, 1.35, LANE_N - 1.4], carPt(10, tf(f), 0.4, 1.1, -0.2), pushK(f, F(24.85), 0.002), { fov: 44, roll: 0.03 }, 5) },
  ],
  11: [
    // parked at the curb: the passenger looks at us, unconvinced; her friend can't wait to get back in
    { f: F(27.05), s: (f) => AD([PARKED_X - 8.6, 2.7, -5.0], [PARKED_X - 0.6, 1.0, 1.0], pushK(f, F(27.05), 0.0025, 0.006, 25), { fov: 48, roll: 0.03 }) },
    { f: F(29.9), dur: 30, s: (f) => AD([PARKED_X - 8.1, 2.6, -4.7], [PARKED_X - 0.3, 1.0, 1.1], pushK(f, F(29.9), 0.0025, 0.006, 25), { fov: 48, roll: -0.03 }) }, // "trusts robots"
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [HC, 0.6], [HSNAP, 0.9], [W.stopped2, 0.6], [W.bells, 0.5], [W.gates + 0.55, 0.6], [W.out, 0.4], [W.reversed, 0.5], [W.gate, 0.6], [SNAP, 0.8], [GLASS, 0.9],
  [W.hurt, 0.4], [W.drive, 0.4], [W.robots, 0.5],
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
  { f: 0, cInf: 4, focus: () => [-0.2, 1.6, 3.8] },
  { f: F(4.0), cInf: 0 },
  { f: F(6.3), cInf: 5, focus: (f) => carPt(3, tf(f), 0, 1.0, 0) },
  { f: F(10.75), cInf: 12, focus: () => [-4.0, 3.0, 0.5] },
  { f: F(11.95), cInf: 5, focus: () => [0, 1.0, LANE_N] },
  { f: F(13.35), cInf: 14, focus: () => carPt(5, 0, -0.45, 1.3, 0.2) },
  { f: F(15.2), cInf: 6, focus: () => [0.6, 1.2, 1.0] },
  { f: F(16.45), cInf: 12, focus: () => [-2.2, 1.0, LANE_N] },
  { f: F(18.1), cInf: 5, focus: () => [-4.0, 1.0, -1.2] },
  { f: F(21.7), cInf: 8, focus: () => [4.2, 1.6, 2.6] },
  { f: F(22.75), cInf: 11, focus: () => [-6.9, 1.0, 0.9] },
  { f: F(24.85), cInf: 10, focus: (f) => carPt(10, tf(f), 0.45, 1.3, -0.42) },
  { f: F(27.05), cInf: 6, focus: () => [PARKED_X - 1.0, 1.6, 1.8] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
