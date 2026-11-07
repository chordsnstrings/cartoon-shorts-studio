// "Eleven Thousand Searches for Finnish Music": timeline timed to pipeline/stories/finnish/words.json (ElevenLabs George, 69 s).
// Four places in one scene graph: the university LIBRARY reading hall with its catalogue kiosk (x 0), the library IT
// office with the monitor (x - 1000), a snowy Finnish LAKE at golden hour (x + 1000) and the BUFFET of the analogy (x + 2000).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 2085;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const LIB = 0, DESK = -1000, FIN = 1000, BUF = 2000;

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  single: 0.73, university: 1.85, library: 2.49, eleven: 3.13, thousand: 3.53, searches: 4.1, finnish: 5.03, music: 5.63,
  month: 6.75, fifteen: 7.66, north: 8.93, finals: 10.26, students: 11.2, cramming: 11.59, catalogue: 12.99, humming: 13.72,
  normally: 14.61, hundred: 15.61, people: 15.94, then5: 17.59, five: 17.72,
  every: 20.08, different: 20.75, picky: 21.97, human: 22.82, six: 23.83, filters: 24.19, these: 24.98, ticked: 25.25, tf: 25.65,
  screen: 28.08, queue: 29.17, full: 29.72, everybody: 30.43, out: 30.68,
  luckily: 31.74, finland: 32.1, famous: 33.57, unluckily: 34.47, visitors: 35.18, notp: 35.74, people2: 35.93,
  bots: 37.06, scraping: 37.73, everything: 38.34, feed: 38.88, models: 39.74,
  picture: 40.62, guest: 41.01, buffet: 41.51, doesnt: 42.12, eat: 42.48, fills: 43.17, truck: 43.74, then: 44.5, sneaks: 44.71,
  back: 45.23, line: 45.59, different2: 46.26, door: 46.64, again: 47.47, again2: 48.41,
  banned: 49.94, millions: 50.39, addresses: 50.88, bots2: 51.87, came: 52.4, newones: 53.13,
  so: 54.13, ai: 54.75, guards: 55.17, door2: 55.67, letting: 56.39, peopleIn: 56.71, keeping: 57.52, botsOut: 57.95,
  week: 59.44, libraries: 59.92, everywhere: 60.41, worse: 61.8,
  somewhere: 62.64, computer: 63.29, knows: 64.0, more: 64.32, finnish3: 64.88, finland2: 65.94, never: 66.84, heard: 67.17, single2: 67.64, note: 68.05,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** library hall: x -12..12, z -18..18, 9 m high; entrance in the back wall (z -18), kiosk in the middle aisle */
export const HALL = { w: 24, d: 36, h: 9 };
export const KIOSK: V3 = [LIB, 0, -7];
/** kiosk screen centre and size (faces +z, tilted back) */
export const KSCR: V3 = [LIB, 1.32, -6.93];
export const KS_W = 0.62, KS_H = 0.62 * (0.46 / 0.86), KS_TILT = -0.32;
export const GUARD: V3 = [LIB + 2.3, 0, -15.6];
/** reading tables: centre x, z0..z1 (long axis along z) */
export const TABLES: [number, number, number][] = [[-4.6, -3, 9], [4.6, -3, 9]];

/** IT office monitor (the desk room of the template) */
export const MON: V3 = [DESK + 0.42, 1.08, -1.12];
export const MON_YAW = -0.62;
export const MON_W = 0.86, MON_H = 0.46;
export const YT: V3 = [DESK - 0.32, 0, -1.55]; // the librarian's seat

/** Finnish lake: cabin porch, the musician, the bot beside him */
export const PORCH: V3 = [FIN + 0.0, 0.45, -2.0];
export const FINN: V3 = [FIN - 0.55, 0.45, -1.4];
export const FBOT: V3 = [FIN + 0.75, 0.45, -1.35];
export const JETTY_END: V3 = [FIN - 7.5, 0.3, -12];

/** buffet room: table along x at z -1.6, doors in the back wall at z -5, the truck on the right */
export const DOORS = [-4.5, -1.5, 1.5, 4.5];
export const TRUCK: V3 = [BUF + 5.6, 0, 0.6];

