// "The Christmas Market That Only Existed in AI": timeline timed to pipeline/stories/market/words.json (ElevenLabs George, 33.2 s).
// Two places: the bare warehouse HALL (5 lonely huts, buckets under a leaky roof, the AI banner on the back wall) and the
// DREAM market of the ad (x + DREAM_X: snow, glowing huts, fairy-light garlands, a giant tree).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1008;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// ---------------- story beats (film seconds, ElevenLabs alignment, whisper-checked) ----------------
export const W = {
  christmas: 0.54, magical: 1.69, online: 2.27, real: 3.35, life: 3.69, buckets: 4.6,
  ads: 5.41, fairy: 6.08, lights: 6.42, snowy: 7.24, stalls: 7.64, happy: 8.26, crowds: 8.61,
  traders: 9.31, promised: 9.91, over: 10.33, fifty: 10.64, stalls2: 10.99, twenty: 12.0, hundred: 12.56, visitors: 12.89, day: 13.52,
  one: 14.2, counted: 14.78, about: 15.56, five: 15.91, stalls3: 16.31,
  buckets2: 17.26, catching: 17.97, drips: 18.6, leaky: 19.23, roof: 19.64,
  pictures: 20.3, made: 20.89, by: 21.29, ai: 21.61,
  four: 22.29, days: 22.51, opening: 23.07, every: 23.86, booking: 24.18, cancelled: 24.75,
  organiser: 26.03, called: 26.57, it: 26.89, lesson: 27.46, learned: 27.99,
  would: 28.82, trust: 29.05, ai2: 29.56, poster: 29.96, send: 30.95, friend: 31.51, books: 32.06, online2: 32.34,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** the warehouse: x0..x1, z0 (back wall, banner) .. z1 (front wall), eave + ridge heights */
export const HALL = { x0: -14, x1: 14, z0: -24, z1: 8, eave: 6.2, ridge: 8.6 };
export type Hut = { x: number; z: number; ry: number };
/** the five lonely huts: a left row facing +x, a right pair facing -x, a wide empty aisle between */
export const HUTS: Hut[] = [
  { x: -4.8, z: -7, ry: Math.PI / 2 }, { x: -4.8, z: -13.5, ry: Math.PI / 2 }, { x: -4.8, z: -20, ry: Math.PI / 2 },
  { x: 4.8, z: -10, ry: -Math.PI / 2 }, { x: 4.8, z: -17, ry: -Math.PI / 2 },
];
/** buckets on the floor (each with a drip from the roof above) */
export const BUCKETS: { x: number; z: number; col: string; puddle?: number; period: number; hit: number }[] = [
  { x: 0.7, z: -2.3, col: "#d8453a", puddle: 0.55, period: 2.5, hit: 1.1 },  // 0: the hook bucket
  { x: -0.6, z: -5.0, col: "#3a7ad8", puddle: 0.45, period: 2.4, hit: 18.66 }, // 1: the buckets-shot hero (splash on "drips")
  { x: 1.1, z: -7.4, col: "#e8a33a", period: 2.7, hit: 0.4 },
  { x: -0.9, z: -10.6, col: "#3aa86a", puddle: 0.6, period: 2.3, hit: 1.9 },
  { x: 0.7, z: -14.2, col: "#d8453a", period: 2.9, hit: 0.9 },
  { x: -1.7, z: -17.6, col: "#3a7ad8", puddle: 0.5, period: 2.6, hit: 29.9 },
];
/** the dream market of the ad */
export const DREAM_X = 400;
export const DREAM_HUTS: Hut[] = (() => {
  const out: Hut[] = [];
  for (let i = 0; i < 5; i++) { out.push({ x: DREAM_X - 5.2, z: -2 - i * 3.4, ry: Math.PI / 2 }); out.push({ x: DREAM_X + 5.2, z: -2 - i * 3.4, ry: -Math.PI / 2 }); }
  return out;
})();
export const TREE: V3 = [DREAM_X, 0, -21];

// ---------------- shots ----------------
export type Light = "indoor" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(5.15), light: "indoor" },          // hook: she walks in on the payoff: an empty shed, drips, buckets
  { id: 2, a: F(5.15), b: F(9.25), light: "night" },     // the ad: fairy lights, snowy stalls, happy crowds
  { id: 3, a: F(9.25), b: F(14.1), light: "indoor" },    // the trader dreams of 50 stalls and 2,500 visitors a day
  { id: 4, a: F(14.1), b: F(17.1), light: "indoor" },    // the wide: one, two ... five stalls
  { id: 5, a: F(17.1), b: F(20.15), light: "indoor" },   // the buckets under the leaky roof
  { id: 6, a: F(20.15), b: F(22.2), light: "indoor" },   // the banner glitches: made by AI
  { id: 7, a: F(22.2), b: F(25.75), light: "indoor" },   // shutters slam down: every booking cancelled
  { id: 8, a: F(25.75), b: F(28.7), light: "indoor" },   // the organiser: a lesson learned (a drip on the head)
  { id: 9, a: F(28.7), b: TOTAL, light: "indoor" },      // would you trust an AI poster?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(5.15);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

