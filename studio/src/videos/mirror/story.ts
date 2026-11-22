// "A Whole Fake Internet, Built to Trick AI": timeline timed to pipeline/stories/mirror/words.json (ElevenLabs George, 33.4 s).
// One place: a cartoon movie-set town on an empty lot (x 0): a fake street along x (asphalt z -2.5..2.5, kerb strips to |z| 4),
// flat painted shop fronts facing the street (north row face at z -4 facing +z, south row face at z +4 facing -z), each propped
// up from behind by two wooden struts and sandbags. The little robot shopper (the AI agent) and two engineers hiding giant
// mousetraps (the traps) act it out. Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps,
// every hold creeps in, impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1020;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const ROAD = 0;

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  google: 0.61, fake: 1.385, internet: 1.7, just: 2.5, trick: 2.88, ai: 3.71, hundreds: 4.26, websites: 5.12, shops: 5.85,
  checkouts: 6.51, social: 7.52, feeds: 7.95, then: 8.58, ai2: 9.7, shopper: 10.09, and: 10.93, hid: 11.02, traps: 11.34,
  everywhere: 11.8, text: 12.98, pictures: 13.81, invisible: 14.76, labels: 15.28, goal: 16.25, catch: 16.74, fooled: 17.66,
  one: 18.57, problem: 18.67, ai3: 19.65, noticed: 20.09, weird: 20.72, addresses: 21.28, and2: 22.04, suspicious: 22.38,
  google2: 23.95, admits: 24.35, far: 25.53, perceptive: 25.95, so: 26.7, traps2: 27.2, deeper: 27.76, would: 28.67, shop: 29.72,
  you: 30.19, send: 30.9, friend: 31.49, clicks: 32.04, link: 32.71,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
export const FACE_N = -4, FACE_S = 4;
/** shop fronts: [x0, width, height, kind] per row; kinds pick colours and the window icon (no text anywhere):
 *  shop (cart), pay (card), social (heart), recipe (chef hat), video (play), mail (envelope). An alley at x -15.2..-14.4 in the
 *  north row lets the engineers peek out (shot 5). */
export type Kind = "shop" | "pay" | "social" | "recipe" | "video" | "mail";
export const NORTH: [number, number, number, Kind][] = [
  [-33, 5.6, 6.2, "video"], [-27, 5.4, 7.2, "recipe"], [-21.2, 6.0, 6.4, "social"], [-14.4, 5.8, 6.8, "pay"], [-8.2, 6.4, 7.4, "shop"],
  [-1.4, 5.4, 6.0, "recipe"], [4.4, 6.0, 7.0, "social"], [10.8, 5.6, 6.4, "mail"], [16.8, 6.2, 7.2, "shop"], [23.4, 5.6, 6.0, "video"],
];
export const SOUTH: [number, number, number, Kind][] = [
  [-33, 6.0, 6.6, "shop"], [-26.6, 5.6, 6.0, "mail"], [-20.6, 6.2, 7.0, "pay"], [-14, 5.4, 6.2, "video"], [-8.2, 6.0, 6.8, "social"],
  [-1.8, 5.8, 7.2, "shop"], [4.4, 5.6, 6.2, "pay"], [10.4, 6.2, 6.8, "recipe"], [17, 5.6, 6.4, "social"], [23, 6.0, 7.0, "mail"],
];
/** giant mousetraps: [x, z, yaw, shot ids where visible]; snap time per trap (film s, Infinity = never) */
export type Trap = { x: number; z: number; yaw: number; shots: number[]; snap: number; bait: boolean; y?: number; s?: number };
export const HOOK_SNAP = 1.15;
export const SIGN: [number, number] = [21.6, -2.9];
export const DIG: [number, number] = [-3.0, 3.0];
export const TRAPS: Trap[] = [
  { x: 0.2, z: -2.2, yaw: 0.25, shots: [1], snap: HOOK_SNAP, bait: true },
  { x: -5.0, z: -2.85, yaw: -0.1, shots: [4], snap: Infinity, bait: true },
  { x: 9.0, z: 1.6, yaw: 0.4, shots: [2, 3], snap: Infinity, bait: true },
  { x: 17.4, z: -2.7, yaw: 0.1, shots: [2, 6], snap: Infinity, bait: true },
  { x: -1.2, z: 2.95, yaw: 0.15, shots: [7], snap: Infinity, bait: true, y: 0.06 },
  { x: -1.0, z: -3.0, yaw: 0.0, shots: [8], snap: Infinity, bait: true, y: 0.06, s: 0.45 },
  { x: -18.0, z: 0.8, yaw: -0.3, shots: [2], snap: Infinity, bait: true },
  { x: -3.5, z: -1.2, yaw: 0.6, shots: [2], snap: Infinity, bait: false },
  { x: -13.3, z: -2.4, yaw: 0.35, shots: [5], snap: Infinity, bait: true },
];
/** per-trap offsets: trap 1 slides out of engineer A's hands to the ground on "traps" (shot 4); trap 4 sinks into the hole
 *  on "deeper" (shot 7); trap 5 is carried across behind the robot by the sneaking engineer (shot 8, held at hip height) */
