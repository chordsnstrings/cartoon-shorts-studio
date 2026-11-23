// "The Probe That Braked Too Soon" (BepiColombo reaches Mercury orbit, 21 Nov 2026; the braking burn was cut short by a
// software issue): timeline timed to ~/day/mercury/voice/words.json (ElevenLabs George, 32.4 s).
// Places in one scene graph: SPACE at the origin (the probe at 0,0,0 over a 240 m cartoon Mercury, the Sun far off),
// the FLYBY diagram (x + 3000: Earth, Venus, Mercury stacked vertically, the probe's slingshot trail) and mission
// CONTROL (x - 1100: three engineers at a desk under a big wall screen). Camera grammar from the bridge short:
// smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in, impact kicks flip sign and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1000;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const CTRL = -1100, FLY = 3000;
/** Mercury (cartoon scale): radius 120, centre below the probe */
export const MERC_R = 120, MERC_Y = -124;
export const MERC_C: V3 = [0, MERC_Y, 0];

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  it: 0.39, eight: 0.78, years: 1.11, reach: 1.56, mercury: 1.84, then: 2.81, brakes: 3.12, cut: 3.52, out: 3.74, early: 3.94,
  outThere: 4.69, sun: 5.22, pulling: 5.81, faster: 6.32, so: 7.18, brake: 7.5, whole: 7.89, way: 8.19,
  nine: 8.87, flybys: 9.29, more: 10.18, energy: 10.56, flying: 11.19, pluto: 11.64,
  saturday: 12.95, final: 13.51, braking: 13.9, burn: 14.33, thenB: 14.81, engines: 15.83, stopped: 16.37, too: 16.65, soon: 17.35,
  a: 18.12, software: 18.19, issue: 18.69,
  luckily: 20.1, mercuryB: 20.47, caught: 21.26, only: 21.87, second: 22.42, spacecraft: 22.83, orbit: 23.95, there: 24.33,
  unluckily: 25.01, parked: 26.12, higher: 26.43, planned: 26.87,
  would: 27.79, trust: 27.95, softwareB: 28.45, send: 29.17, friend: 30.06, always: 30.77, brakesB: 31.1, late: 31.68,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- the probe (a drawn character card: gold-foil body, screen face, solar wings, one big engine) ----------------
export type SatFace = "happy" | "dots" | "closed" | "star" | "curious" | "worried" | "dazed" | "sleepy" | "proud" | "think";
/** engine flame size 0 (off) .. 1; sputter = flickering on/off with puffs */
export const flameAt = (id: number, t: number): { k: number; sputter: boolean } => {
  if (id === 1) return { k: (Math.floor(t * 11) + 1) % 3 === 0 ? 0.2 : 0.95 - 0.2 * Math.sin(t * 9), sputter: true }; // hook: coughing engine
  if (id === 3) return { k: at(t, W.so) ? 1 : 0.55, sputter: false }; // braking all the way in
  if (id === 7) { // the burn cuts out: flame shrinks to nothing on "stopped"
    const d = t - (W.stopped - LEADS);
    if (d < 0) return { k: 0.9, sputter: false };
    return { k: Math.max(0, 0.9 - d * 4.5) * (Math.floor(t * 20) % 2 ? 1 : 0.6), sputter: d < 0.35 };
  }
  return { k: 0, sputter: false };
};
export const faceAt = (id: number, t: number): SatFace => {
  if (id === 1) return "worried";
  if (id === 3) return at(t, W.so) ? "think" : at(t, W.faster) ? "worried" : "curious";
  if (id === 4) return "happy";
  if (id === 5) return at(t, W.pluto) ? "star" : at(t, W.energy) ? "proud" : "happy";
  if (id === 7) return at(t, W.too) ? "dazed" : at(t, W.stopped) ? "worried" : "think";
  if (id === 9) return at(t, W.caught) ? "star" : at(t, W.mercuryB) ? "happy" : "worried";
  if (id === 11) return at(t, W.higher) ? "curious" : "think";
  if (id === 13) return at(t, W.late) ? "star" : "happy";
  return "happy";
};
export const SAT_S = 1.15; // card scale in close-ups

// ---------------- Mercury orbits (polar: the ring plane contains the y axis, opened 30 deg toward the lens) ----------------
export const RING_A = 0.52; // ring plane angle (rad)
export const R_PLAN = 146, R_REAL = 176; // the planned orbit and the (higher) real one
export const ringPt = (th: number, r: number): V3 => {
  const sa = Math.sin(RING_A), ca = Math.cos(RING_A);
  return [MERC_C[0] - sa * r * Math.sin(th), MERC_C[1] + r * Math.cos(th), MERC_C[2] + ca * r * Math.sin(th)];
};
/** the probe's angle along the real orbit (shots 9, 11, 13) */
export const orbitTh = (id: number, t: number) => {
  if (id === 9) return -0.45 + (t - 19.95) * 0.95; // comes in over the top-right and swings round the front
  if (id === 11) return 1.15 + (t - 24.9) * 0.18;
  if (id === 13) return 0.3 + (t - 29.1) * 0.32;
  return 0;
};
export const ORBIT_S = 22; // probe card scale in the orbit wides (cartoon scale)

