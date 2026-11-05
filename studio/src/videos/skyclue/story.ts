// "The Sky Gave It Away": timeline timed to pipeline/stories/skyclue/words.json (ElevenLabs George, 67.75 s).
// Four places in one scene graph: the RIVER bank with the security camera on its pole (x 0), the YouTuber's DESK room
// (x - 1000), the giant flight MAP of the US (x + 1000) and the STREET of the siren analogy (x + 2000).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 2055;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const RIV = 0, DESK = -1000, MAP = 1000, ST = 2000;

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  youtuber: 0.46, found: 1.07, exactly: 1.4, filmed: 2.77, using: 3.42, airplanes: 3.68, nobody: 4.46, hear: 5.22,
  clue: 6.26, blurry: 7.08, camera: 8.11, trees: 9.2, riverbank: 9.95, knew: 11.29, september: 12.02, somewhere: 13.08, america: 13.59,
  hidden: 14.61, audio: 15.21, two: 15.98, planes: 16.25, passing: 17.18, nine: 17.65, seconds: 18.72, apart: 19.21,
  pulled: 20.18, gigabytes: 20.76, flight: 21.45, wrote: 22.59, five: 22.91, lines: 23.57, code: 24.14,
  first: 24.78, seventy: 25.75, spots: 27.4, filter: 28.29, gap: 28.97, fifteen: 29.49,
  simulated: 31.33, every: 32.0, sound: 32.7, spot: 33.93,
  one: 34.8, fit: 35.23, street: 35.97, same: 36.81, trees2: 37.1, pole: 38.22, theres: 39.05, cam2: 39.33,
  luckily: 40.4, odds: 41.67, slim: 43.37, unluckily: 44.05, survived: 45.5, filters: 45.99, noise: 46.71, phone: 47.26, compression: 47.57,
  how: 48.51, siren: 49.43, drops: 49.86, passes: 50.99, planesToo: 51.89, fast: 53.66, close: 55.38, flew: 55.9,
  broadcast: 57.01, where: 57.46, publicly: 58.48, allDay: 59.56,
  sky: 60.95, clock: 62.24, map: 63.41, allThat: 64.31, films: 66.01, trees3: 66.56,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- props and their motion (pure functions of film time) ----------------
/** the security camera on its pole at the river: pole foot, head pivot; it films the far bank (-z) */
export const POLE: V3 = [RIV + 1.6, 0, -3.0];
export const CAM_HEAD: V3 = [RIV + 1.98, 4.35, -3.05];
/** head yaw (0 = facing -z, the river) and pitch: it swivels to the lens on "There's the camera" */
export const camHeadYaw = (t: number) => (t > 38.5 && t < 40.4 ? 2.9 * smooth((t - (W.cam2 - 0.12)) / 0.22) : 0) + 0.04 * Math.sin(t * 0.6);
export const camHeadPitch = (t: number) => (t > 38.5 && t < 40.4 ? 0.12 * smooth((t - (W.cam2 - 0.12)) / 0.22) : -0.18);

