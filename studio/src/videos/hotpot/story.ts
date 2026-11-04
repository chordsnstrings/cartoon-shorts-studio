// "The Robot That Danced Too Close": timeline timed to ~/hotpot-short/voice/words.json (am_michael x1.33, 68.7 s).
// Three places in one scene graph: the restaurant at the origin, the street at x = +200, the kitchen at x = -200.
// tau = story time in the restaurant (s). Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts
// on big jumps, every hold creeps in, impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 2061;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const D0 = 0;
export const STREET = 200, KITCHEN = -200;

// ---------------- restaurant layout ----------------
export const TABLE_H = 0.76;
export const T1: V3 = [-0.85, 0, 0]; // the guest's table
export const T2: V3 = [0.95, 0, 0]; // the table next door
export const TW = 1.2, TD = 0.8;
export const HOME: V3 = [0.2, 0, 2.3]; // the robot's open-floor spot
export const SPOT: V3 = [0.12, 0, 0.62]; // the spot the guest asked for, between the two tables
export const ROBOT_S = 1.18; // card scale: ~1.3 m tall

// ---------------- story beats (seconds, from words.json) ----------------
export const W = {
  apron: 9.96, celebration: 12.52, guest: 13.9, soItDid: 16.6, music: 17.66, armsUp: 18.98, armsOut: 19.88,
  down: 21.42, chop: 23.06, sauce: 24.42, plates: 25.3, three: 26.48, kept: 28.3, phone: 29.44, luckily: 33.02,
  unluckily: 35.44, sauceHand: 38.08, smile: 39.12, here: 40.48, watching: 42.0, plan: 43.72, every: 44.44,
  whatever: 46.3, like: 47.6, edge1: 51.54, left: 52.86, right: 53.72, restaurant: 54.68, programmed: 59.66,
  smaller: 61.02, andThats: 62.82, edge2: 65.68, stops: 66.62, does: 67.34,
};
export const BEAT = 60 / 112; // music tempo
/** arm impacts on the table next door (tau): the slam, then one per "took off" */
export const HITS = [W.down + 0.03, W.chop, W.sauce, W.plates];