// ---------------- the flyby diagram (x + 3000): Earth, Venus, Mercury stacked top to bottom ----------------
export const P_EARTH: V3 = [FLY - 2, 22, 0], P_VENUS: V3 = [FLY + 4, 1, 0], P_MERC: V3 = [FLY - 3, -21, 0];
export const R_EARTH = 6.5, R_VENUS = 6.0, R_MERCS = 4.2;
/** the slingshot path, s 0..1: in from the top right, hairpin round Earth, round Venus twice, then six tight loops at Mercury */
export const flyPt = (s: number): V3 => {
  const u = clamp01(s);
  const loop = (c: V3, r: number, a0: number, turns: number, k: number, shrink = 0): V3 => {
    const a = a0 + turns * Math.PI * 2 * k, rr = r * (1 - shrink * k);
    return [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a), c[2] + 2 * Math.sin(a)];
  };
  const lerp = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const E0: V3 = [FLY + 16, 34, 0];
  if (u < 0.08) return lerp(E0, loop(P_EARTH, 11, 0.6, 0.85, 0), u / 0.08);
  if (u < 0.22) return loop(P_EARTH, 11, 0.6, 0.85, (u - 0.08) / 0.14);
  const eEnd = loop(P_EARTH, 11, 0.6, 0.85, 1), vStart = loop(P_VENUS, 10, 1.2, 2, 0);
  if (u < 0.3) return lerp(eEnd, vStart, (u - 0.22) / 0.08);
  if (u < 0.52) return loop(P_VENUS, 10, 1.2, 2, (u - 0.3) / 0.22);
  const vEnd = loop(P_VENUS, 10, 1.2, 2, 1), mStart = loop(P_MERC, 9, 1.0, 6, 0);
  if (u < 0.6) return lerp(vEnd, mStart, (u - 0.52) / 0.08);
  return loop(P_MERC, 9, 1.0, 6, (u - 0.6) / 0.4, 0.45);
};
export const flyS = (t: number) => clamp01((t - 8.72) / 1.38);
/** flyby counter pips: when each of the nine pops (1 Earth, 2 Venus, 6 Mercury) */
export const PIP_T = (() => {
  const t0 = 8.72, L = 1.38, out: number[] = [t0 + L * 0.2];
  for (let i = 1; i <= 2; i++) out.push(t0 + L * (0.3 + 0.22 * i / 2));
  for (let i = 1; i <= 6; i++) out.push(t0 + L * (0.6 + 0.4 * i / 6));
  return out;
})();

