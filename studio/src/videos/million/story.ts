// "One Million Satellites" (25 Nov 2026: US regulators approve up to 1,000,000 solar-powered AI computing satellites):
// timeline timed to ~/day/million/voice/words.json (ElevenLabs George, 30.2 s).
// Places in one scene graph: SPACE at the origin (the hero satellite at 0,0,0 over a cartoon Earth of radius 120, the
// swarm of instanced satellites on shells around it, the Sun far off), the HILL at night (x + 3000: an astronomer and his
// telescope on a hilltop under a starry sky full of satellite trains) and the OFFICE (x - 1100: the old mission-control
// room as the regulator's office: one desk, one regulator, the big wall screen). Camera grammar from the bridge short:
// smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in, impact kicks flip sign and decay over 7 f.
export const FPS = 30;
export const TOTAL = 930;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const CTRL = -1100, HILL = 3000;
/** Earth (cartoon scale): radius 120, centre below the hero satellite */
export const EARTH_R = 120, EARTH_Y = -131;
export const EARTH_C: V3 = [0, EARTH_Y, 0];

// ---------------- story beats (film seconds, from words.json) ----------------
export const W = {
  rocket: 0.44, green: 1.96, light: 2.29, launch: 2.84, one: 3.25, million: 3.49, satellites: 3.97,
  right: 4.81, has: 5.57, eleven: 5.97, thousand: 6.31, up: 6.86,
  each: 7.53, flying: 8.42, computer: 8.84, running: 9.79, ai: 10.3, sunshine: 10.85,
  thats: 11.73, fifty: 12.2, times: 12.58, more: 12.9, satellitesB: 13.16, circle: 14.12, earth: 14.6, today: 15.01,
  astronomers: 15.88, warned: 16.29, wreck: 17.18, view: 17.74, stars: 18.26,
  regulators: 19.23, said: 19.82, not: 20.51, our: 20.73, department: 20.9,
  the: 21.86, part: 22.2, didnt: 22.73, approve: 23.08, where: 23.65, dead: 24.29, ones: 24.55, go: 24.94,
  would: 25.78, trade: 25.94, starsB: 26.37, faster: 26.93, ai2: 27.57, send: 28.08, stargazer: 29.0,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- the hero satellite (a drawn card: gold-foil body, screen face, solar wings, four AI-chip lights) ----------------
export type SatFace = "happy" | "dots" | "closed" | "star" | "curious" | "worried" | "dazed" | "sleepy" | "proud" | "think";
export const faceAt = (id: number, t: number): SatFace => {
  if (id === 3) return at(t, W.sunshine) ? "star" : at(t, W.computer) ? "proud" : "happy";
  if (id === 9) return at(t, W.dead) ? "dazed" : "curious";
  return "happy";
};
export const chipsAt = (id: number, t: number) => {
  if (id === 3) return at(t, W.computer) ? Math.min(4, 1 + Math.floor((t - W.computer + 0.1) * 8)) : 0;
  return 0;
};
export const SAT_S = 1.15; // card scale in close-ups

// ---------------- the swarm (instanced satellites on shells around Earth) ----------------
export const SWARM_MAX = 7000;
export const SWARM_FEW = 140; // "about eleven thousand" in cartoon scale
/** how many swarm satellites are visible in shot id at t */
export const swarmN = (id: number, t: number) => {
  if (id === 2) return SWARM_FEW;
  if (id === 4) return Math.round(SWARM_FEW + (SWARM_MAX - SWARM_FEW) * smooth((t - (W.fifty - 0.1)) / 2.6) ** 1.3);
  return 0;
};

// ---------------- the night sky over the hill: satellite trains ----------------
/** density 0..1 of satellite trains in the night sky */
export const trainK = (id: number, t: number) => {
  if (id === 1) return 0.45 + 0.55 * smooth((t - (W.million - 0.3)) / 1.0);
  if (id === 5) return 0.35 + 0.65 * smooth((t - (W.warned - 0.2)) / 0.9);
  if (id === 6) return smooth((t - 17.45) / 0.9);
  if (id === 10) return 0.9;
  return 0;
};

// ---------------- the hill ----------------
export const ASTRO: V3 = [HILL - 0.55, 0, 0.2]; // the astronomer
export const SCOPE: V3 = [HILL + 0.5, 0, -0.1]; // the telescope tripod foot centre
export const SCOPE_ALT = 0.62, SCOPE_AZ = -0.5; // tube elevation (rad) + yaw
/** the galaxy the astronomer was looking at (shot 6: the eyepiece view) */
export const GALAXY: V3 = [HILL + 60, 120, -160];

// ---------------- the office ----------------
export const REG: V3 = [CTRL, 0, -1.3]; // the regulator (seated at the middle seat)
export type Screen = "approve" | "deny";
export const screenAt = (id: number): Screen => (id === 8 ? "deny" : "approve");

// ---------------- shots ----------------
export type Light = "day" | "golden" | "indoor" | "space" | "night";
export type Place = "space" | "hill" | "ctrl";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.7), light: "night", place: "hill" }, // hook: the sky floods with satellites, the astronomer gapes
  { id: 2, a: F(4.7), b: F(7.45), light: "space", place: "space", sunAz: 120, sunEl: 25 }, // eleven thousand now
  { id: 3, a: F(7.45), b: F(11.65), light: "space", place: "space", sunAz: 125, sunEl: 25 }, // a flying computer running AI on sunshine
  { id: 4, a: F(11.65), b: F(15.7), light: "space", place: "space", sunAz: 120, sunEl: 25 }, // fifty times more
  { id: 5, a: F(15.7), b: F(17.15), light: "night", place: "hill" }, // astronomers warned...
  { id: 6, a: F(17.15), b: F(19.1), light: "night", place: "hill" }, // ...the eyepiece view gets wrecked
  { id: 7, a: F(19.1), b: F(21.75), light: "indoor", place: "ctrl" }, // regulators: not our department
  { id: 8, a: F(21.75), b: F(23.6), light: "indoor", place: "ctrl" }, // the one part they didn't approve?
  { id: 9, a: F(23.6), b: F(25.6), light: "space", place: "space", sunAz: 0, sunEl: -32 }, // where the dead ones go
  { id: 10, a: F(25.6), b: TOTAL, light: "night", place: "hill" }, // would you trade the stars...
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(4.7);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** hero satellite placement for shot id at time t: centre + scale + tilt (null = not in this shot) */
export const satAt = (id: number, t: number): { c: V3; s: number; tilt: number; wings: number } | null => {
  const bob = 0.06 * Math.sin(t * 1.1);
  if (id === 3) return { c: [0, bob, 0], s: SAT_S, tilt: 3 * Math.sin(t * 0.7), wings: 1 };
  if (id === 9) { const u = t - 23.6; return { c: [0.15 * u, -0.32 * u, 0], s: SAT_S, tilt: 18 + 10 * u + 4 * Math.sin(t * 2), wings: 0.55 }; } // tumbling down toward the Sun
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
const Hl = (x: number, y: number, z: number): V3 => [HILL + x, y, z];
const add = (a: V3, x: number, y: number, z: number): V3 => [a[0] + x, a[1] + y, a[2] + z];

const CAMS: Record<number, Key[]> = {
  1: [ // low behind-front of the astronomer: he gapes up at the sky full of satellite trains (sky fills the upper 2/3)
    { f: 0, s: (f) => dolly(Hl(-0.35, 0.75, 3.6), Hl(-0.35, 3.0, -1.2), pushK(f, 0, 0.0015, 0, 0), { fov: 52, roll: 0.03 }) },
    { f: F(3.3), dur: 22, s: (f) => dolly(Hl(-0.38, 0.8, 3.35), Hl(-0.38, 3.1, -1.2), pushK(f, F(3.3), 0.0015, 0.004, 25), { fov: 50, roll: -0.03 }) }, // "million"
  ],
  2: [ // Earth whole with a thin sprinkle of satellites
    { f: F(4.7), s: (f) => dolly([110, EARTH_Y + 70, 860], [0, EARTH_Y + 6, 0], pushK(f, F(4.7), 0.0016), { fov: 44, roll: 0.03 }) },
  ],
  3: [ // CU: the hero satellite over Earth's limb, the Sun to the side
    { f: F(7.45), s: (f) => dolly([1.3, 0.35, 4.3], [0, 0.0, 0], pushK(f, F(7.45), 0.0028), { fov: 40, roll: -0.03 }) },
    { f: F(10.6), dur: 20, s: (f) => dolly([1.0, 0.3, 3.7], [0, 0.05, 0], pushK(f, F(10.6), 0.002, 0.006, 25), { fov: 40, roll: 0.03 }) }, // "sunshine"
  ],
  4: [ // Earth whole: the swarm grows fifty-fold
    { f: F(11.65), s: (f) => dolly([-90, EARTH_Y + 60, 780], [0, EARTH_Y + 4, 0], pushK(f, F(11.65), 0.0014), { fov: 44, roll: -0.03 }) },
    { f: F(12.1), dur: 30, s: (f) => dolly([-100, EARTH_Y + 72, 860], [0, EARTH_Y + 6, 0], pushK(f, F(12.1), 0.0012, 0.004, 25), { fov: 44, roll: 0.02 }) }, // "fifty"
  ],
  5: [ // MS: the astronomer at his telescope eyepiece
    { f: F(15.7), s: (f) => dolly(Hl(-0.62, 1.55, 3.0), Hl(-0.42, 1.5, 0), pushK(f, F(15.7), 0.003, 0.006, 25), { fov: 44, roll: 0.03 }) },
  ],
  6: [ // the eyepiece view: up at the galaxy (a black ring vignette in front of the lens, stage fx)
    { f: F(17.15), s: (f) => dolly(Hl(0.6, 1.5, -0.4), GALAXY, 1, { fov: 26, roll: 0.004 * (f - F(17.15)) }) },
  ],
  7: [ // the regulator at his desk under the wall screen
    { f: F(19.1), s: (f) => dolly(Ct(0.15, 1.9, 2.7), Ct(0, 1.6, -3.9), pushK(f, F(19.1), 0.0025, 0.006, 25), { fov: 48, roll: 0.02 }) },
    { f: F(20.4), dur: 24, s: (f) => dolly(Ct(0.05, 1.85, 1.9), Ct(0, 1.5, -3.9), pushK(f, F(20.4), 0.0025, 0.006, 25), { fov: 46, roll: -0.03 }) }, // "not our department"
  ],
  8: [ // the wall screen turns red
    { f: F(21.75), s: (f) => dolly(Ct(-0.3, 1.9, 2.9), Ct(0, 1.7, -3.9), pushK(f, F(21.75), 0.0025, 0.006, 25), { fov: 48, roll: -0.02 }) },
  ],
  9: [ // looking down past the dead satellite at the giant Sun below
    { f: F(23.6), s: (f) => { const p = satAt(9, f / FPS)!.c; return dolly(add(p, 1.3, 1.5, 4.2), add(p, 0, -0.8, 0), pushK(f, F(23.6), 0.002, 0.006, 25), { fov: 46, roll: 0.04 }); } },
  ],
  10: [ // the end: the astronomer turns to us, the sky streaming behind him
    { f: F(25.6), s: (f) => dolly(Hl(-0.45, 1.3, 2.55), Hl(-0.5, 1.85, -1.0), pushK(f, F(25.6), 0.0018), { fov: 48, roll: 0.02 }) },
    { f: F(28.0), dur: 30, s: (f) => dolly(Hl(-0.45, 1.35, 2.25), Hl(-0.55, 1.95, -0.8), pushK(f, F(28.0), 0.0018, 0.004, 25), { fov: 48, roll: -0.02 }) }, // "send this"
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.million, 0.9], [W.computer, 0.4], [W.sunshine, 0.4], [W.fifty, 0.7], [W.wreck, 0.6], [W.department, 0.5], [W.approve, 0.6], [W.dead, 0.4],
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
const satEyes = (): V3 => [0, 0.05, 0];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: F(4.7), cInf: 0 },
  { f: F(7.45), cInf: 10, focus: satEyes },
  { f: F(11.65), cInf: 0 },
  { f: F(15.7), cInf: 10, focus: () => add(ASTRO, 0, 1.75, 0) },
  { f: F(17.15), cInf: 0 },
  { f: F(19.1), cInf: 7, focus: () => add(REG, 0, 1.2, 0) },
  { f: F(20.4), dur: 24, cInf: 11, focus: () => add(REG, 0, 1.2, 0) },
  { f: F(21.75), cInf: 5, focus: () => add(REG, 0, 1.2, 0) },
  { f: F(23.6), cInf: 0 },
  { f: F(25.6), cInf: 6, focus: () => add(ASTRO, 0, 1.75, 0) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
