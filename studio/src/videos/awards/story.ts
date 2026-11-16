// "The First AI Music Awards": timeline timed to pipeline/stories/awards/words.json (ElevenLabs George, 33.1 s).
// Two places in one scene graph: the awards THEATRE (x 0: stage, big screen, podium, mic, the AI announcer's speaker
// pod, audience rows) and the red-carpet LOBBY (x + 400: backdrop wall, carpet, rope posts, the AI reporter's stone tower).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1000;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const THEATRE = 0, LOBBY = 400;

// ---------------- story beats (film seconds, ElevenLabs alignment cross-checked with whisper) ----------------
export const W = {
  first: 0.61, awards: 1.89, humans: 2.69, lip: 3.17, robots: 4.0,
  carpet: 4.91, reporter: 5.47, ai: 6.53, stuck: 7.31, fake: 8.07, tower: 8.79, couldnt: 9.6, move: 10.02,
  announcer: 11.94, talking: 12.74, over: 13.12, hosts: 13.42,
  show: 14.26, thirty: 14.95, late: 15.62, one: 16.26, award: 16.42, took: 16.87, thirteen: 17.12, minutes: 17.59,
  trailer: 18.72, finally: 19.11, played: 19.47, and: 20.38, cut: 20.5, right: 21.04, before: 21.29, face: 22.21,
  winner: 23.21, an: 23.94, singer: 24.56, artist: 25.69, song: 25.97, AND: 26.65, album: 26.9, year: 27.55,
  would: 28.27, watch: 28.42, show2: 29.56, send: 30.2, friend: 30.92, hates: 31.48, music: 32.22,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** stage: platform top y 0.6, front edge z 0.8 */
export const STAGE_Y = 0.6;
export const STAGE_FRONT = 0.8;
export const SCREEN = { x: THEATRE, y: 3.45, z: -3.9, w: 6.4, h: 3.6 };
export const PODIUM: V3 = [THEATRE + 1.75, STAGE_Y, -0.55];
export const MIC: V3 = [THEATRE - 0.35, STAGE_Y, -0.35];
/** the AI announcer: a speaker pod hanging over the stage */
export const POD: V3 = [THEATRE - 0.2, 4.15, -0.9];
/** red-carpet lobby: carpet along x at z 0, backdrop wall at z -2.2, the stone tower right of the carpet */
export const TOWER: V3 = [LOBBY + 1.05, 0, -1.05];
export const TOWER_H = 2.7;
export const TOWER_FACE: V3 = [LOBBY + 1.05, 1.95, -0.52];

// ---------------- shots ----------------
export type Light = "day" | "indoor" | "night";
export type Place = "theatre" | "lobby";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.45), light: "night", place: "theatre", sunAz: 150, sunEl: 50 }, // hook: she mimes, the AI sings
  { id: 2, a: F(4.45), b: F(10.95), light: "indoor", place: "lobby", sunAz: 120, sunEl: 45 }, // the stone tower reporter
  { id: 3, a: F(10.95), b: F(14.05), light: "night", place: "theatre", sunAz: 150, sunEl: 50 }, // the announcer talks over the hosts
  { id: 4, a: F(14.05), b: F(18.15), light: "night", place: "theatre", sunAz: 140, sunEl: 50 }, // late; 13 minutes for one award
  { id: 5, a: F(18.15), b: F(22.8), light: "night", place: "theatre", sunAz: 160, sunEl: 50 }, // the trailer cuts off
  { id: 6, a: F(22.8), b: F(28.1), light: "night", place: "theatre", sunAz: 150, sunEl: 50 }, // the AI singer wins three
  { id: 7, a: F(28.1), b: TOTAL, light: "night", place: "theatre", sunAz: 140, sunEl: 50 }, // would you watch?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.45);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- what the big screen shows ----------------
