// "The Satellite That Wrote a Poem": timeline timed to ~/day/orbit/voice/words.json (ElevenLabs George, 68.3 s).
// Six places in one scene graph: SPACE at the origin (satellite at 0,0,0 over a 300 m cartoon Earth), the launch PAD
// (x + 1000), the radiation LAB (x - 1000), the CLEAN room (x - 1050), mission CONTROL (x - 1100), the Arctic ground
// STATION (x + 1400) and the PARK of the phone analogy (x + 1800). Camera grammar from the bridge short: smootherstep
// glides 18-40 f, hard cuts on big jumps, every hold creeps in, impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 2070;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const PAD = 1000, LAB = -1000, CLEAN = -1050, CTRL = -1100, STA = 1400, PARK = 1800;
export const EARTH_R = 120, EARTH_Y = -128;

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  google: 0.38, supercomputer: 1.62, space: 2.68, its: 3.35, answer: 4.16, poem: 5.31,
  october: 6.48, rocket: 8.13, lifts: 9.99, one: 10.87, four: 11.58, chips: 12.95, tiny: 13.84, orbit: 15.28,
  before: 16.08, blasted: 17.24, proton: 18.54, glitching: 20.25, three: 21.12, five: 22.84,
  weeks: 23.96, wake: 26.01, engineers: 26.92, message: 27.95, write: 28.83, haiku: 29.17, orbiting: 30.71,
  then: 32.01, around: 33.39, norway: 34.23, answers: 35.48,
  blue: 38.04, data: 39.46, silent: 40.36, starlight: 41.68, core: 42.84,
  luckily: 44.12, worked: 44.83, unluckily: 45.9, oneChip: 47.35, time: 48.11, twenty: 49.25, minutes: 49.58,
  why: 50.48, earth: 51.5, solar: 52.22, phone: 53.34, unplugged: 54.15, night: 55.02,
  rightOrbit: 55.75, sun: 56.96, never: 57.62, next: 59.06, two: 60.82, talking: 61.91, laser: 62.45,
  and: 63.36, poets: 63.93, assignment: 64.72, laugh: 65.3, limericks: 66.48,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- satellite state (pure function of film time) ----------------
export type SatFace = "happy" | "dots" | "closed" | "star" | "curious" | "worried" | "dazed" | "sleepy" | "proud" | "think";
export type SatState = { face: SatFace; wings: number; chips: number; beret: boolean; shades: boolean; scroll: number; zz: number };
export const satState = (t: number): SatState => {
  const s: SatState = { face: "happy", wings: 1, chips: 4, beret: false, shades: false, scroll: 0, zz: 0 };
  if (t < 6.3) { s.face = at(t, W.poem) ? "proud" : at(t, W.answer) ? "think" : "dots"; s.scroll = smooth((t - (W.poem - 0.1)) / 0.45); }
  else if (t < 14.55) { s.wings = 0; s.face = "closed"; s.chips = t < 11.5 ? 0 : Math.min(4, 1 + Math.floor((t - (W.four - LEADS)) / 0.18)); }
  else if (t < 16.1) { s.wings = smooth((t - (W.orbit - 0.25)) / 0.5); s.face = at(t, W.orbit) ? "star" : "dots"; }
  else if (t < 27) { s.face = at(t, W.wake) ? "star" : "closed"; s.chips = at(t, W.wake) ? 4 : 0; s.zz = at(t, W.wake) ? 0 : 1; }
  else if (t < 37.9) { s.face = t < 30.2 ? "curious" : "think"; }
  else if (t < 45.8) { s.face = at(t, W.starlight) ? "closed" : "happy"; }
  else if (t < 50.4) { s.chips = at(t, W.oneChip) ? 1 : 4; s.face = at(t, W.twenty) ? "sleepy" : at(t, W.oneChip) ? "worried" : "happy"; s.zz = at(t, W.minutes + 0.3) ? 1 : 0; }
  else if (t < 58.9) { s.shades = true; s.face = "happy"; }
  else if (t < 63.2) { s.face = at(t, W.talking) ? "happy" : "dots"; }
  else { s.beret = at(t, W.poets); s.face = at(t, W.limericks) ? "dazed" : at(t, W.assignment) ? "worried" : "proud"; }
  return s;
};
/** where the hero satellite floats in SPACE: a slow bob */
export const satPos = (t: number): V3 => [0, 0.06 * Math.sin(t * 1.1), 0];
export const SAT2: V3 = [-2.3, 0.3, -1.0]; // its future twin (laser shot)
export const SAT_S = 1.15; // card scale

