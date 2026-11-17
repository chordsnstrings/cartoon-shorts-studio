// "One update took the whole store down": Apple's internal update knocks its services offline (Tue 17 Nov 2026).
// Timeline timed to pipeline/stories/outage/words.json (ElevenLabs George, 27.0 s).
// Two places in one scene graph: the phone STORE (x 0: wall screen, two display tables, the checkout counter with a card
// reader + register) and the back OFFICE (x + 400: server racks, desk, monitor running the update).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 850;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const STORE = 0, OFFICE = 400;

// ---------------- story beats (film seconds, ElevenLabs alignment cross-checked with whisper) ----------------
export const W = {
  tuesday: 0.48, one: 1.42, update: 1.91, knocked: 2.36, apple: 2.71, offline: 3.11,
  icloud: 4.4, signed: 4.54, out: 5.22, pay: 6.12, stopped: 6.41, paying: 6.83, store: 7.93, wouldnt: 8.28, load: 8.52,
  brand: 9.25, iphones: 9.81, said: 10.67, unable: 11.42, activate: 11.92,
  even: 13.46, stores: 14.34, couldnt: 14.72, sell: 15.07, anything: 15.22,
  status: 16.16, page: 16.58, still: 17.09, green: 17.61,
  says: 18.61, wasnt: 18.99, hackers: 19.27, it: 20.18, own: 20.61, internal: 20.92, update2: 21.57,
  did: 22.44, phone: 22.73, weird: 23.22, today: 23.56, send: 24.21, friend: 24.95, blamed: 25.44, wifi: 26.02,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
export const TABLE_Y = 0.92;
/** display tables: centre x, z; 3.2 x 1.1 m */
export const T1: V3 = [STORE + 0.0, TABLE_Y, -1.4];
export const T2: V3 = [STORE - 4.2, TABLE_Y, -1.4];
/** wall screen on the back wall */
export const SCREEN = { x: STORE, y: 2.5, z: -5.9, w: 6.0, h: 3.375 };
/** checkout counter (x 3.6..5.8, z -3.0..-2.3, top 1.0), card reader + register on top */
export const COUNTER = { x0: STORE + 3.6, x1: STORE + 5.8, z0: -3.0, z1: -2.3, y: 1.0 };
export const READER: V3 = [STORE + 4.1, 1.0, -2.5];
export const REGISTER: V3 = [STORE + 5.15, 1.0, -2.65];
/** wifi router on table 2 */
export const ROUTER: V3 = [STORE - 3.26, TABLE_Y, -1.5];
/** office: monitor on the desk facing the camera, server racks behind */
export const MONITOR = { x: OFFICE - 0.25, y: 1.18, z: -1.55, w: 0.9, h: 0.52 };
export const DESK_Y = 0.75;

// ---------------- shots ----------------
export type Light = "day" | "indoor" | "night";
export type Place = "store" | "office";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.25), light: "indoor", place: "store", sunAz: 140, sunEl: 55 }, // hook: the whole store goes down
  { id: 2, a: F(4.25), b: F(5.55), light: "indoor", place: "store", sunAz: 130, sunEl: 55 }, // the cloud leaves the phone
  { id: 3, a: F(5.55), b: F(7.2), light: "indoor", place: "store", sunAz: 150, sunEl: 55 }, // pay: the reader says no
  { id: 4, a: F(7.2), b: F(9.15), light: "indoor", place: "store", sunAz: 140, sunEl: 55 }, // the wall screen spins forever
  { id: 5, a: F(9.15), b: F(13.35), light: "indoor", place: "store", sunAz: 140, sunEl: 55 }, // brand-new phone: locked
  { id: 6, a: F(13.35), b: F(15.95), light: "indoor", place: "store", sunAz: 150, sunEl: 55 }, // the queue: nothing sells
  { id: 7, a: F(15.95), b: F(18.15), light: "indoor", place: "store", sunAz: 140, sunEl: 55 }, // status page: all green
  { id: 8, a: F(18.15), b: F(20.05), light: "indoor", place: "store", sunAz: 150, sunEl: 55 }, // not hackers
  { id: 9, a: F(20.05), b: F(22.35), light: "indoor", place: "office", sunAz: 140, sunEl: 55 }, // their own update
  { id: 10, a: F(22.35), b: TOTAL, light: "indoor", place: "store", sunAz: 140, sunEl: 55 }, // blame the wifi
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.25);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- what the screens show ----------------
export type WallMode = "hero" | "glitch" | "dark" | "spin" | "status";
/** wall screen picture for shot id at film time t (k = spinner step / glitch variant) */
export const wallAt = (id: number, t: number): { mode: WallMode; k: number } => {
  if (id === 1) {
    if (t < W.knocked - 0.05) return { mode: "hero", k: 0 };
    if (t < W.offline - 0.05) return { mode: Math.floor(t * 15) % 3 === 0 ? "dark" : "glitch", k: Math.floor(t * 15) % 3 };
    return { mode: "dark", k: 0 };
  }
  if (id === 4) return { mode: "spin", k: Math.floor(t * 12) % 8 };
  if (id === 7) return { mode: "status", k: 0 };
  if (id === 5 || id === 10) return { mode: "dark", k: 0 };
  return { mode: "dark", k: 0 };
};
/** the little phones on the display tables: fraction switched off (hook: they die one by one) */
export const tablePhonesOff = (id: number, t: number) => (id === 1 ? clamp01((t - W.knocked + 0.2) / 0.9) : 1);
/** card reader face: "ok" (waiting) or "no" (red cross) */
export const readerAt = (id: number, t: number) => (id === 3 && at(t, W.stopped) ? "no" : id === 3 ? "ok" : "dark");
/** office monitor: update progress 0..1, then "err" */
export const monitorAt = (t: number): { mode: "upd" | "err"; u: number } =>
  t >= W.update2 - LEADS ? { mode: "err", u: 1 } : { mode: "upd", u: clamp01((t - 20.05) / (W.update2 - 20.1)) };