// ---------------- drips ----------------
/** cartoon drip: leaves the roof from rest and lands at DRIP_V m/s under a soft gravity (slow enough to follow on screen).
 *  height above the landing point as a function of the time left to land */
export const DRIP_V = 6.5, DRIP_G = 3.0, DRIP_FALL = DRIP_V / DRIP_G;
export const dropY = (tl: number) => DRIP_V * tl - 0.5 * DRIP_G * tl * tl;
export const DRIP_TOP = 0.25 + dropY(DRIP_FALL);
export const dripAt = (i: number, t: number): { y: number | null; since: number } => {
  const b = BUCKETS[i], since = (((t - b.hit) % b.period) + b.period) % b.period, tl = b.period - since;
  return { y: tl < DRIP_FALL ? 0.25 + dropY(tl) : null, since };
};
/** the hook bucket's punch-in drip lands exactly on "Buckets" */
export const HOOK_PLINK = W.buckets + 0.12;
/** the organiser's drip lands on his head on "learned" */
export const HEAD_DRIP = W.learned + 0.05;

// ---------------- shutters (shot 7): hut index -> slam time ----------------
export const SLAM: Record<number, number> = { 0: W.every - 0.02, 1: W.booking + 0.02, 2: W.cancelled + 0.05 };
export const shutterAt = (id: number, hut: number, t: number) => {
  if (id < 7) return 0;
  if (id > 7) return hut <= 2 ? 1 : 0;
  const s = SLAM[hut];
  if (s === undefined) return 0;
  const d = t - (s - 0.2);
  return d <= 0 ? 0 : d >= 0.2 ? 1 : (d / 0.2) ** 2;
};

// ---------------- people (feet positions per shot) ----------------
/** a ground point at `depth` metres along the view and `nx` (-1..1) across a portrait frame of vertical fov `fov` */
export const placeAt = (pos: V3, look: V3, fov: number, depth: number, nx: number): V3 => {
  const fx = look[0] - pos[0], fz = look[2] - pos[2], n = Math.hypot(fx, fz) || 1, ux = fx / n, uz = fz / n;
  const half = Math.tan((fov * Math.PI) / 360) * (9 / 16) * depth;
  return [pos[0] + ux * depth - uz * half * nx, 0, pos[2] + uz * depth + ux * half * nx];
};
export const VISITOR: Record<number, V3> = { 1: [-0.2, 0, -3.9], 4: [0.2, 0, -9.5], 9: [0.4, 0, -17.2] };
export const TRADER: Record<number, V3> = { 3: [-3.0, 0, -6.4], 7: [0.45, 0, -3.35] };
export const ORG: V3 = [2.6, 0, -5.4];

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
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
/** creep toward the look point (look kept ~4-9 m out so the creep stays small) */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** a look point d metres out from pos toward target */
export const aim = (pos: V3, target: V3, d: number): V3 => { const v = target.map((x, i) => x - pos[i]), n = Math.hypot(...v) || 1; return pos.map((x, i) => x + (v[i] / n) * d) as V3; };
const X = DREAM_X;

