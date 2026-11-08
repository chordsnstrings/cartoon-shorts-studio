// "Air Traffic Control Runs on Floppy Disks": timeline timed to pipeline/stories/floppy/words.json (ElevenLabs George, 68.4 s).
// Four places in one scene graph: the AIRPORT (runway, tower, terminal, airliners; x 0), the CONTROL ROOM (console row of
// beige 1980s terminals, the floppy drive; x - 1000), the US flight MAP (x + 1000) and the HIGHWAY of the analogy (x + 2000).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 2080;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const AIR = 0, DESK = -1000, MAP = 1000, ROAD = 2000;

// ---------------- story beats (film seconds, from words.json, cross-checked with whisper) ----------------
export const W = {
  parts: 0.56, america: 0.75, control: 1.96, still: 2.82, floppy: 3.54, disks: 3.9, yes: 4.8, those: 5.37, floppy2: 5.66, disks2: 6.08,
  passengers: 7.14, movies: 7.91, thirty: 8.6, feet: 9.37, but: 9.98, rooms: 11.1, four: 11.81, systems: 12.12, eighties: 12.91, duty: 14.5,
  when: 15.51, breaks: 15.91, spare: 16.64, ebay: 17.63, some: 18.53, towers: 18.62, hand: 19.34, paper: 20.21, strips: 20.55, one: 21.35,
  every: 21.74, flight: 22.06, and: 22.79, floppy3: 23.1, holds: 23.94, oneP: 24.44, four4: 25.09, mega: 25.5, thats: 26.5, smaller: 26.65,
  single: 27.3, selfie: 27.72, luckily: 29.04, machines: 29.56, work: 30.33, unluckily: 31.33, nobody: 32.36, makes: 32.82, disks3: 33.24,
  anymore: 33.63, so: 34.69, swap: 35.36, because: 36.1, never: 37.21, stops: 37.57, like: 38.41, changing: 38.65, tyres: 39.23, car: 39.85,
  whilee: 40.54, driving: 40.95, highway: 41.61, full: 42.3, passengers2: 42.8, thisw: 43.94, faa: 44.68, posted: 45.62, emojis: 46.68,
  floppy4: 47.6, eighties2: 48.67, out: 49.6, twentyfirst: 50.2, century: 50.9, tech: 51.26, inn: 51.95, onew: 52.53, screen: 53.07,
  weather: 53.86, outages: 54.5, alerts: 55.39, together: 55.79, fourh: 56.8, sites: 58.08, by: 58.6, y2028: 59.26, most: 60.61,
  floppy5: 61.57, save: 63.04, icon: 63.48, turns: 64.42, air2: 65.15, traffic2: 65.34, actual: 66.59, save2: 67.05, button: 67.45,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** control room: 9 x 7 x 3 m; console desk along z -1.42..-0.72 from x -2.2 to 3.2 */
export const ROOM = { w: 9, d: 7, h: 3 };
/** the hero CRT (beige 1980s terminal): screen centre, yaw, size */
export const MON: V3 = [DESK + 0.42, 1.06, -1.1];
export const MON_YAW = -0.5;
export const MON_W = 0.5, MON_H = 0.38;
/** the other three terminals of the row: [x, yaw] (screen centre y 1.06, z -1.1) */
export const TERMS: [number, number][] = [[DESK - 1.45, 0.28], [DESK + 1.55, -0.3], [DESK + 2.65, -0.45]];
export const YT: V3 = [DESK - 0.32, 0, -1.55]; // the controller's seat
export const MATE: V3 = [DESK + 0.95, 0, -0.4]; // the colleague, standing at the desk front
/** the floppy drive box on the desk: centre of its front slot, facing +z */
export const DRIVE: V3 = [DESK + 1.0, 0.82, -0.8];

/** airport: runway along x at z -40 (60 m wide band), tower, terminal */
export const RWY_Z = -40;
export const TOWER: V3 = [AIR + 22, 0, -72];

/** highway: road z -6..0 along x; the truck drives +x */
export const truckX = (t: number) => ROAD - 34 + (t - 37.85) * 4.2;
export const TRUCK_Z = -2.0;

// ---------------- planes ----------------
export type PlaneState = { p: V3; yaw: number; pitch: number; s: number; trail: number; vis: boolean };
const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const fly = (a: V3, b: V3, t0: number, t1: number, t: number, s = 1, trail = 60, pitch = 0): PlaneState => {
  const u = (t - t0) / (t1 - t0);
  return { p: lerp3(a, b, u), yaw: Math.atan2(b[0] - a[0], b[2] - a[2]), pitch, s, trail, vis: u > -0.2 && u < 1.2 };
};
/** a take-off roll along the runway (+x): ground run, rotate, climb */
const takeoff = (t: number, t0: number, z: number, s = 3, x0 = -150): PlaneState => {
  const d = t - t0, v = 14 + d * 6;
  const x = AIR + x0 + 14 * d + 3 * d * d, lift = Math.max(0, d - 3.4);
  const y = 1.25 * s + 0.05 + lift * lift * 2.2, pitch = -Math.min(0.2, lift * 0.12);
  void v;
  return { p: [x, y, z], yaw: Math.PI / 2, pitch, s, trail: 0, vis: x < AIR + 260 };
};
/** a landing approach toward -x */
const landing = (t: number, t0: number, z: number, s = 3): PlaneState => {
  const d = t - t0, x = AIR + 90 - 30 * d, y = Math.max(1.25 * s + 0.05, 28 - 6.5 * d);
  return { p: [x, y, z], yaw: -Math.PI / 2, pitch: y > 3 ? 0.05 : 0, s, trail: 0, vis: x > AIR - 220 };
};
export const airPlanes = (id: number, t: number): PlaneState[] => {
  const out: PlaneState[] = [];
  if (id === 4) out.push(fly([AIR - 70, 150, -30], [AIR + 70, 150, -30], 6.2, 10.6, t, 3, 0));
  if (id === 12) { out.push(takeoff(t, 34.0, RWY_Z, 3, -60)); out.push(landing(t, 34.5, RWY_Z - 14)); out.push(fly([AIR - 230, 70, -160], [AIR + 120, 85, -210], 32.0, 40.0, t, 3, 0)); }
  if (id === 19) { out.push(fly([AIR - 30, 58, RWY_Z - 60], [AIR + 90, 74, RWY_Z - 60], 63.8, 67.2, t, 3, 0, -0.12)); out.push(fly([AIR + 220, 140, -260], [AIR - 180, 150, -240], 62.0, 69.0, t, 3, 0)); } // both well above the tower cab: never overlap the tower
  return out;
};
/** little planes crossing the map with trails (hook) */
export const mapPlanes = (t: number, id: number): PlaneState[] => {
  const out: PlaneState[] = [];
  const n = id === 1 ? 14 : id === 17 ? 8 : 0;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r0 = 110;
    const A: V3 = [MAP + r0 * Math.cos(a), 9 + (i % 3) * 2, r0 * 0.55 * Math.sin(a)], B: V3 = [MAP - r0 * Math.cos(a + 0.7), 9 + (i % 3) * 2, -r0 * 0.55 * Math.sin(a + 0.7)];
    const T = 9 + (i % 4) * 1.5, ph = (i * 0.37) % 1;
    const base = -ph * T, t0 = base + T * Math.floor((t - base) / T);
    out.push(fly(A, B, t0, t0 + T, t, 0.55, 30));
  }
  return out;
};
/** how many of the 435 site dots are lit at t (shot 17) */
export const sitesK = (t: number) => clamp01((t - (W.fourh - 0.1)) / 2.3);

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "air" | "desk" | "map" | "road";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(2.7), light: "day", place: "map", sunAz: 60, sunEl: 50 }, // hook: planes over the map
  { id: 2, a: F(2.7), b: F(4.65), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // the floppy goes into the drive
  { id: 3, a: F(4.65), b: F(7.0), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // yes, those floppy disks
  { id: 4, a: F(7.0), b: F(9.85), light: "day", place: "air", sunAz: 70, sunEl: 45 }, // airliner cruising over clouds
  { id: 5, a: F(9.85), b: F(15.4), light: "indoor", place: "desk", sunAz: 30, sunEl: 40 }, // the control room, four 1980s systems
  { id: 6, a: F(15.4), b: F(18.35), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // a part breaks, the spare arrives
  { id: 7, a: F(18.35), b: F(22.65), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // paper strips
  { id: 8, a: F(22.65), b: F(26.35), light: "indoor", place: "desk" }, // screen: 1.44 MB
  { id: 9, a: F(26.35), b: F(28.85), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // smaller than a selfie
  { id: 10, a: F(28.85), b: F(31.15), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // luckily they work
  { id: 11, a: F(31.15), b: F(34.5), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // unluckily, the last disk
  { id: 12, a: F(34.5), b: F(37.85), light: "day", place: "air", sunAz: 60, sunEl: 40 }, // air traffic never stops
  { id: 13, a: F(37.85), b: F(43.75), light: "day", place: "road", sunAz: 120, sunEl: 40 }, // tyres changed on a moving car
  { id: 14, a: F(43.75), b: F(51.5), light: "indoor", place: "desk" }, // screen: the post with emojis
  { id: 15, a: F(51.5), b: F(52.4), light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // the floppy goes over the shoulder
  { id: 16, a: F(52.4), b: F(56.6), light: "indoor", place: "desk" }, // screen: the new one-screen system
  { id: 17, a: F(56.6), b: F(60.35), light: "day", place: "map", sunAz: 60, sunEl: 50 }, // 435 sites light up
  { id: 18, a: F(60.35), b: F(64.3), light: "indoor", place: "desk" }, // screen: the save icon
  { id: 19, a: F(64.3), b: F(66.4), light: "golden", place: "air", sunAz: 150, sunEl: 9 }, // the tower at sunset
  { id: 20, a: F(66.4), b: TOTAL, light: "indoor", place: "desk", sunAz: 40, sunEl: 40 }, // the actual save button
];
export const XFADE: Record<number, number> = { 4: 8, 19: 10 };
export const FLASH_AT = F(4.65);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
/** what the hero CRT shows */
export type Screen = "radar" | "cap" | "post" | "eids" | "save" | "off";
export const screenAt = (id: number, t: number): Screen =>
  id === 8 ? "cap" : id === 14 ? "post" : id === 16 ? "eids" : id === 18 ? "save" : id === 6 && at(t, W.breaks) ? "off" : "radar";
/** the floppy's slide into the drive: 0 out .. 1 in (shots 2 and 20) */
export const insertK = (id: number, t: number) => id === 2 ? smooth((t - 2.9) / 0.85) : id === 20 ? smooth((t - (W.save2 - 0.3)) / 0.5) : 0;
/** the three side terminals: lit? (they pop on one by one on "four") */
export const termOn = (id: number, t: number, i: number) => id !== 5 || at(t, W.four + 0.12 * i);

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
const Ar = (x: number, y: number, z: number) => at3(AIR, x, y, z);
const Dk = (x: number, y: number, z: number) => at3(DESK, x, y, z);
const Mp = (x: number, y: number, z: number) => at3(MAP, x, y, z);
const monN: V3 = [Math.sin(MON_YAW), 0, Math.cos(MON_YAW)];
const monCam = (d: number, dx = 0, dy = 0): V3 => [MON[0] + monN[0] * d + Math.cos(MON_YAW) * dx, MON[1] + dy, MON[2] + monN[2] * d - Math.sin(MON_YAW) * dx];
const monLook = (dx = 0, dy = 0): V3 => [MON[0] + Math.cos(MON_YAW) * dx, MON[1] + dy, MON[2] - Math.sin(MON_YAW) * dx];
/** floppy drive close-up: in front of and a little above the slot */
const drv = (d: number, dx = 0, dy = 0.12): V3 => [DRIVE[0] + dx, DRIVE[1] + dy, DRIVE[2] + d];
/** the truck-following camera on the highway (pos relative to the truck) */
const Tk = (t: (f: number) => number, dx: number, y: number, z: number): ((f: number) => V3) => (f) => [truckX(t(f)) + dx, y, z];
const tf = (f: number) => f / FPS;

const CAMS: Record<number, Key[]> = {
  1: [
    // high over the map, little airliners crossing with their trails; glide down and across
    { f: 0, s: (f) => dolly(Mp(-30, 95, 95), Mp(-6, 0, -8), pushK(f, 0, 0.002), { fov: 46, roll: 0.03 }) },
    { f: F(0.9), dur: 50, s: (f) => dolly(Mp(10, 48, 52), Mp(16, 4, -10), pushK(f, F(0.9), 0.002), { fov: 46, roll: -0.03 }) },
  ],
  2: [
    // the floppy drive: the disk slides into the slot ("floppy disks"), the light goes on
    { f: F(2.7), s: (f) => dolly(drv(0.62, -0.18, 0.2), [DRIVE[0], DRIVE[1] - 0.01, DRIVE[2] - 0.05], pushK(f, F(2.7), 0.003, 0.009, 25), { fov: 40, roll: 0.04 }) },
  ],
  3: [
    // the controller holds the disk up to us, deadpan
    { f: F(4.65), s: (f) => dolly(Dk(-0.55, 1.32, 1.1), Dk(-0.18, 1.15, -1.5), pushK(f, F(4.65), 0.0028), { fov: 42, roll: -0.03 }) },
    { f: F(5.3), dur: 22, s: (f) => dolly(Dk(-0.42, 1.3, 0.6), Dk(-0.18, 1.18, -1.5), pushK(f, F(5.3), 0.003, 0.007, 25), { fov: 42, roll: 0.02 }) }, // "those floppy disks"
  ],
  4: [
    // beside the airliner in the clouds
    { f: F(6.7), s: (f) => dolly(Ar(-40, 160, 62), Ar(-6, 150, -30), pushK(f, F(6.7), 0.0018), { fov: 46, roll: 0.04 }) },
    { f: F(8.0), dur: 50, s: (f) => dolly(Ar(30, 162, 58), Ar(14, 150, -30), pushK(f, F(8.0), 0.0018), { fov: 44, roll: -0.03 }) },
  ],
  5: [
    // the control room: along the console row, the four beige terminals pop on, in to the controller
    { f: F(9.85), s: (f) => dolly(Dk(-3.2, 1.9, 3.2), Dk(0.3, 0.95, -1.2), pushK(f, F(9.85), 0.0022), { fov: 52, roll: 0.03 }) },
    { f: F(11.2), dur: 40, s: (f) => dolly(Dk(0.6, 1.85, 3.3), Dk(0.6, 0.95, -1.3), pushK(f, F(11.2), 0.002, 0.005, 25), { fov: 58, roll: -0.03 }) }, // "four systems"
    { f: F(13.4), dur: 34, s: (f) => dolly(Dk(-0.9, 1.35, 1.25), Dk(-0.1, 1.05, -1.4), pushK(f, F(13.4), 0.0025), { fov: 46, roll: 0.02 }) }, // "still on duty"
  ],
  6: [
    // the left terminal coughs smoke; a parcel drops on the desk
    { f: F(15.4), s: (f) => dolly(Dk(-1.9, 1.4, 1.0), Dk(-1.1, 1.0, -1.2), pushK(f, F(15.4), 0.003, 0.008, 25), { fov: 44, roll: -0.03 }) },
    { f: F(16.9), dur: 24, s: (f) => dolly(Dk(-1.35, 1.45, 1.2), Dk(-0.75, 0.95, -1.0), pushK(f, F(16.9), 0.0025, 0.007, 25), { fov: 46, roll: 0.03 }) }, // "from eBay"
  ],
  7: [
    // paper strips handed across: one per flight
    { f: F(18.35), s: (f) => dolly(Dk(0.35, 1.6, 3.35), Dk(0.35, 1.15, -0.9), pushK(f, F(18.35), 0.0025), { fov: 56, roll: 0.03 }) },
    { f: F(20.0), dur: 40, s: (f) => dolly(Dk(0.35, 1.5, 3.1), Dk(0.35, 1.15, -0.9), pushK(f, F(20.0), 0.002, 0.005, 25), { fov: 56, roll: -0.02 }) }, // "paper strips"
  ],
  8: [
    { f: F(22.65), s: (f) => ({ ...dolly(monCam(0.55, 0, 0), monLook(0, 0), pushK(f, F(22.65), 0.0022)), fov: 40, roll: 0.02 }) },
    { f: F(25.0), dur: 22, s: (f) => ({ ...dolly(monCam(0.5, 0, -0.01), monLook(0, -0.01), pushK(f, F(25.0), 0.002, 0.006, 25)), fov: 40, roll: -0.02 }) }, // "megabytes"
  ],
  9: [
    // the controller with phone and floppy: the selfie doesn't fit
    { f: F(26.35), s: (f) => dolly(Dk(-0.32, 1.32, 1.25), Dk(-0.32, 1.18, -1.5), pushK(f, F(26.35), 0.003, 0.008, 25), { fov: 44, roll: 0.03 }) },
  ],
  10: [
    // pats the old terminal: still works
    { f: F(28.85), s: (f) => dolly(Dk(-0.15, 1.42, 1.7), Dk(0.08, 1.08, -1.3), pushK(f, F(28.85), 0.0025), { fov: 48, roll: -0.02 }) },
  ],
  11: [
    // the last disk in an empty box
    { f: F(31.15), s: (f) => dolly(Dk(-0.3, 1.32, 1.3), Dk(-0.2, 1.02, -1.4), pushK(f, F(31.15), 0.0025), { fov: 44, roll: 0.03 }) },
    { f: F(32.6), dur: 30, s: (f) => dolly(Dk(-0.28, 1.25, 0.9), Dk(-0.2, 1.02, -1.4), pushK(f, F(32.6), 0.002, 0.005, 25), { fov: 44, roll: -0.03 }) }, // "nobody makes"
  ],
  12: [
    // the airport: one plane takes off, one lands, more in the sky - it never stops
    { f: F(34.5), s: (f) => dolly(Ar(-40, 9, 20), aim(Ar(-40, 9, 20), Ar(10, 6, -50)), pushK(f, F(34.5), 0.0018), { fov: 52, roll: 0.03 }) },
    { f: F(35.9), dur: 50, s: (f) => dolly(Ar(-8, 12, 26), aim(Ar(-8, 12, 26), Ar(30, 12, -55)), pushK(f, F(35.9), 0.0015), { fov: 52, roll: -0.03 }) }, // "never stops"
  ],
  13: [
    // alongside the truck on the highway; the mechanics run with it and swap a tyre
    { f: F(37.85), s: (f) => { const p = Tk(tf, -1.0, 1.45, 8.6)(f); return dolly(p, [truckX(tf(f)) - 0.5, 1.15, TRUCK_Z + 0.4], pushK(f, F(37.85), 0.0015), { fov: 46, roll: 0.03 }); } },
    { f: F(38.9), dur: 20, s: (f) => { const p = Tk(tf, -1.5, 1.0, 4.4)(f); return dolly(p, [truckX(tf(f)) - 1.4, 0.75, TRUCK_Z + 0.9], pushK(f, F(39.0), 0.0015, 0.004, 25), { fov: 46, roll: -0.03 }); } }, // "the tyres"
    { f: F(41.9), dur: 30, s: (f) => { const p = Tk(tf, 0.6, 1.9, 7.6)(f); return dolly(p, [truckX(tf(f)) - 0.6, 1.3, TRUCK_Z], pushK(f, F(41.9), 0.0015, 0.004, 25), { fov: 48, roll: 0.03 }); } }, // "full of passengers"
  ],
  14: [
    { f: F(43.75), s: (f) => ({ ...dolly(monCam(0.57, 0, 0), monLook(0, 0), pushK(f, F(43.75), 0.0018)), fov: 40, roll: -0.02 }) },
    { f: F(49.4), dur: 14, s: (f) => ({ ...dolly(monCam(0.54, 0, 0), monLook(0, 0), pushK(f, F(49.4), 0.002, 0.008, 20)), fov: 40, roll: 0.03 }) }, // "out"
    { f: F(50.15), dur: 16, s: (f) => ({ ...dolly(monCam(0.54, 0, -0.01), monLook(0, -0.01), pushK(f, F(50.15), 0.002, 0.008, 20)), fov: 40, roll: -0.03 }) }, // "in"
  ],
  15: [
    { f: F(51.5), s: (f) => dolly(Dk(-0.9, 1.3, 1.2), Dk(-0.3, 1.25, -1.5), pushK(f, F(51.5), 0.003, 0.008, 25), { fov: 44, roll: 0.03 }) },
  ],
  16: [
    { f: F(52.4), s: (f) => ({ ...dolly(monCam(0.57, 0, 0), monLook(0, 0), pushK(f, F(52.4), 0.0022)), fov: 40, roll: 0.02 }) },
    { f: F(55.6), dur: 22, s: (f) => ({ ...dolly(monCam(0.52, 0, 0.01), monLook(0, 0.01), pushK(f, F(55.6), 0.002, 0.006, 25)), fov: 40, roll: -0.02 }) }, // "together"
  ],
  17: [
    // the map again: the 435 sites light up coast to coast
    { f: F(56.6), s: (f) => dolly(Mp(0, 70, 78), Mp(4, 0, -4), pushK(f, F(56.6), 0.0015), { fov: 48, roll: -0.02 }) },
    { f: F(57.6), dur: 60, s: (f) => dolly(Mp(-10, 110, 92), Mp(0, 0, -6), pushK(f, F(57.6), 0.0012), { fov: 50, roll: 0.02 }) },
  ],
  18: [
    { f: F(60.35), s: (f) => ({ ...dolly(monCam(0.56, 0, 0), monLook(0, 0), pushK(f, F(60.35), 0.0022)), fov: 40, roll: -0.02 }) },
    { f: F(62.7), dur: 22, s: (f) => ({ ...dolly(monCam(0.5, 0, 0), monLook(0, 0), pushK(f, F(62.7), 0.002, 0.007, 25)), fov: 40, roll: 0.02 }) }, // "save icon"
  ],
  19: [
    // the tower at sunset, an airliner rolling past and lifting off
    { f: F(63.9), s: (f) => dolly(Ar(-12, 8, -6), aim(Ar(-12, 8, -6), Ar(18, 26, -72)), pushK(f, F(63.9), 0.0018), { fov: 50, roll: 0.03 }) },
    { f: F(65.0), dur: 40, s: (f) => dolly(Ar(-18, 7, -8), aim(Ar(-18, 7, -8), Ar(16, 25, -72)), pushK(f, F(65.0), 0.0015), { fov: 50, roll: -0.02 }) },
  ],
  20: [
    // callback: the disk slides in - save - then the controller's quiet nod
    { f: F(66.4), s: (f) => dolly(drv(0.6, 0.16, 0.18), [DRIVE[0], DRIVE[1] - 0.01, DRIVE[2] - 0.05], pushK(f, F(66.4), 0.003, 0.009, 25), { fov: 40, roll: -0.04 }) },
    { f: F(67.95), cut: true, s: (f) => dolly(Dk(-0.85, 1.32, 1.15), Dk(-0.25, 1.12, -1.5), pushK(f, F(67.95), 0.0022), { fov: 42, roll: 0.02 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.disks, 0.8], [W.floppy2, 0.4], [W.four, 0.5], [W.breaks, 0.7], [W.ebay, 0.9], [W.mega, 0.5], [W.selfie, 0.9], [W.changing + 0.2, 0.6],
  [W.tyres + 0.3, 0.6], [W.out, 0.9], [W.twentyfirst, 0.7], [W.inn, 0.6], [W.together, 0.5], [W.save, 0.6], [W.button, 0.6],
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
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: F(2.7), cInf: 12, focus: () => DRIVE },
  { f: F(4.65), cInf: 12, focus: ytEyes },
  { f: F(7.0), cInf: 0 },
  { f: F(9.85), cInf: 5, focus: () => [DESK - 0.2, 1.0, -1.2] },
  { f: F(13.4), dur: 34, cInf: 10, focus: ytEyes },
  { f: F(15.4), cInf: 11, focus: () => [TERMS[0][0], 1.05, -1.1] },
  { f: F(16.9), dur: 24, cInf: 10, focus: () => [DESK - 0.7, 0.85, -0.95] },
  { f: F(18.35), cInf: 7, focus: () => [DESK + 0.5, 1.2, -0.9] },
  { f: F(22.65), cInf: 0 },
  { f: F(26.35), cInf: 13, focus: ytEyes },
  { f: F(28.85), cInf: 11, focus: ytEyes },
  { f: F(31.15), cInf: 13, focus: ytEyes },
  { f: F(34.5), cInf: 0 },
  { f: F(37.85), cInf: 6, focus: (f) => [truckX(f / FPS) - 0.5, 1.0, TRUCK_Z + 0.4] },
  { f: F(43.75), cInf: 0 },
  { f: F(51.5), cInf: 12, focus: ytEyes },
  { f: F(52.4), cInf: 0 },
  { f: F(64.3), cInf: 4, focus: () => [TOWER[0], 14, TOWER[2]] },
  { f: F(66.4), cInf: 12, focus: () => DRIVE },
  { f: F(67.95), cInf: 12, focus: ytEyes },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