// ---------------- the guest bot at the buffet (pure function of time) ----------------
export type GuestState = { x: number; z: number; walk: number; mode: "stand" | "walk" | "dump" | "tiptoe" | "pop"; disguise: number; tray: number; face: "dots" | "happy" | "closed" | "wink"; shake: number; vis: boolean; dumpK: number };
export const guestAt = (t: number): GuestState => {
  const bx = BUF - 4.1, bz = -0.6, tx = TRUCK[0] - 2.45, tz = TRUCK[2] + 0.2;
  const tray = t < 40.9 ? 1 : t < W.fills ? Math.min(5, 1 + Math.floor((t - 40.9) * 2.2)) : t < W.truck + 0.3 ? 5 : 0;
  if (t < W.fills - 0.1) return { x: bx, z: bz, walk: 0, mode: "stand", disguise: 0, tray, face: at(t, W.doesnt) && t < W.eat + 0.5 ? "closed" : "happy", shake: at(t, W.doesnt) && t < W.eat + 0.4 ? Math.sin((t - W.doesnt) * 22) : 0, vis: true, dumpK: 0 };
  if (t < W.truck - 0.15) { const u = smooth((t - (W.fills - 0.1)) / (W.truck - 0.15 - W.fills + 0.1)); return { x: tx - 1.3 + 1.3 * u, z: tz, walk: (t - W.fills) * 2.4, mode: "walk", disguise: 0, tray, face: "happy", shake: 0, vis: true, dumpK: 0 }; }
  if (t < W.then) return { x: tx, z: tz, walk: 0, mode: "dump", disguise: 0, tray, face: "happy", shake: 0, vis: true, dumpK: smooth((t - (W.truck - 0.15)) / 0.3) };
  // sneaks off to the left behind the table, out of the room ...
  if (t < W.different2 - 0.25) { const u = clamp01((t - W.then) / (W.different2 - 0.25 - W.then)); return { x: tx + (BUF + 7.6 - tx) * u, z: tz + 2.4 * u, walk: (t - W.then) * 3.2, mode: "tiptoe", disguise: 0, tray: 0, face: "wink", shake: 0, vis: u < 0.97, dumpK: 0 }; }
  // ... and pops back in through another door each time, in a new disguise, straight into the line
  const k = t < W.again - 0.1 ? 1 : t < W.again2 - 0.1 ? 2 : 3;
  const t0 = k === 1 ? W.different2 - 0.25 : k === 2 ? W.again - 0.1 : W.again2 - 0.1;
  const dx = BUF + DOORS[k], u = smooth((t - t0) / 1.0);
  return { x: dx - 0.5 * u, z: -5.1 + 2.5 * u, walk: (t - t0) * 2.6, mode: u < 1 ? "pop" : "stand", disguise: k, tray: 0, face: "wink", shake: 0, vis: true, dumpK: 0 };
};