export type ScreenMode = "bot" | "botWin" | "trailer" | "bars" | "dark";
/** screen state for shot id at film time t; u = trailer tilt 0 (feet) .. 1 (chin) */
export const screenAt = (id: number, t: number): { mode: ScreenMode; u: number; sing: boolean } => {
  if (id === 5) {
    if (t < W.played - 0.05) return { mode: "dark", u: 0, sing: false };
    if (t < W.right - 0.02) return { mode: "trailer", u: clamp01((t - W.played) / (W.right - W.played)), sing: false };
    return { mode: "bars", u: 1, sing: false };
  }
  if (id === 6) return { mode: t >= W.year - LEADS ? "botWin" : "bot", u: 0, sing: Math.floor(t * 7) % 2 === 0 };
  if (id === 1) return { mode: "bot", u: 0, sing: Math.floor(t * 7.5) % 2 === 0 };
  return { mode: "bot", u: 0, sing: false };
};
/** the tower reporter's face: talking, straining (can't move), or calm */
export const towerFace = (t: number): "talk0" | "talk1" | "strain" | "calm" => {
  if (t >= W.couldnt - LEADS) return "strain";
  if (t >= W.reporter && t < W.couldnt - 0.3) return Math.floor(t * 8) % 2 ? "talk1" : "talk0";
  return "calm";
};
/** the tower wobbles in place (it tries to follow the star but can't): roll in radians */
export const towerRock = (id: number, t: number) => (id === 2 && t >= W.couldnt - LEADS ? 0.09 * Math.sin((t - W.couldnt) * 26) * Math.min(1, (t - W.couldnt + 0.1) * 4) : 0);

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
const T = (x: number, y: number, z: number): V3 => [THEATRE + x, y, z];
const L = (x: number, y: number, z: number): V3 => [LOBBY + x, y, z];

/** cast positions (feet) */
export const SINGER: V3 = [MIC[0] + 0.05, STAGE_Y, MIC[2] - 0.12];
export const HOST_A: V3 = [PODIUM[0] - 0.42, STAGE_Y, PODIUM[2] + 0.1];
export const HOST_B: V3 = [PODIUM[0] + 0.45, STAGE_Y, PODIUM[2] + 0.12];
export const PRESENTER: V3 = [THEATRE + 0.15, STAGE_Y, -0.3];
export const STAR_WALK = (t: number): V3 => [LOBBY - 2.3 + 0.72 * (t - 4.45), 0, 0.05];

