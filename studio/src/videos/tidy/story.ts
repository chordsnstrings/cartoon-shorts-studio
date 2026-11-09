// "The Robot Cleaner That Had to Be Carried": timeline timed to pipeline/stories/tidy/words.json (ElevenLabs George, 31.0 s).
// Four places in one scene graph: the apartment HALL with its carpeted staircase (x 0), the front STOOP on the street
// with the minivan (x + 400), the pilot's HQ office (x - 400) and the BATHroom (x - 800).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 940;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const HALL = 0, STOOP = 400, HQ = -400, BATH = -800;

// ---------------- story beats (film seconds, ElevenLabs alignment cross-checked with whisper) ----------------
export const W = {
  robot: 0.89, carried: 3.71, stairs: 4.38, thirty: 5.43, hour: 6.03, claw: 6.54, hands: 7.01, grippy: 7.61, socks: 8.07,
  twist: 9.15, human: 10.06, steers: 10.46, remotely: 11.37, hq: 12.32, on: 13.48, front: 13.62, steps: 13.96, climbed: 14.58,
  drunk: 15.49, then: 16.19, froze: 16.45, pilots: 17.39, equipment: 17.99, overheated: 18.41, visit: 19.63, two: 19.8,
  toilet: 20.6, brush: 21.41, fell: 21.95, three: 22.36, times: 22.65, three2: 24.01, times2: 24.13, poked: 24.75, back: 25.05,
  onn: 25.35, would: 26.49, pay: 26.73, robot2: 26.99, clean: 27.46, toilet2: 27.87, send: 28.54, someone: 29.25, hates: 29.75,
  chores: 30.09,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;
export const ROBOT_S = 1.3; // card scale: ~1.37 m tall (four and a half feet)

// ---------------- layout shared with build / world / cast ----------------
/** hall staircase: 12 steps rising toward +z, bottom riser at z -3.6, top landing from z 0 */
export const ST = { n: 12, rise: 0.19, run: 0.3, z0: -3.6, w: 1.5 };
export const hallStepY = (z: number) => { const i = Math.floor((z - ST.z0) / ST.run) + 1; return clamp01(i / ST.n) * ST.n * ST.rise * (i >= 1 ? 1 : 0); };
/** stoop: 8 steps up toward -z from the sidewalk (front edge of step 1 at z 0), landing, facade at z -3 */
export const SP = { n: 8, rise: 0.18, run: 0.3, w: 2.2, face: -3.0 };
export const stoopZ = (k: number) => -(k - 0.5) * SP.run; // centre of step k (k = 0: sidewalk just in front)
export const VAN: V3 = [STOOP + 4.0, 0, 4.7];
/** HQ: pilot seat behind the desk, the monitor on the desk (centre, yaw), the spare robot in the corner */
export const PILOT: V3 = [HQ - 0.05, 0, -1.0];
export const MON: V3 = [HQ + 0.45, 1.04, -0.62];
export const MON_YAW = -0.75, MON_W = 0.56, MON_H = 0.34;
export const DESK_Z = -0.42, DESK_H = 0.75;
/** bathroom: toilet (bowl centre), robot spot, the reporter at the door */
export const TOILET: V3 = [BATH + 0.45, 0, -0.95];
export const RB: V3 = [BATH - 0.25, 0, -0.62];
export const REPORTER: V3 = [BATH - 0.85, 0, 0.45];

// ---------------- the robot on the stoop: a drunk climb, a slip on "drunk", frozen on "froze" ----------------
/** step progress k (0 sidewalk .. 8 landing) on the stoop at film time t */
export const climbK = (t: number) => {
  const t0 = W.on - 0.3, slip = W.drunk;
  if (t < t0) return 0;
  if (t < slip) { const u = (t - t0) / 0.48; return Math.min(4, Math.floor(u) + smooth((u % 1) * 1.6)); }
  const back = smooth((t - slip) / 0.22); // slides back down one step
  if (t < W.then - 0.1) return 4 - back;
  const u = (t - (W.then - 0.1)) / 0.4; // one more wobbly try, then the freeze
  return Math.min(3.55, 3 + 0.55 * smooth(u));
};
export const climbFrozen = (t: number) => t >= W.froze - LEADS;
/** height of the robot's feet at progress k (hop arc between steps) */
export const climbY = (k: number) => { const i = Math.floor(k), u = k - i; return SP.rise * (i + smooth(u)) + 0.09 * Math.sin(Math.PI * u); };

// ---------------- brush head: on the handle / falling / on the floor ----------------
/** times the head falls off and is poked back on */
export const DROPS = [W.fell - 0.03, W.three + 0.12, W.times + 0.42];
export const BACKON = [W.three - 0.06, W.times + 0.22, W.onn];
/** 0 = on the handle, 1 = falling (u = fall progress 0..1), 2 = lying on the floor */
export const headState = (t: number): { s: 0 | 1 | 2; u: number; n: number } => {
  for (let i = DROPS.length - 1; i >= 0; i--) {
    if (t >= BACKON[i]) return { s: 0, u: 0, n: i + 1 };
    if (t >= DROPS[i]) { const u = (t - DROPS[i]) / 0.3; return u < 1 ? { s: 1, u, n: i } : { s: 2, u: 1, n: i }; }
  }
  return { s: 0, u: 0, n: 0 };
};

// ---------------- shots ----------------
export type Light = "day" | "indoor";
export type Place = "hall" | "stoop" | "hq" | "bath";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 150, light: "indoor", place: "hall", sunAz: 120, sunEl: 40 }, // hook: carried up the stairs
  { id: 2, a: 150, b: F(9.0), light: "day", place: "stoop", sunAz: 70, sunEl: 45 }, // $30/h, claw hands, grippy socks
  { id: 3, a: F(9.0), b: F(9.75), light: "day", place: "stoop", sunAz: 70, sunEl: 45 }, // the twist: signal from the antennae
  { id: 4, a: F(9.75), b: F(13.42), light: "indoor", place: "hq", sunAz: 60, sunEl: 35 }, // the human pilot at HQ
  { id: 5, a: F(13.42), b: F(16.12), light: "day", place: "stoop", sunAz: 60, sunEl: 45 }, // the drunk climb
  { id: 6, a: F(16.12), b: F(17.3), light: "day", place: "stoop", sunAz: 60, sunEl: 45 }, // frozen
  { id: 7, a: F(17.3), b: F(19.55), light: "indoor", place: "hq", sunAz: 60, sunEl: 35 }, // the gear overheats
  { id: 8, a: F(19.55), b: F(23.85), light: "indoor", place: "bath", sunAz: 110, sunEl: 40 }, // visit two: the toilet
  { id: 9, a: F(23.85), b: F(26.3), light: "indoor", place: "bath", sunAz: 110, sunEl: 40 }, // poked back on (floor CU)
  { id: 10, a: F(26.3), b: TOTAL, light: "indoor", place: "bath", sunAz: 110, sunEl: 40 }, // would you pay?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = 150;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- hall: the carry ----------------