const CAMS: Record<number, Key[]> = {
  1: [
    // MS of the visitor in the empty hall (banner far behind her), the red bucket in the foreground catching a drip
    { f: 0, s: (f) => { const P: V3 = [0.6, 1.2, 0.9]; return dolly(P, aim(P, [0.15, 1.42, -4], 4.5), pushK(f, 0, 0.0018), { fov: 52, roll: 0.03 }); } },
    // "Buckets": punch into the bucket as the drip plinks
    { f: F(W.buckets - 0.1), cut: true, s: (f) => { const P: V3 = [0.95, 1.05, -1.25]; return dolly(P, aim(P, [0.7, 0.22, -2.3], 3), pushK(f, F(W.buckets), 0.002, 0.007, 22), { fov: 44, roll: -0.05 }); } },
  ],
  2: [
    // the ad: a slow crane down the snowy aisle toward the tree, garlands overhead
    { f: F(5.15), s: (f) => { const u = glide((f - F(5.15)) / 120); const P: V3 = [X + 0.6, 3.6 - 1.9 * u, 9.5 - 3.0 * u]; return { pos: P, look: aim(P, [X, 4.2 - 1.4 * u, -21], 9), fov: 56, roll: 0.02 - 0.03 * u }; } },
  ],
  3: [
    // the trader at his bare hut, dreaming (thought bubble upper right)
    { f: F(9.25), s: (f) => { const P: V3 = [-0.6, 1.5, -3.6]; return dolly(P, aim(P, [-2.65, 1.9, -6.6], 4.5), pushK(f, F(9.25), 0.002), { fov: 48, roll: -0.02 }); } },
    { f: F(W.twenty - 0.1), dur: 20, s: (f) => { const P: V3 = [-0.75, 1.55, -3.85]; return dolly(P, aim(P, [-2.55, 2.0, -6.6], 4.5), pushK(f, F(W.twenty), 0.002, 0.005, 22), { fov: 48, roll: 0.03 }); } },
  ],
  4: [
    // the wide from high at the front: the huge empty shed, five lonely huts, the visitor tiny in the aisle
    { f: F(14.1), s: (f) => { const P: V3 = [0.0, 5.1, 4.6]; return dolly(P, aim(P, [0.0, 0.2, -11.5], 8), pushK(f, F(14.1), 0.0016), { fov: 67, roll: 0 }); } },
  ],
  5: [
    // low along the aisle: buckets in a row, drips falling from the roof
    { f: F(17.1), s: (f) => { const P: V3 = [0.0, 1.1, -2.05]; return dolly(P, aim(P, [-0.6, 1.55, -5.0], 4.5), pushK(f, F(17.1), 0.002), { fov: 56, roll: 0.03 }); } },
    { f: F(W.leaky - 0.1), dur: 22, s: (f) => { const P: V3 = [0.0, 1.05, -2.2]; return dolly(P, aim(P, [-0.6, 3.6, -8.0], 6), pushK(f, F(W.leaky), 0.0018, 0.004, 22), { fov: 56, roll: -0.03 }); } },
  ],
  6: [
    // push into the AI banner on the back wall; it glitches on "AI"
    { f: F(20.15), s: (f) => { const P: V3 = [0.0, 4.6, -15.0]; return dolly(P, [0.0, 4.95, -20.5], pushK(f, F(20.15), 0.003, 0.012, 24), { fov: 52, roll: -0.02 }); } },
    { f: F(W.ai - 0.1), dur: 14, s: (f) => { const P: V3 = [0.15, 4.7, -16.2]; return dolly(P, [0.1, 5.0, -20.5], pushK(f, F(W.ai), 0.002, 0.008, 22), { fov: 50, roll: 0.03 }); } },
  ],
  7: [
    // along the left row of huts: shutters slam down one after another, the trader by the first
    { f: F(22.2), s: (f) => { const P: V3 = [0.8, 1.7, 0.0]; return dolly(P, aim(P, [-4.3, 1.2, -12], 8), pushK(f, F(22.2), 0.002), { fov: 54, roll: 0.03 }); } },
    { f: F(W.cancelled - 0.1), dur: 14, s: (f) => { const P: V3 = [0.8, 1.7, -0.4]; return dolly(P, aim(P, [-4.3, 1.15, -12], 8), pushK(f, F(W.cancelled), 0.002, 0.006, 22), { fov: 54, roll: -0.03 }); } },
  ],
  8: [
    // MS of the organiser shrugging; a drip lands on his head on "learned"
    { f: F(25.75), s: (f) => { const P: V3 = [3.45, 1.45, -1.9]; return dolly(P, aim(P, [2.6, 1.7, -5.4], 4), pushK(f, F(25.75), 0.0022), { fov: 48, roll: -0.03 }); } },
    { f: F(W.learned - 0.1), dur: 12, s: (f) => { const P: V3 = [3.4, 1.5, -2.2]; return dolly(P, aim(P, [2.6, 1.8, -5.4], 4), pushK(f, F(W.learned), 0.002, 0.006, 22), { fov: 48, roll: 0.03 }); } },
  ],
  9: [
    // the visitor under the glossy banner, turning to us
    { f: F(28.7), s: (f) => { const P: V3 = [0.6, 1.25, -11.9]; return dolly(P, aim(P, [0.05, 2.75, -18], 5), pushK(f, F(28.7), 0.0022), { fov: 58, roll: 0.02 }); } },
    { f: F(W.send - 0.1), dur: 26, s: (f) => { const P: V3 = [0.55, 1.3, -12.5]; return dolly(P, aim(P, [0.05, 2.55, -18], 5), pushK(f, F(W.send), 0.0015, 0.004, 22), { fov: 58, roll: -0.02 }); } },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [HOOK_PLINK + 0.02, 0.5], [W.fifty + 0.02, 0.3], [SLAM[0] + 0.02, 0.6], [SLAM[1] + 0.02, 0.6], [SLAM[2] + 0.02, 0.9], [HEAD_DRIP + 0.02, 0.5],
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
const eyes = (p: V3, dy = 1.62): (() => V3) => () => [p[0], p[1] + dy, p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 9, focus: eyes(VISITOR[1]) },
  { f: F(W.buckets - 0.1), cInf: 13, focus: () => [BUCKETS[0].x, 0.3, BUCKETS[0].z] },
  { f: F(5.15), cInf: 4, focus: () => [X, 2, -8] },
  { f: F(9.25), cInf: 11, focus: eyes(TRADER[3]) },
  { f: F(14.1), cInf: 0 },
  { f: F(17.1), cInf: 9, focus: () => [BUCKETS[1].x, 0.4, BUCKETS[1].z] },
  { f: F(20.15), cInf: 0 },
  { f: F(22.2), cInf: 4, focus: () => [-3.6, 1.2, -10] },
  { f: F(25.75), cInf: 11, focus: eyes(ORG) },
  { f: F(28.7), cInf: 8, focus: eyes(VISITOR[9]) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