// ---------------- robot choreography ----------------
export type Pose = { la: number; le: number; ra: number; re: number; sway: number; head: number; step: number };
const P = (la: number, le: number, ra: number, re: number, sway = 0, head = 0, step = 0): Pose => ({ la, le, ra, re, sway, head, step });
const REST = P(8, 10, 8, 10);
// keyframes [tau, pose]; between keys a smootherstep blend. Reactions land 0-3 f before their word.
const KEYS: [number, Pose][] = [
  [0, REST], [W.apron - 0.2, REST], [W.apron + 0.3, P(10, 20, 35, 70, -3, 6)], [W.apron + 1.1, P(10, 20, 30, 80, 3, -4)],
  [W.celebration - 0.1, P(12, 10, 12, 10)], [W.celebration + 0.25, P(150, 20, 150, 20, 0, 0)], [W.celebration + 0.7, P(160, 10, 160, 10, 4, 6)],
  [W.celebration + 1.2, P(150, 20, 150, 20, -4, -6)], [W.celebration + 1.8, REST],
  [W.music, REST], [W.music + 0.27, P(25, 40, 25, 40, 5, 5, 1)], [W.music + 0.54, P(25, 40, 25, 40, -5, -5, -1)],
  [W.music + 0.8, P(25, 40, 25, 40, 5, 5, 1)],
  [W.armsUp - 0.08, P(165, 10, 165, 10, 0, 0)], [W.armsUp + 0.5, P(170, 5, 170, 5, 3, 4, 1)],
  [W.armsOut - 0.08, P(92, 0, 92, 0, 0, 0)], [W.armsOut + 0.45, P(96, 0, 96, 0, -4, -3, -1)],
  [W.down - 0.45, P(170, 5, 172, 0, 2, 0)], [HITS[0], P(70, 0, 92, 0, 6, 8)], [HITS[0] + 0.35, P(80, 10, 95, 0, 5, 6)],
];
/** one pound: right arm up a beat before, slam on the hit, bounce */
const pound = (tau: number, h: number) => {
  const u = (tau - h) / 0.42;
  if (u < -1.3 || u > 1.2) return null;
  if (u < 0) return P(60, 30, 95 + 75 * smooth((u + 1.3) / 0.6) - 75 * smooth((u + 0.35) / 0.35), 10 * smooth(-u), 4 * Math.sin(u * 3), 5);
  return P(60 + 20 * Math.sin(u * 4), 20, 92 + 14 * Math.sin(u * 6) * (1 - u / 1.2), 5, 6 - 4 * u, 8 - 6 * u);
};
/** the endless routine after the slam: swing both arms side to side on the beat, sway, step */
const groove = (tau: number) => {
  const b = (tau - W.music) / BEAT, ph = b * Math.PI;
  const s = Math.sin(ph), c = Math.cos(ph * 0.5);
  return P(70 + 45 * s, 30 + 20 * c, 105 - 45 * s, 25 - 15 * c, 7 * s, 6 * c, s);
};
const mixP = (a: Pose, b: Pose, k: number): Pose => {
  const o = { ...a } as Record<string, number>;
  for (const key of Object.keys(a) as (keyof Pose)[]) o[key] = a[key] + (b[key] - a[key]) * k;
  return o as unknown as Pose;
};
const glide5 = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
/** robot pose at story time tau; frozen = the song has stopped */
export const robotPose = (tau: number): Pose => {
  if (tau >= W.does) return robotPose(W.does - 0.001);
  if (tau > HITS[0] + 0.35) {
    for (const h of HITS.slice(1)) { const p = pound(tau, h); if (p) return p; }
    const g = groove(tau), k = smooth((tau - (HITS[0] + 0.35)) / 0.5);
    return k < 1 ? mixP(KEYS[KEYS.length - 1][1], g, k) : g;
  }
  for (let i = KEYS.length - 1; i >= 0; i--) if (tau >= KEYS[i][0]) {
    const [t0, a] = KEYS[i], nx = KEYS[i + 1];
    if (!nx) return a;
    return mixP(a, nx[1], glide5((tau - t0) / (nx[0] - t0)));
  }
  return REST;
};
export type RobotFaceK = "happy" | "star" | "closed" | "dots" | "wink";
export const robotFace = (tau: number): RobotFaceK =>
  tau >= W.celebration - 0.08 && tau < W.guest ? "star" : tau >= W.watching - 0.1 && tau < W.plan ? "closed" : tau >= W.music ? "happy" : "dots";
/** where the robot stands */
export const robotPos = (tau: number): V3 => {
  const k = glide5((tau - (W.soItDid - 0.05)) / 0.95);
  return [HOME[0] + (SPOT[0] - HOME[0]) * k, 0, HOME[2] + (SPOT[2] - HOME[2]) * k];
};

// ---------------- flying tableware (pure function of tau) ----------------
export type Item = { kind: "plate" | "chop" | "sauce" | "cup"; p0: V3; v: V3; spin: V3; at: number; rest?: V3 };
const G = 7.0; // cartoon gravity: a little more hang time
const it = (kind: Item["kind"], x: number, z: number, at: number, v: V3, spin: V3): Item =>
  ({ kind, p0: [T2[0] + x, TABLE_H + (kind === "chop" ? 0.012 : 0.01), T2[2] + z], v, spin, at });