/** planes: [x, y, z, heading yaw] at time t for plane i of shot-group g */
export type PlaneState = { p: V3; yaw: number; s: number; trail: number; vis: boolean };
const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const fly = (a: V3, b: V3, t0: number, t1: number, t: number, s = 1, trail = 60): PlaneState => {
  const u = (t - t0) / (t1 - t0);
  return { p: lerp3(a, b, u), yaw: Math.atan2(b[0] - a[0], b[2] - a[2]), s, trail, vis: u > -0.2 && u < 1.2 };
};
/** the river-sky planes (hook, "planes do it too", the clock-and-map sky, the ending) */
export const riverPlanes = (t: number): PlaneState[] => {
  const out: PlaneState[] = [];
  if (t < 6.2) out.push(fly([RIV - 120, 110, -140], [RIV + 80, 110, -140], -1.0, 7.5, t, 1.6, 140));
  if (t > 51 && t < 56.5) out.push(fly([RIV - 45, 95, -110], [RIV + 45, 95, -100], 51.0, 57.0, t, 1.4, 120));
  if (t > 54 && t < 56.5) out.push(fly([RIV + 70, 30, -70], [RIV - 90, 30, -25], W.close - 0.6, W.close + 1.4, t, 1.1, 50));
  if (t > 60 && t < 68.6) {
    out.push(fly([RIV - 300, 140, -200], [RIV + 300, 150, -120], 58.0, 70.0, t, 1.5, 260));
    out.push(fly([RIV + 260, 170, -300], [RIV - 40, 150, 60], 58.0, 68.0, t, 1.5, 260));
    out.push(fly([RIV + 40, 175, -360], [RIV - 60, 175, 40], 60.2, 68.0, t, 1.5, 260));
  }
  return out;
};
/** map planes (little planes at y 9 crossing the map with trails); count grows on "publicly" */
export const mapPlanes = (t: number, id: number): PlaneState[] => {
  const out: PlaneState[] = [];
  const n = id === 16 ? (at(t, W.publicly) ? 16 : 8) : id >= 7 && id <= 10 ? 6 : 0;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r0 = 120;
    const A: V3 = [MAP + r0 * Math.cos(a), 9 + (i % 3) * 2, r0 * 0.65 * Math.sin(a)], B: V3 = [MAP - r0 * Math.cos(a + 0.7), 9 + (i % 3) * 2, -r0 * 0.65 * Math.sin(a + 0.7)];
    const T = 9 + (i % 4) * 1.5, ph = (i * 0.37) % 1;
    const base = 20 + ph * T, t0 = base + T * Math.floor((t - base) / T);
    out.push(fly(A, B, t0, t0 + T, t, 0.55, 30));
  }
  return out;
};
/** ambulance along the street (x), passing the YouTuber on "passes you" */
export const ambX = (t: number) => ST + (t - W.passes) * 9;

/** the screen state on the desk monitor */
export type Screen = "clip" | "specA" | "specB" | "filters" | "off";
/** spectrogram reveal: 0..1 of curve 1 / curve 2 */
export const curves = (t: number): [number, number] => [smooth((t - (W.planes - 0.1)) / 0.6), smooth((t - (W.apart - 0.15)) / 0.5)];

/** dots on the map: how many survive (fractions of the full set) */
export const dotPhase = (t: number) => {
  const appear = clamp01((t - (W.seventy - 0.35)) / 1.0);
  const keep = t < W.fifteen - 0.1 ? 1 : 1 - 0.8 * smooth((t - (W.fifteen - 0.1)) / 0.55);
  const one = at(t, W.one);
  return { appear, keep, one };
};
/** the hero spot (map coords relative to MAP): somewhere east of centre */
export const SPOT: V3 = [MAP + 34, 0.6, -6];