// ---------------- library crowd motion ----------------
/** bots marching in through the entrance: bot i at time t (hall coords), or null before it enters */
export const marchAt = (i: number, t: number, t0: number): { x: number; z: number; phase: number } | null => {
  const enter = t0 + i * 0.16, d = t - enter;
  if (d < 0) return null;
  const lane = (i % 3) - 1, z = -17.6 + d * 1.25;
  return { x: LIB + lane * 0.9 + 0.12 * Math.sin(i * 2.3), z: Math.min(z, 6 + (i % 5)), phase: d * 1.9 + i * 0.37 };
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "lib" | "desk" | "fin" | "buf";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(2.9), light: "indoor", place: "lib", sunAz: 60, sunEl: 40 }, // hook: the hall, search bubbles streaming to the kiosk
  { id: 2, a: F(2.9), b: F(6.55), light: "indoor", place: "lib", sunAz: 70, sunEl: 40 }, // the kiosk, the counter going wild
  { id: 3, a: F(6.55), b: F(8.75), light: "indoor", place: "desk" }, // screen: a giant bar, then fifteen
  { id: 4, a: F(8.75), b: F(14.45), light: "indoor", place: "lib", sunAz: 50, sunEl: 40 }, // finals week, students cramming
  { id: 5, a: F(14.45), b: F(17.45), light: "indoor", place: "desk" }, // the librarian, a hundred searches
  { id: 6, a: F(17.45), b: F(19.9), light: "indoor", place: "desk" }, // five hundred
  { id: 7, a: F(19.9), b: F(27.75), light: "indoor", place: "desk" }, // picky filters
  { id: 8, a: F(27.75), b: F(31.55), light: "indoor", place: "lib", sunAz: 70, sunEl: 40 }, // queue full, everybody out
  { id: 9, a: F(31.55), b: F(34.3), light: "day", place: "fin", sunAz: 120, sunEl: 35 }, // luckily: quiet Finland
  { id: 10, a: F(34.3), b: F(36.55), light: "indoor", place: "lib", sunAz: 160, sunEl: 40 }, // unluckily: not people
  { id: 11, a: F(36.55), b: F(40.45), light: "indoor", place: "lib", sunAz: 60, sunEl: 40 }, // bots scraping the shelves
  { id: 12, a: F(40.45), b: F(49.25), light: "indoor", place: "buf" }, // the buffet guest
  { id: 13, a: F(49.25), b: F(54.0), light: "indoor", place: "desk" }, // banned millions, they came back
  { id: 14, a: F(54.0), b: F(58.9), light: "indoor", place: "lib", sunAz: 150, sunEl: 40 }, // the AI bouncer
  { id: 15, a: F(58.9), b: F(62.5), light: "indoor", place: "lib", sunAz: 60, sunEl: 40 }, // getting worse
  { id: 16, a: F(62.5), b: TOTAL, light: "golden", place: "fin", sunAz: 145, sunEl: 11 }, // the musician and the bot
];
export const XFADE: Record<number, number> = { 9: 8, 16: 10 };
export const FLASH_AT = F(6.55);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
/** what the screens show (the kiosk and the office monitor share one canvas) */
export type Screen = "search" | "bars" | "load" | "filters" | "full" | "ban" | "ok" | "off";
export const screenAt = (id: number, t: number): Screen =>
  id === 1 || id === 2 ? "search" : id === 3 ? "bars" : id === 4 ? "ok" : id === 5 || id === 6 ? "load" : id === 7 ? "filters"
    : id === 8 ? (at(t, W.queue) ? "full" : "search") : id === 13 ? "ban" : id === 15 ? "search" : "ok";

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
const at3 = (o: number, x: number, y: number, z: number): V3 => [o + x, y, z];
const aim = (pos: V3, far: V3, d = 9): V3 => { const v = far.map((x, i) => x - pos[i]), n = Math.hypot(...v); return pos.map((x, i) => x + (v[i] * d) / n) as V3; };
const Lb = (x: number, y: number, z: number) => at3(LIB, x, y, z);
const Dk = (x: number, y: number, z: number) => at3(DESK, x, y, z);
const Fn = (x: number, y: number, z: number) => at3(FIN, x, y, z);
const Bf = (x: number, y: number, z: number) => at3(BUF, x, y, z);
const monN: V3 = [Math.sin(MON_YAW), 0, Math.cos(MON_YAW)];
const monCam = (d: number, dx = 0, dy = 0): V3 => [MON[0] + monN[0] * d + Math.cos(MON_YAW) * dx, MON[1] + dy, MON[2] + monN[2] * d - Math.sin(MON_YAW) * dx];
const monLook = (dx = 0, dy = 0): V3 => [MON[0] + Math.cos(MON_YAW) * dx, MON[1] + dy, MON[2] - Math.sin(MON_YAW) * dx];
/** kiosk screen insert camera: in front of the tilted screen */
const kCam = (d: number, dy = 0): V3 => [KSCR[0], KSCR[1] + dy + d * Math.sin(-KS_TILT) * 0.6, KSCR[2] + d];

