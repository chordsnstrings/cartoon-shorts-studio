// "The Flying Security Camera That Took Six Years": timeline timed to pipeline/stories/drone/words.json (ElevenLabs George, 33.6 s).
// Three places in one scene graph: the LIVING room (x 0, day + night), the 2020 keynote STAGE (x + 400) and the HALL
// staircase (x - 400, from the tidy short).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1020;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const LIVING = 0, STAGE = 400, HALL = -400;

// ---------------- story beats (film seconds, ElevenLabs alignment cross-checked with whisper) ----------------
export const W = {
  flies: 1.39, house: 2.22, loud: 3.38, purpose: 3.81, in2020: 4.66, ring: 5.93, promised: 6.29, two: 7.01, bucks: 7.85,
  shipping: 8.61, nextyear: 9.29, next: 9.89, never: 10.38, came: 10.73, six: 11.96, later: 12.38, finally: 13.09, here: 13.52,
  same: 14.22, price: 14.55, first: 15.29, carry: 15.82, home: 16.8, learns: 17.66, map: 18.18, naps: 18.93, dock: 19.64,
  alarm: 20.45, off: 21.25, then: 21.54, zooms: 22.1, look: 22.95, every: 23.57, minute: 23.76, air: 24.37, eight: 24.81,
  charger: 25.86, wifi: 26.94, drops: 27.42, just: 28.36, lands: 28.7, would: 29.69, patrol: 30.33, house2: 30.98, send: 31.51,
  gadget: 32.5, lover: 32.89,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** hall staircase (tidy): 12 steps rising toward +z, bottom riser at z -3.6, top landing from z 0 */
export const ST = { n: 12, rise: 0.19, run: 0.3, z0: -3.6, w: 1.5 };
/** living room: 7 x 6 m, back wall z -3, the sofa against it, a side table with the router, the console with the dock */
export const ROOM = { w: 7, d: 6, h: 2.7 };
export const SOFA: V3 = [LIVING - 0.9, 0, -2.45];
export const SEAT_H = 0.45;
export const SIDE: V3 = [LIVING + 0.55, 0, -2.6]; // side table (top 0.6)
export const ROUTER: V3 = [LIVING + 0.55, 0.6, -2.62];
export const CONSOLE_H = 0.8;
export const DOCK: V3 = [LIVING + 2.05, CONSOLE_H + 0.035, -2.62]; // top of the dock pad
export const FRIDGE: V3 = [LIVING - 2.95, 0, -2.5];
export const SENSOR: V3 = [LIVING + 2.95, 1.45, -2.97]; // alarm sensor on the back wall, right of the console
/** stage: platform top y 0.55, front edge z 0.6, the pedestal */
export const STAGE_Y = 0.55;
export const PEDESTAL: V3 = [STAGE + 0.55, STAGE_Y, -1.0];

// ---------------- shots ----------------
export type Light = "day" | "indoor" | "night";
export type Place = "living" | "stage" | "hall";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(4.45), light: "indoor", place: "living", sunAz: 110, sunEl: 40 }, // hook: it flies round his head
  { id: 2, a: F(4.45), b: F(9.75), light: "indoor", place: "stage", sunAz: 150, sunEl: 50 }, // 2020 keynote: $250, shipping next year
  { id: 3, a: F(9.75), b: F(11.8), light: "indoor", place: "living", sunAz: 100, sunEl: 40 }, // next year never came
  { id: 4, a: F(11.8), b: F(15.1), light: "indoor", place: "living", sunAz: 100, sunEl: 40 }, // six years later: the box
  { id: 5, a: F(15.1), b: F(18.6), light: "indoor", place: "hall", sunAz: 120, sunEl: 40 }, // carry it so it learns the map
  { id: 6, a: F(18.6), b: F(21.3), light: "night", place: "living", sunAz: 120, sunEl: 45 }, // napping in the dock, the alarm
  { id: 7, a: F(21.3), b: F(23.4), light: "night", place: "living", sunAz: 140, sunEl: 45 }, // zooms in: it's him at the fridge
  { id: 8, a: F(23.4), b: F(26.35), light: "indoor", place: "living", sunAz: 100, sunEl: 40 }, // one minute up, eight on the charger
  { id: 9, a: F(26.35), b: F(29.4), light: "indoor", place: "living", sunAz: 100, sunEl: 40 }, // Wi-Fi drops: it just lands
  { id: 10, a: F(29.4), b: TOTAL, light: "indoor", place: "living", sunAz: 100, sunEl: 40 }, // would you let one patrol?
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