const CAMS: Record<number, Key[]> = {
  1: [
    // from the front row: she mimes at the mic, the AI singer's face sings on the big screen behind her
    { f: 0, s: (f) => dolly(T(-0.1, 1.55, 4.1), T(-0.25, 2.1, -1.0), pushK(f, 0, 0.0022), { fov: 46, roll: -0.03 }) },
    { f: F(W.robots - 0.15), dur: 20, s: (f) => dolly(T(0.05, 1.7, 3.4), T(-0.05, 2.7, -2.6), pushK(f, F(W.robots), 0.002, 0.007, 22), { fov: 46, roll: 0.04 }) },
  ],
  2: [
    // red-carpet wide: the stone tower right, a star walks the carpet from the left
    { f: F(4.45), s: (f) => dolly(L(-0.2, 1.6, 5.2), L(0.35, 1.35, -0.6), pushK(f, F(4.45), 0.0016), { fov: 48, roll: 0.02 }) },
    { f: F(W.stuck - 0.1), dur: 30, s: (f) => dolly(L(0.25, 1.65, 4.2), L(0.75, 1.5, -0.8), pushK(f, F(W.stuck), 0.0018), { fov: 48, roll: -0.03 }) },
    // "it couldn't move": CU of the straining tower face, the star walking out of frame left
    { f: F(W.couldnt - 0.1), cut: true, s: (f) => dolly(L(0.55, 1.7, 3.3), [TOWER_FACE[0] - 0.15, 1.75, TOWER_FACE[2]], pushK(f, F(W.couldnt), 0.0025, 0.007, 22), { fov: 44, roll: 0.025 }) },
  ],
  3: [
    // the hosts at the podium, the announcer pod hanging above them blaring
    { f: F(10.95), s: (f) => dolly(T(1.0, 2.2, 4.8), T(1.1, 2.85, -0.8), pushK(f, F(10.95), 0.002), { fov: 50, roll: -0.03 }) },
    { f: F(W.talking - 0.1), dur: 20, s: (f) => dolly(T(1.1, 2.15, 4.3), T(1.2, 2.8, -0.7), pushK(f, F(W.talking), 0.002, 0.006, 22), { fov: 50, roll: 0.04 }) },
  ],
  4: [
    // the presenter waits with the trophy; a clock on the screen spins
    { f: F(14.05), s: (f) => dolly(T(-0.4, 1.7, 4.6), T(0.05, 2.3, -1.2), pushK(f, F(14.05), 0.0018), { fov: 48, roll: 0.02 }) },
    { f: F(W.one - 0.1), cut: true, s: (f) => dolly(T(0.55, 2.1, 2.0), T(0.15, 1.95, -0.3), pushK(f, F(W.one), 0.0022, 0.006, 22), { fov: 44, roll: -0.04 }) },
  ],
  5: [
    // over the hosts' shoulders at the big screen: the trailer tilts up a coat... and cuts to bars
    { f: F(18.15), s: (f) => dolly(T(0.3, 1.35, 4.7), T(0.6, 2.5, -3.0), pushK(f, F(18.15), 0.0018), { fov: 54, roll: -0.02 }) },
    { f: F(W.right - 0.08), dur: 14, s: (f) => dolly(T(0.3, 1.35, 4.3), T(0.65, 2.55, -3.0), pushK(f, F(W.right), 0.002, 0.006, 22), { fov: 54, roll: 0.04 }) },
  ],
  6: [
    // the AI singer on the screen; trophies pop in front of it
    { f: F(22.8), s: (f) => dolly(T(0.2, 1.12, 5.0), T(0.0, 2.6, -2.0), pushK(f, F(22.8), 0.002), { fov: 50, roll: 0.02 }) },
    { f: F(W.artist - 0.15), dur: 22, s: (f) => dolly(T(0.1, 1.15, 4.4), T(0.0, 2.65, -2.2), pushK(f, F(W.artist), 0.0022, 0.005, 22), { fov: 50, roll: -0.03 }) },
    { f: F(W.year - 0.08), dur: 14, s: (f) => dolly(T(0.0, 1.18, 4.1), T(0.0, 2.7, -2.2), pushK(f, F(W.year), 0.002, 0.006, 22), { fov: 50, roll: 0.04 }) },
  ],
  7: [
    { f: F(28.1), s: (f) => dolly(T(1.3, 1.95, 3.2), T(1.55, 1.95, -0.5), pushK(f, F(28.1), 0.0022), { fov: 44 }) },
    { f: F(W.send - 0.1), dur: 26, s: (f) => dolly(T(1.25, 1.95, 3.0), T(1.55, 1.98, -0.5), pushK(f, F(W.send), 0.0012, 0.003, 22), { fov: 44, roll: 0.03 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.robots + 0.02, 0.8], [W.couldnt + 0.02, 0.6], [W.talking + 0.02, 0.6], [W.thirteen + 0.02, 0.5], [W.right + 0.02, 0.9],
  [W.artist + 0.02, 0.5], [W.song + 0.02, 0.5], [W.album + 0.02, 0.6], [W.year + 0.02, 0.8],
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
  { f: 0, cInf: 6, focus: eyes(SINGER) },
  { f: F(4.45), cInf: 0 }, // red-carpet wide
  { f: F(W.couldnt - 0.1), cInf: 10, focus: () => TOWER_FACE },
  { f: F(10.95), cInf: 7, focus: eyes(HOST_A) },
  { f: F(14.05), cInf: 0 },
  { f: F(W.one - 0.1), cInf: 11, focus: eyes(PRESENTER) },
  { f: F(18.15), cInf: 0 },
  { f: F(22.8), cInf: 0 },
  { f: F(28.1), cInf: 10, focus: eyes(HOST_A) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