// ---------------- mission control ----------------
export const SEATS = [-1.05, 0, 1.05];
export const LAPTOP_AT: V3 = [CTRL + 0.55, 0, 0.55]; // the engineer with the laptop stands in front of the desk
/** the wall screen state */
export type Screen = "burn" | "orbit";
export const screenAt = (id: number): Screen => (id === 10 ? "orbit" : "burn");

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "space" | "fly" | "ctrl";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(2.75), light: "space", place: "space", sunAz: 125, sunEl: 25 }, // hook: the engine coughs over Mercury
  { id: 2, a: F(2.75), b: F(4.47), light: "indoor", place: "ctrl" }, // "then its brakes cut out early!" - mission control
  { id: 3, a: F(4.47), b: F(8.7), light: "space", place: "space", sunAz: 0, sunEl: -32 }, // the Sun pulls you faster; brake the whole way
  { id: 4, a: F(8.7), b: F(10.15), light: "space", place: "fly", sunAz: 110, sunEl: 30 }, // nine flybys
  { id: 5, a: F(10.15), b: F(12.8), light: "space", place: "space", sunAz: 120, sunEl: 28 }, // more energy than Pluto
  { id: 6, a: F(12.8), b: F(16.2), light: "indoor", place: "ctrl" }, // Saturday: the final braking burn... engines stopped
  { id: 7, a: F(16.2), b: F(17.95), light: "space", place: "space", sunAz: 130, sunEl: 25 }, // too soon
  { id: 8, a: F(17.95), b: F(19.95), light: "indoor", place: "ctrl" }, // a software issue (the bug)
  { id: 9, a: F(19.95), b: F(21.8), light: "space", place: "space", sunAz: 120, sunEl: 25 }, // Mercury still caught it
  { id: 10, a: F(21.8), b: F(24.9), light: "indoor", place: "ctrl" }, // only the second spacecraft ever
  { id: 11, a: F(24.9), b: F(27.6), light: "space", place: "space", sunAz: 120, sunEl: 25 }, // parked higher than planned
  { id: 12, a: F(27.6), b: F(29.1), light: "indoor", place: "ctrl" }, // would you trust that software?
  { id: 13, a: F(29.1), b: TOTAL, light: "space", place: "space", sunAz: 125, sunEl: 25 }, // send this...
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.47);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** probe card placement for shot id at time t: centre + scale (null = not in this shot) */
export const probeAt = (id: number, t: number): { c: V3; s: number; tilt: number } | null => {
  const bob = 0.06 * Math.sin(t * 1.1);
  if (id === 1 || id === 5 || id === 7) return { c: [0, bob, 0], s: SAT_S, tilt: id === 1 ? 4 * Math.sin(t * 13) * (flameAt(1, t).k < 0.3 ? 1 : 0.3) : 3 * Math.sin(t * 0.7) };
  if (id === 3) { const u = t - 4.47; return { c: [0, -0.35 * u, 0], s: SAT_S, tilt: 2 * Math.sin(t * 9) }; } // falling toward the Sun (below)
  if (id === 4) { const p = flyPt(flyS(t)); return { c: p, s: 3.2, tilt: 0 }; }
  if (id === 9 || id === 11 || id === 13) { const p = ringPt(orbitTh(id, t), R_REAL); return { c: p, s: ORBIT_S, tilt: 4 * Math.sin(t * 0.9) }; }
  return null;
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
const Ct = (x: number, y: number, z: number): V3 => [CTRL + x, y, z];
const Fl = (x: number, y: number, z: number): V3 => [FLY + x, y, z];
const add = (a: V3, x: number, y: number, z: number): V3 => [a[0] + x, a[1] + y, a[2] + z];
const LA = LAPTOP_AT;

const CAMS: Record<number, Key[]> = {
  1: [ // close on the probe, its engine coughing; then wider so Mercury's limb fills the lower frame
    { f: 0, s: (f) => dolly([1.5, 0.3, 4.0], [0, 0.05, 0], pushK(f, 0, 0.003), { fov: 40, roll: -0.03 }) },
    { f: F(1.75), dur: 30, s: (f) => dolly([3.2, 1.3, 8.2], [0, -0.9, 0], pushK(f, F(1.75), 0.0025), { fov: 42, roll: 0.03 }) }, // "Mercury"
  ],
  2: [ // mission control: three engineers under the wall screen (the probe's flame on it)
    { f: F(2.75), s: (f) => dolly(Ct(0.2, 1.75, 3.95), Ct(0, 1.85, -3.9), pushK(f, F(2.75), 0.0025, 0.006, 25), { fov: 54, roll: 0.02 }) },
  ],
  3: [ // looking down past the probe at the giant Sun below: it falls toward it, braking all the way
    { f: F(4.47), s: (f) => { const p = probeAt(3, f / FPS)!.c; return dolly(add(p, 1.4, 1.6, 4.4), add(p, 0, -0.9, 0), pushK(f, F(4.47), 0.002), { fov: 46, roll: 0.04 }); } },
    { f: F(7.1), dur: 22, s: (f) => { const p = probeAt(3, f / FPS)!.c; return dolly(add(p, 0.9, 1.1, 3.3), add(p, 0, -0.6, 0), pushK(f, F(7.1), 0.002, 0.006, 25), { fov: 44, roll: -0.03 }); } }, // "so you brake"
  ],
  4: [ // the flyby diagram, whole
    { f: F(8.7), s: (f) => dolly(Fl(4, 2, 92), Fl(2, 1, 0), pushK(f, F(8.7), 0.0018), { fov: 44, roll: 0.02 }) },
  ],
  5: [ // CU: the probe beside two energy bars
    { f: F(10.15), s: (f) => dolly([0.7, 0.35, 5.4], [0.6, -0.05, 0], pushK(f, F(10.15), 0.0025), { fov: 40, roll: -0.02 }) },
    { f: F(11.5), dur: 20, s: (f) => dolly([0.65, 0.3, 4.9], [0.6, 0.0, 0], pushK(f, F(11.5), 0.002, 0.006, 25), { fov: 40, roll: 0.03 }) }, // "Pluto"
  ],
  6: [ // the room watches the burn on the wall screen... then the flame vanishes
    { f: F(12.8), s: (f) => dolly(Ct(-0.5, 1.75, 3.95), Ct(0.1, 1.85, -3.9), pushK(f, F(12.8), 0.0022), { fov: 54, roll: -0.02 }) },
    { f: F(14.7), dur: 30, s: (f) => dolly(Ct(0.1, 1.55, 3.0), Ct(0, 1.75, -3.9), pushK(f, F(14.7), 0.0022, 0.006, 25), { fov: 44, roll: 0.03 }) }, // "Then..."
  ],
  7: [ // the probe, flame dying
    { f: F(16.2), s: (f) => dolly([-1.2, -0.35, 3.6], [0, 0.0, 0], pushK(f, F(16.2), 0.003, 0.007, 25), { fov: 40, roll: 0.04 }) },
  ],
  8: [ // the engineer with her laptop: a bug crawls across the screen
    { f: F(17.95), s: (f) => dolly(add(LA, 0.3, 1.36, 2.35), add(LA, 0.02, 1.16, 0), pushK(f, F(17.95), 0.003, 0.006, 25), { fov: 40, roll: -0.03 }) },
  ],
  9: [ // Mercury whole: the probe swings in and the orbit closes behind it
    { f: F(19.95), s: (f) => dolly([60, MERC_Y + 40, 560], [0, MERC_Y + 8, 0], pushK(f, F(19.95), 0.0015), { fov: 44, roll: 0.03 }) },
  ],
  10: [ // mission control cheers
    { f: F(21.8), s: (f) => dolly(Ct(0.3, 1.75, 3.95), Ct(0, 1.85, -3.9), pushK(f, F(21.8), 0.0025, 0.005, 25), { fov: 54, roll: 0.03 }) },
  ],
  11: [ // the planned (dashed) and the real (higher) orbit
    { f: F(24.9), s: (f) => dolly([-50, MERC_Y + 30, 600], [0, MERC_Y + 6, 0], pushK(f, F(24.9), 0.0015), { fov: 44, roll: -0.03 }) },
    { f: F(26.2), dur: 22, s: (f) => dolly([-46, MERC_Y + 40, 640], [0, MERC_Y + 14, 0], pushK(f, F(26.2), 0.0015, 0.004, 25), { fov: 44, roll: 0.02 }) }, // "higher"
  ],
  12: [ // the laptop again: she looks at us, the bug waves
    { f: F(27.6), s: (f) => dolly(add(LA, -0.25, 1.42, 2.15), add(LA, 0.0, 1.22, 0), pushK(f, F(27.6), 0.0035, 0.006, 25), { fov: 40, roll: 0.03 }) },
  ],
  13: [ // the end: the probe circling Mercury, happy
    { f: F(29.1), s: (f) => dolly([90, MERC_Y + 60, 520], [0, MERC_Y + 10, 0], pushK(f, F(29.1), 0.0012), { fov: 44, roll: 0.02 }) },
    { f: F(30.9), dur: 34, s: (f) => { const p = probeAt(13, f / FPS)!.c; return dolly(add(p, 40, 18, 88), add(p, 0, -4, 0), pushK(f, F(30.9), 0.0015), { fov: 44, roll: -0.02 }); } }, // closer: "brakes too late"
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.cut, 0.9], [W.brake, 0.5], [W.pluto, 0.5], [W.engines, 0.8], [W.stopped, 0.6], [W.software, 0.4], [W.caught, 0.7], [W.second, 0.5], [W.higher, 0.4], [W.late, 0.4],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  // the hook: the coughing engine rattles the lens a little
  if (t < 2.75) a += 0.18 * (Math.floor(t * FPS) % 2 ? -1 : 1) * (flameAt(1, t).k < 0.3 ? 1 : 0.2);
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
const probeEyes = (): V3 => [0, 0.05, 0];
export const DOF: Dof[] = [
  { f: 0, cInf: 10, focus: probeEyes },
  { f: F(1.75), dur: 30, cInf: 4, focus: probeEyes },
  { f: F(2.75), cInf: 8, focus: () => Ct(0, 1.2, -1.3) },
  { f: F(4.47), cInf: 0 },
  { f: F(8.7), cInf: 0 },
  { f: F(10.15), cInf: 10, focus: probeEyes },
  { f: F(12.8), cInf: 7, focus: () => Ct(0, 1.2, -1.3) },
  { f: F(16.2), cInf: 11, focus: probeEyes },
  { f: F(17.95), cInf: 13, focus: () => add(LA, 0, 1.35, 0) },
  { f: F(19.95), cInf: 0 },
  { f: F(21.8), cInf: 7, focus: () => Ct(0, 1.3, -1.3) },
  { f: F(24.9), cInf: 0 },
  { f: F(27.6), cInf: 13, focus: () => add(LA, 0, 1.4, 0) },
  { f: F(29.1), cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