export const ITEMS: Item[] = [
  // chopsticks (pairs) launch on "Chopsticks took off"
  it("chop", -0.42, 0.22, HITS[1], [-0.7, 2.5, 1.0], [9, 2, 14]), it("chop", -0.3, -0.25, HITS[1] + 0.04, [0.2, 2.8, 1.2], [-12, 4, 8]),
  it("chop", 0.3, 0.25, HITS[1] + 0.06, [0.9, 2.3, 1.1], [7, -3, -11]), it("chop", 0.42, -0.22, HITS[1] + 0.03, [1.2, 2.6, 0.6], [-8, 6, 12]),
  // sauce dishes on "Sauces took off"
  it("sauce", -0.4, 0.05, HITS[2], [-0.5, 2.3, 1.2], [5, 0, 7]), it("sauce", 0.4, 0.05, HITS[2] + 0.05, [0.9, 2.5, 0.9], [-6, 0, 5]),
  it("sauce", -0.12, 0.3, HITS[2] + 0.03, [0.1, 2.7, 1.4], [4, 0, -8]),
  // plates on "Plates took off"
  it("plate", -0.3, 0.12, HITS[3], [-0.4, 2.6, 1.1], [6, 0, 9]), it("plate", 0.3, 0.12, HITS[3] + 0.04, [0.8, 2.8, 1.2], [-7, 0, 8]),
  it("plate", 0.0, -0.28, HITS[3] + 0.02, [0.3, 3.0, 0.9], [8, 0, -6]), it("plate", -0.38, -0.2, HITS[3] + 0.06, [-0.8, 2.4, 0.8], [-5, 0, -9]),
  // the one plate that stays on the edge until the very end
  it("plate", 0.42, 0.28, 99, [0, 0, 0], [0, 0, 0]),
];
export const LAST_PLATE = ITEMS.length - 1;
export const LAST_DROP = W.does + 0.62; // tau: the last plate slides off after the music stops
/** every item jumps a little on every earlier hit (the table shakes) */
const jolt = (tau: number) => HITS.reduce((a, h) => { const d = tau - h; return a + (d > 0 && d < 0.3 ? 0.04 * Math.sin((d / 0.3) * Math.PI) : 0); }, 0);
export const itemAt = (i: number, tau: number): { p: V3; r: V3; flying: boolean } => {
  const I = ITEMS[i];
  if (i === LAST_PLATE) {
    const d = tau - LAST_DROP;
    if (d < 0) return { p: [I.p0[0], I.p0[1] + jolt(tau), I.p0[2]], r: [0, 0, 0], flying: false };
    // tips over the front edge (+z) and falls to the floor
    const tl = Math.min(d, Math.sqrt((2 * I.p0[1]) / 9.8));
    return { p: [I.p0[0], Math.max(0.015, I.p0[1] - 4.9 * tl * tl), I.p0[2] + 0.18 + 0.6 * tl], r: [Math.min(1.4, d * 5), 0, 0], flying: d * 1 < 0.45 };
  }
  const d = tau - I.at;
  if (d < 0) return { p: [I.p0[0], I.p0[1] + jolt(tau), I.p0[2]], r: [0, 0, 0], flying: false };
  const vy = I.v[1], tLand = (vy + Math.sqrt(vy * vy + 2 * G * (I.p0[1] - 0.015))) / G;
  const tl = Math.min(d, tLand), slide = Math.max(0, d - tLand);
  const sk = 1 - Math.exp(-slide * 4), fr = 0.25 * sk;
  const p: V3 = [I.p0[0] + I.v[0] * tl + I.v[0] * fr, Math.max(0.015, I.p0[1] + vy * tl - 0.5 * G * tl * tl), I.p0[2] + I.v[2] * tl + I.v[2] * fr];
  const landed = d >= tLand;
  const r: V3 = landed ? [I.kind === "chop" ? Math.PI / 2 : 0, I.spin[1] * tLand, I.kind === "chop" ? 0 : 0] : [I.spin[0] * tl, I.spin[1] * tl, I.spin[2] * tl];
  return { p, r, flying: !landed };
};