// ---------------- rocket ----------------
export const ROCKET: V3 = [PAD, 0, -70];
export const rocketY = (t: number) => { const d = Math.max(0, t - W.lifts); return 1.6 * d * d + 0.6 * d; };

// ---------------- radiation lab ----------------
export const CHIP_AT: V3 = [LAB + 0.0, 0.95, -1.0];
export const beamOn = (t: number) => t >= W.blasted - LEADS && t < 23.85;

// ---------------- control-room wall screen: the orbit dot goes round ----------------
export const orbitAng = (t: number) => -1.2 + (t - 26.5) * 0.55;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "space" | "pad" | "lab" | "clean" | "ctrl" | "sta" | "park";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(3.3), light: "space", place: "space", sunAz: 130, sunEl: 25 }, // hook
  { id: 2, a: F(3.3), b: F(6.3), light: "space", place: "space", sunAz: 120, sunEl: 30 }, // "first answer... a poem"
  { id: 3, a: F(6.3), b: F(10.8), light: "day", place: "pad", sunAz: 110, sunEl: 35 }, // launch
  { id: 4, a: F(10.8), b: F(14.55), light: "indoor", place: "clean" }, // four chips
  { id: 5, a: F(14.55), b: F(16.05), light: "space", place: "space", sunAz: 125, sunEl: 28 }, // wings open "in orbit"
  { id: 6, a: F(16.05), b: F(19.4), light: "indoor", place: "lab" }, // proton beam
  { id: 7, a: F(19.4), b: F(23.85), light: "indoor", place: "lab" }, // glitching at 3x
  { id: 8, a: F(23.85), b: F(26.85), light: "space", place: "space", sunAz: 140, sunEl: 20 }, // wakes up
  { id: 9, a: F(26.85), b: F(29.0), light: "indoor", place: "ctrl" }, // one message
  { id: 10, a: F(29.0), b: F(31.95), light: "space", place: "space", sunAz: 120, sunEl: 25 }, // the message arrives
  { id: 11, a: F(31.95), b: F(34.15), light: "indoor", place: "ctrl" }, // waiting
  { id: 12, a: F(34.15), b: F(36.55), light: "night", place: "sta", sunAz: 120, sunEl: 35 }, // over Norway: it answers
  { id: 13, a: F(36.55), b: F(37.9), light: "indoor", place: "ctrl" }, // engineers lean in
  { id: 14, a: F(37.9), b: F(43.9), light: "space", place: "space", sunAz: 22, sunEl: -6 }, // the haiku, sunrise
  { id: 15, a: F(43.9), b: F(45.75), light: "indoor", place: "ctrl" }, // luckily
  { id: 16, a: F(45.75), b: F(50.35), light: "space", place: "space", sunAz: 120, sunEl: 30 }, // unluckily
  { id: 17, a: F(50.35), b: F(54.05), light: "golden", place: "park", sunAz: 20, sunEl: 6 }, // phone charging at sunset
  { id: 18, a: F(54.05), b: F(55.6), light: "night", place: "park", sunAz: 150, sunEl: 40 }, // unplugged
  { id: 19, a: F(55.6), b: F(58.9), light: "space", place: "space", sunAz: 60, sunEl: 15 }, // the sun never sets
  { id: 20, a: F(58.9), b: F(63.2), light: "space", place: "space", sunAz: 110, sunEl: 30 }, // two satellites, laser
  { id: 21, a: F(63.2), b: TOTAL, light: "space", place: "space", sunAz: 125, sunEl: 25 }, // the poet's next job
];
export const XFADE: Record<number, number> = { 18: 6 };
export const FLASH_AT = F(6.3);
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
const Pd = (x: number, y: number, z: number) => at3(PAD, x, y, z);
const Lb = (x: number, y: number, z: number) => at3(LAB, x, y, z);
const Cl = (x: number, y: number, z: number) => at3(CLEAN, x, y, z);
const Ct = (x: number, y: number, z: number) => at3(CTRL, x, y, z);
const St = (x: number, y: number, z: number) => at3(STA, x, y, z);
const Pk = (x: number, y: number, z: number) => at3(PARK, x, y, z);
/** satellite centre height (card origin is at its feet) */
export const SAT_C = 0.0;

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: (f) => dolly([5.5, 2.4, 13], [0, -1.6, 0], pushK(f, 0, 0.003), { fov: 44, roll: -0.03 }) }, // wide: satellite over the curve of the Earth
    { f: F(1.55), dur: 34, s: (f) => dolly([2.2, 0.9, 5.2], [0, -0.2, 0], pushK(f, F(1.55), 0.0025), { fov: 40, roll: 0.03 }) }, // "supercomputer"
  ],
  2: [
    { f: F(3.3), s: (f) => dolly([0.9, 0.35, 3.3], [0, 0.0, 0], pushK(f, F(3.3), 0.0025), { fov: 38 }) },
    { f: F(5.2), dur: 20, s: (f) => dolly([0.7, 0.2, 2.8], [0.05, -0.12, 0], pushK(f, F(5.2), 0.002, 0.006, 30), { fov: 38, roll: -0.04 }) }, // "poem"
  ],
  3: [
    { f: F(6.3), s: (f) => dolly(Pd(-26, 4, 40), Pd(0, 16, -70), pushK(f, F(6.3), 0.0018), { fov: 46, roll: 0.02 }) }, // rocket on the pad
    { f: F(8.05), cut: true, s: (f) => dolly(Pd(9, 1.6, -38), Pd(0, 12, -70), pushK(f, F(8.05), 0.002), { fov: 50, roll: -0.04 }) }, // low angle
    { f: F(9.95), dur: 30, s: (f) => { const y = rocketY(f / FPS); return dolly(Pd(9, 1.6, -38), Pd(0, 14 + y * 0.85, -70), 1, { fov: 52, roll: -0.04 }); } }, // lifts off: tilt up
  ],
  4: [
    { f: F(10.8), s: (f) => dolly(Cl(1.3, 1.55, 4.2), Cl(-0.3, 1.2, 0), pushK(f, F(10.8), 0.0025), { fov: 40 }) },
    { f: F(11.5), dur: 26, s: (f) => dolly(Cl(0.3, 1.5, 2.9), Cl(-0.15, 1.25, 0), pushK(f, F(11.5), 0.002, 0.005, 30), { fov: 38, roll: 0.03 }) }, // "four chips"
    { f: F(13.75), dur: 22, s: (f) => dolly(Cl(1.0, 1.5, 3.4), Cl(-0.25, 1.25, 0), pushK(f, F(13.75), 0.002), { fov: 40, roll: -0.02 }) }, // "a tiny data center"
  ],
  5: [
    { f: F(14.55), s: (f) => dolly([-2.2, 0.8, 4.4], [0, -0.3, 0], pushK(f, F(14.55), 0.004, 0.007, 30), { fov: 42, roll: -0.04 }) },
  ],
  6: [
    { f: F(16.05), s: (f) => dolly(Lb(1.8, 1.7, 3.2), Lb(-1.0, 1.0, -1.0), pushK(f, F(16.05), 0.0025), { fov: 44 }) },
    { f: F(17.15), dur: 22, s: (f) => dolly(Lb(1.3, 1.45, 2.3), Lb(-0.6, 0.98, -1.0), pushK(f, F(17.15), 0.002, 0.006, 30), { fov: 42, roll: 0.04 }) }, // "blasted"
  ],
  7: [
    { f: F(19.4), s: (f) => dolly(Lb(0.45, 1.05, 0.25), Lb(0, 0.98, -1.0), pushK(f, F(19.4), 0.0025, 0.006, 30), { fov: 38 }) }, // chip CU
    { f: F(21.0), cut: true, s: (f) => dolly(Lb(0.9, 1.6, 1.6), Lb(1.5, 1.35, -2.4), pushK(f, F(21.0), 0.0025), { fov: 40, roll: -0.03 }) }, // scientist: "three times"
    { f: F(22.7), dur: 26, s: (f) => dolly(Lb(1.3, 1.5, 2.6), Lb(0.6, 1.1, -1.6), pushK(f, F(22.7), 0.002), { fov: 42 }) }, // "five years"
  ],
  8: [
    { f: F(23.85), s: (f) => dolly([1.6, 0.3, 4.2], [0, -0.05, 0], pushK(f, F(23.85), 0.0025), { fov: 40, roll: 0.03 }) },
    { f: F(25.9), dur: 18, s: (f) => dolly([1.0, 0.15, 2.9], [0, 0.0, 0], pushK(f, F(25.9), 0.002, 0.007, 25), { fov: 38, roll: -0.03 }) }, // "wake up"
  ],
  9: [
    { f: F(26.85), s: (f) => dolly(Ct(-1.2, 1.6, 3.6), Ct(0.2, 1.2, -1.2), pushK(f, F(26.85), 0.0025), { fov: 44 }) },
    { f: F(27.85), dur: 24, s: (f) => dolly(Ct(-0.4, 1.3, 1.5), Ct(-0.7, 1.15, -1.25), pushK(f, F(27.85), 0.002, 0.005, 30), { fov: 40, roll: 0.03 }) }, // "message"
  ],
  10: [
    { f: F(29.0), s: (f) => dolly([3.6, -1.4, 6.5], [0, -0.6, 0], pushK(f, F(29.0), 0.0025), { fov: 46, roll: -0.03 }) }, // rings rise from the Earth
    { f: F(30.6), dur: 30, s: (f) => dolly([1.3, 0.1, 3.4], [0, -0.05, 0], pushK(f, F(30.6), 0.002), { fov: 40 }) },
  ],
  11: [
    { f: F(31.95), s: (f) => dolly(Ct(0.4, 1.5, 4.2), Ct(0, 1.4, -2), pushK(f, F(31.95), 0.0022), { fov: 44, roll: -0.02 }) },
    { f: F(33.2), dur: 26, s: (f) => dolly(Ct(0.3, 1.6, 2.8), Ct(0, 1.75, -3.9), pushK(f, F(33.2), 0.002), { fov: 40 }) }, // the dot comes round
  ],
  12: [
    { f: F(34.15), s: (f) => dolly(St(-20, 2.0, 28), St(-2, 11, -30), pushK(f, F(34.15), 0.0018), { fov: 50, roll: 0.03 }) }, // Arctic station at dusk
    { f: F(35.4), dur: 24, s: (f) => dolly(St(-14, 1.7, 14), St(-1, 8, -16), pushK(f, F(35.4), 0.002, 0.005, 30), { fov: 50, roll: -0.03 }) }, // "it answers"
  ],
  13: [
    { f: F(36.55), s: (f) => dolly(Ct(0.1, 1.25, 1.9), Ct(0, 1.15, -1.25), pushK(f, F(36.55), 0.004), { fov: 40 }) },
  ],
  14: [
    { f: F(37.9), s: (f) => dolly([-3.2, 0.6, 7.5], [0, -0.9, -4], pushK(f, F(37.9), 0.0015), { fov: 46, roll: 0.03 }) }, // "blue marble below"
    { f: F(39.4), dur: 40, s: (f) => dolly([-1.8, 0.2, 4.6], [0, -0.4, -2], pushK(f, F(39.4), 0.0015), { fov: 44, roll: 0.0 }) }, // "data streams"
    { f: F(41.6), dur: 36, s: (f) => dolly([-0.4, -0.5, 3.4], [0, 0.0, 0], pushK(f, F(41.6), 0.0018), { fov: 42, roll: -0.03 }) }, // "starlight feeds my core"
  ],
  15: [
    { f: F(43.9), s: (f) => dolly(Ct(0.0, 1.35, 3.4), Ct(0, 1.15, -1.2), pushK(f, F(43.9), 0.003, 0.006, 25), { fov: 44, roll: 0.03 }) },
  ],
  16: [
    { f: F(45.75), s: (f) => dolly([0.8, 0.3, 3.2], [0, -0.05, 0], pushK(f, F(45.75), 0.0025), { fov: 38 }) },
    { f: F(47.25), dur: 20, s: (f) => dolly([0.35, -0.15, 2.6], [0, -0.15, 0], pushK(f, F(47.25), 0.002, 0.006, 30), { fov: 38, roll: 0.04 }) }, // "one chip"
    { f: F(49.15), dur: 30, s: (f) => dolly([0.9, 0.3, 3.4], [0, 0.0, 0], pushK(f, F(49.15), 0.002), { fov: 40, roll: -0.03 }) }, // "twenty minutes"
  ],
  17: [
    { f: F(50.35), s: (f) => dolly(Pk(2.6, 1.4, 5.2), Pk(0.4, 1.0, 0), pushK(f, F(50.35), 0.0022), { fov: 44, roll: 0.02 }) },
    { f: F(53.2), dur: 24, s: (f) => dolly(Pk(1.0, 1.25, 2.6), Pk(0.35, 1.05, 0), pushK(f, F(53.2), 0.002, 0.005, 30), { fov: 40, roll: -0.03 }) }, // "phone"
  ],
  18: [
    { f: F(54.05), s: (f) => dolly(Pk(1.0, 1.25, 2.6), Pk(0.35, 1.05, 0), pushK(f, F(53.2), 0.002) * pushK(f, F(54.05), 0.003, 0.007, 25), { fov: 40, roll: -0.03 }) },
  ],
  19: [
    { f: F(55.6), s: (f) => dolly([-2.0, 0.4, 4.2], [0, -0.2, 0], pushK(f, F(55.6), 0.0025), { fov: 42, roll: 0.03 }) },
    { f: F(56.85), dur: 30, s: (f) => dolly([-1.0, 0.2, 2.8], [0, 0.0, 0], pushK(f, F(56.85), 0.002), { fov: 40 }) }, // "the sun"
  ],
  20: [
    { f: F(58.9), s: (f) => dolly([-1.15, 1.3, 12.8], [-1.15, -0.1, -0.5], pushK(f, F(58.9), 0.0022), { fov: 44, roll: -0.02 }) },
    { f: F(62.3), dur: 18, s: (f) => dolly([-1.15, 1.0, 11.0], [-1.15, 0.0, -0.5], pushK(f, F(62.3), 0.002, 0.006, 25), { fov: 44, roll: 0.03 }) }, // "laser"
  ],
  21: [
    { f: F(63.2), s: (f) => dolly([0.9, 0.4, 3.4], [0, 0.05, 0], pushK(f, F(63.2), 0.0025), { fov: 38 }) },
    { f: F(66.35), dur: 16, s: (f) => dolly([0.4, 0.25, 2.8], [0, 0.1, 0], pushK(f, F(66.35), 0.002, 0.007, 25), { fov: 38, roll: -0.04 }) }, // "Limericks"
    { f: F(67.6), dur: 40, s: (f) => dolly([2.2, 1.2, 6.5], [0, -0.6, 0], pushK(f, F(67.6), 0.001), { fov: 44, roll: 0.02 }) }, // pull out
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.poem, 0.6], [W.lifts, 1.4], [W.orbit, 0.6], [W.blasted, 1.1], [W.glitching, 0.8], [W.wake, 0.6],
  [W.answers, 0.7], [W.oneChip, 0.5], [W.unplugged, 1.0], [W.laser, 0.7], [W.limericks, 0.9],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  // the launch rumble: a long, small shake while the rocket climbs
  const d = t - W.lifts;
  if (d > 0 && d < 0.8) a += 0.35 * (Math.floor(t * FPS) % 2 ? -1 : 1) * (1 - d / 0.8);
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c0 = run(CAMS[id], f), a = kickAt(f / FPS);
  // space shots tip down ~5 deg so the Earth's limb sits in the lower frame under the satellite
  const c = SHOTS[id - 1].place === "space" ? { ...c0, look: [c0.look[0], c0.look[1] - 0.09 * Math.hypot(c0.look[0] - c0.pos[0], c0.look[1] - c0.pos[1], c0.look[2] - c0.pos[2]), c0.look[2]] as V3 } : c0;
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const satEyes = (): V3 => [0, 0.05, 0];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: F(1.55), dur: 30, cInf: 8, focus: satEyes },
  { f: F(3.3), cInf: 12, focus: satEyes },
  { f: F(6.3), cInf: 0 }, // pad wide
  { f: F(10.8), cInf: 11 }, // clean room
  { f: F(14.55), cInf: 6, focus: satEyes },
  { f: F(16.05), cInf: 7 },
  { f: F(19.4), cInf: 15 }, // chip macro
  { f: F(21.0), cInf: 12 },
  { f: F(23.85), cInf: 11, focus: satEyes },
  { f: F(26.85), cInf: 9 },
  { f: F(29.0), cInf: 4, focus: satEyes },
  { f: F(31.95), cInf: 8 },
  { f: F(34.15), cInf: 0 }, // station wide
  { f: F(36.55), cInf: 13 },
  { f: F(37.9), cInf: 0 }, // haiku wide
  { f: F(41.6), dur: 36, cInf: 7, focus: satEyes },
  { f: F(43.9), cInf: 11 },
  { f: F(45.75), cInf: 12, focus: satEyes },
  { f: F(50.35), cInf: 6 },
  { f: F(53.2), dur: 24, cInf: 12 },
  { f: F(55.6), cInf: 9, focus: satEyes },
  { f: F(58.9), cInf: 4 },
  { f: F(63.2), cInf: 12, focus: satEyes },
  { f: F(67.6), dur: 40, cInf: 4, focus: satEyes },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