export const SNEAK = (t: number) => 0.8 + 0.04 * (t - 28.4);
export const trapOff = (i: number, id: number, t: number): V3 => {
  if (i === 1 && id === 4) return [0, 0.55 * (1 - smooth((t - (W.traps - 0.35)) / 0.35)), 0];
  if (i === 4 && id === 7) { const sl = smooth((t - (W.deeper - 0.5)) / 0.35); return [(DIG[0] - TRAPS[4].x) * sl, -1.4 * smooth((t - (W.deeper - 0.1)) / 0.45), (DIG[1] - TRAPS[4].z) * sl]; }
  if (i === 5 && id === 8) return [SNEAK(t) + 0.42 - TRAPS[5].x, 0.78, 0.2];
  return [0, 0, 0];
};
/** the snap bar angle (0 = cocked, flat on the +x half; PI = sprung, flat on the -x half) */
export const snapAng = (t: number, snap: number) => { const u = clamp01((t - snap) / 0.1); return Math.PI * u * u; };
/** the address signpost the robot inspects (shot 6) */

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "set";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.2), light: "day", place: "set", sunAz: 115, sunEl: 44 }, // hook: the trap snaps on nothing, the robot dodged it
  { id: 2, a: F(4.2), b: F(8.5), light: "day", place: "set", sunAz: 115, sunEl: 44 }, // the fake web: aerial from behind the props
  { id: 3, a: F(8.5), b: F(10.85), light: "day", place: "set", sunAz: 115, sunEl: 44 }, // the AI shopper rolls in
  { id: 4, a: F(10.85), b: F(16.1), light: "day", place: "set", sunAz: 115, sunEl: 44 }, // hiding traps: note, picture, invisible tag
  { id: 5, a: F(16.1), b: F(18.45), light: "day", place: "set", sunAz: 115, sunEl: 44 }, // the engineers peek, rubbing hands
  { id: 6, a: F(18.45), b: F(23.6), light: "day", place: "set", sunAz: 115, sunEl: 44 }, // the robot squints at the weird address sign
  { id: 7, a: F(23.6), b: F(28.4), light: "day", place: "set", sunAz: 115, sunEl: 44 }, // facepalm ... then digging deeper
  { id: 8, a: F(28.4), b: TOTAL, light: "day", place: "set", sunAz: 115, sunEl: 44 }, // would you let an AI shop for you?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.2);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** robot shopper position per shot (feet on the ground), with a little walk hop */
export const robotAt = (id: number, t: number): { x: number; z: number; hop: number; moving: boolean } => {
  const walk = (t0: number, t1: number, a: [number, number], b: [number, number]) => {
    const u = smooth((t - t0) / (t1 - t0)), m = u > 0 && u < 1;
    return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, hop: m ? 0.07 * Math.abs(Math.sin(u * Math.PI * 6)) : 0, moving: m };
  };
  if (id === 1) {
    // reaching for the bait ... hops back just before the snap
    const back = smooth((t - (HOOK_SNAP - 0.2)) / 0.3);
    return { x: 1.05 + 0.45 * back, z: -1.2 + 0.3 * back, hop: back > 0 && back < 1 ? 0.35 * Math.sin(back * Math.PI) : 0, moving: false };
  }
  if (id === 3) return walk(8.4, 10.8, [-15, 0.2], [-9.6, 0.45]);
  if (id === 6) return walk(18.3, 19.9, [16.2, -0.6], [19.6, -1.4]);
  if (id === 8) return { x: 0.15, z: 0.4, hop: 0, moving: false };
  return { x: -100, z: 0, hop: 0, moving: false };
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

// cast spots (cast.ts reads these too)
export const ENG_DOOR: [number, number] = [-1.0, -3.3];