/** the co-founder's position on the hall stairs at film time t: one step every ~0.75 s, from step 5 */
export const carryAt = (t: number): { z: number; y: number; bob: number } => {
  const u = t / 1.2, i = Math.floor(u), k = smooth((u - i) * 1.6);
  const st = 2.5 + i + k, z = ST.z0 + (st - 0.5) * ST.run;
  return { z, y: ST.rise * st, bob: Math.sin(Math.PI * Math.min(1, (u - i) * 1.6)) };
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
const S = (x: number, y: number, z: number): V3 => [STOOP + x, y, z];
const Q = (x: number, y: number, z: number): V3 => [HQ + x, y, z];
const Bt = (x: number, y: number, z: number): V3 => [BATH + x, y, z];
/** where the robot stands on the curb (shots 2-3) */
export const CURB: V3 = S(0.55, 0, 1.55);
export const SPOTTER: V3 = S(-0.75, 0, 0.45);

const CAMS: Record<number, Key[]> = {
  1: [
    // looking down the staircase from the landing; she climbs toward us with the robot in her arms
    { f: 0, s: (f) => { const c = carryAt(f / FPS); return dolly([0.6, 3.95, 1.65], [0.0, c.y + 1.2, c.z], 1 - 0.0005 * f, { fov: 44, roll: -0.03 }); } },
    { f: 104, dur: 26, s: (f) => { const c = carryAt(f / FPS); return dolly([0.5, 3.9, 1.5], [0.02, c.y + 1.2, c.z], 1 - 0.0005 * f - 0.0008 * Math.max(0, f - 104), { fov: 44, roll: 0.035 }); } }, // "carried"
  ],
  2: [
    { f: 150, s: (f) => dolly(S(-1.2, 1.15, 5.2), S(0.85, 0.85, 1.5), pushK(f, 150, 0.0025), { fov: 42, roll: -0.02 }) }, // curb: the robot by the van
    { f: F(W.claw - 0.08), cut: true, s: (f) => dolly(S(0.3, 1.25, 3.35), [CURB[0] + 0.0, 1.22, CURB[2]], pushK(f, F(W.claw), 0.003, 0.007, 25), { fov: 38, roll: 0.04 }) }, // claw CU
    { f: F(W.grippy - 0.08), cut: true, s: (f) => dolly(S(0.95, 0.32, 2.45), [CURB[0], 0.13, CURB[2]], pushK(f, F(W.grippy), 0.003, 0.006, 25), { fov: 40, roll: -0.04 }) }, // socks CU
  ],
  3: [
    { f: F(9.0), s: (f) => dolly(S(0.45, 1.35, 3.05), [CURB[0], 1.38, CURB[2]], pushK(f, F(9.0), 0.004, 0.008, 22), { fov: 40 }) },
  ],
  4: [
    { f: F(9.75), s: (f) => dolly(Q(-0.55, 1.35, 1.75), Q(0.12, 0.98, -0.75), pushK(f, F(9.75), 0.0025, 0.006, 25), { fov: 42, roll: 0.02 }) },
    { f: F(W.remotely - 0.1), dur: 32, s: (f) => dolly(Q(0.55, 1.28, 1.3), Q(0.25, 1.0, -0.72), pushK(f, F(W.remotely), 0.0022), { fov: 40, roll: -0.03 }) }, // the screen joins the frame
  ],
  5: [
    // three-quarter low view of the stoop: robot climbing, the co-founder spotting behind
    { f: F(13.42), s: (f) => dolly(S(2.2, 0.75, 2.35), S(-0.1, 0.95, -0.7), pushK(f, F(13.42), 0.0025), { fov: 46, roll: 0.03 }) },
    { f: F(W.drunk - 0.1), dur: 20, s: (f) => dolly(S(1.9, 0.8, 2.0), S(-0.05, 0.95, -0.8), pushK(f, F(W.drunk), 0.003, 0.007, 25), { fov: 46, roll: -0.04 }) },
  ],
  6: [
    { f: F(16.12), s: (f) => dolly(S(1.05, 1.15, 2.3), S(-0.1, 1.35, -0.9), pushK(f, F(16.12), 0.003, 0.007, 25), { fov: 44, roll: 0.03 }) }, // frozen MS
  ],
  7: [
    { f: F(17.3), s: (f) => dolly(Q(0.3, 1.32, 1.95), Q(0.33, 1.02, -0.7), pushK(f, F(17.3), 0.0025, 0.006, 25), { fov: 46, roll: 0.03 }) },
    { f: F(W.overheated - 0.08), dur: 18, s: (f) => dolly(Q(0.35, 1.3, 1.65), Q(0.38, 1.05, -0.7), pushK(f, F(W.overheated), 0.003, 0.008, 25), { fov: 46, roll: -0.04 }) },
  ],
  8: [
    { f: F(19.55), s: (f) => dolly(Bt(-0.4, 1.3, 2.25), Bt(-0.05, 0.75, -0.7), pushK(f, F(19.55), 0.0025), { fov: 50, roll: -0.02 }) }, // bathroom wide
    { f: F(W.brush - 0.08), cut: true, s: (f) => dolly(Bt(0.15, 0.95, 0.75), Bt(0.25, 0.5, -0.75), pushK(f, F(W.brush), 0.0025, 0.006, 25), { fov: 42, roll: 0.03 }) }, // brush MS
  ],
  9: [
    { f: F(23.85), s: (f) => dolly(Bt(-0.05, 0.5, 0.35), Bt(0.18, 0.2, -0.62), pushK(f, F(23.85), 0.0028), { fov: 44, roll: -0.03 }) }, // floor CU
    { f: F(W.onn - 0.06), dur: 18, s: (f) => dolly(Bt(-0.05, 0.52, 0.25), Bt(0.18, 0.24, -0.62), pushK(f, F(W.onn), 0.003, 0.008, 22), { fov: 44, roll: 0.03 }) },
  ],
  10: [
    { f: F(26.3), s: (f) => dolly(Bt(-0.15, 1.15, 2.2), Bt(-0.35, 0.88, -0.5), pushK(f, F(26.3), 0.0025), { fov: 46 }) },
    { f: F(W.send - 0.1), dur: 30, s: (f) => dolly(Bt(-0.45, 1.1, 1.85), Bt(-0.5, 0.92, -0.3), pushK(f, F(W.send), 0.0022), { fov: 46, roll: 0.03 }) }, // reporter joins
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.carried + 0.05, 0.9], [W.drunk + 0.02, 1.1], [W.froze, 0.5], [W.overheated + 0.05, 0.8],
  ...DROPS.map((d) => [d + 0.3, 0.6] as [number, number]), [W.onn + 0.02, 0.7],
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
  { f: 0, cInf: 8, focus: (f) => { const c = carryAt(f / FPS); return [0.2, c.y + 1.45, c.z + 0.1]; } },
  { f: 150, cInf: 0 }, // curb wide
  { f: F(W.claw - 0.08), cInf: 13 }, // claw CU (focus = look)
  { f: F(W.grippy - 0.08), cInf: 13 }, // socks CU
  { f: F(9.0), cInf: 12 }, // robot face
  { f: F(9.75), cInf: 9, focus: () => [PILOT[0], 1.2, PILOT[2]] }, // pilot MS
  { f: F(13.42), cInf: 4 }, // stoop climb: mild
  { f: F(16.12), cInf: 11 },
  { f: F(17.3), cInf: 10 },
  { f: F(19.55), cInf: 0 }, // bathroom wide
  { f: F(W.brush - 0.08), cInf: 10 },
  { f: F(23.85), cInf: 14 }, // floor CU
  { f: F(26.3), cInf: 9, focus: () => [RB[0], 1.15, RB[2]] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