const CAMS: Record<number, Key[]> = {
  1: [
    // high in the hall, the kiosk in the aisle, bubbles pouring in from the entrance; glide down toward the kiosk
    { f: 0, s: (f) => dolly(Lb(-3.5, 5.2, 10), Lb(0, 1.6, -8), pushK(f, 0, 0.003), { fov: 52, roll: 0.03 }) },
    { f: F(1.2), dur: 40, s: (f) => dolly(Lb(-1.6, 2.6, 0.5), Lb(0, 1.35, -7), pushK(f, F(1.2), 0.0025), { fov: 48, roll: -0.02 }) },
  ],
  2: [
    { f: F(2.9), s: (f) => dolly(kCam(1.15, 0.05), [KSCR[0], KSCR[1], KSCR[2]], pushK(f, F(2.9), 0.003, 0.007, 25), { fov: 40, roll: 0.03 }) }, // the counter
    { f: F(4.85), cut: true, s: (f) => dolly(Lb(1.6, 1.5, -4.2), Lb(-0.2, 1.6, -9), pushK(f, F(4.85), 0.0025, 0.006, 25), { fov: 50, roll: -0.04 }) }, // "Finnish music": bubbles swirl round the kiosk
  ],
  3: [
    { f: F(6.55), s: (f) => ({ ...dolly(monCam(0.95, 0.06, 0), monLook(0.06, 0), pushK(f, F(6.55), 0.0022)), fov: 38, roll: 0.02 }) },
    { f: F(7.5), dur: 22, s: (f) => ({ ...dolly(monCam(0.85, -0.05, -0.04), monLook(-0.05, -0.04), pushK(f, F(7.5), 0.002, 0.006, 25)), fov: 38, roll: -0.02 }) }, // "fifteen": the tiny bar
  ],
  4: [
    // along a reading table: students cramming under the lamps; then over to the kiosk humming in the aisle
    { f: F(8.75), s: (f) => dolly(Lb(-8.7, 1.8, 10.2), aim(Lb(-8.7, 1.8, 10.2), Lb(-4.4, 1.0, 1.0)), pushK(f, F(8.75), 0.0025), { fov: 46, roll: 0.03 }) },
    { f: F(10.1), dur: 40, s: (f) => dolly(Lb(-8.6, 1.7, 5.4), aim(Lb(-8.6, 1.7, 5.4), Lb(-4.2, 0.95, -2.0)), pushK(f, F(10.1), 0.0022), { fov: 46, roll: -0.02 }) }, // "students cramming"
    { f: F(12.8), dur: 34, s: (f) => dolly(Lb(-1.9, 1.75, -3.6), Lb(0, 1.25, -7.2), pushK(f, F(12.8), 0.0022), { fov: 44, roll: 0.02 }) }, // "the library catalogue"
  ],
  5: [
    { f: F(14.45), s: (f) => dolly(Dk(-1.0, 1.3, 1.3), Dk(0.0, 1.0, -1.3), pushK(f, F(14.45), 0.0025), { fov: 46, roll: 0.02 }) },
    { f: F(15.45), cut: true, s: (f) => ({ ...dolly(monCam(1.0, 0, 0), monLook(0, 0), pushK(f, F(15.45), 0.0025)), fov: 38, roll: -0.02 }) }, // "a hundred people"
  ],
  6: [
    { f: F(17.45), s: (f) => ({ ...dolly(monCam(1.15, 0, 0), monLook(0, 0), pushK(f, F(17.45), 0.003, 0.009, 25)), fov: 38, roll: 0.03 }) },
    { f: F(18.6), cut: true, s: (f) => dolly(Dk(-0.75, 1.3, 1.25), Dk(-0.3, 1.12, -1.5), pushK(f, F(18.6), 0.003), { fov: 40, roll: -0.03 }) }, // the librarian's face
  ],
  7: [
    { f: F(19.9), s: (f) => dolly(Dk(-0.9, 1.25, 0.55), Dk(-0.3, 1.0, -1.45), pushK(f, F(19.9), 0.0028), { fov: 42, roll: -0.03 }) }, // leans in: picky?
    { f: F(22.55), cut: true, s: (f) => ({ ...dolly(monCam(1.0, -0.17, 0), monLook(-0.17, 0), pushK(f, F(22.55), 0.0025)), fov: 38, roll: 0.02 }) }, // a human: six ticks
    { f: F(24.75), dur: 22, s: (f) => ({ ...dolly(monCam(1.0, 0.17, 0), monLook(0.17, 0), pushK(f, F(24.75), 0.002, 0.006, 25)), fov: 38, roll: -0.02 }) }, // these: twenty-five
    { f: F(26.6), cut: true, s: (f) => dolly(Dk(-0.7, 1.28, 1.2), Dk(-0.3, 1.12, -1.5), pushK(f, F(26.6), 0.003), { fov: 40, roll: 0.03 }) }, // dazed
  ],
  8: [
    { f: F(27.75), s: (f) => dolly(Lb(1.3, 1.55, -4.0), Lb(0, 1.3, -7), pushK(f, F(27.75), 0.0025), { fov: 46, roll: 0.02 }) }, // students in line at the kiosk
    { f: F(29.0), cut: true, s: (f) => dolly(kCam(0.95, 0.03), [KSCR[0], KSCR[1], KSCR[2]], pushK(f, F(29.0), 0.003, 0.01, 25), { fov: 40, roll: -0.03 }) }, // queue full
    { f: F(30.3), cut: true, s: (f) => dolly(Lb(0.6, 1.8, -10.3), Lb(0, 1.0, -3.0), pushK(f, F(30.3), 0.002), { fov: 52, roll: 0.04 }) }, // everybody out: from behind the kiosk
  ],
  9: [
    // quiet Finnish lake at sunset: the jetty, a lone figure, the cabin
    { f: F(31.3), s: (f) => dolly(Fn(-3.6, 1.9, -1.5), aim(Fn(-3.6, 1.9, -1.5), Fn(-7.5, 1.1, -12)), pushK(f, F(31.3), 0.002), { fov: 46, roll: 0.02 }) },
    { f: F(32.9), dur: 40, s: (f) => dolly(Fn(-5.6, 1.5, -6.6), aim(Fn(-5.6, 1.5, -6.6), Fn(-7.6, 1.2, -12)), pushK(f, F(32.9), 0.002), { fov: 44, roll: -0.02 }) }, // "famous": in on the shrug
  ],
  10: [
    // down the aisle toward the entrance: the bots march in, one turns to us
    { f: F(34.3), s: (f) => dolly(Lb(-1.5, 1.2, -6.2), Lb(0.2, 1.0, -16), pushK(f, F(34.3), 0.0028), { fov: 48, roll: -0.03 }) },
    { f: F(35.6), dur: 18, s: (f) => dolly(Lb(-0.9, 0.95, -9.4), Lb(0.25, 0.8, -12.5), pushK(f, F(35.6), 0.003, 0.008, 25), { fov: 44, roll: 0.03 }) }, // "not people"
  ],
  11: [
    // the stacks: bots hoovering books off the shelves
    { f: F(36.55), s: (f) => dolly(Lb(5.0, 1.9, -6.0), Lb(8.4, 1.6, -12.0), pushK(f, F(36.55), 0.0025), { fov: 50, roll: 0.03 }) },
    { f: F(38.2), dur: 40, s: (f) => dolly(Lb(6.6, 1.3, -7.6), Lb(8.6, 1.4, -11.6), pushK(f, F(38.2), 0.002, 0.005, 25), { fov: 50, roll: -0.03 }) }, // "everything"
  ],
  12: [
    { f: F(40.45), s: (f) => dolly(Bf(-1.4, 1.6, 3.6), Bf(-4.0, 0.95, -0.7), pushK(f, F(40.45), 0.0025), { fov: 48, roll: 0.02 }) }, // the guest at the buffet
    { f: F(41.95), dur: 18, s: (f) => dolly(Bf(-2.5, 1.2, 1.5), Bf(-4.05, 0.9, -0.65), pushK(f, F(41.95), 0.003, 0.007, 25), { fov: 44, roll: -0.03 }) }, // "doesn't eat"
    { f: F(43.0), cut: true, s: (f) => dolly(Bf(0.4, 1.7, 6.4), Bf(3.4, 0.9, 0.4), pushK(f, F(43.0), 0.0025), { fov: 50, roll: 0.03 }) }, // the truck
    { f: F(44.5), dur: 30, s: (f) => dolly(Bf(1.6, 1.7, 6.6), Bf(4.6, 0.9, 1.6), pushK(f, F(44.5), 0.0018), { fov: 50, roll: -0.02 }) }, // tiptoes off past the truck
    { f: F(45.85), cut: true, s: (f) => dolly(Bf(-1.1, 1.6, 1.4), Bf(-1.5, 1.1, -5.0), pushK(f, F(45.85), 0.0025, 0.006, 20), { fov: 50, roll: 0.03 }) }, // door 2: top hat
    { f: F(47.3), dur: 10, s: (f) => dolly(Bf(1.9, 1.6, 1.4), Bf(1.5, 1.1, -5.0), pushK(f, F(47.3), 0.0025, 0.006, 20), { fov: 50, roll: -0.03 }) }, // door 3: moustache
    { f: F(48.25), dur: 10, s: (f) => dolly(Bf(4.3, 1.75, -0.7), Bf(4.5, 1.1, -5.0), pushK(f, F(48.25), 0.0025, 0.006, 20), { fov: 50, roll: 0.03 }) }, // door 4: glasses
  ],
  13: [
    { f: F(49.25), s: (f) => ({ ...dolly(monCam(1.05, 0, 0), monLook(0, 0), pushK(f, F(49.25), 0.0025)), fov: 38, roll: -0.02 }) }, // banned: red crosses
    { f: F(51.0), dur: 30, s: (f) => ({ ...dolly(monCam(0.95, 0.05, 0.01), monLook(0.05, 0.01), pushK(f, F(51.0), 0.002, 0.006, 25)), fov: 38, roll: 0.02 }) }, // they come back
    { f: F(53.0), cut: true, s: (f) => dolly(Dk(-0.75, 1.3, 1.6), Dk(-0.3, 1.1, -1.5), pushK(f, F(53.0), 0.0028), { fov: 40, roll: 0.03 }) }, // sigh
  ],
  14: [
    // the entrance: the AI bouncer lets a student in and keeps a bot out
    { f: F(54.0), s: (f) => dolly(Lb(-2.6, 1.6, -9.6), Lb(1.6, 1.5, -15.8), pushK(f, F(54.0), 0.0025), { fov: 48, roll: 0.03 }) },
    { f: F(56.2), dur: 28, s: (f) => dolly(Lb(-1.4, 1.3, -11.2), Lb(1.2, 1.2, -15.8), pushK(f, F(56.2), 0.002), { fov: 48, roll: -0.02 }) },
    { f: F(57.75), dur: 14, s: (f) => dolly(Lb(-1.1, 1.2, -11.9), Lb(1.3, 1.1, -15.9), pushK(f, F(57.75), 0.003, 0.009, 25), { fov: 46, roll: 0.03 }) }, // "bots out"
  ],
  15: [
    // up and back over the hall: bots everywhere, more streaming in
    { f: F(58.9), s: (f) => dolly(Lb(2.5, 2.4, 6.0), Lb(0, 1.4, -10), pushK(f, F(58.9), 0.002), { fov: 52, roll: -0.02 }) },
    { f: F(59.7), dur: 60, s: (f) => dolly(Lb(5.5, 7.6, 14.5), Lb(0, 0.8, -6), pushK(f, F(59.7), 0.0015), { fov: 56, roll: 0.02 }) }, // "everywhere"
  ],
  16: [
    // the porch at sunset: the musician plays, the bot sits beside him with its stack of cards
    { f: F(62.2), s: (f) => dolly(Fn(1.0, 1.35, 2.8), Fn(-0.05, 1.05, -1.45), pushK(f, F(62.2), 0.0022), { fov: 44, roll: 0.02 }) },
    { f: F(64.6), dur: 40, s: (f) => dolly(Fn(1.5, 1.25, 2.2), Fn(0.8, 1.05, -1.4), pushK(f, F(64.6), 0.002), { fov: 42, roll: -0.02 }) }, // in on the bot
    { f: F(66.7), dur: 30, s: (f) => dolly(Fn(1.7, 1.2, 1.3), Fn(1.05, 1.1, -1.35), pushK(f, F(66.7), 0.0025, 0.005, 25), { fov: 40, roll: 0.03 }) }, // "never heard a single note"
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.eleven, 0.6], [W.finnish, 0.5], [W.fifteen, 0.4], [W.five, 1.0], [W.tf, 0.7], [W.full, 1.0], [W.out, 0.9],
  [W.people2, 0.6], [W.scraping, 0.6], [W.truck, 0.8], [W.again, 0.5], [W.again2, 0.5], [W.came, 0.6], [W.botsOut, 1.0], [W.worse, 0.5],
  [W.note + 0.35, 0.5],
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
const ytEyes = (): V3 => [YT[0], 1.25, YT[2]];
const kio = (): V3 => KSCR;
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: F(1.2), dur: 40, cInf: 7, focus: kio },
  { f: F(2.9), cInf: 0 }, // screen insert
  { f: F(4.85), cInf: 10, focus: kio },
  { f: F(6.55), cInf: 0 },
  { f: F(8.75), cInf: 6, focus: () => [LIB - 4.2, 1.1, 1.5] },
  { f: F(10.1), dur: 40, cInf: 6, focus: () => [LIB - 4.2, 1.1, -1.0] },
  { f: F(12.8), dur: 34, cInf: 9, focus: kio },
  { f: F(14.45), cInf: 10, focus: ytEyes },
  { f: F(15.45), cInf: 0 },
  { f: F(18.6), cInf: 13, focus: ytEyes },
  { f: F(19.9), cInf: 12, focus: ytEyes },
  { f: F(22.55), cInf: 0 },
  { f: F(26.6), cInf: 13, focus: ytEyes },
  { f: F(27.75), cInf: 10, focus: () => [LIB + 0.3, 1.3, -5.6] },
  { f: F(29.0), cInf: 0 },
  { f: F(30.3), cInf: 7, focus: () => [LIB, 1.2, -5.0] },
  { f: F(31.55), cInf: 0 },
  { f: F(32.9), dur: 40, cInf: 5, focus: () => JETTY_END },
  { f: F(34.3), cInf: 6, focus: () => [LIB, 1.0, -13] },
  { f: F(35.6), dur: 18, cInf: 11, focus: () => [LIB + 0.2, 0.8, -12.6] },
  { f: F(36.55), cInf: 8, focus: () => [LIB + 8.3, 1.4, -11] },
  { f: F(40.45), cInf: 7, focus: () => [BUF - 4.1, 1.0, -0.6] },
  { f: F(41.95), dur: 18, cInf: 12, focus: () => [BUF - 4.1, 1.0, -0.6] },
  { f: F(43.0), cInf: 7, focus: () => [TRUCK[0] - 2.4, 1.0, TRUCK[2]] },
  { f: F(44.5), cInf: 5, focus: () => [BUF + 4.5, 1.0, 2.2] },
  { f: F(45.85), cInf: 8, focus: () => [BUF - 1.6, 1.0, -3.4] },
  { f: F(47.3), cInf: 8, focus: () => [BUF + 1.4, 1.0, -3.4] },
  { f: F(48.25), cInf: 8, focus: () => [BUF + 4.4, 1.0, -3.4] },
  { f: F(49.25), cInf: 0 },
  { f: F(53.0), cInf: 13, focus: ytEyes },
  { f: F(54.0), cInf: 8, focus: () => [GUARD[0], 1.5, GUARD[2]] },
  { f: F(58.9), cInf: 0 },
  { f: F(62.5), cInf: 8, focus: () => [FIN + 0.1, 1.0, -1.4] },
  { f: F(64.6), dur: 40, cInf: 11, focus: () => [FBOT[0], 1.1, FBOT[2]] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