/** server rack LEDs: on (green blink) until the update lands, then red */
export const racksOk = (id: number, t: number) => !(id === 9 && at(t, W.update2));

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
/** look point d metres from pos toward target (pushK creeps along pos->look: keep it near) */
export const aim = (pos: V3, target: V3, d = 6): V3 => {
  const v = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]], n = Math.hypot(...v) || 1;
  return [pos[0] + (v[0] / n) * d, pos[1] + (v[1] / n) * d, pos[2] + (v[2] / n) * d];
};
const S = (x: number, y: number, z: number): V3 => [STORE + x, y, z];
const O = (x: number, y: number, z: number): V3 => [OFFICE + x, y, z];

/** cast positions (feet) */
export const C1: V3 = S(-0.5, 0, -2.25); // hook customer, behind table 1
export const S1: V3 = S(0.6, 0, -2.3); // staff, behind table 1
export const C2: V3 = S(-4.2, 0, -2.15); // cloud customer, behind table 2
export const C3: V3 = S(3.4, 0, -1.7); // pay customer, in front of the counter
export const S2: V3 = S(5.05, 0, -3.45); // staff behind the counter
export const C4: V3 = S(0.05, 0, -2.2); // unboxer, behind table 1
export const UP_A: V3 = S(-0.42, 0, -0.05); // spinner watchers, in front of table 1
export const UP_B: V3 = S(0.48, 0, -0.15);
export const QUEUE: V3[] = [S(3.9, 0, -1.65), S(3.05, 0, -1.2), S(2.2, 0, -0.75), S(1.35, 0, -0.3)];
export const S1W: V3 = S(1.25, 0, -3.3); // staff at the wall screen
export const ENG: V3 = O(0.55, 0, -1.95); // engineer by the monitor
export const C1W: V3 = S(-4.15, 0, -2.15); // ending: by the router