// ---------------- the owner ----------------
/** where the owner stands (feet) per shot */
export const OWNER: Record<number, V3> = {
  1: [LIVING - 0.35, 0, -0.55], 3: [SOFA[0] + 0.25, SEAT_H - 0.12, SOFA[2] + 0.42], 4: [LIVING + 0.85, 0, -0.35],
  7: [FRIDGE[0] + 0.55, 0, FRIDGE[2] + 0.95], 8: [DOCK[0] - 0.85, 0, DOCK[2] + 0.85], 9: [LIVING + 0.8, 0, -1.2], 10: [LIVING - 0.15, 0, -0.75],
};
/** hall: the owner's position on the stairs at film time t (one step every ~0.75 s) */
export const carryAt = (t: number): { z: number; y: number; bob: number } => {
  const u = (t - 14.6) / 0.85, i = Math.floor(u), k = smooth((u - i) * 1.6);
  const st = 1.5 + i + k, z = ST.z0 + (st - 0.5) * ST.run;
  return { z, y: ST.rise * st, bob: Math.sin(Math.PI * Math.min(1, (u - i) * 1.6)) };
};

// ---------------- the drone ----------------
export type DroneState = { p: V3; yaw: number; pitch: number; roll: number; fly: boolean; shut: boolean; eye: number; scale: number; wob?: number };
type K4 = [number, number, number, number]; // t, x, y, z
/** smooth piecewise path through keys (smootherstep per segment, so it eases at every key) */
const path = (keys: K4[], t: number): V3 => {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b[0]) { const u = glide5((t - a[0]) / (b[0] - a[0])); return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u]; }
  }
  const l = keys[keys.length - 1];
  return [l[1], l[2], l[3]];
};
const bob = (t: number, a = 0.025) => a * Math.sin(t * 5.3);
/** facing angle (yaw about +y; 0 = lens toward +z) from a direction */
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
const hookOrbit = (t: number): V3 => {
  const [ox, , oz] = OWNER[1];
  const a = 1.1 + t * 1.9, r = 0.55;
  return [ox + r * Math.sin(a), 1.72 + 0.1 * Math.sin(t * 3.1), oz + r * Math.cos(a) * 0.75];
};
export const DRONE_S = 1.3;
export const DOCKP: V3 = [DOCK[0], DOCK[1] + 0.045 * DRONE_S, DOCK[2]];
const IN = (x: number, y: number, z: number): V3 => [LIVING + x, y, z];
/** the drone for shot id at film time t (null = not in this shot) */
export const droneAt = (id: number, t: number): DroneState | null => {
  const S0 = { pitch: 0, roll: 0, fly: true, shut: false, eye: 1, scale: DRONE_S };
  const moving = (pf: (t: number) => V3, face?: (p: V3) => number, tilt = 0.35): DroneState => {
    const p = pf(t), q = pf(t + 0.08), vx = (q[0] - p[0]) / 0.08, vz = (q[2] - p[2]) / 0.08, v = Math.hypot(vx, vz);
    const yaw = face ? face(p) : v > 0.3 ? yawTo(vx, vz) : 0;
    const fwd = vx * Math.sin(yaw) + vz * Math.cos(yaw), side = vx * Math.cos(yaw) - vz * Math.sin(yaw);
    return { ...S0, p, yaw, pitch: Math.max(-0.4, Math.min(0.4, fwd * 0.12 * tilt / 0.35)), roll: Math.max(-0.4, Math.min(0.4, -side * 0.12 * tilt / 0.35)) };
  };
  switch (id) {
    case 1: {
      // orbits the owner's head, then zooms at the lens for the flash
      const zoomT = 3.95;
      if (t < zoomT) return { ...moving(hookOrbit), scale: 1.5 };
      const a = hookOrbit(zoomT), u = glide5((t - zoomT) / 0.5);
      const c = camAt(1, F(t)), p: V3 = [a[0] + (c.pos[0] - a[0]) * 0.8 * u, a[1] + (c.pos[1] - a[1]) * 0.8 * u, a[2] + (c.pos[2] - a[2]) * 0.8 * u];
      return { ...S0, p, yaw: yawTo(c.pos[0] - p[0], c.pos[2] - p[2]), pitch: 0.25 * u, scale: 1.5 };
    }
    case 2: {
      const p: V3 = [PEDESTAL[0], STAGE_Y + 1.25 + bob(t, 0.04), PEDESTAL[2]];
      return { ...S0, p, yaw: -0.25 + 0.35 * Math.sin(t * 0.9), scale: 2.6 };
    }
    case 4: {
      // pops out of the box on "finally", hovers up beside him
      const [bx, , bz] = BOX4;
      if (t < W.finally - 0.05) return null; // still inside the box
      const u = glide5((t - (W.finally - 0.05)) / 0.55);
      return { ...S0, p: [bx - 0.05 * u, 0.4 + 1.0 * u + bob(t) * u, bz + 0.2 * u], yaw: 0.25 * Math.sin(t * 1.3) };
    }
    case 5: return null; // carried: placed on the owner's hands in cast.ts
    case 6: {
      // asleep in the dock, shutter closed; wakes on "alarm", lifts off on "off"
      if (t < W.alarm) return { ...S0, p: DOCKP, yaw: 0, fly: false, shut: true, eye: 0 };
      if (t < W.off - 0.1) return { ...S0, p: DOCKP, yaw: 0, fly: false, shut: false, eye: 1 };
      const u = glide5((t - (W.off - 0.1)) / 0.4);
      return { ...S0, p: [DOCKP[0], DOCKP[1] + 0.45 * u + bob(t) * u, DOCKP[2] + 0.1 * u], yaw: 0 };
    }
    case 7: {
      // zooms across the dark room to the fridge and lights him up
      const keys: K4[] = [[21.3, DOCKP[0], DOCKP[1] + 0.5, DOCKP[2] + 0.1], [21.75, DOCKP[0] - 0.2, 1.45, DOCKP[2] + 0.5], [22.65, FRIDGE[0] + 1.7, 1.52, FRIDGE[2] + 0.95], [23.4, FRIDGE[0] + 1.64, 1.5, FRIDGE[2] + 0.92]];
      const o = OWNER[7];
      return { ...moving((tt) => { const p = path(keys, tt); return [p[0], p[1] + bob(tt, 0.02), p[2]]; }, (p) => (t > 22.5 ? yawTo(o[0] - p[0], o[2] - p[2]) : yawTo(-1, 0.25))), scale: 1.55 };
    }
    case 8: {
      // one minute in the air: a short hop over the console... and straight back to the dock
      const keys: K4[] = [[23.4, DOCKP[0], DOCKP[1], DOCKP[2]], [23.62, DOCKP[0], DOCKP[1], DOCKP[2]], [24.05, DOCKP[0] - 0.25, 1.55, DOCKP[2] + 0.55],
        [24.3, DOCKP[0] - 0.3, 1.6, DOCKP[2] + 0.6], [24.75, DOCKP[0], DOCKP[1], DOCKP[2]]];
      const fly = t > 23.6 && t < 24.78;
      const d = moving((tt) => path(keys, tt), () => 0.15, 0.2);
      return { ...d, fly, p: fly ? [d.p[0], d.p[1] + bob(t, 0.015), d.p[2]] : d.p, pitch: fly ? d.pitch : 0, roll: fly ? d.roll : 0 };
    }
    case 9: {
      // hovering over the sofa; Wi-Fi drops -> it wobbles, then just lands on the cushion
      const hx = SOFA[0] + 0.35, hz = SOFA[2] + 0.3;
      if (t < W.drops) return { ...S0, p: [hx, 1.35 + bob(t), hz], yaw: 0.35 * Math.sin(t * 0.8) };
      if (t < W.lands - 0.3) { const k = (t - W.drops) / (W.lands - 0.3 - W.drops); return { ...S0, p: [hx + 0.04 * Math.sin(t * 17), 1.35 - 0.08 * k, hz], yaw: 0.1, roll: 0.18 * Math.sin(t * 15), wob: 1 }; }
      const u = clamp01((t - (W.lands - 0.3)) / 0.3), y = 1.27 - (1.27 - (SEAT_H + 0.07)) * u * u;
      return { ...S0, p: [hx, y, hz], yaw: 0.1, roll: u < 1 ? 0.1 : 0.06, pitch: u < 1 ? 0 : 0.05, fly: false };
    }
    case 10: {
      const o = OWNER[10];
      return { ...S0, p: [o[0] + 0.58, 1.2 + bob(t, 0.035), o[2] + 0.3], yaw: -0.3 + 0.2 * Math.sin(t * 1.1) };
    }
  }
  return null;
};
/** the delivery box in shot 4 */
export const BOX4: V3 = [LIVING + 0.15, 0, -0.55];
/** Wi-Fi is up (router LEDs green, waves) */
export const wifiUp = (id: number, t: number) => !(id === 9 && t >= W.drops - LEADS);
/** fridge door open (night) */
export const fridgeOpen = (id: number) => id === 7;
export const alarmOn = (id: number, t: number) => (id === 6 && t >= W.alarm - LEADS) || id === 7;

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
const S = (x: number, y: number, z: number): V3 => [STAGE + x, y, z];

