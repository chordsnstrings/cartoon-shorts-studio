// "The Butter Benchmark": timeline timed to pipeline/stories/butter/words.json (Kokoro bm_george fallback, 31.0 s).
// One place: the chip LAB (x 0) with a long workbench and four AI chip boards, a knob of butter on each.
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 930;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// ---------------- story beats (film seconds, whisper word timings) ----------------
export const W = {
  tested: 0.48, chips: 1.44, butter: 2.3, korean: 3.32, put: 4.32, knob: 4.8, butter2: 5.04, each: 5.44, chip: 5.62,
  ran: 6.5, exact: 6.98, same: 7.36, job: 8.36, sz1: 9.3, sz2: 9.74, sz3: 10.34, except: 11.1, last: 11.58, its: 12.42,
  didnt: 12.92, soften: 13.5, maker: 14.58, says: 14.8, runs: 15.68, forty: 16.58, cooler: 17.2, under: 18.26, five: 18.5,
  watts: 18.9, critics: 20.0, missing: 21.12, speed: 22.14, cool: 22.86, lazy: 24.12, chip3: 24.4, would: 25.22, trust: 25.46,
  test: 26.18, send: 26.54, laptop: 28.16, fry: 28.9, egg: 29.44,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** workbench: top at BENCH.h, front edge z1, back edge z0; four chip boards along x */
export const BENCH = { x0: -1.75, x1: 1.75, z0: -1.0, z1: -0.35, h: 0.92 };
export const CHIPX = [-1.05, -0.35, 0.35, 1.05];
export const CHIPZ = -0.66;
export const PCB_H = 0.014, CHIP_H = 0.022;
export const CHIP_TOP = BENCH.h + PCB_H + CHIP_H;
/** people behind the bench (legs hidden by the bench skirt) */
export const ENG: V3 = [-0.62, 0, -1.42];
export const BOSS: V3 = [1.45, 0, -1.45];
export const CRITIC: V3 = [1.5, 0, 0.6];

// ---------------- butter ----------------
/** when the knob of butter lands on chip i (shot 2) */
export const LAND = [W.knob - 0.05, W.butter2 + 0.05, W.each - 0.02, W.chip + 0.12];
/** sizzle start per chip (chip 3 never melts) */
export const MELT = [W.sz1 - 0.07, W.sz2 - 0.07, W.sz3 - 0.07, Infinity];
/** melt progress 0 (solid) .. 1 (puddle) of chip i in shot id at film time t; -1 = no butter yet */
export const meltAt = (id: number, i: number, t: number) => {
  if (id === 1) return i === 0 ? 0.3 + 0.7 * smooth(t / 2.7) : -1;
  if (id === 2) return t >= LAND[i] ? 0 : -1;
  if (id === 3) return 0;
  return i === 3 ? 0 : clamp01((t - MELT[i]) / 0.5);
};
/** board LEDs: 0 off, 1 running (hot ones go red once melting), shot 1 always on */
export const runningAt = (id: number, t: number) => id === 1 || id >= 4 || (id === 3 && at(t, W.ran));

// ---------------- shots ----------------
export type Light = "day" | "indoor";
export type Place = "lab";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 90, light: "indoor", place: "lab", sunAz: 120, sunEl: 40 }, // hook: butter sizzling on a chip
  { id: 2, a: 90, b: F(6.1), light: "indoor", place: "lab", sunAz: 110, sunEl: 40 }, // a knob of butter on each chip
  { id: 3, a: F(6.1), b: F(9.1), light: "indoor", place: "lab", sunAz: 110, sunEl: 40 }, // same AI job: boards light up
  { id: 4, a: F(9.1), b: F(11.0), light: "indoor", place: "lab", sunAz: 120, sunEl: 40 }, // sizzle x3
  { id: 5, a: F(11.0), b: F(14.4), light: "indoor", place: "lab", sunAz: 120, sunEl: 40 }, // the last one stays solid
  { id: 6, a: F(14.4), b: F(19.9), light: "indoor", place: "lab", sunAz: 110, sunEl: 40 }, // 40 degrees cooler, under 5 W
  { id: 7, a: F(19.9), b: F(25.0), light: "indoor", place: "lab", sunAz: 100, sunEl: 40 }, // critics: speed? lazy chip (snail)
  { id: 8, a: F(25.0), b: TOTAL, light: "indoor", place: "lab", sunAz: 110, sunEl: 40 }, // would you trust it? laptop egg
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = 90;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

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
const cx = (i: number) => CHIPX[i];
const BT = CHIP_TOP;
const CAMS: Record<number, Key[]> = {
  1: [ // low CU across the bench: butter collapsing on chip 0, the engineer crouched behind, shocked
    { f: 0, s: (f) => dolly([cx(0) + 0.42, BT + 0.2, CHIPZ + 0.95], [cx(0) + 0.05, BT + 0.16, CHIPZ - 0.15], pushK(f, 0, 0.0035, 0.008, 30), { fov: 40, roll: -0.04 }) },
    { f: 52, dur: 26, s: (f) => dolly([cx(0) + 0.3, BT + 0.24, CHIPZ + 0.85], [cx(0) + 0.02, BT + 0.15, CHIPZ - 0.12], pushK(f, 0, 0.0035) * 0.96, { fov: 40, roll: 0.035 }) },
  ],
  2: [ // MS: the engineer slicing knobs onto the boards, the boss at the end of the bench
    { f: 90, s: (f) => dolly([-0.15, 1.85, 1.9], [-0.45, 1.2, -0.95], pushK(f, 90, 0.0022), { fov: 35, roll: 0.02 }) },
    { f: F(W.knob - 0.15), dur: 30, s: (f) => dolly([-0.55, 1.8, 1.6], [-0.55, 1.18, -0.95], pushK(f, F(W.knob), 0.0025), { fov: 31, roll: -0.03 }) },
  ],
  3: [ // the boss starts the job: all four boards light up
    { f: F(6.1), s: (f) => dolly([1.15, 1.8, 1.7], [1.3, 1.25, -1.0], pushK(f, F(6.1), 0.0025, 0.007, 25), { fov: 33, roll: 0.03 }) },
    { f: F(W.exact - 0.1), dur: 34, s: (f) => dolly([0.35, 1.85, 2.1], [0.2, 1.2, -1.0], pushK(f, F(W.exact), 0.0025), { fov: 38, roll: -0.02 }) },
  ],
  4: [ // low glide along the row: sizzle, sizzle, sizzle
    { f: F(9.1), s: (f) => dolly([cx(0) + 0.15, BT + 0.22, CHIPZ + 0.75], [cx(0) - 0.02, BT + 0.06, CHIPZ], pushK(f, F(9.1), 0.003), { fov: 42, roll: -0.03 }) },
    { f: F(W.sz2 - 0.12), dur: 10, s: (f) => dolly([cx(1) + 0.15, BT + 0.22, CHIPZ + 0.75], [cx(1) - 0.02, BT + 0.06, CHIPZ], pushK(f, F(W.sz2), 0.003), { fov: 42, roll: 0.03 }) },
    { f: F(W.sz3 - 0.14), dur: 10, s: (f) => dolly([cx(2) + 0.15, BT + 0.22, CHIPZ + 0.75], [cx(2) - 0.02, BT + 0.06, CHIPZ], pushK(f, F(W.sz3), 0.003), { fov: 42, roll: -0.03 }) },
  ],
  5: [ // the last chip: butter still a neat block; the engineer leans in and pokes it
    { f: F(11.0), s: (f) => dolly([cx(3) - 0.4, BT + 0.5, CHIPZ + 1.25], [cx(3) - 0.05, BT + 0.32, CHIPZ - 0.3], pushK(f, F(11.0), 0.0025, 0.007, 25), { fov: 42, roll: 0.03 }) },
    { f: F(W.soften - 0.1), dur: 20, s: (f) => dolly([cx(3) - 0.32, BT + 0.45, CHIPZ + 1.05], [cx(3) - 0.02, BT + 0.28, CHIPZ - 0.3], pushK(f, F(W.soften), 0.003, 0.008, 22), { fov: 42, roll: -0.03 }) },
  ],
  6: [ // the boss, proud, by the cool chip; thermometers pop up
    { f: F(14.4), s: (f) => dolly([1.05, 1.5, 1.75], [1.0, 1.2, -1.0], pushK(f, F(14.4), 0.0022), { fov: 46, roll: -0.02 }) },
    { f: F(W.forty - 0.15), dur: 28, s: (f) => dolly([0.45, 1.5, 1.7], [0.72, 1.12, -0.85], pushK(f, F(W.forty), 0.0022), { fov: 46, roll: 0.03 }) },
  ],
  7: [ // the critic with a stopwatch; on "lazy" a snail crawls up to the cool chip
    { f: F(19.9), s: (f) => dolly([0.75, 1.55, 3.2], [1.2, 1.15, -0.5], pushK(f, F(19.9), 0.0011), { fov: 48, roll: 0.02 }) },
    { f: F(W.lazy - 0.4), dur: 26, s: (f) => dolly([cx(3) - 0.32, BT + 0.3, CHIPZ + 0.9], [cx(3) + 0.06, BT + 0.1, CHIPZ - 0.1], pushK(f, F(W.lazy), 0.003), { fov: 42, roll: -0.03 }) },
  ],
  8: [ // the engineer with her laptop; an egg fries on it
    { f: F(25.0), s: (f) => dolly([-0.2, 1.5, 1.5], [-0.55, 1.22, -1.0], pushK(f, F(25.0), 0.0022), { fov: 44, roll: -0.02 }) },
    { f: F(W.send - 0.1), dur: 30, s: (f) => dolly([-0.35, 1.4, 1.2], [-0.6, 1.2, -1.0], pushK(f, F(W.send), 0.002), { fov: 44, roll: 0.03 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [[W.butter + 0.02, 0.8], [W.sz1, 0.7], [W.sz2, 0.7], [W.sz3, 0.8], [W.soften, 0.5], [W.lazy, 0.4], [W.egg, 0.6]];
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
  { f: 0, cInf: 12, focus: () => [CHIPX[0], CHIP_TOP + 0.05, CHIPZ] },
  { f: 90, cInf: 6, focus: () => [ENG[0], 1.3, ENG[2]] },
  { f: F(6.1), cInf: 7, focus: () => [BOSS[0], 1.4, BOSS[2]] },
  { f: F(9.1), cInf: 13 },
  { f: F(11.0), cInf: 12, focus: () => [CHIPX[3], CHIP_TOP + 0.05, CHIPZ] },
  { f: F(14.4), cInf: 9, focus: () => [BOSS[0], 1.5, BOSS[2]] },
  { f: F(19.9), cInf: 8, focus: () => [CRITIC[0], 1.5, CRITIC[2]] },
  { f: F(W.lazy - 0.4), dur: 20, cInf: 12, focus: () => [CHIPX[3], CHIP_TOP, CHIPZ] },
  { f: F(25.0), cInf: 9, focus: () => [ENG[0], 1.3, ENG[2]] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