/** drives raining on the desk, code scroll unrolling */
export const drivesN = (t: number) => (t < W.gigabytes - 0.25 ? 0 : Math.min(26, Math.floor((t - (W.gigabytes - 0.25)) * 18)));
export const scrollLen = (t: number) => (t < W.lines - 0.4 ? 0 : Math.min(1, (t - (W.lines - 0.4)) / 1.6));

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "river" | "desk" | "map" | "street";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(3.35), light: "day", place: "river", sunAz: 110, sunEl: 40 }, // hook: the camera on its pole, a plane high above
  { id: 2, a: F(3.35), b: F(6.0), light: "day", place: "river", sunAz: 60, sunEl: 45 }, // "airplanes nobody could even hear"
  { id: 3, a: F(6.0), b: F(10.85), light: "indoor", place: "desk" }, // the blurry clip
  { id: 4, a: F(10.85), b: F(14.45), light: "day", place: "map", sunAz: 100, sunEl: 50 }, // somewhere in America
  { id: 5, a: F(14.45), b: F(19.95), light: "indoor", place: "desk" }, // two planes in the audio
  { id: 6, a: F(19.95), b: F(24.65), light: "indoor", place: "desk" }, // 50 GB, 5000 lines
  { id: 7, a: F(24.65), b: F(28.15), light: "day", place: "map", sunAz: 110, sunEl: 50 }, // 70,000 spots
  { id: 8, a: F(28.15), b: F(30.85), light: "day", place: "map", sunAz: 110, sunEl: 50 }, // 15,000
  { id: 9, a: F(30.85), b: F(34.7), light: "day", place: "map", sunAz: 120, sunEl: 45 }, // simulated every plane
  { id: 10, a: F(34.7), b: F(36.0), light: "day", place: "map", sunAz: 120, sunEl: 45 }, // one spot fit
  { id: 11, a: F(36.0), b: F(40.25), light: "day", place: "river", sunAz: 100, sunEl: 40 }, // street view: trees, pole, camera
  { id: 12, a: F(40.25), b: F(43.95), light: "indoor", place: "desk" }, // luckily
  { id: 13, a: F(43.95), b: F(48.4), light: "indoor", place: "desk" }, // unluckily: it survived
  { id: 14, a: F(48.4), b: F(51.8), light: "day", place: "street", sunAz: 110, sunEl: 42 }, // the siren
  { id: 15, a: F(51.8), b: F(56.3), light: "day", place: "river", sunAz: 70, sunEl: 45 }, // planes do it too
  { id: 16, a: F(56.3), b: F(60.45), light: "day", place: "map", sunAz: 110, sunEl: 50 }, // planes broadcast
  { id: 17, a: F(60.45), b: F(64.15), light: "golden", place: "river", sunAz: 15, sunEl: 9 }, // the sky is a clock and a map
  { id: 18, a: F(64.15), b: TOTAL, light: "day", place: "river", sunAz: 110, sunEl: 40 }, // a camera that films trees
];
export const XFADE: Record<number, number> = { 11: 8, 17: 8 };
export const FLASH_AT = F(6.0);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
/** what the desk monitor shows */
export const screenAt = (id: number, t: number): Screen => (id === 3 ? "clip" : id === 5 ? "specA" : id === 13 ? "filters" : id === 12 ? "specB" : id === 6 ? "specB" : "off");

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
/** a look point d metres from pos toward `far` (keeps creeping push-ins small when the subject is far away) */
const aim = (pos: V3, far: V3, d = 9): V3 => { const v = far.map((x, i) => x - pos[i]), n = Math.hypot(...v); return pos.map((x, i) => x + (v[i] * d) / n) as V3; };
const Rv = (x: number, y: number, z: number) => at3(RIV, x, y, z);
const Dk = (x: number, y: number, z: number) => at3(DESK, x, y, z);
const Mp = (x: number, y: number, z: number) => at3(MAP, x, y, z);
const Sr = (x: number, y: number, z: number) => at3(ST, x, y, z);

/** desk layout (shared with build.ts / cast.ts): the monitor's centre and facing (screen normal yaw) */
export const MON: V3 = [DESK + 0.42, 1.08, -1.12];
export const MON_YAW = -0.62; // screen normal turned toward the lens-left / the YouTuber
export const MON_W = 0.86, MON_H = 0.46;
export const YT: V3 = [DESK - 0.32, 0, -1.55]; // the YouTuber's seat
const monN: V3 = [Math.sin(MON_YAW), 0, Math.cos(MON_YAW)];
/** a point in front of the monitor at distance d (screen insert cameras) */
const monCam = (d: number, dx = 0, dy = 0): V3 => [MON[0] + monN[0] * d + Math.cos(MON_YAW) * dx, MON[1] + dy, MON[2] + monN[2] * d - Math.sin(MON_YAW) * dx];
const monLook = (dx = 0, dy = 0): V3 => [MON[0] + Math.cos(MON_YAW) * dx, MON[1] + dy, MON[2] - Math.sin(MON_YAW) * dx];