// ---------------- wind-up toy on the kitchen counter ----------------
export const COUNTER_H = 0.92, EDGE_X = KITCHEN + 1.0, TOY_Z = -0.28;
/** toy x along the counter: walks right at 0.2 m/s, tips its toe right at the edge as the key runs down */
export const toyX = (t: number) => {
  if (t < 60) return EDGE_X - 1.38 + 0.12 * (t - W.like);
  const x0 = EDGE_X - 0.42, u = clamp01((t - W.andThats) / (W.stops - W.andThats));
  return x0 + 0.32 * (1 - (1 - u) ** 1.6);
};
export const toyPhase = (t: number) => (t < 60 ? (t - W.like) * 1.25 : (W.andThats - 0 + (t - W.andThats) * (1.3 - 0.5 * clamp01((t - W.andThats) / 3.8))) * 1.25);
export const toyStopped = (t: number) => t >= W.stops;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: "rest" | "street" | "kitchen"; tau: (t: number) => number; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 153, light: "indoor", place: "rest", tau: (t) => t + 21.95 }, // hook: flash-forward into the chaos
  { id: 2, a: 153, b: F(9.2), light: "day", place: "street", tau: (t) => t, sunAz: 150, sunEl: 40 },
  { id: 3, a: F(9.2), b: F(13.85), light: "indoor", place: "rest", tau: (t) => t },
  { id: 4, a: F(13.85), b: F(17.6), light: "indoor", place: "rest", tau: (t) => t },
  { id: 5, a: F(17.6), b: F(20.83), light: "indoor", place: "rest", tau: (t) => t },
  { id: 6, a: F(20.83), b: F(23.0), light: "indoor", place: "rest", tau: (t) => t },
  { id: 7, a: F(23.0), b: F(26.43), light: "indoor", place: "rest", tau: (t) => t },
  { id: 8, a: F(26.43), b: F(29.4), light: "indoor", place: "rest", tau: (t) => t },
  { id: 9, a: F(29.4), b: F(32.97), light: "indoor", place: "rest", tau: (t) => t },
  { id: 10, a: F(32.97), b: F(35.4), light: "indoor", place: "rest", tau: (t) => t },
  { id: 11, a: F(35.4), b: F(40.43), light: "indoor", place: "rest", tau: (t) => t },
  { id: 12, a: F(40.43), b: F(47.55), light: "indoor", place: "rest", tau: (t) => t },
  { id: 13, a: F(47.55), b: F(54.63), light: "indoor", place: "kitchen", tau: (t) => t },
  { id: 14, a: F(54.63), b: F(62.77), light: "indoor", place: "rest", tau: (t) => t },
  { id: 15, a: F(62.77), b: F(67.15), light: "indoor", place: "kitchen", tau: (t) => t },
  { id: 16, a: F(67.15), b: TOTAL, light: "indoor", place: "rest", tau: (t) => t },
];
export const XFADE: Record<number, number> = { 13: 8, 14: 8, 15: 8 };
export const FLASH_AT = 152;
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
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const K = (x: number, y: number, z: number): V3 => [KITCHEN + x, y, z];
const S = (x: number, y: number, z: number): V3 => [STREET + x, y, z];
const toyAt = (f: number): V3 => [toyX(f / FPS), COUNTER_H + 0.07, TOY_Z];

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: (f) => dolly([1.1, 1.3, 4.0], [0.3, 0.9, 0.4], pushK(f, 0, 0.0025), { fov: 42 }) },
    { f: 33, dur: 30, s: (f) => dolly([0.75, 1.15, 3.4], [0.3, 0.95, 0.4], pushK(f, 33, 0.002), { fov: 40, roll: -0.04 }) }, // "Silicon Valley"
    { f: 99, cut: true, s: (f) => dolly([2.25, 1.4, 1.75], [0.95, 0.98, 0.05], pushK(f, 99, 0.003, 0.006, 30), { fov: 40, roll: 0.04 }) }, // "destroyed"
  ],
  2: [
    { f: 153, s: (f) => zoom(S(-6.5, 1.4, 6.5), S(0.5, 4.4, -10), 58, pushK(f, 153, 0.0018), { roll: -0.03 }) },
    { f: 196, dur: 34, s: (f) => zoom(S(-3.2, 1.5, 2.5), S(0.5, 3.4, -10), 54, pushK(f, 213, 0.002, 0.005, 30), { roll: 0.02 }) }, // "a hot pot restaurant"
  ],
  3: [
    { f: 276, s: (f) => dolly([0.9, 1.15, 5.3], [HOME[0], 0.85, HOME[2]], pushK(f, 276, 0.0025), { fov: 40 }) },
    { f: 293, dur: 26, s: (f) => dolly([0.6, 1.05, 4.6], [HOME[0], 0.82, HOME[2]], pushK(f, 293, 0.002), { fov: 38 }) }, // "apron"
    { f: 374, cut: true, s: (f) => dolly([0.45, 1.05, 3.75], [HOME[0], 0.95, HOME[2]], pushK(f, 374, 0.0025, 0.006, 30), { fov: 38, roll: 0.04 }) }, // "celebration mode"
  ],
  4: [
    { f: 415, s: (f) => dolly([-0.4, 1.3, 1.55], [-0.85, 1.08, -0.75], pushK(f, 415, 0.0025), { fov: 40 }) },
    { f: 496, cut: true, s: (f) => dolly([3.3, 1.9, 4.9], [0.15, 0.8, 1.2], pushK(f, 496, 0.002), { fov: 40 }) }, // "So it did"
  ],
  5: [
    { f: 528, s: (f) => dolly([0.35, 0.8, 3.0], [0.15, 1.0, 0.6], pushK(f, 528, 0.0025), { fov: 42 }) },
    { f: 584, dur: 24, s: (f) => dolly([0.2, 0.85, 2.6], [0.15, 1.0, 0.6], pushK(f, 584, 0.002), { fov: 42, roll: -0.04 }) }, // "Arms out"
  ],
  6: [
    { f: 625, s: (f) => dolly([1.15, 1.25, 2.15], [0.45, 0.92, 0.3], pushK(f, 625, 0.003), { fov: 40 }) },
    { f: 641, dur: 20, s: rolled((f) => dolly([1.15, 1.25, 2.15], [0.45, 0.92, 0.3], pushK(f, 625, 0.003, 0.007, 25), { fov: 40 }), 0.05) }, // the slam
  ],
  7: [
    { f: 690, s: (f) => dolly([2.7, 1.55, 2.5], [0.9, 1.15, 0.1], pushK(f, 690, 0.0025, 0.006, 25), { fov: 44 }) }, // chopsticks
    { f: 731, cut: true, s: (f) => dolly([-0.9, 1.45, 2.6], [0.75, 1.1, 0.25], pushK(f, 731, 0.0025, 0.006, 25), { fov: 44, roll: -0.04 }) }, // sauces
    { f: 757, cut: true, s: (f) => dolly([1.4, 0.9, 3.0], [0.9, 1.35, 0.25], pushK(f, 757, 0.002, 0.006, 25), { fov: 46, roll: 0.04 }) }, // plates
  ],
  8: [
    { f: 793, s: (f) => dolly([0.45, 1.3, 3.7], [0.2, 1.0, 0.55], pushK(f, 793, 0.0025), { fov: 44 }) },
    { f: 846, dur: 24, s: (f) => dolly([0.3, 1.2, 3.0], [0.2, 1.0, 0.55], pushK(f, 846, 0.002), { fov: 42, roll: 0.04 }) }, // "It kept dancing"
  ],
  9: [
    { f: 882, s: (f) => dolly([0.55, 1.6, 3.3], [1.28, 1.52, 1.55], pushK(f, 882, 0.0025), { fov: 36 }) },
    { f: 930, dur: 30, s: (f) => dolly([0.85, 1.58, 2.75], [1.3, 1.5, 1.55], pushK(f, 930, 0.002, 0.005, 30), { fov: 34, roll: -0.04 }) }, // "possibly"
  ],
  10: [
    { f: 989, s: (f) => dolly([-1.3, 1.22, 0.78], [-0.85, 0.8, 0.0], pushK(f, 989, 0.003), { fov: 38 }) },
  ],
  11: [
    { f: 1062, s: (f) => dolly([0.4, 1.1, 2.6], [0.15, 0.95, 0.62], pushK(f, 1062, 0.0025), { fov: 42, roll: 0.03 }) },
    { f: 1140, cut: true, s: (f) => dolly([0.95, 1.05, 1.95], [0.55, 0.88, 0.62], pushK(f, 1140, 0.003, 0.006, 25), { fov: 40 }) }, // "sauce"
    { f: 1172, cut: true, s: (f) => dolly([0.2, 1.2, 1.55], [0.13, 1.17, 0.62], pushK(f, 1172, 0.003, 0.006, 25), { fov: 36, roll: -0.04 }) }, // "smile"
  ],
  12: [
    { f: 1213, s: (f) => dolly([0.15, 1.05, 2.7], [0.15, 1.0, 0.62], pushK(f, 1213, 0.0025), { fov: 40 }) },
    { f: 1248, dur: 30, s: (f) => dolly([0.15, 1.15, 2.0], [0.13, 1.12, 0.62], pushK(f, 1248, 0.003), { fov: 38 }) }, // "wasn't watching"
    { f: 1309, cut: true, s: (f) => dolly([1.5, 1.4, 2.9], [0.55, 0.98, 0.3], pushK(f, 1309, 0.002), { fov: 42 }) }, // "plan"
    { f: 1385, dur: 28, s: (f) => dolly([1.6, 1.15, 2.2], [0.75, 0.9, 0.2], pushK(f, 1385, 0.002, 0.005, 30), { fov: 40, roll: 0.04 }) }, // "whatever was in the way"
  ],
  13: [
    { f: 1424, s: (f) => { const x = toyAt(f)[0]; return dolly([x + 0.15, 1.12, 0.72], [x + 0.04, COUNTER_H + 0.06, TOY_Z], pushK(f, 1424, 0.002), { fov: 40 }); } },
    { f: 1544, cut: true, s: (f) => dolly(K(1.6, 1.05, 0.35), K(0.3, COUNTER_H + 0.04, TOY_Z), pushK(f, 1544, 0.0025), { fov: 40 }) }, // "edge"
    { f: 1584, cut: true, s: (f) => { const p = toyAt(f); return { pos: [p[0] + 0.08, COUNTER_H + 0.06, 0.12], look: [p[0], COUNTER_H + 0.04, TOY_Z], fov: 40, roll: 0.04 }; } }, // "left foot"
  ],
  14: [
    { f: 1636, s: (f) => dolly([2.9, 1.75, 3.8], [0.35, 0.75, 0.25], pushK(f, 1636, 0.002), { fov: 42 }) },
    { f: 1788, dur: 28, s: (f) => dolly([0.05, 1.15, 2.6], [0.2, 0.98, 0.6], pushK(f, 1788, 0.0025), { fov: 40 }) }, // "programmed"
    { f: 1828, cut: true, s: (f) => dolly([4.6, 3.1, 6.0], [0.2, 0.6, 0.3], pushK(f, 1828, 0.0015), { fov: 44 }) }, // "smaller space"
  ],
  15: [
    { f: 1880, s: (f) => dolly(K(1.5, 1.0, 0.5), K(0.72, COUNTER_H + 0.03, TOY_Z), pushK(f, 1880, 0.0025), { fov: 38 }) },
    { f: 1966, dur: 30, s: (f) => dolly(K(1.2, 0.98, 0.25), K(0.92, COUNTER_H + 0.04, TOY_Z), pushK(f, 1966, 0.003, 0.005, 30), { fov: 38, roll: -0.04 }) }, // "edge" -> "stops"
  ],
  16: [
    { f: 2014, s: (f) => dolly([0.9, 1.35, 3.6], [0.72, 0.8, 0.45], pushK(f, 2014, 0.0015), { fov: 48 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [3.35, 1.3], // hook: plates fly
  ...HITS.map((h, i) => [h, i === 0 ? 1.6 : 0.8] as [number, number]),
  [W.three + 0.15, 0.5], [LAST_DROP + 0.33, 0.9],
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
const robotEyes = (f: number): V3 => { const s = shotAt(f), p = robotPos(s.tau(f / FPS)); return [p[0], 1.15, p[2]]; };
export const DOF: Dof[] = [
  { f: 0, cInf: 12, focus: robotEyes },
  { f: 99, cInf: 13 }, // plates CU, focus = look
  { f: 153, cInf: 0 }, // street establishing
  { f: 276, cInf: 11, focus: robotEyes },
  { f: 416, cInf: 13, focus: () => [-0.85, 1.12, -0.75] }, // guest MS
  { f: 496, cInf: 0 }, // wide
  { f: 528, cInf: 11, focus: robotEyes },
  { f: 625, cInf: 13 }, // slam CU
  { f: 690, cInf: 6 }, // flying stuff: mild
  { f: 793, cInf: 10, focus: robotEyes },
  { f: 882, cInf: 15 }, // phone CU, focus = look
  { f: 989, cInf: 15 }, // broth insert
  { f: 1062, cInf: 11, focus: robotEyes },
  { f: 1140, cInf: 13 }, { f: 1172, cInf: 14 },
  { f: 1213, cInf: 11, focus: robotEyes },
  { f: 1309, cInf: 6 },
  { f: 1424, cInf: 14 }, // kitchen macro: shallow
  { f: 1636, cInf: 0 }, // aftermath wide
  { f: 1788, dur: 28, cInf: 11, focus: robotEyes },
  { f: 1828, cInf: 0 },
  { f: 1880, cInf: 15 },
  { f: 2015, cInf: 10, focus: robotEyes },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