const CAMS: Record<number, Key[]> = {
  1: [
    // low on the fake street: the robot leans for the bait, hops back, the trap bangs shut on nothing; the engineer in the doorway
    { f: 0, s: (f) => AD([2.9, 1.2, 3.3], [0.45, 1.0, -2.4], pushK(f, 0, 0.0012), { fov: 54, roll: 0.04 }, 6) },
    { f: F(2.6), dur: 34, s: (f) => AD([2.75, 1.2, 3.1], [0.4, 1.1, -2.4], pushK(f, 0, 0.0012) * pushK(f, F(2.6), 0.0012, 0.005, 20), { fov: 54, roll: -0.03 }, 6) },
  ],
  2: [
    // high behind the north row: the plywood backs, struts and sandbags of the "websites"; glide along the street
    { f: F(4.2), s: (f) => AD([-22, 12.5, -22], [-6, 1.5, 0], pushK(f, F(4.2), 0.002), { fov: 50, roll: -0.03 }, 10) },
    { f: F(4.9), dur: 70, s: (f) => AD([-2, 11.0, -21], [8, 1.5, 0], pushK(f, F(4.9), 0.002), { fov: 50, roll: 0.03 }, 10) },
  ],
  3: [
    // down the street: the robot rolls in with its basket; the two engineers wave it in from the right foreground
    { f: F(8.5), s: (f) => AD([-3.4, 1.5, 2.4], [-12, 1.0, -0.6], pushK(f, F(8.5), 0.0022), { fov: 46, roll: 0.03 }, 7) },
    { f: F(9.6), dur: 30, s: (f) => AD([-3.6, 1.45, 2.3], [-10, 0.95, -0.4], pushK(f, F(9.6), 0.0025, 0.006, 25), { fov: 46, roll: -0.03 }, 7) },
  ],
  4: [
    // along the north row: the engineers tiptoe and hide traps; the camera tracks with them
    { f: F(10.85), s: (f) => AD([-4.75, 1.6, 3.6], [-4.75, 1.4, -3.6], pushK(f, F(10.85), 0.0016), { fov: 70, roll: -0.03 }, 6) },
    { f: F(13.2), dur: 40, s: (f) => AD([-4.75, 1.6, 3.6], [-4.75, 1.45, -3.6], pushK(f, F(10.85), 0.0016), { fov: 70, roll: 0.03 }, 6) },
  ],
  5: [
    // the engineers peek out from behind a shop front's side edge, rubbing their hands
    { f: F(16.1), s: (f) => AD([-10.6, 1.55, 2.2], [-15.0, 1.45, -4.4], pushK(f, F(16.1), 0.003, 0.008, 25), { fov: 40, roll: 0.04 }, 5) },
  ],
  6: [
    // the robot reaches the signpost ... squints at the weird address ... turns its head toward us
    { f: F(18.45), s: (f) => AD([17.6, 1.5, 3.3], [21.0, 1.4, -2.6], pushK(f, F(18.45), 0.0022), { fov: 44, roll: -0.03 }, 6) },
    { f: F(20.0), dur: 30, s: (f) => AD([18.3, 1.45, 2.0], [20.5, 1.65, -2.2], pushK(f, F(20.0), 0.003, 0.008, 25), { fov: 48, roll: 0.03 }, 4) },
    { f: F(22.3), cut: true, s: (f) => AD([19.9, 1.15, 0.7], [19.6, 1.15, -1.4], pushK(f, F(22.3), 0.004, 0.01, 20), { fov: 40, roll: -0.04 }, 3) },
  ],
  7: [
    // the engineers groan behind the fronts ... then one digs a hole on the kerb and lowers a trap into it
    { f: F(23.6), s: (f) => AD([-1.6, 1.6, -0.9], [-2.9, 1.3, 3.2], pushK(f, F(23.6), 0.003, 0.008, 25), { fov: 44, roll: 0.03 }, 4) },
    { f: F(26.55), cut: true, s: (f) => AD([-1.0, 2.7, -1.8], [-2.8, 0.4, 3.0], pushK(f, F(26.55), 0.003, 0.008, 25), { fov: 54, roll: -0.04 }, 5) },
  ],
  8: [
    // the robot holds up its basket to us; behind it an engineer sneaks across with another trap
    { f: F(28.4), s: (f) => AD([0.4, 1.3, 3.5], [0.1, 1.25, 0.0], pushK(f, F(28.4), 0.0022), { fov: 48, roll: 0.03 }, 5) },
    { f: F(30.8), dur: 36, s: (f) => AD([0.35, 1.3, 3.3], [0.1, 1.3, 0.0], pushK(f, F(30.8), 0.0025, 0.006, 25), { fov: 48, roll: -0.03 }, 5) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [HOOK_SNAP + 0.1, 0.9], [W.trick, 0.3], [W.shops, 0.25], [W.checkouts, 0.25], [W.social, 0.25], [W.traps, 0.5], [W.text, 0.3], [W.pictures, 0.3],
  [W.invisible, 0.3], [W.catch, 0.4], [W.suspicious, 0.4], [W.perceptive, 0.5], [W.deeper, 0.6], [W.send, 0.4],
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
  { f: 0, cInf: 8, focus: () => [1.3, 1.0, -1.2] },
  { f: F(4.2), cInf: 0 },
  { f: F(8.5), cInf: 6, focus: () => [-3.6, 1.4, 1.6] },
  { f: F(10.85), cInf: 5, focus: () => [-5, 1.4, -3.2] },
  { f: F(16.1), cInf: 10, focus: () => [-15.0, 1.6, -4.3] },
  { f: F(18.45), cInf: 6, focus: () => [19.6, 1.0, -1.4] },
  { f: F(22.3), cInf: 13, focus: () => [19.6, 1.15, -1.4] },
  { f: F(23.6), cInf: 9, focus: () => [-2.9, 1.6, 3.1] },
  { f: F(26.55), cInf: 6, focus: () => [-3.0, 0.6, 3.0] },
  { f: F(28.4), cInf: 12, focus: () => [0.6, 1.2, 0.4] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
void easeOut; void lerp3; void tf;