const CAMS: Record<number, Key[]> = {
  1: [
    // behind and beside the security camera: it fills the right of frame, the river and far trees beyond, the plane high up
    { f: 0, s: (f) => dolly(Rv(2.6, 4.6, -0.6), Rv(1.6, 5.0, -6.5), pushK(f, 0, 0.003), { fov: 46, roll: 0.03 }) },
    { f: F(1.3), dur: 40, s: (f) => dolly(Rv(2.9, 4.0, 1.0), aim(Rv(2.9, 4.0, 1.0), Rv(0.5, 14, -24)), pushK(f, F(1.3), 0.0022), { fov: 50, roll: -0.02 }) }, // "exactly where": pull back, tilt up toward the plane
  ],
  2: [
    // low angle up at the sky: the plane crosses, faint rings fall toward the camera
    { f: F(3.35), s: (f) => dolly(Rv(-1.5, 1.4, 2.0), aim(Rv(-1.5, 1.4, 2.0), Rv(2.0, 40, -70)), pushK(f, F(3.35), 0.0025), { fov: 58, roll: 0.05 }) },
    { f: F(4.9), dur: 22, s: (f) => dolly(Rv(2.7, 3.3, -5.4), [CAM_HEAD[0], CAM_HEAD[1] + 0.25, CAM_HEAD[2]], pushK(f, F(4.9), 0.002, 0.007, 25), { fov: 40, roll: -0.04 }) }, // "hear": down to the camera
  ],
  3: [
    { f: F(6.0), s: (f) => dolly(Dk(-0.3, 1.3, 1.5), Dk(0.05, 1.0, -1.3), pushK(f, F(6.0), 0.0025), { fov: 48, roll: 0.02 }) }, // the YouTuber at his desk
    { f: F(7.95), cut: true, s: (f) => ({ ...dolly(monCam(1.1, -0.12, 0.0), monLook(-0.12, 0), pushK(f, F(7.95), 0.003, 0.006, 30)), fov: 38, roll: -0.02 }) },
    { f: F(9.0), dur: 40, s: (f) => ({ ...dolly(monCam(1.0, 0.12, 0.0), monLook(0.12, 0), pushK(f, F(9.0), 0.0025)), fov: 38, roll: 0.01 }) }, // pan along the bank // "camera clip": the screen
  ],
  4: [
    // high over the map, then pull up to see the whole continent on "somewhere in America"
    { f: F(10.85), s: (f) => dolly(Mp(10, 46, 60), Mp(4, 0, -6), pushK(f, F(10.85), 0.0025), { fov: 46, roll: 0.03 }) },
    { f: F(12.9), dur: 36, s: (f) => dolly(Mp(0, 150, 120), Mp(0, 0, -8), pushK(f, F(12.9), 0.0015), { fov: 48, roll: -0.02 }) },
  ],
  5: [
    { f: F(14.45), s: (f) => dolly(Dk(-0.9, 1.25, 0.55), Dk(-0.3, 1.0, -1.45), pushK(f, F(14.45), 0.003, 0.006, 30), { fov: 42, roll: -0.03 }) }, // leans in
    { f: F(15.85), cut: true, s: (f) => ({ ...dolly(monCam(1.0, -0.2, 0), monLook(-0.2, 0), pushK(f, F(15.85), 0.0025)), fov: 38, roll: 0.02 }) }, // "two planes": the first streak
    { f: F(17.3), dur: 52, s: (f) => ({ ...dolly(monCam(1.0, 0.2, 0), monLook(0.2, 0), pushK(f, F(17.3), 0.002, 0.005, 25)), fov: 38, roll: -0.02 }) }, // "920 seconds apart": pan to the second
  ],
  6: [
    { f: F(19.95), s: (f) => dolly(Dk(-1.1, 1.55, 1.7), Dk(-0.05, 1.0, -1.2), pushK(f, F(19.95), 0.0025), { fov: 46, roll: 0.03 }) }, // drives rain down
    { f: F(22.5), dur: 30, s: (f) => dolly(Dk(0.9, 1.0, 1.9), Dk(-0.1, 0.65, -0.9), pushK(f, F(22.5), 0.002, 0.005, 30), { fov: 50, roll: -0.03 }) }, // the code scroll piles up
  ],
  7: [
    { f: F(24.65), s: (f) => dolly(Mp(-30, 110, 95), Mp(0, 0, -6), pushK(f, F(24.65), 0.002), { fov: 48, roll: 0.03 }) },
    { f: F(25.6), dur: 36, s: (f) => dolly(Mp(-14, 125, 80), Mp(6, 0, -10), pushK(f, F(25.6), 0.0016), { fov: 48, roll: -0.01 }) }, // "seventy thousand"
  ],
  8: [
    { f: F(28.15), s: (f) => dolly(Mp(40, 90, 70), Mp(10, 0, -8), pushK(f, F(28.15), 0.0025), { fov: 46, roll: -0.03 }) },
    { f: F(29.35), dur: 24, s: (f) => dolly(Mp(38, 70, 50), Mp(18, 0, -8), pushK(f, F(29.35), 0.002, 0.005, 25), { fov: 46, roll: 0.02 }) }, // "fifteen thousand"
  ],
  9: [
    { f: F(30.85), s: (f) => dolly(Mp(60, 30, 40), Mp(30, 2, -6), pushK(f, F(30.85), 0.003), { fov: 46, roll: 0.03 }) }, // low over the map: rings everywhere
    { f: F(32.6), dur: 40, s: (f) => dolly(Mp(48, 22, 22), Mp(33, 1, -6), pushK(f, F(32.6), 0.0022), { fov: 46, roll: -0.02 }) },
  ],
  10: [
    { f: F(34.7), s: (f) => dolly(Mp(44, 26, 16), Mp(34, 0.6, -6), pushK(f, F(34.7), 0.004, 0.01, 30), { fov: 44, roll: 0.03 }) }, // the one spot
  ],
  11: [
    // dive down onto the river bank, along the trees, up the pole, to the camera, which turns to look at us
    { f: F(35.7), s: (f) => dolly(Rv(-8, 32, 18), Rv(1.0, 0, -8), pushK(f, F(35.7), 0.002), { fov: 50, roll: 0.03 }) },
    { f: F(36.3), dur: 28, s: (f) => dolly(Rv(-5.5, 2.6, 6.5), aim(Rv(-5.5, 2.6, 6.5), Rv(-2.5, 2.2, -20)), pushK(f, F(36.3), 0.002), { fov: 48, roll: -0.02 }) }, // "same trees"
    { f: F(37.9), dur: 26, s: (f) => dolly(Rv(-0.6, 1.4, 1.6), Rv(1.7, 3.6, -3.0), pushK(f, F(37.9), 0.002), { fov: 46, roll: 0.03 }) }, // "same pole": tilt up it
    { f: F(38.9), dur: 18, s: (f) => dolly(Rv(1.62, 4.32, -1.45), CAM_HEAD, pushK(f, F(38.9), 0.003, 0.008, 25), { fov: 40, roll: -0.03 }) }, // "there's the camera"
  ],
  12: [
    { f: F(40.25), s: (f) => dolly(Dk(-0.75, 1.3, 1.6), Dk(-0.3, 1.1, -1.5), pushK(f, F(40.25), 0.0028), { fov: 40, roll: 0.03 }) }, // deadpan, shrug
    { f: F(43.2), dur: 18, s: (f) => dolly(Dk(-0.6, 1.25, 1.3), Dk(-0.3, 1.12, -1.5), pushK(f, F(43.2), 0.002, 0.006, 25), { fov: 40, roll: -0.02 }) }, // "slim"
  ],
  13: [
    { f: F(43.95), s: (f) => ({ ...dolly(monCam(1.7, 0, 0), monLook(0, 0), pushK(f, F(43.95), 0.0025)), fov: 38, roll: -0.03 }) },
    { f: F(45.9), dur: 20, s: (f) => ({ ...dolly(monCam(1.45, -0.03, 0), monLook(-0.03, 0), pushK(f, F(45.9), 0.002)), fov: 38, roll: 0.03 }) },
  ],
  14: [
    // the YouTuber on the kerb, the ambulance passes left to right
    { f: F(48.4), s: (f) => dolly(Sr(3.6, 1.6, 7.0), Sr(-3.0, 1.5, -2.0), pushK(f, F(48.4), 0.0025), { fov: 52, roll: 0.02 }) },
    { f: F(50.5), dur: 30, s: (f) => dolly(Sr(-2.4, 1.6, 7.0), Sr(4.0, 1.5, -2.0), pushK(f, F(50.5), 0.002), { fov: 52, roll: -0.03 }) }, // pan with it
  ],
  15: [
    { f: F(51.8), s: (f) => dolly(Rv(-2.0, 1.6, 3.0), aim(Rv(-2.0, 1.6, 3.0), Rv(0, 50, -90)), pushK(f, F(51.8), 0.0022), { fov: 60, roll: 0.04 }) }, // a plane, its rings
    { f: F(54.9), dur: 20, s: (f) => dolly(Rv(-2.4, 1.5, 3.2), aim(Rv(-2.4, 1.5, 3.2), Rv(-8, 22, -45)), pushK(f, F(54.9), 0.002, 0.007, 25), { fov: 62, roll: -0.05 }) }, // "how close": the low one
  ],
  16: [
    { f: F(56.3), s: (f) => dolly(Mp(-60, 70, 80), Mp(-10, 0, -10), pushK(f, F(56.3), 0.0025), { fov: 46, roll: 0.03 }) },
    { f: F(58.3), dur: 40, s: (f) => dolly(Mp(0, 160, 140), Mp(0, 0, -8), pushK(f, F(58.3), 0.0015), { fov: 50, roll: -0.02 }) }, // "publicly": all of them
  ],
  17: [
    { f: F(60.2), s: (f) => dolly(Rv(-4, 1.6, 6.5), aim(Rv(-4, 1.6, 6.5), Rv(-1, 3.2, -20)), pushK(f, F(60.2), 0.002), { fov: 52, roll: 0.02 }) },
    { f: F(61.0), dur: 40, s: (f) => dolly(Rv(-3.4, 1.4, 5.0), aim(Rv(-3.4, 1.4, 5.0), Rv(0, 60, -110)), pushK(f, F(61.0), 0.0018), { fov: 62, roll: -0.03 }) }, // tilt up to the sky: trails
  ],
  18: [
    // the security camera's own view: trees across the river, slightly wide
    { f: F(64.15), s: (f) => dolly([CAM_HEAD[0], CAM_HEAD[1] - 0.05, CAM_HEAD[2] - 0.35], aim([CAM_HEAD[0], CAM_HEAD[1] - 0.05, CAM_HEAD[2] - 0.35], Rv(0.6, 1.8, -32), 6), pushK(f, F(64.15), 0.003), { fov: 64, roll: 0 }) },
    { f: F(65.35), cut: true, s: (f) => dolly(Rv(3.1, 4.5, -4.6), [CAM_HEAD[0], CAM_HEAD[1] + 0.05, CAM_HEAD[2]], pushK(f, F(65.35), 0.0025), { fov: 40, roll: 0.03 }) }, // "a camera that films trees"
    { f: F(67.1), dur: 36, s: (f) => dolly(Rv(3.5, 4.6, -5.3), [CAM_HEAD[0], CAM_HEAD[1] + 0.12, CAM_HEAD[2]], pushK(f, F(67.1), 0.0015), { fov: 42, roll: -0.02 }) }, // bird on top; ease back
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.hear, 0.5], [W.trees, 0.4], [W.planes, 0.5], [W.apart, 0.6], [W.gigabytes, 1.1], [W.lines, 0.8], [W.seventy, 0.6], [W.fifteen, 0.6],
  [W.one, 1.0], [W.cam2, 0.9], [W.filters, 0.7], [W.noise, 0.8], [W.phone, 0.9], [W.passes, 0.6], [W.close, 1.0], [W.publicly, 0.5], [67.0, 0.7],
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
const camHead = (): V3 => CAM_HEAD;
export const DOF: Dof[] = [
  { f: 0, cInf: 9, focus: camHead },
  { f: F(1.3), dur: 40, cInf: 3, focus: camHead },
  { f: F(3.35), cInf: 0 },
  { f: F(4.9), dur: 22, cInf: 8, focus: camHead },
  { f: F(6.0), cInf: 10, focus: ytEyes },
  { f: F(7.95), cInf: 0 }, // screen insert
  { f: F(10.85), cInf: 0 }, // map
  { f: F(14.45), cInf: 12, focus: ytEyes },
  { f: F(15.85), cInf: 0 },
  { f: F(19.95), cInf: 8, focus: ytEyes },
  { f: F(24.65), cInf: 0 },
  { f: F(30.85), cInf: 6 },
  { f: F(34.7), cInf: 10, focus: () => SPOT },
  { f: F(36.0), cInf: 0 },
  { f: F(38.9), dur: 18, cInf: 12, focus: camHead },
  { f: F(40.25), cInf: 13, focus: ytEyes },
  { f: F(43.95), cInf: 0 },
  { f: F(48.4), cInf: 7, focus: () => [ST + 0.2, 1.3, 1.3] },
  { f: F(51.8), cInf: 0 },
  { f: F(56.3), cInf: 0 },
  { f: F(60.45), cInf: 0 },
  { f: F(64.15), cInf: 4 },
  { f: F(65.35), cInf: 12, focus: camHead },
  { f: F(66.9), dur: 40, cInf: 9, focus: camHead },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