const CAMS: Record<number, Key[]> = {
  1: [
    // across the display table: customer + staff behind it, phones dying on the table, wall screen glitching behind
    { f: 0, s: (f) => dolly(S(0.05, 1.5, 1.7), aim(S(0.05, 1.5, 1.7), S(0.05, 1.55, -2.3), 5.5), pushK(f, 0, 0.0028), { fov: 50, roll: -0.03 }) },
    { f: F(W.offline - 0.1), dur: 14, s: (f) => dolly(S(0.05, 1.55, 1.3), aim(S(0.05, 1.55, 1.3), S(0.05, 1.6, -2.3), 5.5), pushK(f, F(W.offline), 0.002, 0.007, 22), { fov: 50, roll: 0.04 }) },
  ],
  2: [
    { f: F(4.25), s: (f) => dolly(S(-3.95, 1.5, 1.35), aim(S(-3.95, 1.5, 1.35), S(-4.05, 1.5, -2.15), 5), pushK(f, F(4.25), 0.003, 0.006, 20), { fov: 42, roll: 0.03 }) },
  ],
  3: [
    // side-on at the counter: customer taps, reader refuses, staff behind
    { f: F(5.55), s: (f) => dolly(S(2.2, 1.55, 0.9), aim(S(2.2, 1.55, 0.9), S(4.35, 1.25, -2.6), 5), pushK(f, F(5.55), 0.0025), { fov: 46, roll: -0.03 }) },
    { f: F(W.stopped - 0.1), dur: 16, s: (f) => dolly(S(2.4, 1.5, 0.55), aim(S(2.4, 1.5, 0.55), S(4.3, 1.2, -2.6), 5), pushK(f, F(W.stopped), 0.002, 0.007, 22), { fov: 46, roll: 0.04 }) },
  ],
  4: [
    // two customers stare up at the wall screen: the spinner never stops
    { f: F(7.2), s: (f) => dolly(S(0.05, 1.35, 2.5), aim(S(0.05, 1.35, 2.5), S(0.05, 2.25, -5.9), 6), pushK(f, F(7.2), 0.0025), { fov: 52, roll: 0.02 }) },
    { f: F(W.load - 0.1), dur: 16, s: (f) => dolly(S(0.05, 1.35, 2.2), aim(S(0.05, 1.35, 2.2), S(0.05, 2.3, -5.9), 6), pushK(f, F(W.load), 0.002, 0.006, 22), { fov: 52, roll: -0.04 }) },
  ],
  5: [
    // the unboxer, happy, sparkles... then the CU deadpan
    { f: F(9.15), s: (f) => dolly(S(0.15, 1.55, 1.2), aim(S(0.15, 1.55, 1.2), S(0.05, 1.45, -2.2), 5), pushK(f, F(9.15), 0.0022), { fov: 44, roll: -0.02 }) },
    { f: F(W.unable - 0.1), cut: true, s: (f) => dolly(S(0.25, 1.6, -0.1), aim(S(0.25, 1.6, -0.1), S(0.08, 1.55, -2.2), 4.5), pushK(f, F(W.unable), 0.0018, 0.005, 22), { fov: 42, roll: 0.03 }) },
  ],
  6: [
    // wide on the queue at the dead register
    { f: F(13.35), s: (f) => dolly(S(-0.9, 1.85, 3.4), aim(S(-0.9, 1.85, 3.4), S(3.6, 1.15, -2.2), 6), pushK(f, F(13.35), 0.0022), { fov: 54, roll: 0.02 }) },
    { f: F(W.sell - 0.1), dur: 18, s: (f) => dolly(S(-0.6, 1.8, 3.0), aim(S(-0.6, 1.8, 3.0), S(3.7, 1.2, -2.3), 6), pushK(f, F(W.sell), 0.002, 0.006, 22), { fov: 54, roll: -0.04 }) },
  ],
  7: [
    // the status wall: all green, while the table phones pop errors
    { f: F(15.95), s: (f) => dolly(S(0.3, 1.55, 1.0), aim(S(0.3, 1.55, 1.0), S(0.6, 2.2, -5.9), 6), pushK(f, F(15.95), 0.0022), { fov: 50, roll: -0.02 }) },
    { f: F(W.green - 0.1), dur: 14, s: (f) => dolly(S(0.4, 1.65, 0.3), aim(S(0.4, 1.65, 0.3), S(0.55, 2.3, -5.9), 6), pushK(f, F(W.green), 0.002, 0.007, 22), { fov: 50, roll: 0.04 }) },
  ],
  8: [
    // staff behind the counter; a hooded hacker icon pops up and gets crossed out
    { f: F(18.15), s: (f) => dolly(S(3.6, 1.6, 0.2), aim(S(3.6, 1.6, 0.2), S(4.85, 1.75, -3.4), 5), pushK(f, F(18.15), 0.0025), { fov: 46, roll: 0.02 }) },
    { f: F(W.hackers - 0.1), dur: 14, s: (f) => dolly(S(3.7, 1.6, -0.1), aim(S(3.7, 1.6, -0.1), S(4.85, 1.75, -3.4), 5), pushK(f, F(W.hackers), 0.002, 0.007, 22), { fov: 46, roll: -0.04 }) },
  ],
  9: [
    // the back office: the update bar fills... the racks turn red
    { f: F(20.05), s: (f) => dolly(O(0.35, 1.5, 1.35), aim(O(0.35, 1.5, 1.35), O(0.15, 1.3, -2.3), 5), pushK(f, F(20.05), 0.0025), { fov: 48, roll: -0.02 }) },
    { f: F(W.update2 - 0.1), dur: 14, s: (f) => dolly(O(0.35, 1.5, 0.95), aim(O(0.35, 1.5, 0.95), O(0.15, 1.35, -2.3), 5), pushK(f, F(W.update2), 0.002, 0.008, 22), { fov: 48, roll: 0.045 }) },
  ],
  10: [
    // she blames the wifi router... then laughs at us
    { f: F(22.35), s: (f) => dolly(S(-3.7, 1.5, 1.05), aim(S(-3.7, 1.5, 1.05), S(-3.74, 1.35, -2.15), 5), pushK(f, F(22.35), 0.0022), { fov: 44, roll: 0.02 }) },
    { f: F(W.send - 0.1), dur: 26, s: (f) => dolly(S(-3.95, 1.6, 0.4), aim(S(-3.95, 1.6, 0.4), S(-4.1, 1.6, -2.15), 5), pushK(f, F(W.send), 0.0014, 0.003, 22), { fov: 42, roll: 0.03 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.knocked + 0.02, 0.6], [W.offline + 0.02, 1.0], [W.out + 0.02, 0.5], [W.stopped + 0.02, 0.7], [W.load + 0.02, 0.5],
  [W.unable + 0.02, 0.6], [W.sell + 0.02, 0.5], [W.green + 0.02, 0.6], [W.hackers + 0.02, 0.7], [W.update2 + 0.02, 0.9],
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
  const Ld = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * Ld * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const eyes = (p: V3, dy = 1.62): (() => V3) => () => [p[0], p[1] + dy, p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 8, focus: eyes(C1) },
  { f: F(4.25), cInf: 11, focus: eyes(C2) },
  { f: F(5.55), cInf: 8, focus: eyes(C3) },
  { f: F(7.2), cInf: 0 },
  { f: F(9.15), cInf: 9, focus: eyes(C4) },
  { f: F(W.unable - 0.1), cInf: 13, focus: eyes(C4) },
  { f: F(13.35), cInf: 0 },
  { f: F(15.95), cInf: 0 },
  { f: F(18.15), cInf: 9, focus: eyes(S2) },
  { f: F(20.05), cInf: 8, focus: eyes(ENG) },
  { f: F(22.35), cInf: 10, focus: eyes(C1W) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