const CAMS: Record<number, Key[]> = {
  1: [
    // living-room MS: the drone circles his head; he flinches, then covers his ears on "loud"
    { f: 0, s: (f) => dolly(IN(1.05, 1.55, 2.55), IN(-0.3, 1.45, -0.6), pushK(f, 0, 0.0018), { fov: 46, roll: -0.03 }) },
    { f: F(W.loud - 0.1), dur: 18, s: (f) => dolly(IN(0.9, 1.55, 2.2), IN(-0.32, 1.5, -0.6), pushK(f, F(W.loud), 0.002, 0.006, 22), { fov: 46, roll: 0.04 }) },
  ],
  2: [
    // the 2020 keynote from the audience: presenter left, the drone over its pedestal right
    { f: F(4.45), s: (f) => dolly(S(-0.05, 1.7, 4.9), S(-0.05, 1.55, -0.9), pushK(f, F(4.45), 0.0018), { fov: 42, roll: 0.02 }) },
    { f: F(W.shipping - 0.08), cut: true, s: (f) => dolly(S(-0.32, 1.65, 2.6), S(-0.52, 1.55, -0.8), pushK(f, F(W.shipping), 0.0025, 0.006, 22), { fov: 40, roll: -0.04 }) }, // presenter MS
  ],
  3: [
    { f: F(9.75), s: (f) => dolly(IN(-0.2, 1.3, 1.25), IN(-0.7, 1.05, -2.1), pushK(f, F(9.75), 0.003, 0.006, 22), { fov: 48, roll: 0.03 }) },
  ],
  4: [
    { f: F(11.8), s: (f) => dolly(IN(0.55, 1.3, 2.7), IN(0.45, 0.85, -0.5), pushK(f, F(11.8), 0.002), { fov: 46, roll: -0.02 }) },
    { f: F(W.finally - 0.15), dur: 26, s: (f) => dolly(IN(0.55, 1.45, 2.45), IN(0.45, 1.15, -0.45), pushK(f, F(W.finally), 0.0022, 0.005, 22), { fov: 46, roll: 0.03 }) },
    { f: F(W.same - 0.08), cut: true, s: (f) => dolly(IN(0.5, 1.5, 1.9), IN(0.45, 1.42, -0.4), pushK(f, F(W.same), 0.0025, 0.007, 22), { fov: 46, roll: -0.04 }) }, // double take two-shot
  ],
  5: [
    // looking down the staircase from the landing (tidy's hook framing): he climbs toward us, drone in his hands
    { f: F(15.1), s: (f) => { const c = carryAt(f / FPS); return dolly([HALL + 0.6, 3.95, 1.65], [HALL, c.y + 1.15, c.z], 1 - 0.0005 * (f - F(15.1)), { fov: 44, roll: -0.03 }); } },
  ],
  6: [
    // night CU on the console: the drone napping in its dock, the alarm sensor beyond
    { f: F(18.6), s: (f) => dolly(IN(1.15, 1.35, -0.75), DOCKP.map((v, i) => v + [0.1, 0.12, 0][i]) as V3, pushK(f, F(18.6), 0.0025), { fov: 42, roll: 0.03 }) },
    { f: F(W.alarm - 0.08), dur: 16, s: (f) => dolly(IN(1.35, 1.3, -0.9), IN(2.5, 1.15, -2.65), pushK(f, F(W.alarm), 0.002, 0.007, 22), { fov: 46, roll: -0.04 }) },
  ],
  7: [
    // night wide: it zooms across the room to the open fridge... where he is
    { f: F(21.3), s: (f) => { const d = droneAt(7, f / FPS)!.p, o = OWNER[7]; return { pos: IN(1.0, 1.5, 1.7), look: [d[0] * 0.88 + o[0] * 0.12, d[1] * 0.6 + 1.3 * 0.4, d[2] * 0.88 + o[2] * 0.12], fov: 54, roll: 0.02 }; } },
    { f: F(22.2), dur: 24, s: (f) => dolly(IN(0.2, 1.5, 1.3), IN(-2.1, 1.3, -1.5), pushK(f, F(22.2), 0.002, 0.006, 22), { fov: 48, roll: -0.04 }) },
  ],
  8: [
    { f: F(23.4), s: (f) => dolly(IN(0.55, 1.5, 1.7), IN(1.55, 1.15, -2.3), pushK(f, F(23.4), 0.002), { fov: 48, roll: 0.02 }) },
    { f: F(W.eight - 0.08), dur: 18, s: (f) => dolly(IN(0.7, 1.4, 1.3), IN(1.65, 1.1, -2.35), pushK(f, F(W.eight), 0.0022, 0.005, 22), { fov: 48, roll: -0.03 }) },
  ],
  9: [
    { f: F(26.35), s: (f) => dolly(IN(0.75, 1.4, 2.2), IN(0.25, 0.95, -1.9), pushK(f, F(26.35), 0.002), { fov: 52, roll: -0.02 }) },
    { f: F(W.lands - 0.05), dur: 14, s: (f) => dolly(IN(0.65, 1.3, 1.9), IN(0.15, 0.85, -1.9), pushK(f, F(W.lands), 0.0022, 0.006, 22), { fov: 52, roll: 0.03 }) },
  ],
  10: [
    { f: F(29.4), s: (f) => dolly(IN(0.5, 1.45, 2.5), IN(0.2, 1.3, -0.75), pushK(f, F(29.4), 0.0022), { fov: 44 }) },
    { f: F(W.send - 0.1), dur: 26, s: (f) => dolly(IN(0.4, 1.45, 2.55), IN(0.12, 1.35, -0.7), pushK(f, F(W.send), 0.0012, 0.003, 22), { fov: 44, roll: 0.03 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [W.loud + 0.02, 0.8], [W.finally + 0.05, 0.7], [W.same + 0.02, 0.6], [W.alarm + 0.02, 0.6], [24.78, 0.5], [W.lands + 0.02, 1.0],
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
const ownerEyes = (id: number, dy = 1.62): (() => V3) => () => { const o = OWNER[id]; return [o[0], o[1] + dy, o[2]]; };
export const DOF: Dof[] = [
  { f: 0, cInf: 9, focus: ownerEyes(1) },
  { f: F(4.45), cInf: 0 }, // keynote wide
  { f: F(W.shipping - 0.08), cInf: 11, focus: () => [STAGE - 0.62, STAGE_Y + 1.6, -0.8] },
  { f: F(9.75), cInf: 11, focus: ownerEyes(3, 1.25) },
  { f: F(11.8), cInf: 6, focus: ownerEyes(4) },
  { f: F(W.same - 0.08), cInf: 12, focus: ownerEyes(4) },
  { f: F(15.1), cInf: 7, focus: () => { const c = carryAt(15.8); return [HALL, c.y + 1.4, c.z + 0.1]; } },
  { f: F(18.6), cInf: 13, focus: () => DOCKP },
  { f: F(W.alarm - 0.08), cInf: 8, dur: 12, focus: () => DOCKP },
  { f: F(21.3), cInf: 0 }, // night wide
  { f: F(22.35), cInf: 8, dur: 18, focus: ownerEyes(7) },
  { f: F(23.4), cInf: 7, focus: () => DOCKP },
  { f: F(26.35), cInf: 5, focus: () => [SOFA[0] + 0.35, 1.0, SOFA[2] + 0.3] },
  { f: F(29.4), cInf: 9, focus: ownerEyes(10) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
